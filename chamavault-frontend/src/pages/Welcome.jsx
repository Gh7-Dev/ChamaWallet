import { useEffect, useState } from "react";
import LoadingState from "../components/LoadingState";
import ErrorState from "../components/ErrorState";
import { connectWallet, isFreighterInstalled } from "../stellar";
import { t } from "../translations";

const LANG_KEY = "chamavault_lang";

function Welcome({ onConnected, lang, setLang }) {
  const [checkingExtension, setCheckingExtension] = useState(true);
  const [installed, setInstalled] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);
  const tr = t[lang];

  useEffect(() => {
    let cancelled = false;
    isFreighterInstalled().then((result) => {
      if (cancelled) return;
      setInstalled(result);
      setCheckingExtension(false);
    });
    return () => { cancelled = true; };
  }, []);

  const handleSignIn = async () => {
    setError(null);
    setConnecting(true);
    try {
      const address = await connectWallet();
      onConnected(address);
    } catch (err) {
      setError(err);
    } finally {
      setConnecting(false);
    }
  };

  const toggleLang = () => {
    const next = lang === "en" ? "sw" : "en";
    setLang(next);
    try { localStorage.setItem(LANG_KEY, next); } catch { /* ignore */ }
  };

  if (connecting) return <LoadingState text={tr.processing} lang={lang} />;

  if (error) {
    return (
      <div className="welcome">
        <button className="lang-toggle lang-toggle--welcome" onClick={toggleLang} type="button">
          {lang === "en" ? "🇰🇪 Swahili" : "🇬🇧 English"}
        </button>
        <ErrorState error={error} onRetry={handleSignIn} onBack={() => setError(null)} lang={lang} />
      </div>
    );
  }

  return (
    <div className="welcome">
      <button className="lang-toggle lang-toggle--welcome" onClick={toggleLang} type="button">
        {lang === "en" ? "🇰🇪 Swahili" : "🇬🇧 English"}
      </button>

      <div className="welcome__logo">
        Chama<span>Vault</span>
      </div>
      <p className="welcome__tagline">{tr.tagline}</p>

      <div className="welcome__card">
        {checkingExtension ? (
          <button className="btn btn--primary btn--full" disabled>
            {tr.checkingExtension}
          </button>
        ) : installed ? (
          <button className="btn btn--primary btn--full" onClick={handleSignIn}>
            {tr.signIn}
          </button>
        ) : (
          <div className="welcome__install">
            {tr.freighterMissing}
            <br />
            <a href="https://www.freighter.app/" target="_blank" rel="noreferrer">
              {tr.downloadFreighter}
            </a>
          </div>
        )}
      </div>

      <p className="welcome__disclaimer">{tr.disclaimer}</p>
    </div>
  );
}

export default Welcome;
