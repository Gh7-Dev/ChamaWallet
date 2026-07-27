import { useEffect, useState } from "react";
import { useApp } from "../App";
import GroupSwitcher from "../components/GroupSwitcher";
import LoadingState from "../components/LoadingState";
import SuccessState from "../components/SuccessState";
import ErrorState from "../components/ErrorState";
import {
  getChama,
  proposeWithdrawal,
  approveWithdrawal,
  kesToXlm,
  xlmToStroops,
  shortenAddress,
  saveLocalProposal,
  recordLocalApproval,
  getLocalProposal,
  XLM_TOKEN_ID,
} from "../stellar";

function ProposeForm({ walletAddress, activeGroupName, setActiveGroupName }) {
  const [members, setMembers] = useState([]);
  const [membersStatus, setMembersStatus] = useState("idle"); // idle | loading | loaded | error
  const [amountKes, setAmountKes] = useState("");
  const [recipient, setRecipient] = useState("");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState("form");
  const [error, setError] = useState(null);
  const [hash, setHash] = useState(null);

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
    return () => {
      cancelled = true;
    };
  }, [activeGroupName, walletAddress]);

  const amountNum = Number(amountKes);
  const validAmount = amountKes && Number.isFinite(amountNum) && amountNum > 0;
  const canSubmit = activeGroupName && validAmount && recipient;

  const reset = () => {
    setStatus("form");
    setError(null);
    setHash(null);
  };

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

  if (status === "loading") return <LoadingState text="Inatuma ombi... / Submitting request..." />;
  if (status === "success") {
    return (
      <SuccessState
        title="Ombi limetumwa! / Request submitted!"
        message="Wanachama wataidhinisha ombi hili kabla ya fedha kutumwa. / Members will approve this request before funds are sent."
        hash={hash}
        onBack={reset}
      />
    );
  }
  if (status === "error") return <ErrorState error={error} onRetry={handleSubmit} onBack={reset} />;

  return (
    <>
      <div className="card">
        <GroupSwitcher groupName={activeGroupName} onChange={setActiveGroupName} />
      </div>
      <form className="card" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="propose-amount">Kiasi / Amount (KES)</label>
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
          <div className="amount-preview">≈ {kesToXlm(amountNum).toFixed(4)} Fedha (XLM)</div>
        )}
        <div className="form-group">
          <label htmlFor="propose-recipient">Mpokeaji / Recipient</label>
          <select
            id="propose-recipient"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            disabled={!activeGroupName || membersStatus !== "loaded" || members.length === 0}
          >
            <option value="">
              {membersStatus === "loading"
                ? "Inapakia wanachama... / Loading members..."
                : "Chagua mwanachama / Select a member"}
            </option>
            {members.map((m) => (
              <option key={m} value={m}>
                {shortenAddress(m)}
                {m === walletAddress ? " (Wewe / You)" : ""}
              </option>
            ))}
          </select>
          {membersStatus === "error" && (
            <p className="field-error">
              Imeshindwa kupakia wanachama / Could not load members
            </p>
          )}
          {membersStatus === "loaded" && members.length === 0 && (
            <p className="field-error">
              Hakuna wanachama kwenye kikundi hiki / No members in this group yet
            </p>
          )}
        </div>
        <div className="form-group">
          <label htmlFor="propose-reason">Sababu / Reason</label>
          <textarea
            id="propose-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. School fees for members"
          />
          <p className="form-hint">
            Kwa taarifa tu — haihifadhiwi kwenye mfumo / For information only — not stored on chain
          </p>
        </div>
        <div className="form-actions">
          <button className="btn btn--secondary btn--full" type="submit" disabled={!canSubmit}>
            Omba / Request
          </button>
        </div>
      </form>
    </>
  );
}

function ApproveForm({ walletAddress, activeGroupName, setActiveGroupName }) {
  const [proposal, setProposal] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [error, setError] = useState(null);
  const [hash, setHash] = useState(null);
  const [finalized, setFinalized] = useState(false);

  useEffect(() => {
    setProposal(activeGroupName ? getLocalProposal(activeGroupName) : null);
  }, [activeGroupName]);

  const reset = () => {
    setStatus("idle");
    setError(null);
    setHash(null);
  };

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

  if (status === "loading") return <LoadingState text="Inathibitisha... / Confirming..." />;
  if (status === "success") {
    return (
      <SuccessState
        title={finalized ? "Fedha imetumwa! / Funds sent!" : "Imeidhinishwa! / Approved!"}
        message={
          finalized
            ? "Idhini ya pili imekamilisha malipo. / The second approval completed the payment."
            : "Inasubiri idhini nyingine moja. / Waiting for one more approval."
        }
        hash={hash}
        onBack={reset}
      />
    );
  }
  if (status === "error") return <ErrorState error={error} onRetry={handleApprove} onBack={reset} />;

  return (
    <>
      <div className="card">
        <GroupSwitcher groupName={activeGroupName} onChange={setActiveGroupName} />
      </div>

      {activeGroupName && proposal && (
        <div className="card">
          <div className="summary-row">
            <span className="summary-row__label">Kiasi / Amount</span>
            <strong>KES {proposal.amount}</strong>
          </div>
          <div className="summary-row">
            <span className="summary-row__label">Mpokeaji / Recipient</span>
            <span>{shortenAddress(proposal.recipient)}</span>
          </div>
          {proposal.reason && (
            <div className="summary-row">
              <span className="summary-row__label">Sababu / Reason</span>
              <span>{proposal.reason}</span>
            </div>
          )}
          <div className="summary-row">
            <span className="summary-row__label">Idhini / Approvals</span>
            <strong>{proposal.approvals || 0}/2</strong>
          </div>
          <div className="notice notice--info" style={{ marginTop: 12 }}>
            Inahitaji idhini 2 / Requires 2 approvals
          </div>
          <button className="btn btn--secondary btn--full btn--large" onClick={handleApprove}>
            Idhinisha / Approve
          </button>
        </div>
      )}

      {activeGroupName && !proposal && (
        <div className="notice notice--info">
          Hakuna ombi linalosubiri kwa sasa / No pending request right now
        </div>
      )}
    </>
  );
}

function Withdrawals() {
  const { walletAddress, activeGroupName, setActiveGroupName } = useApp();
  const [tab, setTab] = useState("propose");

  return (
    <div className="page">
      <div className="page__header">
        <h1>Ombi la Fedha / Withdrawal</h1>
      </div>

      <div className="segmented">
        <button
          className={`segmented__btn${tab === "propose" ? " segmented__btn--active" : ""}`}
          onClick={() => setTab("propose")}
        >
          Omba / Request
        </button>
        <button
          className={`segmented__btn${tab === "approve" ? " segmented__btn--active" : ""}`}
          onClick={() => setTab("approve")}
        >
          Idhinisha / Approve
        </button>
      </div>

      {tab === "propose" ? (
        <ProposeForm
          walletAddress={walletAddress}
          activeGroupName={activeGroupName}
          setActiveGroupName={setActiveGroupName}
        />
      ) : (
        <ApproveForm
          walletAddress={walletAddress}
          activeGroupName={activeGroupName}
          setActiveGroupName={setActiveGroupName}
        />
      )}
    </div>
  );
}

export default Withdrawals;
