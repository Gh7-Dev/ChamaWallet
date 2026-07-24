import { useState } from "react";
import { useApp } from "../App";
import LoadingState from "../components/LoadingState";
import SuccessState from "../components/SuccessState";
import ErrorState from "../components/ErrorState";
import {
  proposeWithdrawal,
  approveWithdrawal,
  kesToXlm,
  xlmToStroops,
  sanitizeSymbol,
  saveLocalProposal,
  recordLocalApproval,
  NATIVE_TOKEN_ID,
} from "../stellar";

function ProposeForm({ walletAddress, activeGroupName, setActiveGroupName }) {
  const [chamaName, setChamaName] = useState(activeGroupName || "");
  const [amountKes, setAmountKes] = useState("");
  const [recipient, setRecipient] = useState("");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState("form");
  const [error, setError] = useState(null);
  const [hash, setHash] = useState(null);

  const amountNum = Number(amountKes);
  const validAmount = amountKes && Number.isFinite(amountNum) && amountNum > 0;
  const canSubmit = chamaName.trim() && validAmount && recipient.trim();

  const reset = () => {
    setStatus("form");
    setError(null);
    setHash(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    const name = sanitizeSymbol(chamaName);
    const stroops = xlmToStroops(kesToXlm(amountNum));
    try {
      setStatus("loading");
      setError(null);
      const result = await proposeWithdrawal(walletAddress, name, stroops, recipient.trim());
      saveLocalProposal(name, { amount: amountKes, recipient: recipient.trim(), reason });
      setActiveGroupName(name);
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
    <form className="card" onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="propose-group">Jina la Kikundi / Group Name</label>
        <input
          id="propose-group"
          type="text"
          value={chamaName}
          onChange={(e) => setChamaName(e.target.value)}
          placeholder="e.g. Nguruwe Savings"
        />
      </div>
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
        <label htmlFor="propose-recipient">Akaunti ya Mpokeaji / Recipient Address</label>
        <input
          id="propose-recipient"
          type="text"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value.trim())}
          placeholder="e.g. GABC...XYZ"
        />
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
        <p className="form-hint">Kwa taarifa tu — haihifadhiwi kwenye mfumo / For information only — not stored on chain</p>
      </div>
      <div className="form-actions">
        <button className="btn btn--secondary btn--full" type="submit" disabled={!canSubmit}>
          Omba / Request
        </button>
      </div>
    </form>
  );
}

function ApproveForm({ walletAddress, activeGroupName, setActiveGroupName }) {
  const [chamaName, setChamaName] = useState(activeGroupName || "");
  const [tokenId, setTokenId] = useState(NATIVE_TOKEN_ID);
  const [status, setStatus] = useState("form");
  const [error, setError] = useState(null);
  const [hash, setHash] = useState(null);
  const [finalized, setFinalized] = useState(false);

  const canSubmit = chamaName.trim() && tokenId.trim();

  const reset = () => {
    setStatus("form");
    setError(null);
    setHash(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    const name = sanitizeSymbol(chamaName);
    try {
      setStatus("loading");
      setError(null);
      const result = await approveWithdrawal(walletAddress, name, tokenId.trim());
      const remaining = recordLocalApproval(name);
      setActiveGroupName(name);
      setHash(result.hash);
      setFinalized(remaining === null);
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
  if (status === "error") return <ErrorState error={error} onRetry={handleSubmit} onBack={reset} />;

  return (
    <form className="card" onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="approve-group">Jina la Kikundi / Group Name</label>
        <input
          id="approve-group"
          type="text"
          value={chamaName}
          onChange={(e) => setChamaName(e.target.value)}
          placeholder="e.g. Nguruwe Savings"
        />
      </div>
      <div className="form-group">
        <label htmlFor="approve-token">Akaunti ya Fedha / Token Contract Address</label>
        <input
          id="approve-token"
          type="text"
          value={tokenId}
          onChange={(e) => setTokenId(e.target.value.trim())}
        />
      </div>
      <div className="notice notice--info">Inahitaji idhini 2 / Requires 2 approvals</div>
      <div className="form-actions">
        <button className="btn btn--secondary btn--full" type="submit" disabled={!canSubmit}>
          Idhinisha / Approve
        </button>
      </div>
    </form>
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
