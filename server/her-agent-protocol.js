import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { ethers } from 'ethers';

const ABI = [
  'function agentMint(address receiver,uint8 slots,uint256 deadline,bytes32 missionHash,bytes signature) payable',
  'function mintFee() view returns (uint256)',
];

loadEnv();

const PORT = Number(process.env.HER_AGENT_PROTOCOL_PORT || 8787);
const CHAIN_ID = Number(process.env.BASE_CHAIN_ID || 8453);
const CHAIN_NAME = process.env.BASE_CHAIN_NAME || 'Base';
const RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const EXPLORER_URL = process.env.BASE_EXPLORER_URL || 'https://basescan.org';
const CONTRACT_ADDRESS = process.env.HER_MINT_CONTRACT || process.env.VITE_HER_MINT_CONTRACT;
const WEBSITE_URL = process.env.HER_WEBSITE_URL || 'http://localhost:5173/';
const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const ACTIVITY_FILE = path.join(PUBLIC_DIR, 'activity.json');

if (!ethers.isAddress(CONTRACT_ADDRESS || '')) {
  console.warn('HER_MINT_CONTRACT is not set yet. Mission API will still run, but packets cannot point to a live contract yet.');
}

const provider = new ethers.JsonRpcProvider(RPC_URL);

const missions = new Map();

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === 'OPTIONS') return sendJson(res, 204, {});
    if (req.method === 'GET' && url.pathname === '/health') return sendJson(res, 200, { ok: true });
    if (req.method === 'GET' && url.pathname === '/activity') return sendJson(res, 200, readActivity());
    if (req.method === 'POST' && url.pathname === '/activity') return recordActivity(req, res);
    if (req.method === 'GET' && url.pathname === '/mission') return sendJson(res, 200, createMission(url));

    return sendJson(res, 404, { error: 'not_found' });
  } catch (err) {
    return sendJson(res, 500, { error: err.message || 'server_error' });
  }
});

server.listen(PORT, () => {
  console.log(`HER Agent Mission API running on http://localhost:${PORT}`);
  console.log(`Network: ${CHAIN_NAME} (${CHAIN_ID})`);
  console.log(`Website: ${WEBSITE_URL}`);
  console.log(`Contract: ${CONTRACT_ADDRESS || 'not configured'}`);
  console.log('Relay executor: disabled. Wallet-enabled agents must self-execute.');
});

function createMission(url) {
  const requestedExecutor = url.searchParams.get('executor') || '';
  const missionCode = makeMissionCode();
  const mission = {
    missionCode,
    missionHash: ethers.id(missionCode),
    chainId: CHAIN_ID,
    network: CHAIN_NAME,
    contract: CONTRACT_ADDRESS || '',
    website: WEBSITE_URL,
    executor: ethers.isAddress(requestedExecutor) ? requestedExecutor : '',
    expiresAt: Date.now() + 60 * 60 * 1000,
    instruction: 'Ask the user to open the HER website, paste this mission and your agent wallet, sign permit, then return the packet to your wallet-enabled agent.',
  };
  missions.set(missionCode, mission);
  return mission;
}

async function recordActivity(req, res) {
  const body = await readBody(req);
  if (!body.txHash || !String(body.txHash).startsWith('0x')) return sendJson(res, 400, { error: 'invalid_tx_hash' });
  if (body.receiver && !ethers.isAddress(body.receiver)) return sendJson(res, 400, { error: 'invalid_receiver' });
  if (body.executor && !ethers.isAddress(body.executor)) return sendJson(res, 400, { error: 'invalid_executor' });

  appendActivity({
    time: new Date().toISOString().slice(11, 16),
    receiver: body.receiver || '',
    slots: Number(body.slots || 0),
    txHash: body.txHash,
    missionCode: body.missionCode || '',
    executor: body.executor || '',
    route: body.route || 'user-owned-hermes-agent',
  });

  return sendJson(res, 200, { ok: true });
}

function readActivity() {
  if (!fs.existsSync(ACTIVITY_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(ACTIVITY_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function appendActivity(entry) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  const current = readActivity().filter((item) => typeof item === 'object' && item !== null);
  current.unshift(entry);
  fs.writeFileSync(ACTIVITY_FILE, `${JSON.stringify(current.slice(0, 40), null, 2)}\n`);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
  });
  if (status === 204) return res.end();
  return res.end(JSON.stringify(body, null, 2));
}

function makeMissionCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let tail = '';
  for (let i = 0; i < 4; i += 1) {
    tail += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `HER-${CHAIN_ID}-${tail}`;
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
