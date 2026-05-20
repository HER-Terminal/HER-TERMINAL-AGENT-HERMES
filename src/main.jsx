import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BadgeCheck,
  ClipboardSignature,
  Copy,
  ExternalLink,
  KeyRound,
  Network,
  ShieldCheck,
  Terminal,
  Wallet,
} from 'lucide-react';
import { ethers } from 'ethers';
import './styles.css';

const ZERO = '0x0000000000000000000000000000000000000000';
const CHAIN_ID = Number(import.meta.env.VITE_BASE_CHAIN_ID || 8453);
const CHAIN_HEX = `0x${CHAIN_ID.toString(16)}`;

const CONFIG = {
  projectName: import.meta.env.VITE_PROJECT_NAME || 'HER',
  ticker: import.meta.env.VITE_TOKEN_SYMBOL || 'HER',
  chainName: import.meta.env.VITE_BASE_CHAIN_NAME || 'Base',
  chainId: CHAIN_ID,
  chainHex: CHAIN_HEX,
  rpcUrl: import.meta.env.VITE_BASE_RPC_URL || 'https://mainnet.base.org',
  explorer: import.meta.env.VITE_BASE_EXPLORER || 'https://basescan.org',
  contractAddress: import.meta.env.VITE_HER_MINT_CONTRACT || ZERO,
  treasuryAddress: import.meta.env.VITE_TREASURY_ADDRESS || ZERO,
  agentProtocolUrl: import.meta.env.VITE_HER_AGENT_PROTOCOL_URL || 'http://localhost:8787',
  totalSupply: '21,000,000',
  publicMint: '10,000,000',
  publicMintCap: 10_000_000,
  lpReserve: '10,000,000',
  treasury: '1,000,000',
  perSlot: 1_000,
  maxSlots: 10,
  feePerSlotEth: '0.0006',
};

const HER_MINT_ABI = [
  'function agentMint(address receiver,uint8 slots,uint256 deadline,bytes32 missionHash,bytes signature) payable',
  'function nonces(address owner) view returns (uint256)',
  'function mintsByWallet(address owner) view returns (uint8)',
  'function mintedPublic() view returns (uint256)',
  'function mintFee() view returns (uint256)',
  'event AgentMinted(address indexed receiver,address indexed agent,uint8 slots,uint256 amount,uint256 fee,bytes32 missionHash)',
];

const baseParams = {
  chainId: CONFIG.chainHex,
  chainName: CONFIG.chainName,
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: [CONFIG.rpcUrl],
  blockExplorerUrls: [CONFIG.explorer],
};

const ACTIVITY_LINES = [
  '[00:01] user asked a wallet-enabled agent to mint HER',
  `[00:03] agent created mission code HER-${CONFIG.chainId}-XXXX`,
  '[00:05] user wallet connected / receiver locked to signer',
  '[00:07] agent wallet prepared Base transaction',
  '[00:09] user signed permit / no token moved yet',
  '[00:12] packet copied back to the agent wallet',
  `[00:15] agentMint execution prepared on ${CONFIG.chainName}`,
  '[00:18] receipt proof returned with BaseScan link',
];

