import { createContext, useContext, useEffect, useState, useCallback } from "react";
import SideNav from "./components/SideNav";
import BottomNav from "./components/BottomNav";
import LoadingState from "./components/LoadingState";
import ErrorState from "./components/ErrorState";
import { roleMeta } from "./components/RoleBadge";
import Welcome from "./pages/Welcome";
import Dashboard from "./pages/Dashboard";
import MyGroup from "./pages/MyGroup";
import Deposit from "./pages/Deposit";
import Withdrawals from "./pages/Withdrawals";
import Admin from "./pages/Admin";
import {
  isOnline,
  sanitizeSymbol,
  saveNickname,
  getChama,
  roleFromChama,
  fillRole,
  extractErrorMessage,
  ROLES,
} from "./stellar";
import { t } from "./translations";

const LAST_GROUP_KEY = "chamawallet_group";
const LANG_KEY = "chamawallet_lang";

const AppContext = createContext(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within App");
  return ctx;
}

function NicknameModal({ walletAddress, lang, onSaved }) {
  const [name, setName] = useState("");
  const tr = t[lang];

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    saveNickname(walletAddress, trimmed);
    onSaved(trimmed);
  };

  return (
    <div className="nickname-overlay">
      <div className="nickname-modal">
        <div className="welcome__logo" style={{ marginBottom: 8 }}>
          Chama<span>Wallet</span>
        </div>
        <h2 style={{ marginBottom: 4 }}>{tr.welcomeTitle}</h2>
        <p style={{ color: "#52606a", marginBottom: 20 }}>{tr.whatsYourName}</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="nickname-input">{tr.yourName}</label>
            <input
              id="nickname-input"
              type="text"
              value={name}
              maxLength={20}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Mama Aisha"
            />
          </div>
          <button className="btn btn--primary btn--full" type="submit" disabled={!name.trim()}>
            {tr.continue}
          </button>
        </form>
      </div>
    </div>
  );
}

/** Shown after an invite link (?group=X&role=chairperson|secretary|treasurer)
 * once the wallet is connected and has a nickname — lets this person claim
 * that empty seat with their OWN address in one tap, before landing on the
 * normal app shell. Nobody ever types anyone else's address. */
