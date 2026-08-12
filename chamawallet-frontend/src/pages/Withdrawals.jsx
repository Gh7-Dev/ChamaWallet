import { useEffect, useState } from "react";
import { useApp } from "../App";
import GroupSwitcher from "../components/GroupSwitcher";
import LoadingState from "../components/LoadingState";
import SuccessState from "../components/SuccessState";
import ErrorState from "../components/ErrorState";
import AccessGate from "../components/AccessGate";
import {
  getChama,
  proposeWithdrawal,
  approveWithdrawal,
  kesToXlm,
  xlmToStroops,
  saveLocalProposal,
  recordLocalApproval,
  getLocalProposal,
  getNickname,
  XLM_TOKEN_ID,
} from "../stellar";
import { t } from "../translations";

function ProposeForm({ walletAddress, activeGroupName, setActiveGroupName, lang }) {
  const [members, setMembers] = useState([]);
  const [membersStatus, setMembersStatus] = useState("idle");
  const [amountKes, setAmountKes] = useState("");
  const [recipient, setRecipient] = useState("");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState("form");
  const [error, setError] = useState(null);
  const [hash, setHash] = useState(null);
  const tr = t[lang];

  useEffect(() => {
    setRecipient("");
    if (!activeGroupName || !walletAddress) {
      setMembers([]);
      setMembersStatus("idle");
      return undefined;
    }
    let cancelled = false;
    setMembersStatus("loading");
    getChama(walletAddress, activeGroupName)
      .then((chama) => {
        if (cancelled) return;
        setMembers(chama.members || []);
        setMembersStatus("loaded");
      })
      .catch(() => {
        if (cancelled) return;
        setMembers([]);
        setMembersStatus("error");
      });
    return () => { cancelled = true; };
  }, [activeGroupName, walletAddress]);

  const amountNum = Number(amountKes);
  const validAmount = amountKes && Number.isFinite(amountNum) && amountNum > 0;
  const canSubmit = activeGroupName && validAmount && recipient;

  const reset = () => { setStatus("form"); setError(null); setHash(null); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    const stroops = xlmToStroops(kesToXlm(amountNum));
    try {
      setStatus("loading");
      setError(null);
      const result = await proposeWithdrawal(walletAddress, activeGroupName, stroops, recipient);
      saveLocalProposal(activeGroupName, { amount: amountKes, recipient, reason });
      setHash(result.hash);
      setStatus("success");
    } catch (err) {
      setError(err);
      setStatus("error");
    }
  };

  if (status === "loading") return <LoadingState text={tr.submitting} lang={lang} />;
  if (status === "success") {
    return (
      <SuccessState
        title={tr.requestSubmitted}
        message={tr.requestSubmittedMsg}
        hash={hash}
        onBack={reset}
        lang={lang}
      />
    );
  }
  if (status === "error") return <ErrorState error={error} onRetry={handleSubmit} onBack={reset} lang={lang} />;

  return (
    <>
      <div className="card">
        <GroupSwitcher groupName={activeGroupName} onChange={setActiveGroupName} lang={lang} />
      </div>
      <form className="card" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="propose-amount">{tr.amount}</label>
          <input
            id="propose-amount"
            type="number"
            min="0"
            inputMode="decimal"
            value={amountKes}
            onChange={(e) => setAmountKes(e.target.value)}
            placeholder="e.g. 2000"
          />
        </div>
        {validAmount && (
          <div className="amount-preview">≈ {kesToXlm(amountNum).toFixed(4)} XLM</div>
        )}
        <div className="form-group">
          <label htmlFor="propose-recipient">{tr.recipient}</label>
          <select
            id="propose-recipient"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            disabled={!activeGroupName || membersStatus !== "loaded" || members.length === 0}
          >
            <option value="">
              {membersStatus === "loading" ? tr.loadingMembers : tr.selectMember}
            </option>
            {members.map((m) => (
              <option key={m} value={m}>
                👤 {getNickname(m)}{m === walletAddress ? ` (${tr.memberSince})` : ""}
              </option>
            ))}
          </select>
          {membersStatus === "error" && (
            <p className="field-error">{tr.couldNotLoadMembers}</p>
          )}
          {membersStatus === "loaded" && members.length === 0 && (
            <p className="field-error">{tr.noMembersYet}</p>
          )}
        </div>
        <div className="form-group">
          <label htmlFor="propose-reason">{tr.reason}</label>
          <textarea
            id="propose-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. School fees"
          />
          <p className="form-hint">{tr.reasonHint}</p>
        </div>
        <div className="form-actions">
          <button className="btn btn--secondary btn--full" type="submit" disabled={!canSubmit}>
            {tr.propose}
          </button>
        </div>
      </form>
    </>
  );
}