function short(addr) {
  if (!addr || addr === ZERO) return '--';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function isAddress(addr) {
  return ethers.isAddress(addr || '');
}

function agentStatus(addr, account) {
  if (!addr) return 'waiting for agent wallet';
  if (!isAddress(addr)) return 'invalid address';
  if (account && addr.toLowerCase() === account.toLowerCase()) return 'agent must be a separate wallet';
  return 'agent wallet ready';
}

function getContract(signerOrProvider) {
  if (!isAddress(CONFIG.contractAddress) || CONFIG.contractAddress === ZERO) {
    throw new Error('Set VITE_HER_MINT_CONTRACT first.');
  }
  return new ethers.Contract(CONFIG.contractAddress, HER_MINT_ABI, signerOrProvider);
}

function App() {
  const [page, setPage] = useState('mint');
  const [account, setAccount] = useState(localStorage.getItem('hermes_wallet') || '');
  const [chainId, setChainId] = useState(localStorage.getItem('hermes_chain') || '--');
  const [agentAddress, setAgentAddress] = useState(localStorage.getItem('hermes_agent') || '');
  const [missionCode, setMissionCode] = useState(localStorage.getItem('hermes_mission') || '');
  const [slots, setSlots] = useState(1);
  const [permit, setPermit] = useState(localStorage.getItem('hermes_permit') || '');
  const [deadline, setDeadline] = useState(localStorage.getItem('hermes_deadline') || '');
  const [txHash, setTxHash] = useState(localStorage.getItem('hermes_tx') || '');
  const [status, setStatus] = useState('ready');
  const [copied, setCopied] = useState('');
  const [chainStats, setChainStats] = useState({ mintedPublic: 0, mintFeeEth: CONFIG.feePerSlotEth, loaded: false });
  const [walletMints, setWalletMints] = useState(null);
  const [activityFeed, setActivityFeed] = useState(ACTIVITY_LINES);

  const fee = useMemo(() => {
    const total = Number(CONFIG.feePerSlotEth) * slots;
    return `${total.toFixed(5)} ETH`;
  }, [slots]);

  const missionRequest = useMemo(() => {
    return [
      'HER_AGENT_MISSION_REQUEST',
      `network: ${CONFIG.chainName} / ${CONFIG.chainId}`,
      `contract: ${CONFIG.contractAddress}`,
      `receiver: ${account || '<connected wallet>'}`,
      `mints: ${slots}x`,
      'requirement: you must use an agent wallet that can send Base transactions',
      'return: agent wallet address + mission code',
      'note: Hermes Agent is recommended, but any wallet-enabled agent can mine HER',
    ].join('\n');
  }, [account, slots]);

  const hermesPrompt = useMemo(() => {
    const receiver = account || '<user wallet>';
    const missionHash = missionCode ? ethers.id(missionCode.trim()) : '<mission hash>';
    const args = [
      receiver,
      slots,
      deadline || '<deadline unix>',
      missionHash,
      permit || '<permit signature>',
    ];
    return [
      'HER_AGENT_MINT_PACKET',
      `task: mint $HER on ${CONFIG.chainName}`,
      `receiver: ${receiver}`,
      `mints: ${slots}x / ${CONFIG.perSlot.toLocaleString()} HER each`,
      `agentWallet: ${agentAddress || '<wallet-enabled agent address>'}`,
      `mission: ${missionCode || '<mission code from your agent>'}`,
      `call: agentMint(${args.join(', ')})`,
      `feePerMint: ${CONFIG.feePerSlotEth} ETH`,
      'rule: transaction sender must be the agent wallet in this packet',
      'rule: receiver signs, agent sends, website never mints directly',
      'return: tx hash + BaseScan link',
    ].join('\n');
  }, [account, agentAddress, deadline, missionCode, permit, slots]);

  useEffect(() => {
    loadChainStats();
    loadActivityFeed();
    const id = setInterval(loadActivityFeed, 10000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    loadWalletMints(account);
  }, [account]);

  async function loadActivityFeed() {
    try {
      if (isAddress(CONFIG.contractAddress) && CONFIG.contractAddress !== ZERO) {
        const provider = new ethers.JsonRpcProvider(CONFIG.rpcUrl);
        const contract = getContract(provider);
        const latest = await provider.getBlockNumber();
        const events = await contract.queryFilter(contract.filters.AgentMinted(), Math.max(0, latest - 50000), latest);
        const lines = events.slice(-10).reverse().map((event) => {
          const { receiver, agent, slots, amount } = event.args;
          const tokenAmount = Number(ethers.formatUnits(amount, 18)).toLocaleString();
          return `[block ${event.blockNumber}] ${short(agent)} mined ${tokenAmount} HER for ${short(receiver)} / ${Number(slots)}x`;
        });
        if (lines.length) {
          setActivityFeed(lines);
          return;
        }
      }
      const response = await fetch(`${CONFIG.agentProtocolUrl}/activity`, { cache: 'no-store' })
        .catch(() => fetch('/activity.json', { cache: 'no-store' }));
      if (!response.ok) return;
      const data = await response.json();
      const lines = (Array.isArray(data) ? data : data.items || [])
        .map((item) => {
          if (typeof item === 'string') return item;
          const time = item.time || '--:--';
          const wallet = item.receiver ? short(item.receiver) : 'unknown wallet';
          const slotsText = item.slots ? `${item.slots} mint` : 'mint';
          const hash = item.txHash ? short(item.txHash) : 'pending tx';
          return `[${time}] ${wallet} minted HER / ${slotsText} / ${hash}`;
        })
        .filter(Boolean);
      if (lines.length) setActivityFeed(lines);
    } catch {
      setActivityFeed(ACTIVITY_LINES);
    }
  }

  async function loadChainStats() {
    if (!isAddress(CONFIG.contractAddress) || CONFIG.contractAddress === ZERO) return;
    try {
      const provider = new ethers.JsonRpcProvider(CONFIG.rpcUrl);
      const contract = getContract(provider);
      const [minted, mintFee] = await Promise.all([contract.mintedPublic(), contract.mintFee()]);
      setChainStats({
        mintedPublic: Number(ethers.formatUnits(minted, 18)),
        mintFeeEth: ethers.formatEther(mintFee),
        loaded: true,
      });
    } catch (err) {
      setStatus(`stats read failed: ${err.message || 'unknown error'}`);
    }
  }

  async function loadWalletMints(wallet = account) {
    if (!isAddress(wallet) || !isAddress(CONFIG.contractAddress) || CONFIG.contractAddress === ZERO) return;
    try {
      const provider = new ethers.JsonRpcProvider(CONFIG.rpcUrl);
      const contract = getContract(provider);
      setWalletMints(Number(await contract.mintsByWallet(wallet)));
    } catch {
      setWalletMints(null);
    }
  }

  async function connectWallet() {
    if (!window.ethereum) {
      alert('Wallet extension not found. Install MetaMask, Rabby, or another Base wallet.');
      return;
    }
    const provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.send('eth_requestAccounts', []);
    const network = await provider.getNetwork();
    setAccount(accounts[0]);
    setChainId(String(network.chainId));
    loadWalletMints(accounts[0]);
    localStorage.setItem('hermes_wallet', accounts[0]);
    localStorage.setItem('hermes_chain', String(network.chainId));
  }

  async function switchBase() {
    if (!window.ethereum) return alert('Wallet extension not found.');
    try {
      await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: baseParams.chainId }] });
    } catch (err) {
      if (err.code === 4902) {
        await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [baseParams] });
      } else {
        throw err;
      }
    }
    setChainId(String(CONFIG.chainId));
    localStorage.setItem('hermes_chain', String(CONFIG.chainId));
  }

  async function signHermesPermit() {
    try {
      if (!account) await connectWallet();
      if (!isAddress(agentAddress)) throw new Error('Enter the agent wallet address first.');
      if (!missionCode.trim()) throw new Error('Enter the mission code from your agent.');

      setStatus('signing permit');
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const receiver = await signer.getAddress();
      if (agentAddress.toLowerCase() === receiver.toLowerCase()) {
        throw new Error('Agent wallet must be different from the receiver wallet.');
      }
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== CONFIG.chainId) await switchBase();

      const contract = getContract(signer);
      const nonce = await contract.nonces(receiver);
      const nextDeadline = Math.floor(Date.now() / 1000) + 60 * 60;
      const domain = {
        name: 'HERAgentMint',
        version: '1',
        chainId: CONFIG.chainId,
        verifyingContract: CONFIG.contractAddress,
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
      const value = {
        receiver,
        agent: agentAddress,
        slots,
        nonce,
        deadline: nextDeadline,
        missionHash: ethers.id(missionCode.trim()),
      };
      const sig = await signer.signTypedData(domain, types, value);
      setAccount(receiver);
      setPermit(sig);
      setDeadline(String(nextDeadline));
      setStatus('permit ready for agent wallet');
      localStorage.setItem('hermes_wallet', receiver);
      localStorage.setItem('hermes_agent', agentAddress);
      localStorage.setItem('hermes_mission', missionCode);
      localStorage.setItem('hermes_slots', String(slots));
      localStorage.setItem('hermes_permit', sig);
      localStorage.setItem('hermes_deadline', String(nextDeadline));
    } catch (err) {
      setStatus(err.message || 'permit failed');
    }
  }

  function updateAgent(next) {
    setAgentAddress(next);
    localStorage.setItem('hermes_agent', next);
  }

  function updateMission(next) {
    setMissionCode(next);
    localStorage.setItem('hermes_mission', next);
  }

  function updateSlots(next) {
    const value = Math.max(1, Math.min(CONFIG.maxSlots, Number(next) || 1));
    setSlots(value);
    localStorage.setItem('hermes_slots', String(value));
  }

  async function copy(text, key) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 1200);
  }

  return (
    <div className="shell">
      <div className="ink" />
      <header className="topbar">
        <button className="brand" onClick={() => setPage('mint')}>
          <span className="mark"><img src="/her-logo.svg" alt="HER" /></span>
          <span>
            <b>HER</b>
            <small>AGENT TERMINAL</small>
          </span>
        </button>
        <nav>
          {[
            ['mint', 'mint'],
            ['agent', 'packet'],
            ['passport', 'status'],
            ['proof', 'guide'],
          ].map(([key, label]) => (
            <button key={key} className={page === key ? 'active' : ''} onClick={() => setPage(key)}>
              {label}
            </button>
          ))}
        </nav>
        <div className="online"><i /> {CONFIG.chainName} {CONFIG.chainId}</div>
      </header>

      {page === 'mint' && (
        <Mint
          account={account}
          agentAddress={agentAddress}
          chainId={chainId}
          copied={copied}
          copy={copy}
          fee={fee}
          missionCode={missionCode}
          missionRequest={missionRequest}
          permit={permit}
          setPage={setPage}
          signHermesPermit={signHermesPermit}
          slots={slots}
          status={status}
          switchBase={switchBase}
          connectWallet={connectWallet}
          txHash={txHash}
          updateAgent={updateAgent}
          updateMission={updateMission}
          updateSlots={updateSlots}
          chainStats={chainStats}
          walletMints={walletMints}
          refreshStats={loadChainStats}
          activityFeed={activityFeed}
        />
      )}
      {page === 'agent' && (
        <Agent
          account={account}
          agentAddress={agentAddress}
          permit={permit}
          deadline={deadline}
          hermesPrompt={hermesPrompt}
          missionRequest={missionRequest}
          missionCode={missionCode}
          slots={slots}
          fee={fee}
          copy={copy}
          copied={copied}
        />
      )}
      {page === 'passport' && (
        <Passport account={account} agentAddress={agentAddress} chainId={chainId} permit={permit} slots={slots} fee={fee} chainStats={chainStats} />
      )}
      {page === 'proof' && <Proof hermesPrompt={hermesPrompt} copy={copy} copied={copied} />}
    </div>
  );
}

