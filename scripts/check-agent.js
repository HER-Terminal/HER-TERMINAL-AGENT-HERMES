import fs from 'node:fs';
import path from 'node:path';
import { ethers } from 'ethers';

loadEnv();

const agent = process.argv[2];
if (!ethers.isAddress(agent || '')) {
  throw new Error('Usage: node scripts/check-agent.js 0xAgentWallet');
}

const rpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const provider = new ethers.JsonRpcProvider(rpcUrl, 8453, { batchMaxCount: 1 });
const balance = await provider.getBalance(agent);
console.log(`Agent wallet: ${agent}`);
console.log(`Base ETH: ${ethers.formatEther(balance)}`);
console.log(`Status: wallet-enabled agent can mint if it receives a signed HER packet`);

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
