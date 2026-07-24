import { useEffect, useState } from "react";
import { useApp } from "../App";
import GroupCard from "../components/GroupCard";
import LoadingState from "../components/LoadingState";
import ErrorState from "../components/ErrorState";
import { getChama, getLocalProposal, sanitizeSymbol } from "../stellar";

function MyGroup() {
  const { walletAddress, activeGroupName, setActiveGroupName, navigate } = useApp();
  const [nameInput, setNameInput] = useState("");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroupName]);

  const handleSave = (e) => {
    e.preventDefault();
    const name = sanitizeSymbol(nameInput);
    if (!name) return;
    setActiveGroupName(name);
  };

  if (!activeGroupName) {
    return (
      <div className="page">
        <div className="page__header">
          <h1>Kikundi / Group</h1>
          <p>Weka jina la kikundi chako kuanza / Enter your group name to get started</p>
        </div>
        <form className="card" onSubmit={handleSave}>
          <div className="form-group">
            <label htmlFor="my-group-name">Jina la Kikundi / Group Name</label>
            <input
              id="my-group-name"
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="e.g. Nguruwe Savings"
            />
          </div>
          <button className="btn btn--primary btn--full" type="submit" disabled={!nameInput.trim()}>
            Hifadhi / Save
          </button>
        </form>
      </div>
    );
  }

  const pendingCount = chama && getLocalProposal(chama.name) ? 1 : 0;

  return (
    <div className="page">
      <div className="page__header">
        <h1>Kikundi Changu / My Group</h1>
        <button
          className="btn btn--outline"
          onClick={() => setActiveGroupName("")}
          style={{ minHeight: 40, padding: "8px 14px" }}
        >
          Badilisha kikundi / Change group
        </button>
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
