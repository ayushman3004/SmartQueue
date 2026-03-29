import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { io } from "socket.io-client";

const SocketContext = createContext(null);

export const SocketProvider = ({ children, setUser }) => {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = io("http://localhost:3001", {
      withCredentials: true,
      transports: ["websocket"], // prevents polling issues
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("✅ Socket connected:", socket.id);
      setConnected(true);
    });

    socket.on("disconnect", () => {
      console.log("❌ Socket disconnected");
      setConnected(false);
    });

    socket.on("connect_error", (err) => {
      console.error("🚨 Socket connection error:", err.message);
    });

    socket.on("wallet:update", ({ balance }) => {
      console.log("💰 Wallet update received:", balance);
      setUser(prev => prev ? { ...prev, walletBalance: balance } : prev);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const joinRoom = useCallback((businessId) => {
    socketRef.current?.emit("join:room", { businessId });
  }, []);

  const joinAdmin = useCallback((businessId) => {
    socketRef.current?.emit("join:admin", { businessId });
  }, []);

  const joinUser = useCallback((userId) => {
    socketRef.current?.emit("join:user", { userId });
  }, []);

  const leaveRoom = useCallback((businessId, userId) => {
    socketRef.current?.emit("leave:room", { businessId, userId });
  }, []);

  const onQueueUpdate = useCallback((cb) => {
    socketRef.current?.on("queue:update", cb);
    return () => socketRef.current?.off("queue:update", cb);
  }, []);

  const onQueueDelay = useCallback((cb) => {
    socketRef.current?.on("queue:delay", cb);
    return () => socketRef.current?.off("queue:delay", cb);
  }, []);

  const onBusinessStatus = useCallback((cb) => {
    socketRef.current?.on("business:status", cb);
    return () => socketRef.current?.off("business:status", cb);
  }, []);

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
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
