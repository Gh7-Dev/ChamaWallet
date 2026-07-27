import { useEffect, useState } from "react";
import { useApp } from "../App";
import GroupCard from "../components/GroupCard";
import GroupSwitcher from "../components/GroupSwitcher";
import LoadingState from "../components/LoadingState";
import ErrorState from "../components/ErrorState";
import { getChama, getLocalProposal } from "../stellar";

function MyGroup() {
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
      setError(err);
      setStatus("error");
    }
  };

  useEffect(() => {
    if (activeGroupName) load(activeGroupName);
    else setStatus("idle");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroupName, walletAddress]);

  const pendingCount = chama && getLocalProposal(chama.name) ? 1 : 0;

  return (
    <div className="page">
      <div className="page__header">
        <h1>Kikundi Changu / My Group</h1>
      </div>

      <div className="card">
        <GroupSwitcher groupName={activeGroupName} onChange={setActiveGroupName} />
      </div>

      {status === "loading" && <LoadingState />}
      {status === "error" && (
        <ErrorState error={error} onRetry={() => load(activeGroupName)} />
      )}
      {status === "found" && chama && (
        <GroupCard
          chama={chama}
          pendingCount={pendingCount}
          walletAddress={walletAddress}
          onDeposit={() => navigate("deposit")}
          onWithdraw={() => navigate("withdrawals")}
        />
      )}
    </div>
  );
}

export default MyGroup;
