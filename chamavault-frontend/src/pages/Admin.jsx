import { useState } from "react";
import { useApp } from "../App";
import LoadingState from "../components/LoadingState";
import SuccessState from "../components/SuccessState";
import ErrorState from "../components/ErrorState";
import { createChama, addMember, getChama, sanitizeSymbol, mapError } from "../stellar";

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

function AddMemberSection({ walletAddress, setActiveGroupName }) {
  const [name, setName] = useState("");
  const [checkStatus, setCheckStatus] = useState("idle"); // idle | checking | authorized | unauthorized | error
  const [checkError, setCheckError] = useState(null);
  const [memberAddress, setMemberAddress] = useState("");
  const [status, setStatus] = useState("form");
  const [error, setError] = useState(null);
  const [hash, setHash] = useState(null);

  const handleCheck = async (e) => {
    e.preventDefault();
    const sanitized = sanitizeSymbol(name);
    if (!sanitized) return;
    setCheckStatus("checking");
    setCheckError(null);
    try {
      const chama = await getChama(walletAddress, sanitized);
      setActiveGroupName(sanitized);
      setCheckStatus(chama.admin === walletAddress ? "authorized" : "unauthorized");
    } catch (err) {
      setCheckError(err);
      setCheckStatus("error");
    }
  };

  const resetSubmit = () => {
    setStatus("form");
    setError(null);
    setHash(null);
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    const sanitized = sanitizeSymbol(name);
    if (!sanitized || !memberAddress.trim()) return;
    try {
      setStatus("loading");
      setError(null);
      const result = await addMember(walletAddress, sanitized, memberAddress.trim());
      setHash(result.hash);
      setStatus("success");
    } catch (err) {
      setError(err);
      setStatus("error");
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

      <form onSubmit={handleCheck}>
        <div className="form-group">
          <label htmlFor="add-member-group">Jina la Kikundi / Group Name</label>
          <input
            id="add-member-group"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setCheckStatus("idle");
            }}
            placeholder="e.g. Nguruwe Savings"
          />
        </div>
        {checkStatus !== "authorized" && (
          <button
            className="btn btn--outline btn--full"
            type="submit"
            disabled={!name.trim() || checkStatus === "checking"}
          >
            {checkStatus === "checking" ? "Inaangalia... / Checking..." : "Angalia / Check"}
          </button>
        )}
      </form>

      {checkStatus === "unauthorized" && (
        <div className="notice notice--error" style={{ marginTop: 16 }}>
          Huna ruhusa / You don't have permission — only the group admin can add members.
        </div>
      )}

      {checkStatus === "error" && (
        <div className="notice notice--error" style={{ marginTop: 16 }}>
          {mapError(checkError)}
        </div>
      )}

      {checkStatus === "authorized" && (
        <form onSubmit={handleAddMember} style={{ marginTop: 16 }}>
          <div className="notice notice--info">Umeidhinishwa kama msimamizi / Verified as admin</div>
          <div className="form-group">
            <label htmlFor="new-member-address">Akaunti ya Mwanachama / Member Address</label>
            <input
              id="new-member-address"
              type="text"
              value={memberAddress}
              onChange={(e) => setMemberAddress(e.target.value.trim())}
              placeholder="e.g. GABC...XYZ"
            />
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
    </div>
  );
}

function Admin() {
  const { walletAddress, setActiveGroupName } = useApp();

  return (
    <div className="page">
      <div className="page__header">
        <h1>Msimamizi / Admin</h1>
      </div>
      <CreateGroupSection walletAddress={walletAddress} setActiveGroupName={setActiveGroupName} />
      <AddMemberSection walletAddress={walletAddress} setActiveGroupName={setActiveGroupName} />
    </div>
  );
}

export default Admin;
