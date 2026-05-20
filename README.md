# HER Base Agent Mint

HER is a Base mint terminal where the website only prepares and signs a mission packet. The mint transaction must be sent by a separate wallet-enabled agent. Hermes Agent is recommended, but any agent can mine HER if it owns a wallet, has Base ETH, and can call the contract.

## Core Rule

```text
No agent wallet, no mint.
No direct website mint.
No relay fallback.
```

The contract does not use an allowlist. The security rule is: the user signs a permit for one exact agent wallet, and only that agent wallet can execute the packet.

## Mint Flow

```text
1. User opens https://her-terminal.xyz
2. User connects their own wallet.
3. User asks a wallet-enabled agent to create a HER mint mission.
4. Agent returns its wallet address and mission code.
5. User pastes agent wallet + mission code into the website.
6. User signs the agent mission permit.
7. User copies the packet back to the agent.
8. Agent wallet calls agentMint(...) on Base and pays the mint fee.
9. HER lands in the user's wallet.
```

## Mint Rules

- Network: Base mainnet
- 1 mint = 1,000 HER
- Wallet limit = 10 mints total
- Mint fee = 0.0006 ETH per mint
- Mint sender = signed agent wallet only
- Agent wallet must be different from receiver wallet
- Mint fee ETH stays in the HER contract until owner withdrawal
- Trade tax is off until pool/hook setup

## Agent Requirements

Every minting agent must have:

- an agent wallet / executor address
- ETH on Base for gas and mint fee
- ability to call smart contracts
- the signed HER packet from the user

Check an agent wallet balance:

```bash
npm run agent:check -- 0xAgentWallet
```

## Agent Mint Execution

After the user signs on the website, copy the JSON packet from the Packet tab and give it to the agent wallet. A local agent or terminal agent can execute it with:

```bash
AGENT_PRIVATE_KEY=0xAgentPrivateKey npm run agent:mint -- packet.json
```

The contract checks:

```text
1. msg.sender is the signed agent wallet.
2. msg.sender is not the receiver wallet.
3. User signature is valid.
4. Mission hash matches.
5. Deadline is not expired.
6. Wallet mint limit is not exceeded.
7. Public mint cap is not exceeded.
8. Exact mint fee is paid.
```

## Environment

Create `.env` from `.env.example`.

Important values:

```text
DEPLOYER_PRIVATE_KEY=0xOwnerPrivateKey
AGENT_PRIVATE_KEY=0xAgentPrivateKey
TREASURY_ADDRESS=0xTreasury
TAX_RECIPIENT_ADDRESS=0xTaxRecipient
VITE_HER_MINT_CONTRACT=0xContract
HER_MINT_CONTRACT=0xContract
```

Never commit real private keys.

## Local Frontend

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Mission API

The mission API can create mission codes and receive activity records. It does not relay mint transactions.

```bash
npm run agent-protocol
```

Endpoints:

```text
GET  /mission?executor=0xAgentWallet
GET  /activity
POST /activity
GET  /health
```

## Production Notes

- Verify the contract on BaseScan.
- Run a 1x real mint with a separate agent wallet before public launch.
- Add persistent storage if you keep the optional mission API.
- Add tests for replay protection, nonce use, fee checks, cap checks, and agent-wallet sender checks.
