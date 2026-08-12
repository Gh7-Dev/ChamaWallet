import { mapError } from "../stellar";
import { t } from "../translations";

function ErrorState({ error, onRetry, onBack, lang }) {
  const tr = t[lang || "en"];
  const message = mapError(error);

  return (
    <div className="state-screen">
      <div className="state-icon state-icon--error" aria-hidden="true">✕</div>
      <h3 className="state-screen__title">{tr.error}</h3>
      <p className="state-screen__message" style={{ marginBottom: 20 }}>{message}</p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        {onRetry && (
          <button className="btn btn--secondary" onClick={onRetry}>{tr.tryAgain}</button>
        )}
        {onBack && (
          <button className="btn btn--outline" onClick={onBack}>{tr.back}</button>
        )}
      </div>
    </div>
  );
}

export default ErrorState;