function Mint(props) {
  const configured = CONFIG.contractAddress !== ZERO;
  return (
    <main className="hero">
      <section className="heroCopy">
        <p className="eyebrow">{CONFIG.chainName} / WALLET-ENABLED AGENTS ONLY / HERMES RECOMMENDED</p>
        <h1>Mint $HER Through Your Agent Wallet</h1>
        <div className="actions">
          <button onClick={props.connectWallet}><Wallet size={18} /> connect</button>
          <button onClick={props.switchBase}><Network size={18} /> Base</button>
          <button className="primary" onClick={props.signHermesPermit} disabled={!configured}>
            <ClipboardSignature size={18} /> sign permit
          </button>
        </div>
      </section>

      <div className="statusSteps heroFlow">
        <span><i>01</i> ask agent</span>
        <span><i>02</i> sign mission</span>
        <span><i>03</i> agent mines HER</span>
      </div>

      <MintProgress stats={props.chainStats} refreshStats={props.refreshStats} />

      <section className="mintGrid">
        <div className="terminal">
          <div className="bar"><span /><span /><span /><b>her.mint</b></div>
          <div className="fieldGrid">
            <label>
              <span>mints</span>
              <input type="number" min="1" max={CONFIG.maxSlots} value={props.slots} onChange={(e) => props.updateSlots(e.target.value)} />
            </label>
            <label>
              <span>Agent wallet</span>
              <input value={props.agentAddress} onChange={(e) => props.updateAgent(e.target.value)} placeholder="0x wallet from your agent" />
            </label>
            <label className="wide">
              <span>Mission code</span>
              <input value={props.missionCode} onChange={(e) => props.updateMission(e.target.value)} placeholder={`HER-${CONFIG.chainId}-XXXX from your agent`} />
            </label>
          </div>
          <div className="copyRow">
            <button type="button" onClick={() => props.copy(props.missionRequest, 'mission')}>
              <Copy size={16} /> {props.copied === 'mission' ? 'copied' : 'copy mission request'}
            </button>
            <button type="button" disabled={!props.permit} onClick={() => props.setPage('agent')}>
              <Terminal size={16} /> packet
            </button>
          </div>
          <div className="mintChoices" aria-label="mint amount choices">
            {[1, 2, 5, 10].map((choice) => (
              <button
                key={choice}
                type="button"
                className={props.slots === choice ? 'active' : ''}
                onClick={() => props.updateSlots(choice)}
              >
                {choice}x
              </button>
            ))}
          </div>
          <ConsoleLine k="wallet" v={short(props.account)} />
          <ConsoleLine k="chain" v={props.chainId === String(CONFIG.chainId) ? `${CONFIG.chainName} / ${CONFIG.chainId}` : props.chainId} />
          <ConsoleLine k="contract" v={short(CONFIG.contractAddress)} />
          <ConsoleLine k="agent status" v={agentStatus(props.agentAddress, props.account)} />
          <ConsoleLine k="token per mint" v={`${CONFIG.perSlot.toLocaleString()} ${CONFIG.ticker}`} />
          <ConsoleLine k="wallet limit" v={props.walletMints === null ? `${CONFIG.maxSlots} mints` : `${props.walletMints} / ${CONFIG.maxSlots} mints used`} />
          <ConsoleLine k="fee per mint" v={`${CONFIG.feePerSlotEth} ETH`} />
          <ConsoleLine k="status" v={props.status} />
          {props.txHash && (
            <a className="scan" href={`${CONFIG.explorer}/tx/${props.txHash}`} target="_blank" rel="noreferrer">
              <ExternalLink size={16} /> {short(props.txHash)}
            </a>
          )}
        </div>

        <ActivityTerminal lines={props.activityFeed} />
      </section>
    </main>
  );
}

