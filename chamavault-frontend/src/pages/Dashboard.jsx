import { useState } from "react";
import { useApp } from "../App";
import GroupCard from "../components/GroupCard";
import LoadingState from "../components/LoadingState";
import ErrorState from "../components/ErrorState";
import {
  getChama,
  getLocalProposal,
  shortenAddress,
  sanitizeSymbol,
  stroopsToXlm,
  xlmToKes,
  formatKes,
} from "../stellar";

function Dashboard() {
  const { walletAddress, setActiveGroupName, navigate } = useApp();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | found | error
  const [chama, setChama] = useState(null);
  const [error, setError] = useState(null);

  const pendingCount = chama && getLocalProposal(chama.name) ? 1 : 0;
  const isMember = chama && chama.members?.includes(walletAddress);

  const handleSearch = async (e) => {
    e.preventDefault();
    const name = sanitizeSymbol(query);
    if (!name) return;
    setStatus("loading");
    setError(null);
    try {
      const result = await getChama(walletAddress, name);
      setChama(result);
      setActiveGroupName(name);
      setStatus("found");
    } catch (err) {
      setChama(null);
      setError(err);
      setStatus("error");
    }
  };

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

      <form className="card" onSubmit={handleSearch}>
        <div className="form-group" style={{ marginBottom: 12 }}>
          <label htmlFor="search-group">Tafuta kikundi / Search group name</label>
          <input
            id="search-group"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Nguruwe Savings"
          />
        </div>
        <button className="btn btn--primary btn--full" type="submit" disabled={!query.trim()}>
          Tafuta / Search
        </button>
      </form>

      {status === "loading" && <LoadingState />}

      {status === "error" && (
        <ErrorState error={error} onRetry={handleSearch} onBack={() => setStatus("idle")} />
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
