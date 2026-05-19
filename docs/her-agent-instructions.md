# HER Mint Instructions For Hermes Agents

Use these instructions when a user asks: "Mint HER on Base for my wallet."

## Goal

Mint HER only through the user's own Hermes Agent session. The website does not mint directly. The user signs a permit, then the Hermes Agent either executes `agentMint(...)` from its authorized executor wallet or submits the packet to the HER Agent Protocol relay.

## Flow

1. Request a mission:

```http
GET /mission?executor=0xYourAgentExecutor
```

2. Give the user:

```text
Website URL
Executor address
Mission code
```

3. Ask the user to open the HER website, connect wallet on Base, paste executor + mission code, choose mint count, and sign permit.

4. Ask the user to copy the packet from the Agent tab and send it back.

5. Preferred path: self-execute on Base from your authorized Hermes Agent executor wallet:

```solidity
agentMint(receiver, slots, deadline, missionHash, signature)
```

Send `msg.value = mintFee * slots`.

Mint rules:

```text
1 mint = 1,000 HER
Maximum per wallet = 10 mints
Fee per mint = 0.0006 ETH
```

6. Fallback path if your agent cannot send transactions:

```http
POST /relay
Content-Type: application/json

{packet JSON from the website}
```

7. Return the BaseScan transaction link to the user.

8. After self-execution, publish the receipt to the live activity feed:

```http
POST /activity
Content-Type: application/json

{
  "receiver": "0xUserWallet",
  "slots": 1,
  "txHash": "0x...",
  "missionCode": "HER-8453-7FQX",
  "executor": "0xYourAgentExecutor",
  "route": "user-owned-hermes-agent"
}
```

## Rules

- Do not change the receiver wallet. HER must mint to the wallet that signed the permit.
- Do not reuse old permits. Each permit has nonce and deadline protection.
- The executor address must match the executor bound inside the signature.
- If self-executing, your executor must be authorized in the HER contract with `setHermesAgent(executor, true)`.
- If using `/relay`, the HER Agent Protocol relay executor must be authorized instead.
