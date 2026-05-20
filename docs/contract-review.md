# HER Contract Pre-Launch Review

Review date: 2026-05-20

Contract: `HERAgentMint`

Deployed Base address:

```text
0xAc13853FF1f9ac4fE51d2e191C7D8ed7d0Ad04dD
```

BaseScan status:

```text
Verified
```

## Launch Rule

HER is not a direct website mint. A mint needs:

1. Receiver wallet signs an EIP-712 mission permit.
2. Agent wallet sends `agentMint(...)`.
3. Contract checks `msg.sender` is the signed agent wallet.
4. Contract mints HER to the receiver wallet.

The contract does not prove that a wallet belongs to Hermes, Telegram, or any specific AI agent. The enforceable on-chain rule is: a separate wallet-enabled agent address must execute the signed mission.

## Checks Passed

- `agentMint` requires receiver is not zero.
- `agentMint` requires `msg.sender != receiver`, so the receiver cannot direct-mint from the same wallet.
- `agentMint` requires a nonzero mission hash.
- `agentMint` requires a valid deadline.
- User nonce is consumed inside the signed digest, preventing replay after a successful mint.
- Signature binds receiver, agent wallet, slots, nonce, deadline, and mission hash.
- Mint fee must equal `mintFee * slots`.
- Mint count must be 1-10.
- Receiver wallet limit is 10 mints.
- Public mint cap is 10,000,000 HER.
- LP reserve cannot be moved until public mint is fully minted out.
- Mint fees stay in the contract until owner withdrawal.
- Owner can pause minting.
- Trade tax is off by default.
- Trade tax is 1% when enabled and only applies through owner-marked taxable trade routes.

## Centralized Owner Powers

These are intentional admin powers, but they should be disclosed before launch:

- Owner can withdraw mint fee ETH at any time.
- Owner can change mint fee.
- Owner can pause minting.
- Owner can enable or disable trade tax.
- Owner can mark trade routes as taxable.
- Owner can set tax exemptions.
- Owner can set tax recipient.
- Owner can unlock and transfer LP reserve only after mint-out.
- Owner can transfer ownership.

## Risk Notes

1. Not a formal third-party audit.
   This is an internal review. A public launch with high value should still get an external Solidity audit.

2. Agent identity is wallet-based.
   The contract cannot know whether an address is really Hermes. The product narrative should say "wallet-enabled agent" and "Hermes recommended", not "only Hermes cryptographically".

3. Signature malleability.
   `_recover` validates `v` and signature length, but does not enforce low-s ECDSA signatures. Replay is still blocked by nonce after success, but using OpenZeppelin ECDSA would be cleaner in a future redeploy.

4. Exact fee only.
   `agentMint` requires exact ETH. If the agent sends too much or too little, the transaction reverts.

5. Tax route setup happens later.
   Trade tax does nothing until `tradeTaxEnabled` is true and pool/router addresses are marked as taxed trade routes.

6. No rescue function for ERC-20 tokens sent to the contract.
   ETH fees can be withdrawn. Random ERC-20s sent to the contract are not recoverable unless future code is deployed.

## Recommended Before Public Mint

1. Keep the verified BaseScan link visible in docs/community posts.
2. Run another 1x mint from a real user-owned agent wallet, not only a dev test wallet.
3. Decide and publish the owner wallet policy: multisig, hardware wallet, or timelock plan.
4. Publish the admin powers clearly so users understand fee withdrawal and tax controls.
5. If mint size becomes large, get an external audit before heavy promotion.
6. Before opening Uniswap, set taxable route addresses carefully and test with a tiny pool first.

