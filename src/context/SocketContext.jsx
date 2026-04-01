import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { io } from "socket.io-client";

import toast from "react-hot-toast";

const SocketContext = createContext(null);

export const SocketProvider = ({ children, setUser, user }) => {
  const socketRef = useRef(null);
  const userRef = useRef(user);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    const socket = io({
      withCredentials: true,
      transports: ["websocket", "polling"], // allow fallback for proxy compatibility
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

    socket.on("queue:joined", (data) => {
      if (data.userId === userRef.current?._id) toast.success("You joined the queue successfully", { id: "q-join" });
      else toast.info("Someone joined the queue", { id: "q-join-other" });
    });

    socket.on("queue:left", (data) => {
      if (data.userId === userRef.current?._id) toast.success("You left the queue", { id: "q-left" });
      else toast.info("Someone left the queue", { id: "q-left-other" });
    });

    socket.on("queue:updated", () => {
      toast.success("Your position has been updated", { id: "q-update" });
    });

    socket.on("queue:etaUpdated", () => {
      toast.info("Your ETA has been updated", { id: "q-eta" });
    });

    socket.on("queue:serviceStarted", () => {
      toast.success("Service started for the next user", { id: "q-started" });
    });

    socket.on("queue:serviceCompleted", () => {
      toast.success("Service completed", { id: "q-completed" });
    });

    socket.on("extension:free", (data) => {
      toast.info(`Service delayed: Time extended by ${data.minutes} mins`, { id: "ext-free" });
    });

    socket.on("extension:paid", (data) => {
      toast.info(`Service delayed due to extension: ${data.minutes} mins`, { id: "ext-paid" });
    });

    socket.on("service:created", () => {
      toast.success("New business service created", { id: "s-created" });
    });

    socket.on("service:updated", () => {
      toast.success("Business service updated", { id: "s-updated" });
    });

    socket.on("service:deleted", () => {
      toast.success("Business service deleted", { id: "s-deleted" });
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
