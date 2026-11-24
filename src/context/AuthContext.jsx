import { createContext, useContext, useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { publishFeedback, sessionNotificationScope, setFeedbackAccount } from "../modules/notification/browser-feedback";
import { getMe } from "../api/auth.api.js";
import api from "../api/axios.js";
import { clearBrowserBearer, logoutBrowserSession } from "../utils/browserSession.js";
import {
  INACTIVITY_TIMEOUT_MS,
  ACTIVITY_THROTTLE_MS,
  LAST_ACTIVE_KEY,
} from "../utils/sessionConstants.js";

export { INACTIVITY_TIMEOUT_MS, ACTIVITY_THROTTLE_MS, LAST_ACTIVE_KEY };
export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  const [user, updateUser] = useState(null);
  const currentUser = useRef(null);
  const [loading, setLoading] = useState(() => window.location.pathname !== "/auth/callback");
  const lastActivityRef = useRef(0);
  const timerRef = useRef(null);
  const sessionRevision = useRef(0);

  useLayoutEffect(() => { navigateRef.current = navigate; }, [navigate]);

  const setUser = useCallback((value) => {
    const next = typeof value === "function" ? value(currentUser.current) : value;
    currentUser.current = next;
    setFeedbackAccount(next?._id);
    updateUser(next);
  }, []);

  const logOut = useCallback(async (reason) => {
    const revision = ++sessionRevision.current;
    const cleared = logoutBrowserSession(api, localStorage);
    localStorage.removeItem(LAST_ACTIVE_KEY);
    setUser(null);
    const signedOut = await cleared;
    if (revision !== sessionRevision.current) return;
    if (!signedOut) {
      publishFeedback(sessionNotificationScope, "error", "Could not clear your server session. Reconnect and sign out again.");
      return;
    }
    localStorage.setItem("serveq_logout_at", String(Date.now()));
    if (reason === "inactivity") {
      publishFeedback(sessionNotificationScope, "info", "You have been logged out due to 10 minutes of inactivity.");
      if (window.location.pathname !== "/login") {
        navigateRef.current("/login", { replace: true });
      }
    }
  }, [setUser]);

  useEffect(() => {
    if (window.location.pathname === "/auth/callback") return;
    clearBrowserBearer(api, localStorage);
    const revision = sessionRevision.current;
    getMe()
      .then((res) => {
        if (revision !== sessionRevision.current) return;
        setUser(res.data.data.user);
        localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
      })
      .catch(() => {
        if (revision === sessionRevision.current) setUser(null);
      })
      .finally(() => setLoading(false));
  }, [setUser]);

  const logIn = useCallback((userData) => {
    sessionRevision.current += 1;
    setUser(userData);
    setLoading(false);
    localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
  }, [setUser]);

  // 10-Minute Inactivity Auto-Logout Tracker
  useEffect(() => {
    if (!user) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    const checkInactivity = () => {
      const storedLast = parseInt(localStorage.getItem(LAST_ACTIVE_KEY) || "0", 10);
      const effectiveLast = Math.max(storedLast, lastActivityRef.current);
      const idleTime = Date.now() - effectiveLast;

      if (idleTime >= INACTIVITY_TIMEOUT_MS) {
        logOut("inactivity");
        return;
      }

      // Schedule next timeout check for the remaining time
      const remainingTime = Math.max(1000, INACTIVITY_TIMEOUT_MS - idleTime);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(checkInactivity, remainingTime);
    };

    const handleUserActivity = () => {
      const now = Date.now();
      if (now - lastActivityRef.current > ACTIVITY_THROTTLE_MS) {
        lastActivityRef.current = now;
        localStorage.setItem(LAST_ACTIVE_KEY, String(now));

        // Reset inactivity timer
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(checkInactivity, INACTIVITY_TIMEOUT_MS);
      }
    };

    // Initialize timestamps and timer
    lastActivityRef.current = Date.now();
    localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
    timerRef.current = setTimeout(checkInactivity, INACTIVITY_TIMEOUT_MS);

    // Activity event listeners
    const events = ["mousedown", "mousemove", "keydown", "touchstart", "scroll", "click"];
    events.forEach((evt) => window.addEventListener(evt, handleUserActivity, { passive: true }));

    // Visibility / Focus handler (user returning from sleep or another tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkInactivity();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleVisibilityChange);

    // Cross-tab synchronization
    const handleStorageChange = (e) => {
      if (e.key === LAST_ACTIVE_KEY && e.newValue) {
        const remoteTime = parseInt(e.newValue, 10);
        if (!isNaN(remoteTime)) {
          lastActivityRef.current = remoteTime;
          if (timerRef.current) clearTimeout(timerRef.current);
          const idleTime = Date.now() - remoteTime;
          if (idleTime >= INACTIVITY_TIMEOUT_MS) {
            logOut("inactivity");
          } else {
            timerRef.current = setTimeout(checkInactivity, INACTIVITY_TIMEOUT_MS - idleTime);
          }
        }
      } else if (e.key === "serveq_logout_at") {
        // User logged out in another tab
        sessionRevision.current += 1;
        setUser(null);
      }
    };
    window.addEventListener("storage", handleStorageChange);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((evt) => window.removeEventListener(evt, handleUserActivity));
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleVisibilityChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [user, logOut, setUser]);

  return (
    <AuthContext.Provider value={{ user, loading, logIn, logOut, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

