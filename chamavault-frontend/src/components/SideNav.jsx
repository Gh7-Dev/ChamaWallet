import { shortenAddress } from "../stellar";

const LINKS = [
  { key: "home", icon: "🏠", label: "Nyumbani / Home" },
  { key: "group", icon: "👥", label: "Kikundi / Group" },
  { key: "deposit", icon: "💰", label: "Weka / Deposit" },
  { key: "withdrawals", icon: "📋", label: "Ombi / Withdrawal" },
  { key: "admin", icon: "⚙️", label: "Msimamizi / Admin" },
];

function SideNav({ active, onNavigate, walletAddress, onDisconnect }) {
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
            <span className="sidebar__icon" aria-hidden="true">
              {link.icon}
            </span>
            {link.label}
          </button>
        ))}
      </nav>
      <div className="sidebar__footer">
        <div className="sidebar__address">{shortenAddress(walletAddress)}</div>
        <button className="btn btn--outline btn--full" onClick={onDisconnect} style={{ borderColor: "rgba(255,255,255,0.4)", color: "#fff" }}>
          Toka / Disconnect
        </button>
      </div>
    </aside>
  );
}

export default SideNav;
