import { mapError } from "../stellar";

/** Renders any error (raw SDK error, Error instance, or string) as a safe,
 * plain-language bilingual message. Raw error text is never shown. */
function ErrorState({ error, onRetry, onBack }) {
  const message = mapError(error);

  return (
    <div className="state-screen">
      <div className="state-icon state-icon--error" aria-hidden="true">
        ✕
      </div>
      <h3 className="state-screen__title">Hitilafu / Error</h3>
      <p className="state-screen__message" style={{ marginBottom: 20 }}>
        {message}
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        {onRetry && (
          <button className="btn btn--secondary" onClick={onRetry}>
            Jaribu tena / Try again
          </button>
        )}
        {onBack && (
          <button className="btn btn--outline" onClick={onBack}>
            Rudi / Back
          </button>
        )}
      </div>
    </div>
  );
}

export default ErrorState;
