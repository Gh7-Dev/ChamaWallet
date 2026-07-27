// Central Soroban / Freighter integration layer.
// Every write call follows: build -> prepare -> sign -> send -> poll.
import {
  Contract,
  TransactionBuilder,
  Networks,
  BASE_FEE,
  nativeToScVal,
  scValToNative,
  Address,
  Account,
  rpc,
} from "@stellar/stellar-sdk";
import {
  requestAccess,
  getAddress,
  isConnected,
  signTransaction,
} from "@stellar/freighter-api";

export const CONTRACT_ID =
  "CDB76V4HNBC7LIQHEJUIAUHNM4B2GSUJ6RMD6KEIC4YIRMPWXKL663QE";
export const NETWORK_PASSPHRASE = Networks.TESTNET;
export const RPC_URL = "https://soroban-testnet.stellar.org";
export const TX_TIMEOUT = 120;
export const POLL_INTERVAL_MS = 2000;
export const POLL_MAX_ATTEMPTS = 60; // ~120s

// Hardcoded SEP-41 contract id for native XLM on Stellar Testnet.
// Verified via Asset.native().contractId(Networks.TESTNET) — do not edit
// by hand, an invalid StrKey here breaks every deposit/approve call.
export const XLM_TOKEN_ID =
  "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

let cachedServer = null;
export function getServer() {
  if (!cachedServer) {
    cachedServer = new rpc.Server(RPC_URL);
  }
  return cachedServer;
}

const KES_PER_XLM = 18.5;
const STROOPS_PER_XLM = 10_000_000; // 7 decimals

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** "GABCD...WXYZ" -> "GABCD...WXYZ" shortened for display. */
export function shortenAddress(address) {
  if (!address || typeof address !== "string") return "";
  if (address.length <= 12) return address;
  return `${address.slice(0, 5)}...${address.slice(-4)}`;
}

/** Replace spaces with underscores so the value is a valid Soroban Symbol. */
export function sanitizeSymbol(value) {
  return (value || "").trim().replace(/\s+/g, "_");
}

export function xlmToKes(xlm) {
  const n = Number(xlm);
  if (!Number.isFinite(n)) return 0;
  return n * KES_PER_XLM;
}

export function kesToXlm(kes) {
  const n = Number(kes);
  if (!Number.isFinite(n)) return 0;
  return n / KES_PER_XLM;
}

export function xlmToStroops(xlm) {
  return BigInt(Math.round(Number(xlm) * STROOPS_PER_XLM));
}

export function stroopsToXlm(stroops) {
  return Number(stroops) / STROOPS_PER_XLM;
}

export function formatKes(kes) {
  const n = Number(kes);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("en-KE", { maximumFractionDigits: 2 });
}

/** True when the browser reports it currently has network connectivity. */
export function isOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

/**
 * Turn a raw SDK/contract error into a short machine-matchable string.
 * UI layers should feed this into a bilingual copy table rather than
 * ever rendering it directly.
 */
export function extractErrorMessage(err) {
  if (!err) return "unknown";
  if (typeof err === "string") return err;
  if (err.message) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return "unknown";
  }
}

const ERROR_MAP = [
  [/not a member/i, "Hujasajiliwa katika kikundi hiki / Not registered in this group"],
  [/already executed/i, "Tayari imetekelezwa / Already executed"],
  [/insufficient/i, "Salio haitoshi / Insufficient balance"],
  [/not found|missingvalue|unwrap.*none/i, "Kikundi hakipatikani / Group not found"],
  [/user rejected|user declined|not authorized to sign/i, "Ulikataa kuidhinisha / You cancelled the approval"],
  [/freighter|extension/i, "Freighter haijasakinishwa / Freighter extension not found"],
  [/failed to fetch|network|offline/i, "Hakuna mtandao / No internet connection"],
  [/txfailed|transaction failed/i, "Malipo hayakufanikiwa, jaribu tena / Payment failed, try again"],
  [/timeout|timed out/i, "Muda umeisha, jaribu tena / Timed out, please try again"],
  [/hosterror/i, "Kuna tatizo la kiufundi, jaribu tena / Technical error, try again"],
];

