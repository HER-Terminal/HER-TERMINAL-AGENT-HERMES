# HER Terminal

HER Terminal is an agent-gated mint interface on Base. The website prepares a signed mint packet, but the mint transaction is executed by a separate wallet-enabled agent. Hermes Agent is the recommended execution path, while any agent wallet can mint if it can send contract calls on Base.

Live app: https://her-terminal.xyz

## Contract

| Item | Value |
| --- | --- |
| Network | Base mainnet |
| Token | HER |
| Contract | `0xAc13853FF1f9ac4fE51d2e191C7D8ed7d0Ad04dD` |
| Mint function | `agentMint(address,uint8,uint256,bytes32,bytes)` |
| Function selector | `0x283ae4fb` |
| Token per mint | `1,000 HER` |
| Mint fee | `0.0006 ETH` |
| Wallet limit | `10 mints` |
| Public mint cap | `10,000,000 HER` |

## Core Rule

```text
No direct website mint.
The receiver wallet signs.
The agent wallet executes.
```

The receiver wallet never sends the mint transaction. It signs an EIP-712 permit for one exact agent wallet, mission code, mint count, nonce, and deadline. The agent wallet then calls `agentMint(...)` and pays the mint fee.

## User Flow

```text
1. Open HER Terminal.
2. Connect the receiver wallet on Base.
3. Ask a wallet-enabled agent to create a HER mint mission.
4. Agent returns:
   - agent wallet address
   - mission code
5. Paste both values into HER Terminal.
6. Sign the permit.
7. Copy the execution packet back to the same agent.
8. Agent executes agentMint on Base.
9. HER is minted to the receiver wallet.
```

## Agent Requirements

The minting agent must have:

- a wallet or executor address
- Base ETH for gas and mint fee
- support for contract call or raw calldata
- the signed packet produced by HER Terminal

Native ETH transfer alone cannot mint HER. The agent wallet must send calldata to the HER contract.

## Packet Formats

HER Terminal provides multiple packet formats for different agent implementations:

| Button | Use Case |
| --- | --- |
| Copy text for Hermes | Plain-language prompt for chat-based agents |
| Copy JSON packet | Structured payload for agent runtimes |
| Copy raw calldata | Encoded `agentMint(...)` calldata for wallet CLI tools |
| Copy command example | Terminal-style command shape with chain, contract, value, and calldata |

Example command shape:

```bash
contract-send \
  --chain base \
  --to 0xAc13853FF1f9ac4fE51d2e191C7D8ed7d0Ad04dD \
  --value 0.0006 \
  --data <signed-agentMint-calldata> \
  --confirm-send
```

## Local Development

Install dependencies:

```bash
npm install
```

Run the frontend:

```bash
npm run dev
```

Build production assets:

```bash
npm run build
```

## Environment

Create `.env` from `.env.example`.

Frontend values:

```text
VITE_BASE_CHAIN_ID=8453
VITE_BASE_CHAIN_NAME=Base
VITE_BASE_RPC_URL=https://mainnet.base.org
VITE_BASE_EXPLORER=https://basescan.org
VITE_HER_MINT_CONTRACT=0xAc13853FF1f9ac4fE51d2e191C7D8ed7d0Ad04dD
VITE_TREASURY_ADDRESS=0x...
```

Server/indexer values:

```text
HER_MINT_CONTRACT=0xAc13853FF1f9ac4fE51d2e191C7D8ed7d0Ad04dD
BASE_RPC_URL=https://mainnet.base.org
BASE_EXPLORER_URL=https://basescan.org
HER_INDEXER_START_BLOCK=46243000
HER_INDEXER_POLL_MS=15000
HER_INDEXER_RANGE_SIZE=9000
HER_INDEXER_LOOKBACK_BLOCKS=1200
HER_INDEXER_MAX_RANGES_PER_TICK=6
HER_ACTIVITY_LIMIT=120
HER_ACTIVITY_FILE=public/activity.json
HER_INDEXER_STATE_FILE=.her-indexer-state.json
```

Never commit real private keys.

## Activity Feed

The activity indexer watches `AgentMinted` events and writes a compact JSON feed. Production serves the feed through:

```text
GET /api/activity
```

Run locally:

```bash
npm run activity:indexer
```

The indexer supports backfill, lookback scanning, duplicate filtering, and atomic JSON writes.

## Agent Mint Script

For local or terminal-based agents, save the signed JSON packet from HER Terminal and execute:

```bash
AGENT_PRIVATE_KEY=0xAgentPrivateKey npm run agent:mint -- packet.json
```

The script checks that:

- the packet receiver is valid
- mint count is between 1 and 10
- the mission hash and signature are present
- the private key matches the signed agent wallet
- the agent wallet differs from the receiver wallet

## Contract Verification

Set a BaseScan API key:

```text
BASESCAN_API_KEY=...
```

Submit verification:

```bash
npm run verify:basescan
```

## Deployment Notes

Production currently runs as a static Vite build served by Nginx. The activity indexer runs as a systemd service and writes `/var/www/her-terminal/activity.json`, exposed through `/api/activity`.

Recommended production checks:

- verify the contract on BaseScan
- run a 1x mint with a real wallet-enabled agent
- confirm `/api/activity` updates after each mint
- confirm the agent wallet can send raw calldata
- monitor Base RPC health for indexer reliability

## Security Notes

- The website does not mint directly.
- The permit is scoped to one receiver, one agent, one mission, one nonce, one deadline, and one mint count.
- The agent wallet must be different from the receiver wallet.
- Mint fee ETH remains in the contract until owner withdrawal.
- Activity data is indexed from on-chain `AgentMinted` events.
