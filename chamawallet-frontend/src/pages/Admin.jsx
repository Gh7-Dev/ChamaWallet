import { useState } from "react";
import { useApp } from "../App";
import GroupSwitcher from "../components/GroupSwitcher";
import AccessGate from "../components/AccessGate";
import SuccessState from "../components/SuccessState";
import ErrorState from "../components/ErrorState";
import { roleMeta } from "../components/RoleBadge";
import {
  proposeChama,
  approveJoin,
  getChama,
  getNickname,
  sanitizeSymbol,
  mapError,
  extractErrorMessage,
  ROLES,
} from "../stellar";
import { t } from "../translations";

const ALL_ROLES = [ROLES.CHAIRPERSON, ROLES.SECRETARY, ROLES.TREASURER];

function inviteLabelFor(role, tr) {
  if (role === ROLES.CHAIRPERSON) return tr.chairpersonInvite;
  if (role === ROLES.SECRETARY) return tr.secretaryInvite;
  return tr.treasurerInvite;
}

// Built from wherever the app is actually running (localhost while
// developing, GitHub Pages or wherever it's deployed) — a hardcoded
// production domain would produce dead links in every other environment.
// Points at the app's own root (not a /join sub-path) plus BASE_URL, since
// static hosts like GitHub Pages don't do SPA fallback routing for
// arbitrary paths — the app reads ?group=/&role= from location.search
// regardless of path, so the root URL works everywhere without relying on
// server-side routing at all.
const INVITE_BASE_URL = `${window.location.origin}${import.meta.env.BASE_URL}`;

function InviteLinkButton({ label, link, lang }) {
  const [copied, setCopied] = useState(false);
  const tr = t[lang];

  const handleCopy = async () => {
    setCopied(false);
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard blocked — link still shown below for manual copy */
    }
  };

  return (
    <div className="invite-box">
      <button type="button" className="btn btn--outline btn--full" onClick={handleCopy}>
        🔗 {label}
      </button>
      <input className="invite-box__link" type="text" readOnly value={link} onFocus={(e) => e.target.select()} />
      {copied && <p className="invite-box__copied">{tr.copied}</p>}
    </div>
  );
}

function CreateGroupFlow({ walletAddress, setActiveGroupName, lang }) {
  const tr = t[lang];
  const [step, setStep] = useState(1); // 1 name | 2 your role | 3 confirm | 4 invite
  const [name, setName] = useState("");
  const [checking, setChecking] = useState(false);
  const [nameError, setNameError] = useState(null);
  const [myRole, setMyRole] = useState(ROLES.CHAIRPERSON);
  const [createStatus, setCreateStatus] = useState("idle"); // idle | loading | error
  const [createError, setCreateError] = useState(null);
  const [hash, setHash] = useState(null);

  const sanitized = sanitizeSymbol(name);
  const otherRoles = ALL_ROLES.filter((r) => r !== myRole);

  const handleCheckName = async (e) => {
    e.preventDefault();
    if (!sanitized) return;
    setChecking(true);
    setNameError(null);
    try {
      await getChama(walletAddress, sanitized);
      setNameError(tr.nameTaken);
    } catch (err) {
      const msg = extractErrorMessage(err);
      if (/not found|missingvalue|unwrap.*none/i.test(msg)) {
        setStep(2);
      } else {
        setNameError(mapError(err));
      }
    } finally {
      setChecking(false);
    }
  };

  const handleCreate = async () => {
    setCreateStatus("loading");
    setCreateError(null);
    try {
      const result = await proposeChama(walletAddress, sanitized, myRole);
      setActiveGroupName(sanitized);
      setHash(result.hash);
      setCreateStatus("idle");
      setStep(4);
    } catch (err) {
      setCreateError(err);
      setCreateStatus("error");
    }
  };

  const resetAll = () => {
    setStep(1);
    setName("");
    setNameError(null);
    setMyRole(ROLES.CHAIRPERSON);
    setCreateStatus("idle");
    setCreateError(null);
    setHash(null);
  };

  return (
    <div className="card">
      <h2>{tr.createGroupTitle}</h2>

      {step < 4 && (
        <div className="steps">
          <div className={`step${step === 1 ? " step--active" : " step--done"}`}>{tr.stepName}</div>
          <div className={`step${step === 2 ? " step--active" : step > 2 ? " step--done" : ""}`}>{tr.stepRole}</div>
          <div className={`step${step === 3 ? " step--active" : ""}`}>{tr.stepConfirm}</div>
        </div>
      )}

      {step === 1 && (
        <form onSubmit={handleCheckName}>
          <div className="form-group">
            <label htmlFor="create-group-name">{tr.groupName}</label>
            <input
              id="create-group-name"
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value.replace(/\s+/g, "_")); setNameError(null); }}
              placeholder="e.g. Nguruwe_Savings"
            />
            {nameError && <p className="field-error">{nameError}</p>}
          </div>
          <button className="btn btn--primary btn--full" type="submit" disabled={!name.trim() || checking}>
            {checking ? tr.checkingName : tr.next}
          </button>
        </form>
      )}

      {step === 2 && (
        <div>
          <p style={{ fontWeight: 700, marginBottom: 6 }}>{tr.roleQuestion}</p>
          <p className="form-hint" style={{ marginBottom: 16 }}>{tr.roleExplanation}</p>

          <div className="form-group">
            <label htmlFor="my-role-select">{tr.yourRole}</label>
            <select
              id="my-role-select"
              value={myRole}
              onChange={(e) => setMyRole(e.target.value)}
            >
              {ALL_ROLES.map((role) => {
                const meta = roleMeta(tr, role);
                return (
                  <option key={role} value={role}>
                    {meta.icon} {meta.label}
                  </option>
                );
              })}
            </select>
          </div>

          <p className="form-hint">{tr.waitingOnOthers}</p>

          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button className="btn btn--outline" onClick={() => setStep(1)}>{tr.back}</button>
            <button className="btn btn--primary btn--full" onClick={() => setStep(3)}>{tr.next}</button>
          </div>
        </div>
      )}

      {step === 3 && createStatus !== "error" && (
        <div>
          <p style={{ fontWeight: 700, marginBottom: 10 }}>{tr.summary}</p>
          <div className="summary-row">
            <span className="summary-row__label">{tr.groupName}</span>
            <strong>{sanitized}</strong>
          </div>
          <div className="summary-row">
            <span className="summary-row__label">{tr.yourRole}</span>
            <strong>
              {roleMeta(tr, myRole).icon} {roleMeta(tr, myRole).label} — {getNickname(walletAddress)}
            </strong>
          </div>
          <p className="form-hint" style={{ marginTop: 10 }}>{tr.waitingOnOthers}</p>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button className="btn btn--outline" onClick={() => setStep(2)} disabled={createStatus === "loading"}>
              {tr.back}
            </button>
            <button className="btn btn--primary btn--full" onClick={handleCreate} disabled={createStatus === "loading"}>
              {createStatus === "loading" ? tr.processing : tr.confirmMyRole}
            </button>
          </div>
        </div>
      )}

      {step === 3 && createStatus === "error" && (
        <ErrorState error={createError} onRetry={handleCreate} onBack={() => setCreateStatus("idle")} lang={lang} />
      )}

      {step === 4 && (
        <div>
          <SuccessState title={tr.groupCreated} hash={hash} lang={lang} />
          <p style={{ fontWeight: 700, marginTop: 8, marginBottom: 4 }}>{tr.shareTheseLinks}</p>
          <p className="form-hint" style={{ marginBottom: 16 }}>{tr.activatesHint}</p>
          {otherRoles.map((role) => (
            <InviteLinkButton
              key={role}
              label={inviteLabelFor(role, tr)}
              link={`${INVITE_BASE_URL}?group=${encodeURIComponent(sanitized)}&role=${role.toLowerCase()}`}
              lang={lang}
            />
          ))}
          <button className="btn btn--outline btn--full" style={{ marginTop: 16 }} onClick={resetAll}>
            {tr.createNewGroup}
          </button>
        </div>
      )}
    </div>
  );
}

