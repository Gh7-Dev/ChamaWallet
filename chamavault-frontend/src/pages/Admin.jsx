import { useEffect, useState } from "react";
import { useApp } from "../App";
import GroupSwitcher from "../components/GroupSwitcher";
import QrScanner from "../components/QrScanner";
import LoadingState from "../components/LoadingState";
import SuccessState from "../components/SuccessState";
import ErrorState from "../components/ErrorState";
import { createChama, addMember, getChama, sanitizeSymbol, mapError } from "../stellar";

const INVITE_BASE_URL = "https://chamavault.app/join";

function CreateGroupSection({ walletAddress, setActiveGroupName }) {
  const [name, setName] = useState("");
  const [status, setStatus] = useState("form");
  const [error, setError] = useState(null);
  const [hash, setHash] = useState(null);

  const reset = () => {
    setStatus("form");
    setError(null);
    setHash(null);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const sanitized = sanitizeSymbol(name);
    if (!sanitized) return;
    try {
      setStatus("loading");
      setError(null);
      const result = await createChama(walletAddress, sanitized);
      setActiveGroupName(sanitized);
      setHash(result.hash);
      setStatus("success");
    } catch (err) {
      setError(err);
      setStatus("error");
    }
  };

  if (status === "loading") return <LoadingState text="Inaunda kikundi... / Creating group..." />;
  if (status === "success") {
    return (
      <SuccessState
        title="Kikundi kimeundwa! / Group created!"
        message={`"${name}" iko tayari. Jiongeze kama mwanachama ili uweze kuomba au kuidhinisha fedha. / "${name}" is ready. Add yourself as a member so you can propose or approve withdrawals.`}
        hash={hash}
        onBack={reset}
      />
    );
  }
  if (status === "error") return <ErrorState error={error} onRetry={handleCreate} onBack={reset} />;

  return (
    <form className="card" onSubmit={handleCreate}>
      <h2>Unda Kikundi / Create Group</h2>
      <div className="form-group">
        <label htmlFor="create-group-name">Jina la Kikundi / Group Name</label>
        <input
          id="create-group-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value.replace(/\s+/g, "_"))}
          placeholder="e.g. Nguruwe_Savings"
        />
      </div>
      <div className="form-actions">
        <button className="btn btn--primary btn--full" type="submit" disabled={!name.trim()}>
          Unda Kikundi / Create Group
        </button>
      </div>
    </form>
  );
}

