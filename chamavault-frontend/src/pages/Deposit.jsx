import { useState } from "react";
import { useApp } from "../App";
import LoadingState from "../components/LoadingState";
import SuccessState from "../components/SuccessState";
import ErrorState from "../components/ErrorState";
import {
  approveAllowance,
  deposit as depositCall,
  kesToXlm,
  xlmToStroops,
  sanitizeSymbol,
  CONTRACT_ID,
  NATIVE_TOKEN_ID,
} from "../stellar";

function Deposit() {
  const { walletAddress, activeGroupName, setActiveGroupName } = useApp();
  const [chamaName, setChamaName] = useState(activeGroupName || "");
  const [tokenId, setTokenId] = useState(NATIVE_TOKEN_ID);
  const [amountKes, setAmountKes] = useState("");
  const [status, setStatus] = useState("form"); // form | approving | depositing | success | error
  const [error, setError] = useState(null);
  const [hash, setHash] = useState(null);

  const amountNum = Number(amountKes);
  const validAmount = amountKes && Number.isFinite(amountNum) && amountNum > 0;
  const xlmPreview = validAmount ? kesToXlm(amountNum) : 0;

  const reset = () => {
    setStatus("form");
    setError(null);
    setHash(null);
  };

  const handleDeposit = async (e) => {
    e.preventDefault();
    const name = sanitizeSymbol(chamaName);
    if (!name || !validAmount || !tokenId.trim() || !walletAddress) return;

    const stroops = xlmToStroops(xlmPreview);
    try {
      setError(null);
      setStatus("approving");
      await approveAllowance(walletAddress, tokenId.trim(), CONTRACT_ID, stroops);

      setStatus("depositing");
      const result = await depositCall(walletAddress, name, tokenId.trim(), stroops);

      setActiveGroupName(name);
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
            1. Ruhusu / Approve allowance
          </div>
          <div className={`step${status === "depositing" ? " step--active" : ""}`}>
            2. Weka / Deposit funds
          </div>
        </div>
        <LoadingState
          text={
            status === "approving"
              ? "Inaruhusu... / Approving..."
              : "Inaweka fedha... / Depositing..."
          }
        />
      </div>
    );
  }

  if (status === "success") {
    return (
      <SuccessState
        title="Fedha imewekwa! / Funds deposited!"
        message={`KES ${amountKes} (~${xlmPreview.toFixed(2)} XLM) imewekwa kwenye ${chamaName}`}
        hash={hash}
        onBack={reset}
      />
    );
  }

  if (status === "error") {
    return <ErrorState error={error} onRetry={handleDeposit} onBack={reset} />;
  }

  return (
    <div className="page">
      <div className="page__header">
        <h1>Weka Fedha / Deposit</h1>
      </div>

      <form className="card" onSubmit={handleDeposit}>
        <div className="form-group">
          <label htmlFor="deposit-group">Jina la Kikundi / Group Name</label>
          <input
            id="deposit-group"
            type="text"
            value={chamaName}
            onChange={(e) => setChamaName(e.target.value)}
            placeholder="e.g. Nguruwe Savings"
          />
        </div>

        <div className="form-group">
          <label htmlFor="deposit-amount">Kiasi / Amount (KES)</label>
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
          <div className="amount-preview">
            ≈ {xlmPreview.toFixed(4)} Fedha (XLM)
          </div>
        )}

        <div className="form-group">
          <label htmlFor="deposit-token">Akaunti ya Fedha / Token Contract Address</label>
          <input
            id="deposit-token"
            type="text"
            value={tokenId}
            onChange={(e) => setTokenId(e.target.value.trim())}
          />
          <p className="form-hint">Imejazwa kiotomatiki / Pre-filled — usually no need to change</p>
        </div>

        <div className="form-actions">
          <button
            className="btn btn--secondary btn--full"
            type="submit"
            disabled={!chamaName.trim() || !validAmount || !tokenId.trim()}
          >
            Weka Fedha / Deposit
          </button>
        </div>
      </form>
    </div>
  );
}

export default Deposit;
