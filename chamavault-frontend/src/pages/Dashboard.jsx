import { useEffect, useState } from "react";
import { useApp } from "../App";
import GroupCard from "../components/GroupCard";
import GroupSwitcher from "../components/GroupSwitcher";
import LoadingState from "../components/LoadingState";
import ErrorState from "../components/ErrorState";
import {
  getChama,
  getLocalProposal,
  shortenAddress,
  stroopsToXlm,
  xlmToKes,
  formatKes,
} from "../stellar";

function Dashboard() {
  const { walletAddress, activeGroupName, setActiveGroupName, navigate } = useApp();
  const [status, setStatus] = useState("idle"); // idle | loading | found | error
  const [chama, setChama] = useState(null);
  const [error, setError] = useState(null);

  const load = async (name) => {
    setStatus("loading");
    setError(null);
    try {
      const result = await getChama(walletAddress, name);
      setChama(result);
      setStatus("found");
    } catch (err) {
      setChama(null);
      setError(err);
      setStatus("error");
    }
  };

  // Auto-load on login: no search box, no typing — the stored group name
  // (or one just entered via GroupSwitcher) loads straight away.
  useEffect(() => {
    if (activeGroupName) load(activeGroupName);
    else setStatus("idle");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroupName, walletAddress]);

  const pendingCount = chama && getLocalProposal(chama.name) ? 1 : 0;
  const isMember = chama && chama.members?.includes(walletAddress);
  const kes = chama ? xlmToKes(stroopsToXlm(chama.balance || 0)) : 0;

  return (
    <div className="page">
      <div className="page__header">
        <h1>Habari / Hello, {shortenAddress(walletAddress)}</h1>
      </div>

      <div className="stats-row">
        <div className="stat-tile">
          <div className="stat-tile__label">Salio / Balance (KES)</div>
          <div className="stat-tile__value">{chama ? formatKes(kes) : "—"}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile__label">Wanachama / Members</div>
          <div className="stat-tile__value">{chama ? chama.members.length : "—"}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile__label">Maombi / Pending</div>
          <div className="stat-tile__value">{chama ? pendingCount : "—"}</div>
        </div>
      </div>

      <div className="card">
        <GroupSwitcher groupName={activeGroupName} onChange={setActiveGroupName} />
      </div>

      {status === "loading" && <LoadingState />}

      {status === "error" && (
        <ErrorState error={error} onRetry={() => load(activeGroupName)} />
      )}

      {status === "found" && chama && (
        <>
          {!isMember && (
            <div className="notice notice--warning">
              Hujasajiliwa katika kikundi hiki / You are not registered in this group
            </div>
          )}
          <GroupCard
            chama={chama}
            pendingCount={pendingCount}
            walletAddress={walletAddress}
            onDeposit={() => navigate("deposit")}
            onWithdraw={() => navigate("withdrawals")}
          />
        </>
      )}
    </div>
  );
}

export default Dashboard;