function AddMemberSection({ walletAddress, activeGroupName, setActiveGroupName }) {
  const [checkStatus, setCheckStatus] = useState("idle"); // idle | checking | authorized | unauthorized | error
  const [checkError, setCheckError] = useState(null);
  const [memberAddress, setMemberAddress] = useState("");
  const [scanning, setScanning] = useState(false);
  const [status, setStatus] = useState("form");
  const [error, setError] = useState(null);
  const [hash, setHash] = useState(null);
  const [inviteLink, setInviteLink] = useState("");
  const [inviteCopied, setInviteCopied] = useState(false);

  useEffect(() => {
    if (!activeGroupName || !walletAddress) {
      setCheckStatus("idle");
      return undefined;
    }
    let cancelled = false;
    setCheckStatus("checking");
    setCheckError(null);
    getChama(walletAddress, activeGroupName)
      .then((chama) => {
        if (cancelled) return;
        setCheckStatus(chama.admin === walletAddress ? "authorized" : "unauthorized");
      })
      .catch((err) => {
        if (cancelled) return;
        setCheckError(err);
        setCheckStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [activeGroupName, walletAddress]);

  const resetSubmit = () => {
    setStatus("form");
    setError(null);
    setHash(null);
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!activeGroupName || !memberAddress.trim()) return;
    try {
      setStatus("loading");
      setError(null);
      const result = await addMember(walletAddress, activeGroupName, memberAddress.trim());
      setHash(result.hash);
      setStatus("success");
    } catch (err) {
      setError(err);
      setStatus("error");
    }
  };

  const handleShareInvite = async () => {
    const link = `${INVITE_BASE_URL}?group=${encodeURIComponent(activeGroupName)}`;
    setInviteLink(link);
    setInviteCopied(false);
    try {
      await navigator.clipboard.writeText(link);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2500);
    } catch {
      /* clipboard blocked — link still shown below for manual copy */
    }
  };

  if (status === "loading") return <LoadingState text="Inaongeza mwanachama... / Adding member..." />;
  if (status === "success") {
    return (
      <SuccessState
        title="Mwanachama ameongezwa! / Member added!"
        hash={hash}
        onBack={() => {
          resetSubmit();
          setMemberAddress("");
        }}
      />
    );
  }
  if (status === "error") return <ErrorState error={error} onRetry={handleAddMember} onBack={resetSubmit} />;

  return (
    <div className="card">
      <h2>Ongeza Mwanachama / Add Member</h2>

      <GroupSwitcher groupName={activeGroupName} onChange={setActiveGroupName} />

      {activeGroupName && checkStatus === "checking" && (
        <p className="form-hint">Inaangalia ruhusa... / Checking permission...</p>
      )}

      {checkStatus === "unauthorized" && (
        <div className="notice notice--error">
          Huna ruhusa / You don't have permission — only the group admin can add members.
        </div>
      )}

      {checkStatus === "error" && <div className="notice notice--error">{mapError(checkError)}</div>}

      {checkStatus === "authorized" && (
        <>
          <div className="notice notice--info">Umeidhinishwa kama msimamizi / Verified as admin</div>

          {scanning ? (
            <QrScanner
              onResult={(text) => {
                setMemberAddress(text);
                setScanning(false);
              }}
              onClose={() => setScanning(false)}
            />
          ) : (
            <form onSubmit={handleAddMember} style={{ marginTop: 16 }}>
              <div className="form-group">
                <label htmlFor="new-member-address">Akaunti ya Mwanachama / Member Address</label>
                <input
                  id="new-member-address"
                  type="text"
                  value={memberAddress}
                  onChange={(e) => setMemberAddress(e.target.value.trim())}
                  placeholder="e.g. GABC...XYZ"
                />
                <button
                  type="button"
                  className="btn btn--outline btn--full"
                  style={{ marginTop: 8 }}
                  onClick={() => setScanning(true)}
                >
                  📷 Changanua QR / Scan QR
                </button>
              </div>
              <p className="form-hint">
                Admin lazima ajiongeze mwenyewe / Admin must add themselves as a member to
                propose or approve withdrawals
              </p>
              <div className="form-actions">
                <button className="btn btn--secondary btn--full" type="submit" disabled={!memberAddress.trim()}>
                  Ongeza Mwanachama / Add Member
                </button>
              </div>
            </form>
          )}

          <div className="invite-box">
            <button type="button" className="btn btn--outline btn--full" onClick={handleShareInvite}>
              🔗 Shiriki Mwaliko / Share Invite
            </button>
            {inviteLink && (
              <>
                <input
                  className="invite-box__link"
                  type="text"
                  readOnly
                  value={inviteLink}
                  onFocus={(e) => e.target.select()}
                />
                {inviteCopied && <p className="invite-box__copied">Nakiliwa! / Copied!</p>}
              </>
            )}
            <p className="form-hint">
              Mwanachama mpya akifungua kiungo hiki na kuunganisha akaunti yake, kikundi hiki
              kitapakia moja kwa moja kwake — bado utahitaji nambari yake ya akaunti hapo juu
              kumaliza kumwongeza. / When a new member opens this link and connects their
              wallet, this group loads automatically for them — you'll still need their
              account number above to finish adding them.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function Admin() {
  const { walletAddress, activeGroupName, setActiveGroupName } = useApp();

  return (
    <div className="page">
      <div className="page__header">
        <h1>Msimamizi / Admin</h1>
      </div>
      <CreateGroupSection walletAddress={walletAddress} setActiveGroupName={setActiveGroupName} />
      <AddMemberSection
        walletAddress={walletAddress}
        activeGroupName={activeGroupName}
        setActiveGroupName={setActiveGroupName}
      />
    </div>
  );
}

export default Admin;
