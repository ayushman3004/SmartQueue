import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import socket from "../lib/socket";
import { waitForBrowserLogout } from "../utils/browserSession.js";
import { useNavigate } from "react-router-dom";
import { publishFeedback, sessionNotificationScope } from "../modules/notification/browser-feedback";

const SocketContext = createContext(null);

export const SocketProvider = ({ children, setUser, user }) => {
  const navigate = useNavigate();
  const [connected, setConnected] = useState(() => socket.connected);

  useEffect(() => {
    socket.disconnect();
    let cancelled = false;
    waitForBrowserLogout().then(cleared => {
      if (cleared && !cancelled && user?.ownerAccess?.status !== "INVITED" && user?.ownerAccess?.status !== "EXPIRED" && user?.ownerAccess?.status !== "PASSWORD_REQUIRED") socket.connect();
    });
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    const onConnect = () => {
      console.log("Socket connected:", socket.id);
      setConnected(true);
    };

    const onDisconnect = () => {
      console.log("Socket disconnected");
      setConnected(false);
    };

    const onConnectError = (err) => {
      console.error("Socket connection error:", err.message);
    };

    const onForceLogout = (data) => {
      localStorage.removeItem("serveq_last_active");
      if (typeof setUser === "function") setUser(null);
      publishFeedback(sessionNotificationScope, "info", data?.message || "Session expired or logged out by administrator.");
      if (window.location.pathname !== "/login") navigate("/login", { replace: true });
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("auth:force_logout", onForceLogout);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("auth:force_logout", onForceLogout);
    };
  }, [navigate, setUser]);

  const joinRoom = useCallback((businessId) => {
    socket.emit("join:room", { businessId });
  }, []);

  const joinAdmin = useCallback((businessId) => {
    socket.emit("join:admin", { businessId });
  }, []);

  const joinUser = useCallback((userId) => {
    socket.emit("join:user", { userId });
  }, []);

  const leaveRoom = useCallback((businessId, userId) => {
    socket.emit("leave:room", { businessId, userId });
  }, []);

  const onQueueUpdate = useCallback((cb) => {
    socket.on("queue:update", cb);
    return () => socket.off("queue:update", cb);
  }, []);

  const onQueueDelay = useCallback((cb) => {
    socket.on("queue:delay", cb);
    return () => socket.off("queue:delay", cb);
  }, []);

  const onBusinessStatus = useCallback((cb) => {
    socket.on("business:status", cb);
    return () => socket.off("business:status", cb);
  }, []);

  return (
    <SocketContext.Provider
      value={{
        socket,
        connected,
        joinRoom,
        joinAdmin,
        joinUser,
        leaveRoom,
        onQueueUpdate,
        onQueueDelay,
        onBusinessStatus,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
