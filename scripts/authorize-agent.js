import fs from 'node:fs';
import path from 'node:path';
import { ethers } from 'ethers';

loadEnv();

const agent = process.argv[2];
const mode = process.argv.includes('--revoke') ? false : true;
if (!ethers.isAddress(agent || '')) {
  throw new Error('Usage: node scripts/authorize-agent.js 0xAgentWallet [--revoke]');
}

const rpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const contractAddress = mustAddress(process.env.HER_MINT_CONTRACT || process.env.VITE_HER_MINT_CONTRACT, 'HER_MINT_CONTRACT');
const ownerKey = normalizePrivateKey(mustEnv('DEPLOYER_PRIVATE_KEY'));
const provider = new ethers.JsonRpcProvider(rpcUrl, 8453, { batchMaxCount: 1 });
const owner = new ethers.Wallet(ownerKey, provider);
const contract = new ethers.Contract(contractAddress, [
  'function owner() view returns(address)',
  'function hermesAgent(address agent) view returns(bool)',
  'function setHermesAgent(address agent,bool allowed)',
], owner);

const contractOwner = await contract.owner();
if (contractOwner.toLowerCase() !== owner.address.toLowerCase()) {
  throw new Error(`DEPLOYER_PRIVATE_KEY is not contract owner. Owner is ${contractOwner}`);
}

const before = await contract.hermesAgent(agent);
console.log(`Agent wallet: ${agent}`);
console.log(`Before: ${before ? 'authorized' : 'not authorized'}`);

if (before === mode) {
  console.log(`No change needed.`);
  process.exit(0);
}

const tx = await contract.setHermesAgent(agent, mode);
console.log(`Tx: ${tx.hash}`);
await tx.wait();

const after = await contract.hermesAgent(agent);
console.log(`After: ${after ? 'authorized' : 'not authorized'}`);

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
