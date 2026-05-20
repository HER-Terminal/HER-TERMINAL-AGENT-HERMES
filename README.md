# HER Base Agent Mint

HER is a Base mint experience where the website is only a signing terminal. The actual mint transaction must be sent by an authorized wallet-enabled agent. Hermes Agent is the recommended route, but any agent can mine HER if it owns a wallet, has Base ETH, and is authorized in the HER contract.

## Core Rule

```text
No agent wallet, no mint.
No direct website mint.
No relay fallback.
```

## Mint Flow

```text
1. User opens https://her-terminal.xyz
2. User connects their wallet.
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
- Contract: `0x5d2Dedb1B6519Cad138A6687D10A9616B83dFA0a`
- 1 mint = 1,000 HER
- Wallet limit = 10 mints total
- Mint fee = 0.0006 ETH per mint
- Mint sender = authorized agent wallet only
- Mint fee ETH stays in the HER contract until owner withdrawal
- Trade tax is off until pool/hook setup

## Agent Requirements

Every minting agent must have:

- an agent wallet / executor address
- ETH on Base for gas and mint fee
- ability to call smart contracts
- authorization in the HER contract

Authorize an agent wallet:

```bash
npm run agent:authorize -- 0xAgentWallet
```

Check an agent wallet:

```bash
npm run agent:check -- 0xAgentWallet
```

Revoke an agent wallet:

```bash
npm run agent:authorize -- 0xAgentWallet --revoke
```

## Agent Mint Execution

After the user signs on the website, copy the JSON packet from the Agent tab and give it to the agent wallet. A local agent can execute it with:

```bash
AGENT_PRIVATE_KEY=0xAgentPrivateKey npm run agent:mint -- packet.json
```

The contract checks:

```text
1. msg.sender is an authorized agent wallet.
2. User signature is valid.
3. Agent wallet matches the signed permit.
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
VITE_HER_MINT_CONTRACT=0x5d2Dedb1B6519Cad138A6687D10A9616B83dFA0a
HER_MINT_CONTRACT=0x5d2Dedb1B6519Cad138A6687D10A9616B83dFA0a
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
- Add an event indexer for real `AgentMinted` activity.
- Add persistent storage for missions/activity.
- Add owner/admin UI for agent authorization.
- Add tests for replay protection, nonce use, fee checks, cap checks, and authorization.
