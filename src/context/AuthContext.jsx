import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { toast } from "react-hot-toast";
import { getMe } from "../api/auth.api.js";
import {
  INACTIVITY_TIMEOUT_MS,
  ACTIVITY_THROTTLE_MS,
  LAST_ACTIVE_KEY,
} from "../utils/sessionConstants.js";

export { INACTIVITY_TIMEOUT_MS, ACTIVITY_THROTTLE_MS, LAST_ACTIVE_KEY };
export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem("token")));
  const lastActivityRef = useRef(Date.now());
  const timerRef = useRef(null);

  const logOut = useCallback((reason) => {
    localStorage.removeItem("token");
    localStorage.removeItem(LAST_ACTIVE_KEY);
    setUser(null);
    if (reason === "inactivity") {
      toast("You have been logged out due to 10 minutes of inactivity.", {
        icon: "⏱️",
        duration: 6000,
      });
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    getMe()
      .then((res) => {
        setUser(res.data.data.user);
        localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
      })
      .catch(() => localStorage.removeItem("token"))
      .finally(() => setLoading(false));
  }, []);

  const storeToken = (token) => {
    if (token) localStorage.setItem("token", token);
  };

  const logIn = (userData, token) => {
    storeToken(token);
    setUser(userData);
    localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
  };

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
      } else if (e.key === "token" && !e.newValue) {
        // User logged out in another tab
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
  }, [user, logOut]);

  return (
    <AuthContext.Provider value={{ user, loading, logIn, logOut, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

