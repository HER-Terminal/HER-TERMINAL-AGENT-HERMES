import fs from 'node:fs';
import path from 'node:path';
import { ethers } from 'ethers';

loadEnv();

const RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const CONTRACT_ADDRESS = process.env.HER_MINT_CONTRACT || process.env.VITE_HER_MINT_CONTRACT;
const EXPLORER_URL = process.env.BASE_EXPLORER_URL || 'https://basescan.org';
const START_BLOCK = Number(process.env.HER_INDEXER_START_BLOCK || 0);
const POLL_MS = Number(process.env.HER_INDEXER_POLL_MS || 15000);
const RANGE_SIZE = Number(process.env.HER_INDEXER_RANGE_SIZE || 9000);
const LOOKBACK_BLOCKS = Number(process.env.HER_INDEXER_LOOKBACK_BLOCKS || 1200);
const MAX_RANGES_PER_TICK = Number(process.env.HER_INDEXER_MAX_RANGES_PER_TICK || 6);
const ACTIVITY_LIMIT = Number(process.env.HER_ACTIVITY_LIMIT || 120);
const ACTIVITY_FILE = path.resolve(process.env.HER_ACTIVITY_FILE || 'public/activity.json');
const STATE_FILE = path.resolve(process.env.HER_INDEXER_STATE_FILE || '.her-indexer-state.json');
const ABI = [
  'event AgentMinted(address indexed receiver,address indexed agent,uint8 slots,uint256 amount,uint256 fee,bytes32 missionHash)',
];

if (!ethers.isAddress(CONTRACT_ADDRESS || '')) {
  throw new Error('HER_MINT_CONTRACT or VITE_HER_MINT_CONTRACT must be set');
}

const provider = new ethers.JsonRpcProvider(RPC_URL, 8453, { batchMaxCount: 1 });
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

console.log(`HER activity indexer watching ${CONTRACT_ADDRESS}`);
console.log(`Writing activity to ${ACTIVITY_FILE}`);

await tick();
if (process.env.HER_INDEXER_ONCE === '1') process.exit(0);
setInterval(() => tick().catch((err) => console.error(err.message || err)), POLL_MS);

async function tick() {
  const latest = await provider.getBlockNumber();
  const state = readJson(STATE_FILE, {});
  let current = readActivityItems();
  const shouldBootstrap = current.length === 0 && START_BLOCK > 0;
  const stateStart = Number(state.lastBlock || START_BLOCK || latest - RANGE_SIZE);
  let fromBlock = Math.max(shouldBootstrap ? START_BLOCK : stateStart - LOOKBACK_BLOCKS, 0);
  let ranges = 0;
  let indexed = 0;

  while (fromBlock <= latest && ranges < MAX_RANGES_PER_TICK) {
    const toBlock = Math.min(latest, fromBlock + RANGE_SIZE);
    const events = await contract.queryFilter(contract.filters.AgentMinted(), fromBlock, toBlock);

    if (events.length) {
      const next = events.map((event) => {
        const { receiver, agent, slots, amount, fee, missionHash } = event.args;
        return {
          time: new Date().toISOString().slice(11, 16),
          blockNumber: event.blockNumber,
          logIndex: event.index,
          txHash: event.transactionHash,
          txUrl: `${EXPLORER_URL}/tx/${event.transactionHash}`,
          receiver,
          agent,
          slots: Number(slots),
          amount: ethers.formatUnits(amount, 18),
          fee: ethers.formatEther(fee),
          missionHash,
          route: 'wallet-enabled-agent',
        };
      });

      const seen = new Set();
      current = [...next.reverse(), ...current]
        .filter((item) => {
          const key = `${item.txHash || ''}:${item.logIndex ?? ''}:${item.blockNumber || ''}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .sort((a, b) => Number(b.blockNumber || 0) - Number(a.blockNumber || 0))
        .slice(0, ACTIVITY_LIMIT);
      writeActivity(current);
      indexed += events.length;
    } else if (current.length === 0) {
      writeActivity([]);
    }

    writeJson(STATE_FILE, { lastBlock: toBlock + 1 });
    fromBlock = toBlock + 1;
    ranges += 1;
  }

  if (indexed) console.log(`Indexed ${indexed} mint event(s) through block ${Math.min(latest, fromBlock - 1)}`);
}

function readActivityItems() {
  const data = readJson(ACTIVITY_FILE, []);
  const items = Array.isArray(data) ? data : data.items || [];
  return items.filter((item) => typeof item === 'object' && item !== null);
}

function writeActivity(items) {
  writeJson(ACTIVITY_FILE, {
    updatedAt: new Date().toISOString(),
    chainId: 8453,
    contract: CONTRACT_ADDRESS,
    items,
  });
}

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(tmp, file);
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
