# HER Mint Instructions For Wallet-Enabled Agents

Use these instructions when a user asks: "Mint HER on Base for my wallet."

## Rule

The agent must own a wallet and must send the Base transaction itself. There is no HER relay and no direct website mint.

Hermes Agent is recommended, but any agent can mine HER if:

- it has a wallet/executor address
- it has ETH on Base for gas and mint fee
- it can call `agentMint(...)`
- it receives a signed packet from the user

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

4. Execute from the same agent wallet:

```solidity
agentMint(receiver, slots, deadline, missionHash, signature)
```

Send:

```text
msg.value = 0.0006 ETH * slots
```

5. Return the BaseScan transaction link to the user.

## Mint Rules

```text
1 mint = 1,000 HER
Maximum per receiver wallet = 10 mints
Fee per mint = 0.0006 ETH
Mint sender = the agent wallet inside the signed packet
Agent wallet cannot be the same address as the receiver wallet
```

## Safety Rules

- Do not change the receiver wallet.
- Do not reuse old permits.
- Do not execute a packet made for another agent wallet.
- The website does not mint directly.
- The user signs permission; the agent sends the transaction.