function ActivityTerminal({ lines = ACTIVITY_LINES }) {
  return (
    <section className="activityTerminal">
      <div className="bar"><span /><span /><span /><b>live.agent.mint.activity</b></div>
      <div className="activityHeader">
        <b>Recent HER mints mined by wallet-enabled agents</b>
        <span>Hermes recommended / any wallet-enabled agent can mine</span>
      </div>
      <div className="activityWindow">
        <div className="activityTrack">
          {[...lines, ...lines].map((line, index) => (
            <p key={`${line}-${index}`}>{line}</p>
          ))}
        </div>
      </div>
    </section>
  );
}

function MintGuide() {
  return (
    <section className="guidePanel">
      <div className="bar"><span /><span /><span /><b>how.to.mint.her</b></div>
      <div className="guideGrid">
        <Step n="01" t="Ask agent" d="Tell your wallet-enabled agent: Create a HER mint mission on Base." />
        <Step n="02" t="Copy mission" d="Your agent returns its wallet address and mission code. Paste both into the website." />
        <Step n="03" t="Sign permit" d="Connect your Base wallet, choose mint count, then sign the permit. This is not a direct mint." />
        <Step n="04" t="Agent mines" d="Give the packet back to your agent wallet. The agent executes agentMint and HER lands in your wallet." />
      </div>
    </section>
  );
}

