const TABS = [
  { key: "home", icon: "🏠", label: "Nyumbani / Home" },
  { key: "group", icon: "👥", label: "Kikundi / Group" },
  { key: "deposit", icon: "💰", label: "Weka / Deposit" },
  { key: "withdrawals", icon: "📋", label: "Ombi / Withdrawal" },
  { key: "admin", icon: "⚙️", label: "Msimamizi / Admin" },
];

function BottomNav({ active, onNavigate }) {
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
          </span>
          <span className="bottom-nav__label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}

export default BottomNav;
