import { useState } from "react";
import { useApp } from "../App";
import GroupSwitcher from "./GroupSwitcher";
import { requestJoin, mapError, CHAMA_STATUS } from "../stellar";
import { t } from "../translations";

/**
 * Blocks a tab's content behind membership (or secretary-only) access.
 * reason: "not-member" | "secretary-only"
 */
function AccessGate({ reason = "not-member" }) {
  const { walletAddress, activeGroupName, setActiveGroupName, activeChama, chamaStatus, lang, reloadChama } = useApp();
  const tr = t[lang];
  const [requesting, setRequesting] = useState(false);
  const [requestError, setRequestError] = useState(null);
  const [justRequested, setJustRequested] = useState(false);

  if (!activeGroupName) {
    return (
      <div className="card">
        <GroupSwitcher groupName={activeGroupName} onChange={setActiveGroupName} lang={lang} />
      </div>
    );
  }

  const alreadyPending = activeChama?.pendingMembers?.includes(walletAddress) || justRequested;
  const isActive = activeChama?.status === CHAMA_STATUS.ACTIVE;

  const handleRequest = async () => {
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

  return (
    <div className="access-gate">
      <div className="access-gate__icon" aria-hidden="true">🔒</div>
      <h3 className="access-gate__title">
        {reason === "secretary-only" ? tr.secretaryOnlyMsg : tr.notMember}
      </h3>

      {reason === "not-member" && chamaStatus === "found" && isActive && !alreadyPending && (
        <button className="btn btn--secondary" onClick={handleRequest} disabled={requesting}>
          {requesting ? tr.processing : tr.requestToJoin}
        </button>
      )}

      {reason === "not-member" && alreadyPending && (
        <p className="notice notice--info">{tr.requestPending}</p>
      )}

      {requestError && <p className="field-error">{mapError(requestError)}</p>}
    </div>
  );
}

export default AccessGate;
