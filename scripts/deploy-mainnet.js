import fs from 'node:fs';
import path from 'node:path';
import solc from 'solc';
import { ethers } from 'ethers';

loadEnv();

const RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const EXPLORER_URL = process.env.BASE_EXPLORER_URL || 'https://basescan.org';
const DEPLOYER_PRIVATE_KEY = normalizePrivateKey(mustEnv('DEPLOYER_PRIVATE_KEY'));
const TREASURY_ADDRESS = mustAddress('TREASURY_ADDRESS');
const TAX_RECIPIENT_ADDRESS = mustAddress('TAX_RECIPIENT_ADDRESS');
const INITIAL_HERMES_AGENT = process.env.INITIAL_HERMES_AGENT || ethers.ZeroAddress;

if (!ethers.isAddress(INITIAL_HERMES_AGENT)) {
  throw new Error('INITIAL_HERMES_AGENT must be an address or zero address');
}

const sourcePath = path.resolve(process.cwd(), 'contracts', 'HermesAgentMint.sol');
const source = fs.readFileSync(sourcePath, 'utf8');
const input = {
  language: 'Solidity',
  sources: {
    'HermesAgentMint.sol': { content: source },
  },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: {
      '*': {
        '*': ['abi', 'evm.bytecode.object'],
      },
    },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = (output.errors || []).filter((item) => item.severity === 'error');
if (errors.length) {
  throw new Error(errors.map((item) => item.formattedMessage).join('\n'));
}

const compiled = output.contracts['HermesAgentMint.sol'].HERAgentMint;
const abi = compiled.abi;
const bytecode = `0x${compiled.evm.bytecode.object}`;
const provider = new ethers.JsonRpcProvider(RPC_URL);
const deployer = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider);

const network = await provider.getNetwork();
if (Number(network.chainId) !== 8453) {
  throw new Error(`Wrong network: expected Base mainnet 8453, got ${network.chainId}`);
}

console.log(`Deploying HERAgentMint on Base mainnet from ${deployer.address}`);
console.log(`Treasury: ${TREASURY_ADDRESS}`);
console.log(`Tax recipient: ${TAX_RECIPIENT_ADDRESS}`);
console.log(`Initial Hermes Agent: ${INITIAL_HERMES_AGENT}`);

const factory = new ethers.ContractFactory(abi, bytecode, deployer);
const contract = await factory.deploy(TREASURY_ADDRESS, TAX_RECIPIENT_ADDRESS, INITIAL_HERMES_AGENT);
console.log(`Deploy tx: ${contract.deploymentTransaction().hash}`);
await contract.waitForDeployment();

const address = await contract.getAddress();
console.log(`HERAgentMint deployed: ${address}`);
console.log(`Explorer: ${EXPLORER_URL}/address/${address}`);
console.log('');
console.log('Add this to .env:');
console.log(`VITE_HER_MINT_CONTRACT="${address}"`);
console.log(`HER_MINT_CONTRACT="${address}"`);

function mustEnv(key) {
  const value = process.env[key];
  if (!value) throw new Error(`Missing env: ${key}`);
  return value;
}

function mustAddress(key) {
  const value = mustEnv(key);
  if (!ethers.isAddress(value)) throw new Error(`${key} must be a valid address`);
  return value;
}

function normalizePrivateKey(value) {
  const key = value.startsWith('0x') ? value : `0x${value}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error('DEPLOYER_PRIVATE_KEY must be a 32-byte hex private key');
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
