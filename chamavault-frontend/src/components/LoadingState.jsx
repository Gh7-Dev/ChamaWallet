import { useEffect, useState } from "react";

const DEFAULT_MESSAGES = [
  "Inasubiri... / Processing...",
  "Inaunganisha... / Connecting...",
  "Inathibitisha... / Confirming...",
];

/**
 * Full-panel loading indicator. Pass `text` for a fixed message tied to a
 * specific step (e.g. deposit's two-step flow); omit it to cycle through
 * the default rotating messages.
 */
function LoadingState({ text }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (text) return undefined;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % DEFAULT_MESSAGES.length);
    }, 1600);
    return () => clearInterval(id);
  }, [text]);

  return (
    <div className="state-screen" role="status" aria-live="polite">
      <div className="spinner" />
      <p className="state-screen__message">{text || DEFAULT_MESSAGES[index]}</p>
    </div>
  );
}

export default LoadingState;