function MintProgress({ stats, refreshStats }) {
  const minted = stats?.mintedPublic || 0;
  const pct = Math.max(0, Math.min(100, (minted / CONFIG.publicMintCap) * 100));
  const pctLabel = `${pct >= 10 ? pct.toFixed(1) : pct.toFixed(2)}%`;
  return (
    <section className="mintedBar">
      <div>
        <span>HER minted</span>
        <b>{minted.toLocaleString()} / {CONFIG.publicMint} {CONFIG.ticker}</b>
      </div>
      <strong className="mintPercent">{pctLabel}</strong>
      <div className="meter" aria-label="total token minted bar">
        <i style={{ width: `${pct}%` }} />
      </div>
      <button onClick={refreshStats}>refresh</button>
    </section>
  );
}

function Agent({ account, agentAddress, permit, deadline, hermesPrompt, missionRequest, missionCode, slots, fee, copy, copied }) {
  const missionHash = missionCode ? ethers.id(missionCode.trim()) : '<mission hash>';
  const packet = {
    network: 'Base',
    chainId: CONFIG.chainId,
    contract: CONFIG.contractAddress,
    agentWallet: agentAddress || '<wallet-enabled agent address>',
    receiver: account || '<user wallet>',
    function: 'agentMint',
    missionCode: missionCode || '<mission code from your agent>',
    missionHash,
    args: [account || '<user wallet>', slots, deadline || '<deadline unix>', missionHash, permit || '<permit signature>'],
    value: fee,
    requirement: 'transaction sender must be the agent wallet address in this packet',
  };
  return (
    <main className="panelpage">
      <Panel title="mission request" icon={<Terminal />}>
        <code className="block">{missionRequest}</code>
        <button onClick={() => copy(missionRequest, 'mission2')}><Copy size={16} /> {copied === 'mission2' ? 'copied' : 'copy request'}</button>
      </Panel>
      <Panel title="agent execution packet" icon={<KeyRound />}>
        <code className="block">{hermesPrompt}</code>
        <button onClick={() => copy(hermesPrompt, 'prompt')}><Copy size={16} /> {copied === 'prompt' ? 'copied' : 'copy packet text'}</button>
        <ConsoleLine k="mission" v={missionCode || '--'} />
        <ConsoleLine k="mission hash" v={missionCode ? missionHash : '--'} />
        <ConsoleLine k="deadline" v={deadline || '--'} />
        <ConsoleLine k="signature" v={permit ? `${permit.slice(0, 24)}...${permit.slice(-12)}` : '--'} />
        <button disabled={!permit} onClick={() => copy(JSON.stringify(packet, null, 2), 'packet')}>
          <Copy size={16} /> {copied === 'packet' ? 'copied' : 'copy json packet'}
        </button>
      </Panel>
    </main>
  );
}

