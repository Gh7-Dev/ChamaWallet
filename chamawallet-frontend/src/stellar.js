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
  import.meta.env.VITE_CONTRACT_ID ||
  "CCBCXYFUNTXZ5A76QPQEPHCRBOT7NQ5KXZSUUOTOTSMWRM2R7Y7EFJUI";

// Mirrors the contract's Role / ChamaStatus enums, which encode over the
// wire as plain Symbols — scValToNative hands these back as bare strings.
export const ROLES = {
  CHAIRPERSON: "Chairperson",
  SECRETARY: "Secretary",
  TREASURER: "Treasurer",
  MEMBER: "Member",
};

export const CHAMA_STATUS = {
  PROPOSED: "Proposed",
  ACTIVE: "Active",
};
export const NETWORK_PASSPHRASE = Networks.TESTNET;
export const RPC_URL = "https://soroban-testnet.stellar.org";
export const TX_TIMEOUT = 120;
export const POLL_INTERVAL_MS = 2000;
export const POLL_MAX_ATTEMPTS = 60; // ~120s

// SEP-41 contract id for native XLM on Stellar Testnet.
// Verified via Asset.native().contractId(Networks.TESTNET) — do not edit
// by hand, an invalid StrKey here breaks every deposit/approve call.
export const XLM_TOKEN_ID =
  import.meta.env.VITE_XLM_TOKEN_ID ||
  "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

let cachedServer = null;
export function getServer() {
  if (!cachedServer) {
    cachedServer = new rpc.Server(RPC_URL);
  }
  return cachedServer;
}

const KES_PER_XLM = Number(import.meta.env.VITE_KES_PER_XLM) || 15;
const RELAYER_URL = import.meta.env.VITE_RELAYER_URL || null;
const STROOPS_PER_XLM = 10_000_000; // 7 decimals

// ---------------------------------------------------------------------------
// Relayer integration
// ---------------------------------------------------------------------------

/**
 * Attempt to sponsor a signed transaction XDR through the backend relayer.
 * If VITE_RELAYER_URL is not set, or the relayer rejects (non-2xx), falls
 * back to direct submission so the user can still pay their own fee.
 *
 * Returns { hash, ledger } on relayer success, or null to signal fallback.
 */
