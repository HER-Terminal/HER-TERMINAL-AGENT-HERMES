import fs from 'node:fs';
import path from 'node:path';
import solc from 'solc';
import { ethers } from 'ethers';

loadEnv();

const API_KEY = mustEnv('BASESCAN_API_KEY');
const CONTRACT_ADDRESS = mustAddress(process.env.HER_MINT_CONTRACT || process.env.VITE_HER_MINT_CONTRACT, 'HER_MINT_CONTRACT');
const TREASURY_ADDRESS = mustAddress(process.env.TREASURY_ADDRESS, 'TREASURY_ADDRESS');
const TAX_RECIPIENT_ADDRESS = mustAddress(process.env.TAX_RECIPIENT_ADDRESS, 'TAX_RECIPIENT_ADDRESS');
const INITIAL_HERMES_AGENT = process.env.INITIAL_HERMES_AGENT || ethers.ZeroAddress;
const configuredApiUrl = process.env.ETHERSCAN_V2_API_URL || process.env.BASESCAN_API_URL || '';
const API_URL = configuredApiUrl.includes('/v2/') ? configuredApiUrl : 'https://api.etherscan.io/v2/api';
const CHAIN_ID = process.env.BASE_CHAIN_ID || process.env.VITE_BASE_CHAIN_ID || '8453';

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

const encodedArgs = ethers.AbiCoder.defaultAbiCoder().encode(
  ['address', 'address', 'address'],
  [TREASURY_ADDRESS, TAX_RECIPIENT_ADDRESS, INITIAL_HERMES_AGENT],
).slice(2);

const params = new URLSearchParams({
  apikey: API_KEY,
  chainid: CHAIN_ID,
  module: 'contract',
  action: 'verifysourcecode',
  contractaddress: CONTRACT_ADDRESS,
  sourceCode: JSON.stringify(input),
  codeformat: 'solidity-standard-json-input',
  contractname: 'HermesAgentMint.sol:HERAgentMint',
  compilerversion: `v${solc.version()}`,
  optimizationUsed: '1',
  runs: '200',
  constructorArguements: encodedArgs,
  evmversion: 'default',
  licenseType: '3',
});

const response = await fetch(API_URL, { method: 'POST', body: params });
const result = await response.json();
console.log(JSON.stringify(result, null, 2));

if (result.status !== '1') {
  process.exitCode = 1;
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
