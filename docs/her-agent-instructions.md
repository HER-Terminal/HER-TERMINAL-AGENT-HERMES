# HER Mint Instructions For Wallet-Enabled Agents

Use these instructions when a user asks: "Mint HER on Base for my wallet."

## Rule

The agent must own a wallet and must send the Base transaction itself. There is no relay fallback.

Hermes Agent is recommended, but any agent can mine HER if:

- it has a wallet/executor address
- it has ETH on Base
- its wallet is authorized in the HER contract
- it can call `agentMint(...)`

## Flow

1. Create a mission code.

Example:

```text
HER-8453-7FQX
```

2. Give the user:

```text
Website: https://her-terminal.xyz
Agent wallet: 0xYourAgentWallet
Mission code: HER-8453-7FQX
```

3. Ask the user to:

```text
Open HER Terminal
Connect wallet on Base
Paste agent wallet
Paste mission code
Choose mint count
Sign mission permit
Copy the packet back to you
```

4. Execute from your authorized agent wallet:

```solidity
agentMint(receiver, slots, deadline, missionHash, signature)
```

Send:

```text
msg.value = 0.0006 ETH * slots
```

5. Return the BaseScan transaction link to the user.

6. Optional: publish the receipt to the activity feed:

```http
POST /activity
Content-Type: application/json

{
  "receiver": "0xUserWallet",
  "slots": 1,
  "txHash": "0x...",
  "missionCode": "HER-8453-7FQX",
  "executor": "0xYourAgentWallet",
  "route": "wallet-enabled-agent"
}
```

## Mint Rules

```text
1 mint = 1,000 HER
Maximum per wallet = 10 mints
Fee per mint = 0.0006 ETH
Mint sender = authorized agent wallet only
```

## Safety Rules

- Do not change the receiver wallet.
- Do not reuse old permits.
- The agent wallet must match the agent address inside the signed permit.
- The agent wallet must be authorized with `setHermesAgent(agentWallet, true)`.
- The website does not mint directly.