function JoinAsRoleModal({ walletAddress, chamaName, role, lang, chamaStatus, onDone }) {
  const tr = t[lang];
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [error, setError] = useState(null);
  const meta = roleMeta(tr, role);

  const handleJoin = async () => {
    setStatus("loading");
    setError(null);
    try {
      await fillRole(walletAddress, chamaName, role);
      setStatus("success");
    } catch (err) {
      setError(err);
      setStatus("error");
    }
  };

  return (
    <div className="nickname-overlay">
      <div className="nickname-modal">
        <div className="welcome__logo" style={{ marginBottom: 8 }}>
          Chama<span>Wallet</span>
        </div>
        {status === "success" ? (
          <>
            <div className="state-icon state-icon--success" style={{ margin: "0 auto 12px" }}>✓</div>
            <h2 style={{ marginBottom: 8 }}>{tr.groupNowActive}</h2>
            <p style={{ color: "#52606a", marginBottom: 20 }}>
              {tr.joinedAsRole} {meta.label}
            </p>
            <button className="btn btn--primary btn--full" onClick={() => onDone(true)}>
              {tr.continue}
            </button>
          </>
        ) : status === "loading" || chamaStatus === "loading" ? (
          <LoadingState text={tr.processing} lang={lang} />
        ) : (
          <>
            <h2 style={{ marginBottom: 4 }}>
              {meta.icon} {tr.joinAs} {meta.label}
            </h2>
            <p style={{ color: "#52606a", marginBottom: 20 }}>{chamaName}</p>
            {status === "error" && <ErrorState error={error} onRetry={handleJoin} lang={lang} />}
            {status !== "error" && (
              <button className="btn btn--primary btn--full" onClick={handleJoin}>
                {meta.icon} {tr.joinAs} {meta.label}
              </button>
            )}
            <button
              className="btn btn--outline btn--full"
              style={{ marginTop: 10 }}
              onClick={() => onDone(false)}
            >
              {tr.back}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Header({ lang, setLang, currentPage, walletAddress, onDisconnect }) {
  const tr = t[lang];

  const PAGE_TITLES = {
    home: tr.home,
    group: tr.myGroup,
    deposit: tr.deposit,
    withdrawals: tr.withdrawal,
    admin: tr.admin,
  };

  const toggleLang = () => {
    const next = lang === "en" ? "sw" : "en";
    setLang(next);
    try { localStorage.setItem(LANG_KEY, next); } catch { /* ignore */ }
  };

  return (
    <header className="app-header">
      <div className="app-header__logo">
        Chama<span>Wallet</span>
      </div>
      <div className="app-header__title">
        {PAGE_TITLES[currentPage] || ""}
      </div>
      <div className="app-header__right">
        <button className="lang-toggle" onClick={toggleLang} type="button">
          {lang === "en" ? "🇰🇪 Swahili" : "🇬🇧 English"}
        </button>
        {walletAddress && (
          <button className="btn btn--outline btn--sm" onClick={onDisconnect} type="button">
            {tr.signOut}
          </button>
        )}
      </div>
    </header>
  );
}

function App() {
  const [walletAddress, setWalletAddress] = useState(null);
  const [currentPage, setCurrentPage] = useState("home");
  const [online, setOnline] = useState(isOnline());
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem(LANG_KEY) || "en"; } catch { return "en"; }
  });
  const [nickname, setNickname] = useState(null);
  const [needsNickname, setNeedsNickname] = useState(false);
  const [inviteRole, setInviteRole] = useState(null); // ROLES.SECRETARY | ROLES.TREASURER | null

  const [activeGroupName, setActiveGroupNameState] = useState(() => {
    try { return localStorage.getItem(LAST_GROUP_KEY) || ""; } catch { return ""; }
  });

  // Centralized chama data — every page reads this instead of re-fetching,
  // so membership/role access control is consistent across tabs.
  const [activeChama, setActiveChama] = useState(null);
  const [chamaStatus, setChamaStatus] = useState("idle"); // idle | loading | found | notfound | error
  const [chamaError, setChamaError] = useState(null);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const setActiveGroupName = useCallback((name) => {
    setActiveGroupNameState(name);
    try { if (name) localStorage.setItem(LAST_GROUP_KEY, name); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const invited = params.get("group");
      const role = params.get("role");
      if (invited) setActiveGroupName(sanitizeSymbol(invited));
      if (role === "chairperson") setInviteRole(ROLES.CHAIRPERSON);
      else if (role === "secretary") setInviteRole(ROLES.SECRETARY);
      else if (role === "treasurer") setInviteRole(ROLES.TREASURER);
      if (invited || role) {
        params.delete("group");
        params.delete("role");
        const rest = params.toString();
        window.history.replaceState({}, "", window.location.pathname + (rest ? `?${rest}` : ""));
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reloadChama = useCallback(async () => {
    if (!activeGroupName || !walletAddress) {
      setChamaStatus("idle");
      setActiveChama(null);
      return;
    }
    setChamaStatus("loading");
    setChamaError(null);
    try {
      const result = await getChama(walletAddress, activeGroupName);
      setActiveChama(result);
      setChamaStatus("found");
    } catch (err) {
      setActiveChama(null);
      const msg = extractErrorMessage(err);
      if (/not found|missingvalue|unwrap.*none/i.test(msg)) {
        setChamaStatus("notfound");
      } else {
        setChamaError(err);
        setChamaStatus("error");
      }
    }
  }, [activeGroupName, walletAddress]);

  useEffect(() => {
    reloadChama();
  }, [reloadChama]);

  const activeRole = roleFromChama(activeChama, walletAddress);

  const handleWalletConnected = useCallback((address) => {
    setWalletAddress(address);
    try {
      const users = JSON.parse(localStorage.getItem("chamawallet_users") || "{}");
      if (users[address]) {
        setNickname(users[address]);
        setNeedsNickname(false);
      } else {
        setNeedsNickname(true);
      }
    } catch {
      setNeedsNickname(true);
    }
  }, []);

  const handleNicknameSaved = useCallback((name) => {
    setNickname(name);
    setNeedsNickname(false);
  }, []);

  const disconnect = useCallback(() => {
    setWalletAddress(null);
    setNickname(null);
    setNeedsNickname(false);
    setCurrentPage("home");
  }, []);

  const navigate = useCallback((page) => setCurrentPage(page), []);

  const contextValue = {
    walletAddress,
    setWalletAddress,
    activeGroupName,
    setActiveGroupName,
    navigate,
    disconnect,
    lang,
    setLang,
    nickname,
    activeChama,
    chamaStatus,
    chamaError,
    activeRole,
    reloadChama,
  };

  let pageContent;
  switch (currentPage) {
    case "group":   pageContent = <MyGroup />;      break;
    case "deposit": pageContent = <Deposit />;      break;
    case "withdrawals": pageContent = <Withdrawals />; break;
    case "admin":   pageContent = <Admin />;        break;
    case "home":
    default:        pageContent = <Dashboard />;
  }

  // Only prompt to claim a founding seat if the invite's group is actually
  // the one currently loaded and this wallet isn't already a member (the
  // seat itself may still be empty on-chain — that's exactly what tapping
  // the modal's button fills, with this wallet's own address).
  const showJoinAsRole =
    inviteRole &&
    activeGroupName &&
    (chamaStatus === "loading" || chamaStatus === "found") &&
    !activeRole;

  return (
    <AppContext.Provider value={contextValue}>
      {online === false && (
        <div className="offline-banner" role="alert">
          {t[lang].noInternet}
        </div>
      )}

      {!walletAddress ? (
        <Welcome onConnected={handleWalletConnected} lang={lang} setLang={setLang} />
      ) : needsNickname ? (
        <NicknameModal walletAddress={walletAddress} lang={lang} onSaved={handleNicknameSaved} />
      ) : showJoinAsRole ? (
        <JoinAsRoleModal
          walletAddress={walletAddress}
          chamaName={activeGroupName}
          role={inviteRole}
          lang={lang}
          chamaStatus={chamaStatus}
          onDone={(joined) => {
            setInviteRole(null);
            if (joined) reloadChama();
          }}
        />
      ) : (
        <div className="app-shell">
          <SideNav
            active={currentPage}
            onNavigate={navigate}
            walletAddress={walletAddress}
            onDisconnect={disconnect}
            lang={lang}
            nickname={nickname}
            activeRole={activeRole}
          />
          <div className="app-body">
            <Header
              lang={lang}
              setLang={setLang}
              currentPage={currentPage}
              walletAddress={walletAddress}
              onDisconnect={disconnect}
            />
            <main className="app-main">
              <div className="app-content">{pageContent}</div>
            </main>
          </div>
          <BottomNav active={currentPage} onNavigate={navigate} lang={lang} activeRole={activeRole} />
        </div>
      )}
    </AppContext.Provider>
  );
}

export default App;