function Passport({ account, agentAddress, chainId, permit, slots, fee, chainStats }) {
  return (
    <main className="panelpage">
      <Panel title="Agent wallet status" icon={<BadgeCheck />}>
        <ConsoleLine k="user wallet" v={short(account)} />
        <ConsoleLine k="agent wallet" v={short(agentAddress)} />
        <ConsoleLine k="network" v={chainId === String(CONFIG.chainId) ? `${CONFIG.chainName} / ${CONFIG.chainId}` : chainId} />
        <ConsoleLine k="mints" v={String(slots)} />
        <ConsoleLine k="permit" v={permit ? 'signed' : 'not signed'} />
      </Panel>
      <Panel title="Supply status" icon={<ShieldCheck />}>
        <ConsoleLine k="total supply" v={`${CONFIG.totalSupply} ${CONFIG.ticker}`} />
        <ConsoleLine k="public mint" v={`${CONFIG.publicMint} ${CONFIG.ticker}`} />
        <ConsoleLine k="minted now" v={`${(chainStats?.mintedPublic || 0).toLocaleString()} ${CONFIG.ticker}`} />
        <ConsoleLine k="LP reserve" v={`${CONFIG.lpReserve} ${CONFIG.ticker}`} />
        <ConsoleLine k="treasury/dev" v={`${CONFIG.treasury} ${CONFIG.ticker}`} />
        <ConsoleLine k="token per mint" v={`${CONFIG.perSlot.toLocaleString()} ${CONFIG.ticker}`} />
        <ConsoleLine k="wallet limit" v={`${CONFIG.maxSlots} mints`} />
        <ConsoleLine k="fee per mint" v={`${CONFIG.feePerSlotEth} ETH`} />
      </Panel>
    </main>
  );
}

