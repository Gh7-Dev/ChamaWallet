import { shortenAddress } from "../stellar";

function SuccessState({ title, message, hash, onBack, backLabel }) {
  return (
    <div className="state-screen">
      <div className="state-icon state-icon--success" aria-hidden="true">
        ✓
      </div>
      <h3 className="state-screen__title">{title || "Imefanikiwa! / Success!"}</h3>
      {message && <p className="state-screen__message">{message}</p>}
      {hash && (
        <p className="state-screen__hash">
          Nambari ya uthibitisho / Confirmation number: {shortenAddress(hash)}
        </p>
      )}
      {onBack && (
        <button className="btn btn--primary" onClick={onBack}>
          {backLabel || "Rudi / Back"}
        </button>
      )}
    </div>
  );
}

export default SuccessState;
