import { useEffect, useState } from "react";
import { t } from "../translations";

/**
 * Full-panel loading indicator. Pass `text` for a fixed message tied to a
 * specific step (e.g. deposit's two-step flow); omit it to cycle through
 * the language-appropriate default messages.
 */
function LoadingState({ text, lang }) {
  const tr = t[lang || "en"];
  const defaultMessages = [tr.processing, tr.connecting, tr.confirming];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (text) return undefined;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % defaultMessages.length);
    }, 1600);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, lang]);

  return (
    <div className="state-screen" role="status" aria-live="polite">
      <div className="spinner" />
      <p className="state-screen__message">{text || defaultMessages[index]}</p>
    </div>
  );
}

export default LoadingState;
