# HER Mint Instructions For Wallet-Enabled Agents

Use these instructions when a user asks: "Mint HER on Base for my wallet."

## Copy-Paste Hermes Agent Template

Users can paste this into Hermes Agent:

```text
HER HERMES AGENT COMMAND

Mint $HER for my wallet on Base.
Website: https://her-terminal.xyz
Contract: 0xAc13853FF1f9ac4fE51d2e191C7D8ed7d0Ad04dD
Receiver wallet: <my connected wallet>
Mint count: <1x, 2x, 5x, or 10x>

Use your own agent wallet as the transaction sender.
Create one mission code like HER-8453-XXXX.
Return exactly:
1. Agent wallet address
2. Mission code

After I sign the permit on HER Terminal, I will send you the execution packet.
Send agentMint from the same agent wallet and return the BaseScan tx link.
```

## Rule

The agent must own a wallet and must send the Base transaction itself. There is no HER relay and no direct website mint.

Hermes Agent is recommended, but any agent can mine HER if:

- it has a wallet/executor address
- it has ETH on Base for gas and mint fee
- it can call `agentMint(...)`
- it receives a signed packet from the user

## Flow

1. Create a mission code and keep the same agent wallet for the full flow.

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

## Execution Packet Template

After the user signs, they will paste a packet similar to this:

```text
HER HERMES AGENT EXECUTION PACKET

Task: execute the signed HER mint on Base.
Receiver: 0xUserWallet
Agent wallet sender: 0xYourAgentWallet
Mint count: 1x
HER amount: 1,000 HER
Contract: 0xAc13853FF1f9ac4fE51d2e191C7D8ed7d0Ad04dD
Function: agentMint(receiver, slots, deadline, missionHash, signature)
Value: 0.0006 ETH x slots

Rules:
- Send the transaction from the same agent wallet above.
- Do not change receiver, mint count, mission hash, deadline, or signature.
- Website does not mint directly; the agent wallet must execute.
```

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
