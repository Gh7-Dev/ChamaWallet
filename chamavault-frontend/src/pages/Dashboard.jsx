import { useState } from "react";
import { useApp } from "../App";
import GroupSwitcher from "../components/GroupSwitcher";
import LoadingState from "../components/LoadingState";
import ErrorState from "../components/ErrorState";
import { requestJoin, mapError, getNickname, stroopsToXlm, xlmToKes, formatKes, CHAMA_STATUS, ROLES } from "../stellar";
import { t } from "../translations";

function FoundersProgress({ chama, tr }) {
  const rows = [
    { role: ROLES.CHAIRPERSON, icon: "👑", label: tr.roleChairperson, address: chama.chairperson },
    { role: ROLES.SECRETARY, icon: "📝", label: tr.roleSecretary, address: chama.secretary },
    { role: ROLES.TREASURER, icon: "💰", label: tr.roleTreasurer, address: chama.treasurer },
  ];
  return (
    <>
      <p className="form-hint">
        {chama.members.length}/3 {tr.confirmedCount}
      </p>
      <div className="member-list" style={{ marginTop: 6 }}>
        {rows.map((r) => {
          const filled = !!r.address;
          return (
            <div className="member-card" key={r.role}>
              <span className="member-card__name">
                {r.icon} {filled ? getNickname(r.address) : "—"} — {r.label}
              </span>
              <span className={`badge ${filled ? "status-badge status-badge--active" : "badge--muted"}`}>
                {filled ? "✓" : "…"}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

function Dashboard() {
  const {
    walletAddress,
    nickname,
    activeGroupName,
    setActiveGroupName,
    activeChama,
    chamaStatus,
    chamaError,
    activeRole,
    reloadChama,
    navigate,
    lang,
  } = useApp();
  const tr = t[lang];
  const [view, setView] = useState("choice"); // "choice" | "search"
  const [requesting, setRequesting] = useState(false);
  const [requestError, setRequestError] = useState(null);
  const [justRequested, setJustRequested] = useState(false);

  const handleRequestJoin = async () => {
    setRequesting(true);
    setRequestError(null);
    try {
      await requestJoin(walletAddress, activeGroupName);
      setJustRequested(true);
      reloadChama();
    } catch (err) {
      setRequestError(err);
    } finally {
      setRequesting(false);
    }
  };

  if (view === "choice") {
    return (
      <div className="page">
        <div className="page__header">
          <h1>{tr.greeting}, {nickname}!</h1>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <p style={{ fontWeight: 700, marginBottom: 16 }}>{tr.chooseAction}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button className="btn btn--secondary btn--full" onClick={() => setView("search")}>
              🔍 {tr.searchExisting}
            </button>
            <button className="btn btn--primary btn--full" onClick={() => navigate("admin")}>
              ➕ {tr.createNewGroup}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const kes = activeChama ? xlmToKes(stroopsToXlm(activeChama.balance || 0)) : 0;
  const pending = activeChama?.pendingMembers?.includes(walletAddress) || justRequested;

  return (
    <div className="page">
      <div className="page__header">
        <h1>{tr.greeting}, {nickname}!</h1>
        <button
          type="button"
          className="btn btn--outline"
          style={{ minHeight: 36, padding: "6px 12px", marginTop: 8 }}
          onClick={() => setView("choice")}
        >
          ← {tr.back}
        </button>
      </div>

      <div className="card">
        <label htmlFor="dash-search" style={{ marginBottom: 8, display: "block" }}>
          {tr.searchGroupTitle}
        </label>
        <GroupSwitcher groupName={activeGroupName} onChange={setActiveGroupName} lang={lang} />
      </div>

      {chamaStatus === "loading" && <LoadingState lang={lang} />}

      {chamaStatus === "notfound" && (
        <div className="card" style={{ textAlign: "center" }}>
          <p style={{ fontWeight: 700, marginBottom: 12 }}>{tr.groupNotFound}</p>
          <button className="btn btn--primary btn--full" onClick={() => navigate("admin")}>
            {tr.createNewGroup}
          </button>
        </div>
      )}

      {chamaStatus === "error" && <ErrorState error={chamaError} onRetry={reloadChama} lang={lang} />}

      {chamaStatus === "found" && activeChama && activeChama.status === CHAMA_STATUS.PROPOSED && (
        <div className="group-card">
          <div className="group-card__top">
            <h3 className="group-card__name">{activeChama.name}</h3>
            <span className="badge status-badge status-badge--pending">🟡 {tr.statusSettingUp}</span>
          </div>
          <FoundersProgress chama={activeChama} tr={tr} />
          <p className="notice notice--info" style={{ marginTop: 12 }}>{tr.awaitingActivation}</p>
        </div>
      )}

      {chamaStatus === "found" && activeChama && activeChama.status === CHAMA_STATUS.ACTIVE && (
        <div className="group-card">
          <div className="group-card__top">
            <h3 className="group-card__name">{activeChama.name}</h3>
            <span className="badge status-badge status-badge--active">🟢 {tr.statusActive}</span>
          </div>
          <div className="group-card__balance">
            <span className="group-card__balance-kes">KES {formatKes(kes)}</span>
          </div>
          <div className="group-card__row">
            <span className="group-card__row-label">{tr.totalMembers}</span>
            <span>{activeChama.members.length}</span>
          </div>

          {activeRole ? (
            <button
              className="btn btn--secondary btn--full"
              style={{ marginTop: 16 }}
              onClick={() => navigate("group")}
            >
              {tr.enterGroup}
            </button>
          ) : pending ? (
            <p className="notice notice--info" style={{ marginTop: 16 }}>{tr.requestPending}</p>
          ) : (
            <button
              className="btn btn--secondary btn--full"
              style={{ marginTop: 16 }}
              onClick={handleRequestJoin}
              disabled={requesting}
            >
              {requesting ? tr.processing : tr.requestToJoin}
            </button>
          )}
          {requestError && <p className="field-error">{mapError(requestError)}</p>}
        </div>
      )}
    </div>
  );
}

export default Dashboard;