/** Map any raw error into a friendly bilingual message. Never leaks raw errors. */
export function mapError(err) {
  const raw = extractErrorMessage(err);
  for (const [pattern, friendly] of ERROR_MAP) {
    if (pattern.test(raw)) return friendly;
  }
  return "Kuna tatizo, jaribu tena / Something went wrong";
}

// ---------------------------------------------------------------------------
// Wallet
// ---------------------------------------------------------------------------

export async function isFreighterInstalled() {
  try {
    const res = await isConnected();
    if (res?.error) return false;
    return true;
  } catch {
    return false;
  }
}

export async function connectWallet() {
  const access = await requestAccess();
  if (access?.error) throw new Error(access.error);
  const { address } = await getAddress();
  if (!address) throw new Error("Freighter did not return an address");
  return address;
}

// ---------------------------------------------------------------------------
// Transaction polling
// ---------------------------------------------------------------------------

/** Poll getTransaction(hash) every 2s until SUCCESS/FAILED or attempts run out. */
export async function pollTransaction(server, hash) {
  let result;
  for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    result = await server.getTransaction(hash);
    if (result.status !== "NOT_FOUND") break;
  }
  if (!result || result.status === "NOT_FOUND") {
    throw new Error("Confirmation timed out");
  }
  if (result.status === "FAILED") {
    throw new Error("Transaction failed");
  }
  return result;
}

// ---------------------------------------------------------------------------
// Core build -> prepare -> sign -> send -> poll pipeline
// ---------------------------------------------------------------------------

async function submitContractCall(walletAddress, contractId, method, scArgs, opts = {}) {
  const server = getServer();
  const account = await server.getAccount(walletAddress);
  const contract = new Contract(contractId);

  const tx = new TransactionBuilder(account, {
    fee: opts.fee || BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...scArgs))
    .setTimeout(TX_TIMEOUT)
    .build();

  let prepared;
  try {
    prepared = await server.prepareTransaction(tx);
  } catch (err) {
    throw new Error(extractErrorMessage(err));
  }

  const signResult = await signTransaction(prepared.toXDR(), {
    networkPassphrase: NETWORK_PASSPHRASE,
    address: walletAddress,
  });
  if (signResult?.error) throw new Error(extractErrorMessage(signResult.error));
  const { signedTxXdr } = signResult;

  const txToSubmit = TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE);
  const sendResult = await server.sendTransaction(txToSubmit);
  if (sendResult.status === "ERROR") {
    throw new Error(extractErrorMessage(sendResult.errorResult));
  }

  const confirmed = await pollTransaction(server, sendResult.hash);
  return { hash: sendResult.hash, confirmed };
}

// ---------------------------------------------------------------------------
// Contract calls
// ---------------------------------------------------------------------------

export async function createChama(walletAddress, chamaName) {
  const name = sanitizeSymbol(chamaName);
  return submitContractCall(walletAddress, CONTRACT_ID, "create_chama", [
    nativeToScVal(name, { type: "symbol" }),
    new Address(walletAddress).toScVal(),
  ]);
}

export async function addMember(walletAddress, chamaName, memberAddress) {
  const name = sanitizeSymbol(chamaName);
  return submitContractCall(walletAddress, CONTRACT_ID, "add_member", [
    nativeToScVal(name, { type: "symbol" }),
    new Address(walletAddress).toScVal(),
    new Address(memberAddress).toScVal(),
  ]);
}

