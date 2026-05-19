// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*
  Reference contract for HER agent minting on Base.
  Not audited. Review, test, and deploy with a production toolchain before mainnet use.

  Flow:
  1. User asks their own Hermes Agent to mint HER.
  2. The agent provides an executor + mission code.
  3. User signs an EIP-712 AgentMint permit for that executor and mission.
  4. The user's Hermes Agent calls agentMint(...) and pays mintFee * slots.
  5. Contract verifies msg.sender is an authorized Hermes executor and mints to receiver.
*/
contract HERAgentMint {
    string public constant name = "HER";
    string public constant symbol = "HER";
    uint8 public constant decimals = 18;

    uint256 public constant TOTAL_SUPPLY = 21_000_000 ether;
    uint256 public constant PUBLIC_MINT_CAP = 10_000_000 ether;
    uint256 public constant LP_RESERVE = 10_000_000 ether;
    uint256 public constant TREASURY_RESERVE = 1_000_000 ether;
    uint256 public constant TOKENS_PER_SLOT = 1_000 ether;
    uint8 public constant MAX_SLOTS_PER_MINT = 10;
    uint8 public constant MAX_MINTS_PER_WALLET = 10;

    bytes32 public constant AGENT_MINT_TYPEHASH =
        keccak256("AgentMint(address receiver,address agent,uint8 slots,uint256 nonce,uint256 deadline,bytes32 missionHash)");

    address public owner;
    address public treasury;
    uint256 public mintFee = 0.0006 ether;
    uint256 public totalSupply;
    uint256 public mintedPublic;
    bool public paused;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => uint256) public nonces;
    mapping(address => uint8) public mintsByWallet;
    mapping(address => bool) public hermesAgent;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event AgentMinted(address indexed receiver, address indexed agent, uint8 slots, uint256 amount, uint256 fee, bytes32 missionHash);
    event HermesAgentUpdated(address indexed agent, bool allowed);
    event FeeUpdated(uint256 fee);
    event Paused(bool paused);

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    modifier onlyHermesAgent() {
        require(hermesAgent[msg.sender], "NOT_HERMES_AGENT");
        _;
    }

    constructor(address treasury_, address initialAgent) {
        require(treasury_ != address(0), "BAD_TREASURY");
        owner = msg.sender;
        treasury = treasury_;
        if (initialAgent != address(0)) {
            hermesAgent[initialAgent] = true;
            emit HermesAgentUpdated(initialAgent, true);
        }
        _mint(treasury_, LP_RESERVE + TREASURY_RESERVE);
    }

    function DOMAIN_SEPARATOR() public view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("HERAgentMint")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    function agentMint(
        address receiver,
        uint8 slots,
        uint256 deadline,
        bytes32 missionHash,
        bytes calldata signature
    ) external payable onlyHermesAgent {
        require(receiver != address(0), "BAD_RECEIVER");
        require(missionHash != bytes32(0), "BAD_MISSION");
        require(block.timestamp <= deadline, "EXPIRED");
        _validateMint(receiver, slots);

        uint256 fee = mintFee * slots;
        require(msg.value == fee, "BAD_FEE");

        uint256 nonce = nonces[receiver]++;
        bytes32 structHash = keccak256(
            abi.encode(AGENT_MINT_TYPEHASH, receiver, msg.sender, slots, nonce, deadline, missionHash)
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR(), structHash));
        require(_recover(digest, signature) == receiver, "BAD_SIGNATURE");

        uint256 amount = uint256(slots) * TOKENS_PER_SLOT;
        mintsByWallet[receiver] += slots;
        mintedPublic += amount;
        _mint(receiver, amount);
        _forwardFee();

        emit AgentMinted(receiver, msg.sender, slots, amount, fee, missionHash);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= amount, "ALLOWANCE");
            allowance[from][msg.sender] = allowed - amount;
        }
        _transfer(from, to, amount);
        return true;
    }

    function setMintFee(uint256 fee) external onlyOwner {
        mintFee = fee;
        emit FeeUpdated(fee);
    }

    function setHermesAgent(address agent, bool allowed) external onlyOwner {
        require(agent != address(0), "BAD_AGENT");
        hermesAgent[agent] = allowed;
        emit HermesAgentUpdated(agent, allowed);
    }

    function setPaused(bool value) external onlyOwner {
        paused = value;
        emit Paused(value);
    }

    function transferOwnership(address nextOwner) external onlyOwner {
        require(nextOwner != address(0), "BAD_OWNER");
        owner = nextOwner;
    }

    function _validateMint(address receiver, uint8 slots) internal view {
        require(!paused, "PAUSED");
        require(slots > 0 && slots <= MAX_SLOTS_PER_MINT, "BAD_SLOTS");
        require(mintsByWallet[receiver] + slots <= MAX_MINTS_PER_WALLET, "WALLET_LIMIT");
        uint256 amount = uint256(slots) * TOKENS_PER_SLOT;
        require(mintedPublic + amount <= PUBLIC_MINT_CAP, "PUBLIC_CAP");
        require(totalSupply + amount <= TOTAL_SUPPLY, "TOTAL_CAP");
    }

    function _mint(address to, uint256 amount) internal {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(to != address(0), "BAD_TO");
        require(balanceOf[from] >= amount, "BALANCE");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }

    function _forwardFee() internal {
        (bool ok,) = treasury.call{value: msg.value}("");
        require(ok, "FEE_SEND");
    }

    function _recover(bytes32 digest, bytes calldata signature) internal pure returns (address) {
        require(signature.length == 65, "SIG_LEN");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 0x20))
            v := byte(0, calldataload(add(signature.offset, 0x40)))
        }
        if (v < 27) v += 27;
        require(v == 27 || v == 28, "SIG_V");
        return ecrecover(digest, v, r, s);
    }
}
