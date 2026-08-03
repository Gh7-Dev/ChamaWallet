import { useApp } from "../App";
import GroupCard from "../components/GroupCard";
import GroupSwitcher from "../components/GroupSwitcher";
import LoadingState from "../components/LoadingState";
import ErrorState from "../components/ErrorState";
import AccessGate from "../components/AccessGate";
import { getLocalProposal } from "../stellar";
import { t } from "../translations";

function MyGroup() {
  const {
    walletAddress,
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

  const pendingCount = activeChama && getLocalProposal(activeChama.name) ? 1 : 0;

  return (
    <div className="page">
      <div className="page__header">
        <h1>{tr.myGroup}</h1>
      </div>

      <div className="card">
        <GroupSwitcher groupName={activeGroupName} onChange={setActiveGroupName} lang={lang} />
      </div>

      {chamaStatus === "loading" && <LoadingState lang={lang} />}
      {chamaStatus === "error" && <ErrorState error={chamaError} onRetry={reloadChama} lang={lang} />}
      {chamaStatus === "notfound" && (
        <p className="notice notice--warning">{tr.groupNotFound}</p>
      )}
      {chamaStatus === "found" && !activeRole && <AccessGate reason="not-member" />}
      {chamaStatus === "found" && activeRole && (
        <GroupCard
          chama={activeChama}
          pendingCount={pendingCount}
          walletAddress={walletAddress}
          onDeposit={() => navigate("deposit")}
          onWithdraw={() => navigate("withdrawals")}
          lang={lang}
        />
      )}
    </div>
  );
}

export default MyGroup;
