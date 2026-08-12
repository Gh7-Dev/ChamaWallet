import { t } from "../translations";

function SuccessState({ title, message, hash, onBack, backLabel, lang }) {
  const tr = t[lang || "en"];
  const shortHash = hash ? `${hash.slice(0, 6)}...${hash.slice(-6)}` : null;

  return (
    <div className="state-screen">
      <div className="state-icon state-icon--success" aria-hidden="true">✓</div>
      <h3 className="state-screen__title">{title || tr.success}</h3>
      {message && <p className="state-screen__message">{message}</p>}
      {shortHash && (
        <p className="state-screen__hash">
          {tr.confirmNumber}: {shortHash}
        </p>
      )}
      {onBack && (
        <button className="btn btn--primary" onClick={onBack}>
          {backLabel || tr.back}
        </button>
      )}
    </div>
  );
}

export default SuccessState;
