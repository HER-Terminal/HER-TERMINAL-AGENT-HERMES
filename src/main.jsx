import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BadgeCheck,
  ClipboardSignature,
  Copy,
  ExternalLink,
  KeyRound,
  Network,
  PlugZap,
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

function getMetaMaskProvider() {
  const injected = window.ethereum;
  if (!injected) return null;
  if (injected.isMetaMask) return injected;
  if (Array.isArray(injected.providers)) {
    return injected.providers.find((provider) => provider.isMetaMask) || null;
  }
  return null;
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
      'HER HERMES AGENT COMMAND',
      '',
      `Mint $HER for my wallet on ${CONFIG.chainName}.`,
      `Receiver wallet: ${account || '<connect wallet on HER Terminal first>'}`,
      `Mint count: ${slots}x`,
      `Contract: ${CONFIG.contractAddress}`,
      '',
      'Use your own agent wallet as the transaction sender.',
      'Create one mission code for this mint.',
      'Return exactly:',
      '1. Agent wallet address',
      '2. Mission code',
      '',
      'After I sign the permit on HER Terminal, I will send you the execution packet.',
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
      'HER HERMES AGENT EXECUTION PACKET',
      '',
      `Task: execute the signed HER mint on ${CONFIG.chainName}.`,
      `Receiver: ${receiver}`,
      `Agent wallet sender: ${agentAddress || '<your agent wallet>'}`,
      `Mint count: ${slots}x`,
      `HER amount: ${(slots * CONFIG.perSlot).toLocaleString()} HER`,
      `Contract: ${CONFIG.contractAddress}`,
      `Function: agentMint(${args.join(', ')})`,
      `Value: ${CONFIG.feePerSlotEth} ETH x ${slots}`,
      '',
      'Rules:',
      '- Send the transaction from the same agent wallet above.',
      '- Do not change receiver, mint count, mission hash, deadline, or signature.',
      '- Website does not mint directly; the agent wallet must execute.',
      '',
      'Return the transaction hash and BaseScan link.',
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

  useEffect(() => {
    const injected = getMetaMaskProvider();
    if (!injected?.on) return undefined;

    syncMetaMask(injected);

    const handleAccounts = (accounts = []) => {
      const next = accounts[0] || '';
      if (!next) {
        disconnectWallet();
        return;
      }
      setAccount(next);
      localStorage.setItem('hermes_wallet', next);
      loadWalletMints(next);
    };
    const handleChain = (hexChainId) => {
      const next = String(Number(hexChainId));
      setChainId(next);
      localStorage.setItem('hermes_chain', next);
      setStatus(next === String(CONFIG.chainId) ? 'Base wallet ready' : 'switch wallet to Base');
    };

    injected.on('accountsChanged', handleAccounts);
    injected.on('chainChanged', handleChain);
    return () => {
      injected.removeListener?.('accountsChanged', handleAccounts);
      injected.removeListener?.('chainChanged', handleChain);
    };
  }, []);

  async function syncMetaMask(injected = getMetaMaskProvider()) {
    if (!injected) return;
    const [accounts, hexChainId] = await Promise.all([
      injected.request({ method: 'eth_accounts' }).catch(() => []),
      injected.request({ method: 'eth_chainId' }).catch(() => null),
    ]);
    const nextAccount = accounts?.[0] || '';
    if (hexChainId) {
      const nextChain = String(Number(hexChainId));
      setChainId(nextChain);
      localStorage.setItem('hermes_chain', nextChain);
    }
    if (nextAccount) {
      setAccount(nextAccount);
      localStorage.setItem('hermes_wallet', nextAccount);
      loadWalletMints(nextAccount);
      setStatus(Number(hexChainId) === CONFIG.chainId ? 'Base wallet ready' : 'switch wallet to Base');
    }
  }

  async function loadActivityFeed() {
    try {
      const cached = await readActivityEndpoint('/activity.json');
      if (cached.length) setActivityFeed(cached);

      if (isAddress(CONFIG.contractAddress) && CONFIG.contractAddress !== ZERO) {
        const provider = new ethers.JsonRpcProvider(CONFIG.rpcUrl);
        const contract = getContract(provider);
        const latest = await provider.getBlockNumber();
        const events = await contract.queryFilter(contract.filters.AgentMinted(), Math.max(0, latest - 9000), latest);
        const lines = events.slice(-10).reverse().map((event) => {
          const { receiver, agent, slots, amount } = event.args;
          const tokenAmount = Number(ethers.formatUnits(amount, 18)).toLocaleString();
          return {
            blockNumber: event.blockNumber,
            txHash: event.transactionHash,
            txUrl: `${CONFIG.explorer}/tx/${event.transactionHash}`,
            agent,
            receiver,
            slots: Number(slots),
            amount: tokenAmount,
            status: 'mined',
          };
        });
        if (lines.length) {
          setActivityFeed(lines);
          return;
        }
      }
      const lines = await readActivityEndpoint(`${CONFIG.agentProtocolUrl}/activity`);
      if (lines.length) setActivityFeed(lines);
    } catch {
      setActivityFeed(ACTIVITY_LINES);
    }
  }

  async function readActivityEndpoint(url) {
    const response = await fetch(url, { cache: 'no-store' }).catch(() => null);
    if (!response?.ok) return [];
    const data = await response.json();
    return (Array.isArray(data) ? data : data.items || [])
      .map((item) => {
        if (typeof item === 'string') return item;
        return {
          time: item.time || '--:--',
          blockNumber: item.blockNumber,
          txHash: item.txHash,
          txUrl: item.txUrl || (item.txHash ? `${CONFIG.explorer}/tx/${item.txHash}` : ''),
          agent: item.agent || item.executor || '',
          receiver: item.receiver || '',
          slots: Number(item.slots || 0),
          amount: item.amount ? Number(item.amount).toLocaleString() : item.slots ? (Number(item.slots) * CONFIG.perSlot).toLocaleString() : '',
          status: 'indexed',
        };
      })
      .filter(Boolean);
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
    try {
      const injected = getMetaMaskProvider();
      if (!injected) {
        alert('MetaMask not found. Install MetaMask, then connect again.');
        return;
      }
      setStatus('connecting MetaMask');
      const accounts = await injected.request({ method: 'eth_requestAccounts' });
      await ensureBase(injected);
      const hexChainId = await injected.request({ method: 'eth_chainId' });
      if (Number(hexChainId) !== CONFIG.chainId) {
        setStatus('switch MetaMask to Base');
        throw new Error('MetaMask must be connected to Base.');
      }
      const provider = new ethers.BrowserProvider(injected);
      const signer = await provider.getSigner();
      const nextAccount = await signer.getAddress();
      const connected = nextAccount || accounts?.[0] || '';
      setAccount(connected);
      setChainId(String(CONFIG.chainId));
      setStatus('Base wallet ready');
      loadWalletMints(connected);
      localStorage.setItem('hermes_wallet', connected);
      localStorage.setItem('hermes_chain', String(CONFIG.chainId));
    } catch (err) {
      setStatus(err.shortMessage || err.message || 'wallet connect failed');
    }
  }

  function disconnectWallet() {
    setAccount('');
    setChainId('--');
    setPermit('');
    setDeadline('');
    setTxHash('');
    setWalletMints(null);
    setStatus('wallet disconnected');
    localStorage.removeItem('hermes_wallet');
    localStorage.removeItem('hermes_chain');
    localStorage.removeItem('hermes_permit');
    localStorage.removeItem('hermes_deadline');
    localStorage.removeItem('hermes_tx');
  }

  async function switchBase() {
    const injected = getMetaMaskProvider();
    if (!injected) return alert('MetaMask not found.');
    await ensureBase(injected);
    setChainId(String(CONFIG.chainId));
    setStatus('Base wallet ready');
    localStorage.setItem('hermes_chain', String(CONFIG.chainId));
  }

  async function ensureBase(injected) {
    try {
      await injected.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: baseParams.chainId }] });
    } catch (err) {
      if (err.code === 4902) {
        await injected.request({ method: 'wallet_addEthereumChain', params: [baseParams] });
      } else {
        throw err;
      }
    }
  }

  async function signHermesPermit() {
    try {
      if (!isAddress(CONFIG.contractAddress) || CONFIG.contractAddress === ZERO) {
        throw new Error('Contract is not configured.');
      }
      if (!account) await connectWallet();
      if (!isAddress(agentAddress)) throw new Error('Enter the agent wallet address first.');
      if (!missionCode.trim()) throw new Error('Enter the mission code from your agent.');

      setStatus('open MetaMask and sign permit');
      const injected = getMetaMaskProvider();
      if (!injected) throw new Error('MetaMask not found.');
      await ensureBase(injected);
      const provider = new ethers.BrowserProvider(injected);
      const signer = await provider.getSigner();
      const receiver = await signer.getAddress();
      if (agentAddress.toLowerCase() === receiver.toLowerCase()) {
        throw new Error('Agent wallet must be different from the receiver wallet.');
      }
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== CONFIG.chainId) throw new Error('Switch MetaMask to Base and try again.');

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
      setPage('agent');
    } catch (err) {
      setStatus(err.shortMessage || err.message || 'permit failed');
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

  function openPacket() {
    if (!permit) {
      setStatus('sign permit first, then packet will appear');
      return;
    }
    setPage('agent');
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
            ['setup', 'setup'],
            ['proof', 'guide'],
          ].map(([key, label]) => (
            <button key={key} className={page === key ? 'active' : ''} onClick={() => setPage(key)}>
              {label}
            </button>
          ))}
        </nav>
        <a className="xLink" href="https://x.com/HerBase_" target="_blank" rel="noreferrer" aria-label="HER on X">
          <img src="/x-logo.svg" alt="" />
        </a>
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
          disconnectWallet={disconnectWallet}
          txHash={txHash}
          updateAgent={updateAgent}
          updateMission={updateMission}
          updateSlots={updateSlots}
          openPacket={openPacket}
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
      {page === 'setup' && <AgentSetup copy={copy} copied={copied} />}
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
          {props.account ? (
            <>
              <span className="connectedPill"><i /> {short(props.account)} / {props.chainId === String(CONFIG.chainId) ? 'Base' : `chain ${props.chainId}`}</span>
              <button onClick={props.disconnectWallet}><Wallet size={18} /> disconnect</button>
            </>
          ) : (
            <button onClick={props.connectWallet}><Wallet size={18} /> connect</button>
          )}
          <button onClick={props.switchBase}><Network size={18} /> Base</button>
        </div>
      </section>

      <div className={`statusBanner ${props.permit ? 'ready' : ''}`}>
        <b>{props.permit ? 'packet ready' : 'terminal status'}</b>
        <span>{props.permit ? 'signed permit saved / open packet tab' : props.status}</span>
      </div>

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
            <button type="button" className="primary" onClick={props.signHermesPermit} disabled={!configured}>
              <ClipboardSignature size={16} /> sign permit
            </button>
            <button type="button" className={props.permit ? 'primary' : ''} onClick={props.openPacket}>
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
  const rows = normalizeActivity(lines);
  const mintedRows = rows.filter((row) => row.kind === 'mint');
  const primary = mintedRows[0];
  const terminalRows = buildMintRows(mintedRows);

  return (
    <section className="activityTerminal">
      <div className="bar"><span /><span /><span /><b>live.agent.mint.activity</b></div>
      <div className="activityHeader">
        <b>Live HER mint activity</b>
        <span>Detected from AgentMinted events on Base</span>
      </div>
      <div className="activitySummary">
        <span>users: <b>{mintedRows.length || 0}</b></span>
        <span>latest block: <b>{primary?.blockNumber || '--'}</b></span>
        <span>latest HER: <b>{primary?.amount || '--'}</b></span>
      </div>
      <div className="activityWindow">
        <div className="activityTrack">
          {terminalRows.map((row, index) => (
            <a
              className="activityRow"
              href={row.txUrl || undefined}
              target={row.txUrl ? '_blank' : undefined}
              rel={row.txUrl ? 'noreferrer' : undefined}
              key={`${row.message}-${index}`}
            >
              <i>{row.tag}</i>
              <b>{row.message}</b>
              <span>{row.meta}</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function normalizeActivity(items = []) {
  return items.map((item) => {
    if (typeof item === 'string') {
      return { kind: 'log', message: item, tag: 'log', meta: 'terminal heartbeat' };
    }
    const slots = Number(item.slots || 0);
    const amount = item.amount || (slots ? (slots * CONFIG.perSlot).toLocaleString() : '');
    return {
      kind: 'mint',
      blockNumber: item.blockNumber,
      txHash: item.txHash,
      txUrl: item.txUrl || (item.txHash ? `${CONFIG.explorer}/tx/${item.txHash}` : ''),
      agent: item.agent || '',
      receiver: item.receiver || '',
      slots,
      amount,
      status: item.status || 'mined',
    };
  });
}

function buildMintRows(rows) {
  if (!rows.length) {
    return [
      {
        tag: 'WAIT',
        message: 'waiting for the next HER mint',
        meta: 'when a user receives HER, their wallet appears here',
      },
    ];
  }

  return rows.slice(0, 8).map((row) => {
    const amount = row.amount || `${CONFIG.perSlot.toLocaleString()}`;
    return {
      tag: 'MINT',
      message: `${short(row.receiver)} received ${amount} HER`,
      meta: `agent ${short(row.agent)} | block ${row.blockNumber || '--'} | ${row.slots || 1}x | tx ${short(row.txHash)}`,
      txUrl: row.txUrl,
    };
  });
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

function AgentSetup({ copy, copied }) {
  const terminalCommand = [
    'HER_AGENT_SETUP',
    '1. Create or open an agent with its own wallet.',
    '2. Fund that agent wallet with Base ETH for gas + mint fee.',
    '3. Ask the agent to create a HER mission code.',
    '4. Paste agent wallet + mission code in HER Terminal.',
    '5. Sign permit, then give the packet back to the agent.',
  ].join('\n');

  const agentPrompt = [
    'HER HERMES AGENT COMMAND',
    '',
    'Mint $HER for my wallet on Base.',
    'Website: https://her-terminal.xyz',
    `Contract: ${CONFIG.contractAddress}`,
    '',
    'Step 1: use your own agent wallet as executor.',
    'Step 2: create one mission code like HER-8453-XXXX.',
    'Step 3: return your agent wallet address and mission code.',
    'Step 4: wait for my signed execution packet.',
    'Step 5: send agentMint from that same agent wallet.',
    '',
    'Do not mint from the website. The agent wallet must execute the transaction.',
  ].join('\n');

  return (
    <main className="panelpage">
      <Panel title="agent setup" icon={<PlugZap />}>
        <Step n="01" t="Wallet inside agent" d="The agent needs its own wallet/executor. If the agent has no wallet, it cannot mine HER." />
        <Step n="02" t="Fund Base ETH" d="Send enough Base ETH to the agent wallet for gas plus 0.0006 ETH per mint." />
        <Step n="03" t="Create mission" d="Ask the agent for a HER mission code and its agent wallet address." />
        <Step n="04" t="Return packet" d="After signing on HER Terminal, copy the packet back to the same agent wallet." />
        <a className="scan" href="https://hermes-agent.nousresearch.com/" target="_blank" rel="noreferrer">
          <ExternalLink size={16} /> open Hermes Agent
        </a>
      </Panel>
      <Panel title="copy for your agent" icon={<Terminal />}>
        <code className="block">{agentPrompt}</code>
        <button onClick={() => copy(agentPrompt, 'agentSetupPrompt')}><Copy size={16} /> {copied === 'agentSetupPrompt' ? 'copied' : 'copy agent prompt'}</button>
        <code className="block">{terminalCommand}</code>
      </Panel>
    </main>
  );
}

function Proof({ hermesPrompt, copy, copied }) {
  return (
    <main className="panelpage">
      <Panel title="beginner guide" icon={<Terminal />}>
        <Step n="01" t="Prepare two wallets" d="Your normal wallet receives HER. Your agent wallet sends the mint transaction. They cannot be the same address." />
        <Step n="02" t="Fund the agent wallet" d="The agent wallet needs Base ETH for gas and 0.0006 ETH per mint. Your receiver wallet only signs." />
        <Step n="03" t="Ask for mission" d={`Copy the HER Hermes Agent Command and ask your agent to create a mission on ${CONFIG.chainName}.`} />
        <Step n="04" t="Paste agent data" d="Paste the agent wallet and mission code into HER Terminal, then choose 1x, 2x, 5x, or 10x." />
        <Step n="05" t="Sign permit" d="Sign the permit. This is not a mint transaction. It only approves that exact agent wallet for that exact mission." />
        <Step n="06" t="Agent mines" d="Copy the packet to your agent. The agent wallet executes agentMint, pays the fee, and HER lands in your receiver wallet." />
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
