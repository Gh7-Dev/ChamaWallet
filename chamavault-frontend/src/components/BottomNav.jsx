import { t } from "../translations";

const MEMBER_ONLY = new Set(["group", "deposit", "withdrawals"]);

function BottomNav({ active, onNavigate, lang, activeRole }) {
  const tr = t[lang || "en"];
  const locked = !activeRole;

  const TABS = [
    { key: "home",        icon: "🏠", label: tr.home },
    { key: "group",       icon: "👥", label: tr.myGroup },
    { key: "deposit",     icon: "💰", label: tr.deposit },
    { key: "withdrawals", icon: "📋", label: tr.withdrawal },
    { key: "admin",       icon: "⚙️", label: tr.admin },
  ];

  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          className={`bottom-nav__link${active === tab.key ? " bottom-nav__link--active" : ""}`}
          onClick={() => onNavigate(tab.key)}
          aria-current={active === tab.key ? "page" : undefined}
        >
          <span className="bottom-nav__icon" aria-hidden="true">
            {tab.icon}
            {MEMBER_ONLY.has(tab.key) && locked && <span className="bottom-nav__lock">🔒</span>}
          </span>
          <span className="bottom-nav__label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}

export default BottomNav;
