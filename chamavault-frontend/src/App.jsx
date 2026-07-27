import { createContext, useContext, useEffect, useState, useCallback } from "react";
import SideNav from "./components/SideNav";
import BottomNav from "./components/BottomNav";
import Welcome from "./pages/Welcome";
import Dashboard from "./pages/Dashboard";
import MyGroup from "./pages/MyGroup";
import Deposit from "./pages/Deposit";
import Withdrawals from "./pages/Withdrawals";
import Admin from "./pages/Admin";
import { isOnline, sanitizeSymbol } from "./stellar";

const LAST_GROUP_KEY = "chamavault_group";

const AppContext = createContext(null);

/** Shared wallet + active-group state, available to every page. */
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within App");
  return ctx;
}

function App() {
  const [walletAddress, setWalletAddress] = useState(null);
  const [currentPage, setCurrentPage] = useState("home");
  const [online, setOnline] = useState(isOnline());
  const [activeGroupName, setActiveGroupNameState] = useState(() => {
    try {
      return localStorage.getItem(LAST_GROUP_KEY) || "";
    } catch {
      return "";
    }
  });

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
    try {
      if (name) localStorage.setItem(LAST_GROUP_KEY, name);
    } catch {
      /* localStorage unavailable — ignore, in-memory state still works */
    }
  }, []);

  useEffect(() => {
    // Invite links (Admin > Share Invite) look like ?group=NAME — adopt the
    // group automatically so a new member never has to type it in.
    try {
      const params = new URLSearchParams(window.location.search);
      const invited = params.get("group");
      if (invited) {
        setActiveGroupName(sanitizeSymbol(invited));
        params.delete("group");
        const rest = params.toString();
        window.history.replaceState({}, "", window.location.pathname + (rest ? `?${rest}` : ""));
      }
    } catch {
      /* no query string support — ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const disconnect = useCallback(() => {
    setWalletAddress(null);
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
  };

  let pageContent;
  switch (currentPage) {
    case "group":
      pageContent = <MyGroup />;
      break;
    case "deposit":
      pageContent = <Deposit />;
      break;
    case "withdrawals":
      pageContent = <Withdrawals />;
      break;
    case "admin":
      pageContent = <Admin />;
      break;
    case "home":
    default:
      pageContent = <Dashboard />;
  }

  return (
    <AppContext.Provider value={contextValue}>
      {!online && (
        <div className="offline-banner" role="alert">
          Hakuna mtandao / No internet connection
        </div>
      )}
      {!walletAddress ? (
        <Welcome onConnected={setWalletAddress} />
      ) : (
        <div className="app-shell">
          <SideNav active={currentPage} onNavigate={navigate} walletAddress={walletAddress} onDisconnect={disconnect} />
          <main className="app-main">
            <div className="app-content">{pageContent}</div>
          </main>
          <BottomNav active={currentPage} onNavigate={navigate} />
        </div>
      )}
    </AppContext.Provider>
  );
}

export default App;
