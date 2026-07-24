import { shortenAddress, stroopsToXlm, xlmToKes, formatKes } from "../stellar";

/**
 * chama: { name, admin, balance (stroops, BigInt|number), members: string[] }
 * pendingCount: number of pending proposals to badge (optional, may be null/undefined)
 * onDeposit / onWithdraw: optional shortcut callbacks — omit to hide the action row
 */
function GroupCard({ chama, pendingCount, onDeposit, onWithdraw, walletAddress }) {
  if (!chama) return null;

  const xlm = stroopsToXlm(chama.balance || 0);
  const kes = xlmToKes(xlm);
  const isAdmin = walletAddress && chama.admin === walletAddress;

  return (
    <div className="group-card">
      <div className="group-card__top">
        <h3 className="group-card__name">{chama.name}</h3>
        {typeof pendingCount === "number" && pendingCount > 0 && (
          <span className="badge badge--accent">
            {pendingCount} Ombi linalosubiri / Pending
          </span>
        )}
      </div>

      <div className="group-card__balance">
        <span className="group-card__balance-kes">KES {formatKes(kes)}</span>
        <span className="group-card__balance-xlm">(~{xlm.toFixed(2)} XLM)</span>
      </div>

      <div className="group-card__row">
        <span className="group-card__row-label">Msimamizi / Admin</span>
        <span>
          {shortenAddress(chama.admin)}
          {isAdmin ? " (Wewe / You)" : ""}
        </span>
      </div>
      <div className="group-card__row">
        <span className="group-card__row-label">Wanachama / Members</span>
        <span>{chama.members?.length || 0}</span>
      </div>

      {chama.members?.length > 0 && (
        <div className="group-card__members">
          {chama.members.map((m, i) => (
            <span className="member-chip" key={i}>
              {shortenAddress(m)}
            </span>
          ))}
        </div>
      )}

      {(onDeposit || onWithdraw) && (
        <div className="group-card__actions">
          {onDeposit && (
            <button className="btn btn--secondary" onClick={onDeposit}>
              Weka Fedha / Deposit
            </button>
          )}
          {onWithdraw && (
            <button className="btn btn--outline" onClick={onWithdraw}>
              Omba Kutoa / Request Withdrawal
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default GroupCard;
