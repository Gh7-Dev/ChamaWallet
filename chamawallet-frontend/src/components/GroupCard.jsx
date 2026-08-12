import { getNickname, stroopsToXlm, xlmToKes, formatKes, roleFromChama, CHAMA_STATUS } from "../stellar";
import RoleBadge from "./RoleBadge";
import { t } from "../translations";

function GroupCard({ chama, pendingCount, onDeposit, onWithdraw, walletAddress, lang }) {
  if (!chama) return null;
  const tr = t[lang || "en"];

  const xlm = stroopsToXlm(chama.balance || 0);
  const kes = xlmToKes(xlm);
  const isActive = chama.status === CHAMA_STATUS.ACTIVE;
  const confirmedCount = chama.members?.length || 0;

  return (
    <div className="group-card">
      <div className="group-card__top">
        <h3 className="group-card__name">{chama.name}</h3>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {typeof pendingCount === "number" && pendingCount > 0 && (
            <span className="badge badge--accent">{pendingCount} {tr.pending}</span>
          )}
          <span className={`badge status-badge status-badge--${isActive ? "active" : "pending"}`}>
            {isActive ? `🟢 ${tr.statusActive}` : `🟡 ${tr.statusSettingUp}`}
          </span>
        </div>
      </div>

      {!isActive && (
        <p className="form-hint">
          {confirmedCount}/3 {tr.confirmedCount}
        </p>
      )}

      <div className="group-card__balance">
        <span className="group-card__balance-kes">KES {formatKes(kes)}</span>
        <span className="group-card__balance-xlm">(~{xlm.toFixed(2)} XLM)</span>
      </div>

      <div className="group-card__row">
        <span className="group-card__row-label">{tr.totalMembers}</span>
        <span>{chama.members?.length || 0}</span>
      </div>

      {chama.members?.length > 0 && (
        <div className="member-list">
          {chama.members.map((m, i) => (
            <div className="member-card" key={i}>
              <span className="member-card__name">{getNickname(m)}</span>
              <RoleBadge role={roleFromChama(chama, m)} lang={lang} />
            </div>
          ))}
        </div>
      )}

      {(onDeposit || onWithdraw) && (
        <div className="group-card__actions">
          {onDeposit && (
            <button className="btn btn--secondary" onClick={onDeposit}>
              {tr.deposit}
            </button>
          )}
          {onWithdraw && (
            <button className="btn btn--outline" onClick={onWithdraw}>
              {tr.propose}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default GroupCard;
