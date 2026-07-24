import { useEffect, useState } from "react";
import LoadingState from "../components/LoadingState";
import ErrorState from "../components/ErrorState";
import { connectWallet, isFreighterInstalled } from "../stellar";

function Welcome({ onConnected }) {
  const [checkingExtension, setCheckingExtension] = useState(true);
  const [installed, setInstalled] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    isFreighterInstalled().then((result) => {
      if (cancelled) return;
      setInstalled(result);
      setCheckingExtension(false);
    });
    return () => {
      cancelled = true;
    };
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

  if (connecting) {
    return <LoadingState text="Inaunganisha... / Connecting..." />;
  }

  if (error) {
    return (
      <div className="welcome">
        <ErrorState error={error} onRetry={handleSignIn} onBack={() => setError(null)} />
      </div>
    );
  }

  return (
    <div className="welcome">
      <div className="welcome__logo">
        Chama<span>Vault</span>
      </div>
      <p className="welcome__tagline">Fedha Salama kwa Kikundi Chako / Safe Funds for Your Group</p>

      <div className="welcome__card">
        {checkingExtension ? (
          <button className="btn btn--primary btn--full" disabled>
            Inaangalia... / Checking...
          </button>
        ) : installed ? (
          <button className="btn btn--primary btn--full" onClick={handleSignIn}>
            Ingia / Sign In
          </button>
        ) : (
          <div className="welcome__install">
            Unahitaji programu ya Freighter kutumia ChamaVault. / You need the
            Freighter extension to use ChamaVault.
            <br />
            <a href="https://www.freighter.app/" target="_blank" rel="noreferrer">
              Pakua Freighter / Download Freighter
            </a>
          </div>
        )}
      </div>

      <p className="welcome__disclaimer">
        ChamaVault inatumia teknolojia salama kulinda fedha zako / ChamaVault
        uses secure technology to protect your funds
      </p>
    </div>
  );
}

export default Welcome;
