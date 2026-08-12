import { useState } from "react";
import { useApp } from "../App";
import GroupSwitcher from "../components/GroupSwitcher";
import LoadingState from "../components/LoadingState";
import SuccessState from "../components/SuccessState";
import ErrorState from "../components/ErrorState";
import AccessGate from "../components/AccessGate";
import {
  approveAllowance,
  deposit as depositCall,
  kesToXlm,
  xlmToStroops,
  CONTRACT_ID,
  XLM_TOKEN_ID,
} from "../stellar";
import { t } from "../translations";

function Deposit() {
  const { walletAddress, activeGroupName, setActiveGroupName, activeRole, chamaStatus, lang } = useApp();
  const [amountKes, setAmountKes] = useState("");
  const [status, setStatus] = useState("form");
  const [error, setError] = useState(null);
  const [hash, setHash] = useState(null);
  const tr = t[lang];

  const amountNum = Number(amountKes);
  const validAmount = amountKes && Number.isFinite(amountNum) && amountNum > 0;
  const xlmPreview = validAmount ? kesToXlm(amountNum) : 0;

  const reset = () => { setStatus("form"); setError(null); setHash(null); };

  const handleDeposit = async (e) => {
    e.preventDefault();
    if (!activeGroupName || !validAmount || !walletAddress) return;
    const stroops = xlmToStroops(xlmPreview);
    try {
      setError(null);
      setStatus("approving");
      await approveAllowance(walletAddress, XLM_TOKEN_ID, CONTRACT_ID, stroops);
      setStatus("depositing");
      const result = await depositCall(walletAddress, activeGroupName, XLM_TOKEN_ID, stroops);
      setHash(result.hash);
      setStatus("success");
    } catch (err) {
      setError(err);
      setStatus("error");
    }
  };

  if (status === "approving" || status === "depositing") {
    return (
      <div className="page">
        <div className="steps">
          <div className={`step${status === "approving" ? " step--active" : " step--done"}`}>
            {tr.approveStep}
          </div>
          <div className={`step${status === "depositing" ? " step--active" : ""}`}>
            {tr.depositStep}
          </div>
        </div>
        <LoadingState text={status === "approving" ? tr.approvingAllowance : tr.depositingFunds} lang={lang} />
      </div>
    );
  }

  if (status === "success") {
    return (
      <SuccessState
        title={tr.fundsDeposited}
        message={`KES ${amountKes} (~${xlmPreview.toFixed(2)} XLM) ${tr.depositedMsg} ${activeGroupName}`}
        hash={hash}
        onBack={reset}
        lang={lang}
      />
    );
  }

  if (status === "error") {
    return <ErrorState error={error} onRetry={handleDeposit} onBack={reset} lang={lang} />;
  }

  return (
    <div className="page">
      <div className="page__header">
        <h1>{tr.deposit}</h1>
      </div>

      <div className="card">
        <GroupSwitcher groupName={activeGroupName} onChange={setActiveGroupName} lang={lang} />
      </div>

      {chamaStatus === "found" && !activeRole ? (
        <AccessGate reason="not-member" />
      ) : (
        <form className="card" onSubmit={handleDeposit}>
          <div className="form-group">
            <label htmlFor="deposit-amount">{tr.amount}</label>
            <input
              id="deposit-amount"
              type="number"
              min="0"
              inputMode="decimal"
              value={amountKes}
              onChange={(e) => setAmountKes(e.target.value)}
              placeholder="e.g. 500"
            />
          </div>

          {validAmount && (
            <div className="amount-preview">≈ {xlmPreview.toFixed(4)} XLM</div>
          )}

          <div className="form-actions">
            <button
              className="btn btn--secondary btn--full"
              type="submit"
              disabled={!activeGroupName || !validAmount || !activeRole}
            >
              {tr.deposit}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default Deposit;