export async function approveAllowance(walletAddress, tokenId, spender, amount) {
  const server = getServer();
  const ledger = await server.getLatestLedger();
  return submitContractCall(walletAddress, tokenId, "approve", [
    new Address(walletAddress).toScVal(),
    new Address(spender).toScVal(),
    nativeToScVal(amount, { type: "i128" }),
    nativeToScVal(ledger.sequence + 100, { type: "u32" }),
  ]);
}

export async function deposit(walletAddress, chamaName, tokenId, amount) {
  const name = sanitizeSymbol(chamaName);
  return submitContractCall(walletAddress, CONTRACT_ID, "deposit", [
    nativeToScVal(name, { type: "symbol" }),
    new Address(walletAddress).toScVal(),
    new Address(tokenId).toScVal(),
    nativeToScVal(amount, { type: "i128" }),
  ]);
}

export async function proposeWithdrawal(walletAddress, chamaName, amount, recipient) {
  const name = sanitizeSymbol(chamaName);
  return submitContractCall(walletAddress, CONTRACT_ID, "propose_withdrawal", [
    nativeToScVal(name, { type: "symbol" }),
    new Address(walletAddress).toScVal(),
    nativeToScVal(amount, { type: "i128" }),
    new Address(recipient).toScVal(),
  ]);
}

export async function approveWithdrawal(walletAddress, chamaName, tokenId) {
  const name = sanitizeSymbol(chamaName);
  return submitContractCall(walletAddress, CONTRACT_ID, "approve_withdrawal", [
    nativeToScVal(name, { type: "symbol" }),
    new Address(walletAddress).toScVal(),
    new Address(tokenId).toScVal(),
  ]);
}

/** Read-only: fetch a chama's data via simulateTransaction (no signing, no fee). */
export async function getChama(walletAddress, chamaName) {
  const name = sanitizeSymbol(chamaName);
  if (!walletAddress) throw new Error("Wallet not connected");
  const server = getServer();
  const sourceAccount = new Account(walletAddress, "0");

  const tx = new TransactionBuilder(sourceAccount, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      new Contract(CONTRACT_ID).call(
        "get_chama",
        nativeToScVal(name, { type: "symbol" })
      )
    )
    .setTimeout(TX_TIMEOUT)
    .build();

  const result = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(result)) {
    throw new Error(extractErrorMessage(result.error));
  }
  const data = scValToNative(result.result.retval);
  return {
    name: data.name,
    admin: data.admin,
    balance: data.balance, // BigInt, in stroops
    members: data.members || [],
  };
}

// ---------------------------------------------------------------------------
// Local proposal tracking
// ---------------------------------------------------------------------------
// The contract stores one proposal per chama but exposes no getter for it,
// so "pending proposal" state shown in the UI is tracked client-side from
// each device's own successful propose/approve calls. It is a display hint,
// not an authoritative on-chain read.

function proposalKey(chamaName) {
  return `chamavault:proposal:${sanitizeSymbol(chamaName)}`;
}

export function getLocalProposal(chamaName) {
  try {
    const raw = localStorage.getItem(proposalKey(chamaName));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveLocalProposal(chamaName, { amount, recipient, reason }) {
  try {
    localStorage.setItem(
      proposalKey(chamaName),
      JSON.stringify({ amount, recipient, reason, approvals: 0 })
    );
  } catch {
    /* ignore — best-effort UI hint only */
  }
}

/** Returns the updated record, or null once the 2-of-N threshold clears it. */
export function recordLocalApproval(chamaName) {
  const existing = getLocalProposal(chamaName) || { approvals: 0 };
  const approvals = (existing.approvals || 0) + 1;
  if (approvals >= 2) {
    clearLocalProposal(chamaName);
    return null;
  }
  const updated = { ...existing, approvals };
  try {
    localStorage.setItem(proposalKey(chamaName), JSON.stringify(updated));
  } catch {
    /* ignore */
  }
  return updated;
}

export function clearLocalProposal(chamaName) {
  try {
    localStorage.removeItem(proposalKey(chamaName));
  } catch {
    /* ignore */
  }
}
