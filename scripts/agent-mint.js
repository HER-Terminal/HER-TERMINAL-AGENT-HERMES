import fs from 'node:fs';
import path from 'node:path';
import { ethers } from 'ethers';

loadEnv();

const packetPath = process.argv[2];
if (!packetPath) {
  throw new Error('Usage: AGENT_PRIVATE_KEY=... node scripts/agent-mint.js packet.json');
}

const packet = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), packetPath), 'utf8'));
const rpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const contractAddress = packet.contract || process.env.HER_MINT_CONTRACT || process.env.VITE_HER_MINT_CONTRACT;
if (!ethers.isAddress(contractAddress || '')) throw new Error('Missing contract address');

const agentKey = normalizePrivateKey(mustEnv('AGENT_PRIVATE_KEY'));
const provider = new ethers.JsonRpcProvider(rpcUrl, 8453, { batchMaxCount: 1 });
const agent = new ethers.Wallet(agentKey, provider);
const contract = new ethers.Contract(contractAddress, [
  'function agentMint(address receiver,uint8 slots,uint256 deadline,bytes32 missionHash,bytes signature) payable',
  'function hermesAgent(address agent) view returns(bool)',
  'function mintFee() view returns(uint256)',
], agent);

const receiver = packet.receiver || packet.args?.[0];
const slots = Number(packet.slots ?? packet.args?.[1]);
const deadline = BigInt(packet.deadline ?? packet.args?.[2]);
const missionHash = packet.missionHash || packet.args?.[3];
const signature = packet.signature || packet.args?.[4];

if (!ethers.isAddress(receiver || '')) throw new Error('Packet receiver is invalid');
if (!Number.isInteger(slots) || slots < 1 || slots > 10) throw new Error('Packet slots must be 1-10');
if (!missionHash || !String(missionHash).startsWith('0x')) throw new Error('Packet missionHash is invalid');
if (!signature || !String(signature).startsWith('0x')) throw new Error('Packet signature is missing');

const authorized = await contract.hermesAgent(agent.address);
if (!authorized) throw new Error(`Agent wallet ${agent.address} is not authorized`);

const mintFee = await contract.mintFee();
const value = mintFee * BigInt(slots);

console.log(`Agent wallet: ${agent.address}`);
console.log(`Receiver: ${receiver}`);
console.log(`Mints: ${slots}`);
console.log(`Value: ${ethers.formatEther(value)} ETH`);

const tx = await contract.agentMint(receiver, slots, deadline, missionHash, signature, { value });
console.log(`Tx: ${tx.hash}`);
const receipt = await tx.wait();
console.log(`Mined in block: ${receipt.blockNumber}`);

function mustEnv(key) {
  const value = process.env[key];
  if (!value) throw new Error(`Missing env: ${key}`);
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
