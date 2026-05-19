# HER Base Agent Mint

HER is a Base mint experience for user-owned Hermes Agents. Users do not mint directly from the website and they do not need to use a project-owned chat relay. A user tells their own Hermes Agent to mint HER, signs a permit on the website, then that same agent routes the mint.

## What Is Included

- React + Vite frontend in `src/main.jsx`
- Black and white terminal UI in `src/styles.css`
- HER logo and favicon in `public/her-logo.svg` and `public/favicon.svg`
- Live agent mint activity panel on the main page
- Base mint contract reference in `contracts/HermesAgentMint.sol`
- HER Agent Protocol service in `server/her-agent-protocol.js`
- Hermes Agent instruction file in `docs/her-agent-instructions.md`
- Environment template in `.env.example`

## The Mint Concept

The user says this to their own Hermes Agent:

```text
Mint HER on Base for my wallet.
```

The Hermes Agent then:

1. Requests a mission from the HER Agent Protocol.
2. Gives the user a mission code and executor address.
3. Sends the user to the HER website to sign a permit.
4. Receives the packet from the user.
5. Executes `agentMint(...)` from its authorized executor wallet, or uses the protocol relay fallback.
6. Returns the BaseScan transaction link.

HER mints to the user's wallet, not to the agent.

## Mint Rules

- 1 mint = 1,000 HER
- Wallet limit = 10 mints total
- Mint fee = 0.0006 ETH per mint
- Mint route = user-owned Hermes Agent only

## Local Frontend

```bash
npm install
npm run dev
```

## Base Mainnet Setup

The project is configured for Base mainnet by default.

Network values:

```text
Network: Base
Chain ID: 8453
RPC: https://mainnet.base.org
Explorer: https://basescan.org
Currency: ETH
```

What you need before a real mainnet mint:

1. A deployer wallet.
2. ETH on Base for deployment and gas.
3. A treasury address.
4. A Hermes Agent executor address.
5. Optional relay wallet if some user-owned Hermes Agents cannot send transactions.

Create `.env` from `.env.example`, then fill:

```text
DEPLOYER_PRIVATE_KEY=0x...
TREASURY_ADDRESS=0xYourTreasury
INITIAL_HERMES_AGENT=0xYourFirstHermesExecutor
```

Deploy to Base mainnet:

```bash
npm run deploy:mainnet
```

After deploy, copy the printed address into:

```text
VITE_HER_MINT_CONTRACT=0x...
HER_MINT_CONTRACT=0x...
```

Then restart the frontend and protocol service.

## HER Agent Protocol

Create `.env` from `.env.example`, then fill:

```text
VITE_HER_MINT_CONTRACT=...
HER_MINT_CONTRACT=...
VITE_HER_AGENT_PROTOCOL_URL=http://localhost:8787
HER_AGENT_PROTOCOL_PORT=8787
BASE_CHAIN_ID=8453
BASE_CHAIN_NAME=Base
BASE_RPC_URL=https://mainnet.base.org
BASE_EXPLORER_URL=https://basescan.org
HER_WEBSITE_URL=http://localhost:5173/
```

Run the protocol service:

```bash
npm run agent-protocol
```

Endpoints:

```text
GET  /mission?executor=0xUserHermesAgentExecutor
POST /relay
GET  /activity
POST /activity
GET  /health
```

`/mission` is for user-owned Hermes Agents to get a mission code. `/activity` lets self-executing agents publish confirmed receipts to the live feed. `/relay` is optional fallback if a user's agent cannot send transactions itself. The preferred path is still agent self-execution from an authorized executor wallet.

## User Mint Tutorial

```text
1. Open your own Hermes Agent.
2. Say: Mint HER on Base for my wallet.
3. Your agent requests a HER mission.
4. Your agent gives you a mission code and executor address.
5. Open the HER website.
6. Connect wallet and switch to Base.
7. Paste executor address + mission code.
8. Choose how many mints.
9. Click sign permit.
10. Open the Agent tab and copy the packet.
11. Give the packet back to your Hermes Agent.
12. Your Hermes Agent executes agentMint or uses HER relay fallback.
13. HER arrives in your wallet.
14. Open the BaseScan link to confirm.
```

## Beginner Explanation

For a normal mint, a user clicks a mint button and the website sends the transaction. HER is different:

```text
User -> own Hermes Agent -> HER mission -> user signs permit -> Hermes Agent executes mint -> HER goes to user wallet
```

The website is only the signing terminal. It does not mint by itself.

The permit is not a token transfer. It is a signed permission that says:

```text
This wallet allows this Hermes Agent executor to mint this number of HER mints for this mission before this deadline.
```

The smart contract checks:

```text
1. Is the executor authorized?
2. Is the signature really from the receiver wallet?
3. Is the mission hash correct?
4. Is the permit still valid?
5. Is the mint cap still available?
6. Was the exact fee paid?
```

## Contract Setup

1. Deploy `contracts/HermesAgentMint.sol` to Base.
2. Constructor inputs:
   - `treasury_`: treasury wallet.
   - `initialAgent`: first authorized Hermes executor, or zero address if registering later.
3. Fill `VITE_HER_MINT_CONTRACT` and `HER_MINT_CONTRACT`.
4. Fill `VITE_TREASURY_ADDRESS`.
5. Authorize Hermes executors with `setHermesAgent(agent, true)`.
6. Fund executor wallets with ETH on Base for gas and mint fees.

## If A User's Hermes Agent Has No Wallet

The user can still mint. Their Hermes Agent requests a mission, helps the user sign the permit, then submits the packet to `/relay`. In that fallback mode, the HER Agent Protocol relay wallet sends the transaction. HER still mints to the user's wallet.

## Production Notes

- Audit the contract before mainnet scale.
- Add persistent storage for missions and activity.
- Add auth/rate limiting to `/mission` and `/relay`.
- Add an indexer for confirmed on-chain activity.
- Add tests for replay protection, nonce use, fee checks, cap checks, and executor authorization.
- Never place private keys in frontend code.