export async function sponsorTransaction(walletAddress, chamaId, signedXdr) {
  if (!RELAYER_URL) return null;
  try {
    const res = await fetch(`${RELAYER_URL}/api/v1/relayer/sponsor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chamaId,
        memberAddress: walletAddress,
        transactionXdr: signedXdr,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      // eslint-disable-next-line no-console
      console.warn("[ChamaWallet] Relayer declined sponsorship:", body.error);
      return null;
    }
    return await res.json(); // { success, txHash, ledger }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[ChamaWallet] Relayer unreachable, falling back to direct submission:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** "GABCD...WXYZ" -> "GABCD...WXYZ" shortened for display. */
export function shortenAddress(address) {
  if (!address || typeof address !== "string") return "";
  if (address.length <= 12) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function getNickname(address) {
  try {
    const users = JSON.parse(localStorage.getItem("chamawallet_users") || "{}");
    return users[address] || `${address.slice(0, 4)}...${address.slice(-4)}`;
  } catch {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  }
}

export function saveNickname(address, nickname) {
  try {
    const users = JSON.parse(localStorage.getItem("chamawallet_users") || "{}");
    users[address] = nickname.trim();
    localStorage.setItem("chamawallet_users", JSON.stringify(users));
  } catch {
    /* ignore */
  }
}

/** Replace spaces with underscores so the value is a valid Soroban Symbol. */
export function sanitizeSymbol(value) {
  return (value || "").trim().replace(/\s+/g, "_");
}

/** Lightweight format check for a Stellar G... account address (56 chars, base32). */
export function isValidStellarAddress(value) {
  return typeof value === "string" && /^G[A-Z2-7]{55}$/.test(value.trim());
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
  [/not a (chama )?member/i, "Hujasajiliwa katika kikundi hiki / Not registered in this group"],
  [/already executed/i, "Tayari imetekelezwa / Already executed"],
  [/insufficient/i, "Salio haitoshi / Insufficient balance"],
  [/group already exists/i, "Kikundi chenye jina hilo tayari kipo / A group with that name already exists"],
  [/chairperson already filled|secretary already filled|treasurer already filled|invalid founding role/i, "Nafasi hiyo tayari imejazwa / That role is already filled"],
  [/only secretary can approve/i, "Katibu pekee anaweza kuidhinisha / Only the secretary can approve members"],
  [/no pending request/i, "Hakuna ombi kutoka kwa akaunti hii / No pending request from this address"],
  [/request already pending/i, "Ombi lako tayari linasubiri / Your request is already pending"],
  [/group is not yet active|group already active/i, "Kikundi bado hakijawa tayari / This group isn't ready yet"],
  [/already a member/i, "Tayari wewe ni mwanachama / You're already a member"],
  [/not found|missingvalue|unwrap.*none/i, "Kikundi hakipatikani / Group not found"],
  [/user rejected|user declined|not authorized to sign/i, "Ulikataa kuidhinisha / You cancelled the approval"],
  [/freighter|extension/i, "Freighter haijasakinishwa / Freighter extension not found"],
  [/failed to fetch|network|offline/i, "Hakuna mtandao / No internet connection"],
  [/txfailed|transaction failed/i, "Malipo hayakufanikiwa, jaribu tena / Payment failed, try again"],
  [/timeout|timed out/i, "Muda umeisha, jaribu tena / Timed out, please try again"],
  [/hosterror/i, "Kuna tatizo la kiufundi, jaribu tena / Technical error, try again"],
];

/**
 * Map any raw error into a friendly bilingual message — the UI never
 * renders the raw text. It IS logged to the console (dev-tools only,
 * never on-screen) so real problems stay diagnosable during testing.
 */
export function mapError(err) {
  const raw = extractErrorMessage(err);
  // eslint-disable-next-line no-console
  console.error("[ChamaWallet] contract/SDK error:", raw, err);
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

  // Attempt relayer sponsorship first; fall back to direct submission if
  // the relayer is unavailable, rate-limited, or the float is locked.
  const chamaId = opts.chamaId || null;
  if (chamaId) {
    const sponsored = await sponsorTransaction(walletAddress, chamaId, signedTxXdr);
    if (sponsored?.success) {
      return { hash: sponsored.txHash, confirmed: { ledger: sponsored.ledger } };
    }
  }

  // Direct submission fallback
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

// The Rust contract's fieldless enums (Role, ChamaStatus) encode over the
// wire as a one-element Vec containing the variant name Symbol — e.g.
// Role::Chairperson is ScVal::Vec([ScVal::Symbol("Chairperson")]), NOT a
// bare Symbol. (Confirmed by decoding the Stellar CLI's own generated XDR
// — its human-readable JSON output hides this wrapping, which is what led
// to the original bug: a bare Symbol here made the contract's argument
// decoder trap on every call.) Reads must unwrap the same way — see
// getChama() below.
function roleToScVal(role) {
  return nativeToScVal([role], { type: "symbol" });
}

/**
 * Proposes a new chama: the caller claims exactly one founding role for
 * themselves (their own choice). The other two seats start empty — nobody
 * ever supplies another person's address. The group stays Proposed (not
 * usable by anyone) until two other people each fillRole their own seat.
 */
export async function proposeChama(walletAddress, chamaName, role) {
  const name = sanitizeSymbol(chamaName);
  return submitContractCall(walletAddress, CONTRACT_ID, "propose_chama", [
    nativeToScVal(name, { type: "symbol" }),
    roleToScVal(role),
    new Address(walletAddress).toScVal(),
  ]);
}

/**
 * Fills an empty founding seat with the CALLER'S OWN address (never
 * someone else's) — activates the group once all three seats are filled.
 */
export async function fillRole(walletAddress, chamaName, role) {
  const name = sanitizeSymbol(chamaName);
  return submitContractCall(walletAddress, CONTRACT_ID, "fill_role", [
    nativeToScVal(name, { type: "symbol" }),
    new Address(walletAddress).toScVal(),
    roleToScVal(role),
  ]);
}

/** Requests membership in an Active group; a secretary must approve_join it. */
export async function requestJoin(walletAddress, chamaName) {
  const name = sanitizeSymbol(chamaName);
  return submitContractCall(walletAddress, CONTRACT_ID, "request_join", [
    nativeToScVal(name, { type: "symbol" }),
    new Address(walletAddress).toScVal(),
  ]);
}

/** Secretary-only: approves a pending join request. */
export async function approveJoin(walletAddress, chamaName, newMemberAddress) {
  const name = sanitizeSymbol(chamaName);
  return submitContractCall(walletAddress, CONTRACT_ID, "approve_join", [
    nativeToScVal(name, { type: "symbol" }),
    new Address(walletAddress).toScVal(),
    new Address(newMemberAddress).toScVal(),
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
  ], { chamaId: name });
}

export async function proposeWithdrawal(walletAddress, chamaName, amount, recipient) {
  const name = sanitizeSymbol(chamaName);
  return submitContractCall(walletAddress, CONTRACT_ID, "propose_withdrawal", [
    nativeToScVal(name, { type: "symbol" }),
    new Address(walletAddress).toScVal(),
    nativeToScVal(amount, { type: "i128" }),
    new Address(recipient).toScVal(),
  ], { chamaId: name });
}

export async function approveWithdrawal(walletAddress, chamaName, tokenId) {
  const name = sanitizeSymbol(chamaName);
  return submitContractCall(walletAddress, CONTRACT_ID, "approve_withdrawal", [
    nativeToScVal(name, { type: "symbol" }),
    new Address(walletAddress).toScVal(),
    new Address(tokenId).toScVal(),
  ], { chamaId: name });
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
    chairperson: data.chairperson ?? null, // null until someone fills this seat
    secretary: data.secretary ?? null,
    treasurer: data.treasurer ?? null,
    balance: data.balance, // BigInt, in stroops
    members: data.members || [], // only ever contains people who've self-claimed a seat
    // scValToNative decodes the fieldless ChamaStatus enum as ["Proposed"]
    // or ["Active"] (a one-element array), not a bare string — unwrap it.
    status: Array.isArray(data.status) ? data.status[0] : data.status,
    pendingMembers: data.pending_members || [],
  };
}

/**
 * Pure helper: derive a wallet's role from an already-loaded chama object.
 * Every founding seat is filled by that person's own fill_role/propose_chama
 * call, so membership and role are established atomically — there's no
 * "named but not yet confirmed" state to account for here.
 */
export function roleFromChama(chama, address) {
  if (!chama || !address || !chama.members?.includes(address)) return null;
  if (chama.chairperson === address) return ROLES.CHAIRPERSON;
  if (chama.secretary === address) return ROLES.SECRETARY;
  if (chama.treasurer === address) return ROLES.TREASURER;
  return ROLES.MEMBER;
}

export async function isMember(walletAddress, chamaName) {
  const chama = await getChama(walletAddress, chamaName);
  return chama.members.some((m) => m === walletAddress);
}

export async function getRole(walletAddress, chamaName) {
  const chama = await getChama(walletAddress, chamaName);
  return roleFromChama(chama, walletAddress);
}

// ---------------------------------------------------------------------------
// Local proposal tracking
// ---------------------------------------------------------------------------
// The contract stores one proposal per chama but exposes no getter for it,
// so "pending proposal" state shown in the UI is tracked client-side from
// each device's own successful propose/approve calls. It is a display hint,
// not an authoritative on-chain read.

function proposalKey(chamaName) {
  return `chamawallet:proposal:${sanitizeSymbol(chamaName)}`;
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
