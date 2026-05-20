import fs from 'node:fs';
import path from 'node:path';
import { ethers } from 'ethers';

loadEnv();

const agent = process.argv[2];
if (!ethers.isAddress(agent || '')) {
  throw new Error('Usage: node scripts/check-agent.js 0xAgentWallet');
}

const rpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const contractAddress = mustAddress(process.env.HER_MINT_CONTRACT || process.env.VITE_HER_MINT_CONTRACT, 'HER_MINT_CONTRACT');
const provider = new ethers.JsonRpcProvider(rpcUrl, 8453, { batchMaxCount: 1 });
const contract = new ethers.Contract(contractAddress, [
  'function hermesAgent(address agent) view returns(bool)',
], provider);

const authorized = await contract.hermesAgent(agent);
console.log(`Agent wallet: ${agent}`);
console.log(`Status: ${authorized ? 'authorized' : 'not authorized'}`);

function mustAddress(value, key) {
  if (!ethers.isAddress(value || '')) throw new Error(`${key} must be a valid address`);
  return value;
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
