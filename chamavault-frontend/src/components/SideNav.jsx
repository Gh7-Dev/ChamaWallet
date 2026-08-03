import { t } from "../translations";

const MEMBER_ONLY = new Set(["group", "deposit", "withdrawals"]);

function SideNav({ active, onNavigate, walletAddress, onDisconnect, lang, nickname, activeRole }) {
  const tr = t[lang || "en"];
  const locked = !activeRole;

  const LINKS = [
    { key: "home",        icon: "🏠", label: tr.home },
    { key: "group",       icon: "👥", label: tr.myGroup },
    { key: "deposit",     icon: "💰", label: tr.deposit },
    { key: "withdrawals", icon: "📋", label: tr.withdrawal },
    { key: "admin",       icon: "⚙️", label: tr.admin },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar__logo">
        Chama<span>Vault</span>
      </div>
      <nav className="sidebar__nav" aria-label="Main navigation">
        {LINKS.map((link) => (
          <button
            key={link.key}
            className={`sidebar__link${active === link.key ? " sidebar__link--active" : ""}`}
            onClick={() => onNavigate(link.key)}
            aria-current={active === link.key ? "page" : undefined}
          >
            <span className="sidebar__icon" aria-hidden="true">{link.icon}</span>
            {link.label}
            {MEMBER_ONLY.has(link.key) && locked && (
              <span className="sidebar__lock" aria-hidden="true">🔒</span>
            )}
          </button>
        ))}
      </nav>
      <div className="sidebar__footer">
        <div className="sidebar__address">👤 {nickname || "—"}</div>
        <button
          className="btn btn--outline btn--full"
          onClick={onDisconnect}
          style={{ borderColor: "rgba(255,255,255,0.4)", color: "#fff" }}
        >
          {tr.signOut}
        </button>
      </div>
    </aside>
  );
}

export default SideNav;