function Proof({ hermesPrompt, copy, copied }) {
  return (
    <main className="panelpage">
      <Panel title="beginner guide" icon={<Terminal />}>
        <Step n="01" t="Use an agent wallet" d="Your agent must own a wallet and be able to send Base transactions. No wallet, no mint." />
        <Step n="02" t="Ask for mission" d={`Tell your agent: Create a HER mint mission on ${CONFIG.chainName} for my connected wallet.`} />
        <Step n="03" t="Paste agent data" d="Paste the agent wallet and mission code into this terminal. Hermes Agent is recommended, but any wallet-enabled agent can mine HER." />
        <Step n="04" t="Sign mission" d="Sign the permit. This does not mint yet and does not move tokens. It only approves this one agent mission." />
        <Step n="05" t="Return packet" d="Copy the packet from the Agent tab and give it back to your wallet-enabled agent." />
        <Step n="06" t="Agent mines" d="The agent wallet executes agentMint, pays the mint fee, and HER lands in your wallet." />
      </Panel>
      <Panel title="contract" icon={<ExternalLink />}>
        <ConsoleLine k="network" v={`${CONFIG.chainName} / ${CONFIG.chainId}`} />
        <ConsoleLine k="address" v={CONFIG.contractAddress} />
        <ConsoleLine k="treasury" v={CONFIG.treasuryAddress} />
        <ConsoleLine k="explorer" v={CONFIG.explorer} />
        <ConsoleLine k="permit meaning" v="permission for one mission only" />
        <ConsoleLine k="direct mint" v="disabled / agent wallet only" />
        <button onClick={() => copy(hermesPrompt, 'prompt2')}><Copy size={16} /> {copied === 'prompt2' ? 'copied' : 'copy command'}</button>
      </Panel>
      <Panel title="Hermes recommended" icon={<ExternalLink />}>
        <p className="muted">Open the Nous Hermes Agent page, create or open a wallet-enabled agent, then ask it to create and execute your HER mint mission.</p>
        <a className="scan" href="https://hermes-agent.nousresearch.com/" target="_blank" rel="noreferrer">
          <ExternalLink size={16} /> open Hermes Agent
        </a>
      </Panel>
    </main>
  );
}

function Panel({ title, icon, children }) {
  return (
    <section className="panel">
      <h3>{React.cloneElement(icon, { size: 18 })}{title}</h3>
      {children}
    </section>
  );
}

function ConsoleLine({ k, v }) {
  return (
    <div className="row">
      <span>{k}</span>
      <b>{v}</b>
    </div>
  );
}

function Step({ n, t, d }) {
  return (
    <div className="step">
      <strong>{n}</strong>
      <div><b>{t}</b><p>{d}</p></div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