function JoinRequestsSection({ walletAddress, activeGroupName, setActiveGroupName, activeChama, activeRole, chamaStatus, reloadChama, lang }) {
  const tr = t[lang];
  const [approvingAddr, setApprovingAddr] = useState(null);
  const [error, setError] = useState(null);

  const handleApprove = async (addr) => {
    setApprovingAddr(addr);
    setError(null);
    try {
      await approveJoin(walletAddress, activeGroupName, addr);
      await reloadChama();
    } catch (err) {
      setError(err);
    } finally {
      setApprovingAddr(null);
    }
  };

  return (
    <div className="card">
      <h2>{tr.joinRequestsHeading}</h2>
      <GroupSwitcher groupName={activeGroupName} onChange={setActiveGroupName} lang={lang} />

      {activeGroupName && chamaStatus === "found" && activeRole !== ROLES.SECRETARY && (
        <AccessGate reason="secretary-only" />
      )}

      {activeGroupName && chamaStatus === "found" && activeRole === ROLES.SECRETARY && (
        <>
          {(activeChama?.pendingMembers || []).length === 0 ? (
            <p className="empty-state">{tr.noJoinRequests}</p>
          ) : (
            <div className="member-list">
              {activeChama.pendingMembers.map((addr) => (
                <div className="member-card" key={addr}>
                  <span className="member-card__name">👤 {getNickname(addr)}</span>
                  <button
                    className="btn btn--secondary btn--sm"
                    disabled={approvingAddr === addr}
                    onClick={() => handleApprove(addr)}
                  >
                    {approvingAddr === addr ? tr.processing : tr.approveJoinBtn}
                  </button>
                </div>
              ))}
            </div>
          )}
          {error && <p className="field-error">{mapError(error)}</p>}
        </>
      )}
    </div>
  );
}

function Admin() {
  const {
    walletAddress,
    activeGroupName,
    setActiveGroupName,
    activeChama,
    activeRole,
    chamaStatus,
    reloadChama,
    lang,
  } = useApp();
  const tr = t[lang];

  return (
    <div className="page">
      <div className="page__header">
        <h1>{tr.adminPage}</h1>
      </div>
      <CreateGroupFlow walletAddress={walletAddress} setActiveGroupName={setActiveGroupName} lang={lang} />
      <JoinRequestsSection
        walletAddress={walletAddress}
        activeGroupName={activeGroupName}
        setActiveGroupName={setActiveGroupName}
        activeChama={activeChama}
        activeRole={activeRole}
        chamaStatus={chamaStatus}
        reloadChama={reloadChama}
        lang={lang}
      />
    </div>
  );
}

export default Admin;
