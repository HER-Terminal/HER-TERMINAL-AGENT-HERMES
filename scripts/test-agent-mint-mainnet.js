import fs from 'node:fs';
import path from 'node:path';
import { ethers } from 'ethers';

loadEnv();

const RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const CONTRACT_ADDRESS = mustAddress(process.env.HER_MINT_CONTRACT || process.env.VITE_HER_MINT_CONTRACT, 'HER_MINT_CONTRACT');
const DEPLOYER_PRIVATE_KEY = normalizePrivateKey(mustEnv('DEPLOYER_PRIVATE_KEY'));
const provider = new ethers.JsonRpcProvider(RPC_URL, 8453, { batchMaxCount: 1 });
const receiver = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider);
const agent = ethers.Wallet.createRandom().connect(provider);
const contractAsReader = new ethers.Contract(CONTRACT_ADDRESS, [
  'function nonces(address owner) view returns (uint256)',
  'function mintFee() view returns (uint256)',
  'function mintsByWallet(address owner) view returns (uint8)',
], provider);
const contractAsAgent = new ethers.Contract(CONTRACT_ADDRESS, [
  'function agentMint(address receiver,uint8 slots,uint256 deadline,bytes32 missionHash,bytes signature) payable',
], agent);

const slots = 1;
const mintFee = await contractAsReader.mintFee();
const fundAmount = mintFee + ethers.parseEther('0.0005');
const receiverBalance = await provider.getBalance(receiver.address);
if (receiverBalance < fundAmount) {
  throw new Error('Deployer balance is too low for test mint funding');
}

const usedBefore = Number(await contractAsReader.mintsByWallet(receiver.address));
if (usedBefore >= 10) throw new Error('Receiver wallet already reached mint limit');

console.log(`Receiver wallet: ${receiver.address}`);
console.log(`Temporary agent wallet: ${agent.address}`);
console.log(`Funding agent: ${ethers.formatEther(fundAmount)} ETH`);
const fundTx = await receiver.sendTransaction({ to: agent.address, value: fundAmount });
console.log(`Fund tx: ${fundTx.hash}`);
await fundTx.wait();

const nonce = await contractAsReader.nonces(receiver.address);
const deadline = Math.floor(Date.now() / 1000) + 60 * 60;
const missionCode = `HER-8453-TEST-${Date.now().toString(36).toUpperCase()}`;
const missionHash = ethers.id(missionCode);
const domain = {
  name: 'HERAgentMint',
  version: '1',
  chainId: 8453,
  verifyingContract: CONTRACT_ADDRESS,
};
const types = {
  AgentMint: [
    { name: 'receiver', type: 'address' },
    { name: 'agent', type: 'address' },
    { name: 'slots', type: 'uint8' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
    { name: 'missionHash', type: 'bytes32' },
  ],
};
const signature = await receiver.signTypedData(domain, types, {
  receiver: receiver.address,
  agent: agent.address,
  slots,
  nonce,
  deadline,
  missionHash,
});

console.log(`Mission: ${missionCode}`);
console.log('Executing agentMint from temporary agent wallet');
const mintTx = await contractAsAgent.agentMint(receiver.address, slots, deadline, missionHash, signature, { value: mintFee });
console.log(`Mint tx: ${mintTx.hash}`);
await mintTx.wait();

try {
  const left = await provider.getBalance(agent.address, 'latest');
  if (left > ethers.parseEther('0.00001')) {
    const feeData = await provider.getFeeData();
    const gasLimit = 21000n;
    const gasPrice = feeData.gasPrice || ethers.parseUnits('0.01', 'gwei');
    const sweepValue = left - gasPrice * gasLimit;
    if (sweepValue > 0n) {
      const sweepTx = await agent.sendTransaction({ to: receiver.address, value: sweepValue, gasLimit, gasPrice });
      console.log(`Sweep tx: ${sweepTx.hash}`);
      await sweepTx.wait();
    }
  }
} catch (err) {
  console.warn(`Sweep skipped: ${err.shortMessage || err.message}`);
}

const usedAfter = Number(await contractAsReader.mintsByWallet(receiver.address));
console.log(`Receiver mints used: ${usedBefore} -> ${usedAfter}`);

function mustEnv(key) {
  const value = process.env[key];
  if (!value) throw new Error(`Missing env: ${key}`);
  return value;
}

function mustAddress(value, key) {
  if (!ethers.isAddress(value || '')) throw new Error(`${key} must be a valid address`);
  return value;
}

function normalizePrivateKey(value) {
  const key = value.startsWith('0x') ? value : `0x${value}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error('Private key must be a 32-byte hex string');
  }
  return key;
}

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [key, ...rest] = trimmed.split('=');
    if (process.env[key]) continue;
    process.env[key] = rest.join('=').trim().replace(/^"|"$/g, '');
  }
}