function ApproveForm({ walletAddress, activeGroupName, setActiveGroupName, lang }) {
  const [proposal, setProposal] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [hash, setHash] = useState(null);
  const [finalized, setFinalized] = useState(false);
  const tr = t[lang];

  useEffect(() => {
    setProposal(activeGroupName ? getLocalProposal(activeGroupName) : null);
  }, [activeGroupName]);

  const reset = () => { setStatus("idle"); setError(null); setHash(null); };

  const handleApprove = async () => {
    if (!activeGroupName) return;
    try {
      setStatus("loading");
      setError(null);
      const result = await approveWithdrawal(walletAddress, activeGroupName, XLM_TOKEN_ID);
      const remaining = recordLocalApproval(activeGroupName);
      setHash(result.hash);
      setFinalized(remaining === null);
      setProposal(remaining);
      setStatus("success");
    } catch (err) {
      setError(err);
      setStatus("error");
    }
  };

  if (status === "loading") return <LoadingState text={tr.confirming} lang={lang} />;
  if (status === "success") {
    return (
      <SuccessState
        title={finalized ? tr.fundsSent : tr.approved1}
        message={finalized ? tr.secondApprovalMsg : tr.waitingApproval}
        hash={hash}
        onBack={reset}
        lang={lang}
      />
    );
  }
  if (status === "error") return <ErrorState error={error} onRetry={handleApprove} onBack={reset} lang={lang} />;

  return (
    <>
      <div className="card">
        <GroupSwitcher groupName={activeGroupName} onChange={setActiveGroupName} lang={lang} />
      </div>

      {activeGroupName && proposal && (
        <div className="card">
          <div className="summary-row">
            <span className="summary-row__label">{tr.amount}</span>
            <strong>KES {proposal.amount}</strong>
          </div>
          <div className="summary-row">
            <span className="summary-row__label">{tr.recipient}</span>
            <span>👤 {getNickname(proposal.recipient)}</span>
          </div>
          {proposal.reason && (
            <div className="summary-row">
              <span className="summary-row__label">{tr.reason}</span>
              <span>{proposal.reason}</span>
            </div>
          )}
          <div className="summary-row">
            <span className="summary-row__label">{tr.approve}</span>
            <strong>{proposal.approvals || 0}/2 {tr.approvalOf}</strong>
          </div>
          <div className="notice notice--info" style={{ marginTop: 12 }}>
            {tr.requires2}
          </div>
          <button className="btn btn--secondary btn--full btn--large" onClick={handleApprove}>
            {tr.approve}
          </button>
        </div>
      )}

      {activeGroupName && !proposal && (
        <div className="notice notice--info">{tr.noProposalRight}</div>
      )}
    </>
  );
}

function Withdrawals() {
  const { walletAddress, activeGroupName, setActiveGroupName, activeRole, chamaStatus, lang } = useApp();
  const [tab, setTab] = useState("propose");
  const tr = t[lang];

  const locked = chamaStatus === "found" && !activeRole;

  return (
    <div className="page">
      <div className="page__header">
        <h1>{tr.withdrawal}</h1>
      </div>

      {locked ? (
        <>
          <div className="card">
            <GroupSwitcher groupName={activeGroupName} onChange={setActiveGroupName} lang={lang} />
          </div>
          <AccessGate reason="not-member" />
        </>
      ) : (
        <>
          <div className="segmented">
            <button
              className={`segmented__btn${tab === "propose" ? " segmented__btn--active" : ""}`}
              onClick={() => setTab("propose")}
            >
              {tr.propose}
            </button>
            <button
              className={`segmented__btn${tab === "approve" ? " segmented__btn--active" : ""}`}
              onClick={() => setTab("approve")}
            >
              {tr.approve}
            </button>
          </div>

          {tab === "propose" ? (
            <ProposeForm
              walletAddress={walletAddress}
              activeGroupName={activeGroupName}
              setActiveGroupName={setActiveGroupName}
              lang={lang}
            />
          ) : (
            <ApproveForm
              walletAddress={walletAddress}
              activeGroupName={activeGroupName}
              setActiveGroupName={setActiveGroupName}
              lang={lang}
            />
          )}
        </>
      )}
    </div>
  );
}

export default Withdrawals;
