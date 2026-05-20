import fs from 'node:fs';
import path from 'node:path';
import { ethers } from 'ethers';

loadEnv();

const BASE_CHAIN_ID = 8453;
const RPC_URL = process.env.BASE_RPC_URL || process.env.VITE_BASE_RPC_URL || 'https://mainnet.base.org';
const OWNER_KEY = normalizePrivateKey(mustEnv('DEPLOYER_PRIVATE_KEY'));
const HER = mustAddress(process.env.HER_MINT_CONTRACT || process.env.VITE_HER_MINT_CONTRACT, 'HER_MINT_CONTRACT');
const WETH = mustAddress(process.env.BASE_WETH || '0x4200000000000000000000000000000000000006', 'BASE_WETH');
const POOL_MANAGER = mustAddress(
  process.env.UNISWAP_V4_POOL_MANAGER || '0x498581ff718922c3f8e6a244956af099b2652b2b',
  'UNISWAP_V4_POOL_MANAGER',
);
const HOOKS = mustAddress(process.env.UNISWAP_V4_HOOKS || ethers.ZeroAddress, 'UNISWAP_V4_HOOKS');
const FEE = Number(process.env.UNISWAP_V4_POOL_FEE || 3000);
const TICK_SPACING = Number(process.env.UNISWAP_V4_TICK_SPACING || 60);

const provider = new ethers.JsonRpcProvider(RPC_URL, BASE_CHAIN_ID, { batchMaxCount: 1 });
const owner = new ethers.Wallet(OWNER_KEY, provider);
const poolManager = new ethers.Contract(
  POOL_MANAGER,
  ['function initialize((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) key,uint160 sqrtPriceX96) external returns (int24 tick)'],
  owner,
);
const her = new ethers.Contract(
  HER,
  [
    'function owner() view returns(address)',
    'function tradeTaxEnabled() view returns(bool)',
    'function taxedTradeRoute(address) view returns(bool)',
    'function setTaxedTradeRoute(address account,bool taxable) external',
    'function setTradeTaxEnabled(bool enabled) external',
  ],
  owner,
);

const [currency0, currency1] = sortCurrencies(WETH, HER);
const sqrtPriceX96 = initialSqrtPriceX96(currency0, currency1);
const key = { currency0, currency1, fee: FEE, tickSpacing: TICK_SPACING, hooks: HOOKS };

console.log(`Owner: ${owner.address}`);
console.log(`HER: ${HER}`);
console.log(`WETH: ${WETH}`);
console.log(`PoolManager: ${POOL_MANAGER}`);
console.log(`Pool fee: ${FEE}`);
console.log(`Tick spacing: ${TICK_SPACING}`);
console.log(`Hooks: ${HOOKS}`);
console.log(`currency0: ${currency0}`);
console.log(`currency1: ${currency1}`);
console.log(`sqrtPriceX96: ${sqrtPriceX96}`);
console.log('Target price: 1,000 HER = 0.0006 WETH');

const contractOwner = await her.owner();
if (contractOwner.toLowerCase() !== owner.address.toLowerCase()) {
  throw new Error(`DEPLOYER_PRIVATE_KEY is ${owner.address}, but HER owner is ${contractOwner}`);
}

await initializePool();
await enableTradeTax();

async function initializePool() {
  try {
    const tx = await poolManager.initialize(key, sqrtPriceX96);
    console.log(`Initialize pool tx: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`Pool initialized in block ${receipt.blockNumber}`);
  } catch (err) {
    const message = err.shortMessage || err.reason || err.message || '';
    if (/already|initialized|PoolAlreadyInitialized/i.test(message)) {
      console.log('Pool already initialized; continuing tax route setup.');
      return;
    }
    throw err;
  }
}

async function enableTradeTax() {
  const routeEnabled = await her.taxedTradeRoute(POOL_MANAGER);
  if (!routeEnabled) {
    const routeTx = await her.setTaxedTradeRoute(POOL_MANAGER, true);
    console.log(`Set PoolManager taxed route tx: ${routeTx.hash}`);
    await routeTx.wait();
  } else {
    console.log('PoolManager already marked as taxed trade route.');
  }

  const taxEnabled = await her.tradeTaxEnabled();
  if (!taxEnabled) {
    const taxTx = await her.setTradeTaxEnabled(true);
    console.log(`Enable 1% trade tax tx: ${taxTx.hash}`);
    await taxTx.wait();
  } else {
    console.log('Trade tax already enabled.');
  }
}

function initialSqrtPriceX96(token0, token1) {
  // The intended launch price is 1,000 HER = 0.0006 WETH.
  // Equivalent exact ratio: 5,000,000 HER = 3 WETH.
  const herAmount = 5_000_000n * 10n ** 18n;
  const wethAmount = 3n * 10n ** 18n;
  const amount0 = token0.toLowerCase() === HER.toLowerCase() ? herAmount : wethAmount;
  const amount1 = token1.toLowerCase() === HER.toLowerCase() ? herAmount : wethAmount;
  return sqrt((amount1 << 192n) / amount0);
}

function sortCurrencies(a, b) {
  if (a.toLowerCase() === b.toLowerCase()) throw new Error('Pool currencies must be different');
  return BigInt(a) < BigInt(b) ? [a, b] : [b, a];
}

function sqrt(value) {
  if (value < 0n) throw new Error('sqrt only works on non-negative values');
  if (value < 2n) return value;
  let x0 = value / 2n;
  let x1 = (x0 + value / x0) / 2n;
  while (x1 < x0) {
    x0 = x1;
    x1 = (x0 + value / x0) / 2n;
  }
  return x0;
}

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
