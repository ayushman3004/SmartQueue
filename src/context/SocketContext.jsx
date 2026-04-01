import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import socket from "../lib/socket";
import toast from "react-hot-toast";

const SocketContext = createContext(null);

export const SocketProvider = ({ children, setUser, user }) => {
  const socketRef = useRef(socket);
  const userRef = useRef(user);
  const [connected, setConnected] = useState(socket.connected);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    // Sync connection state if already connected
    if (socket.connected) setConnected(true);

    const onConnect = () => {
      console.log("✅ Socket connected:", socket.id);
      setConnected(true);
    };

    const onDisconnect = () => {
      console.log("❌ Socket disconnected");
      setConnected(false);
    };

    const onConnectError = (err) => {
      console.error("🚨 Socket connection error:", err.message);
    };

    const onWalletUpdate = ({ balance }) => {
      console.log("💰 Wallet update received:", balance);
      setUser(prev => prev ? { ...prev, walletBalance: balance } : prev);
    };

    const onQueueJoined = (data) => {
      if (data.userId === userRef.current?._id) toast.success("You joined the queue successfully", { id: "q-join" });
      else toast.info("Someone joined the queue", { id: "q-join-other" });
    };

    const onQueueLeft = (data) => {
      if (data.userId === userRef.current?._id) toast.success("You left the queue", { id: "q-left" });
      else toast.info("Someone left the queue", { id: "q-left-other" });
    };

    const onQueueUpdated = () => {
      toast.success("Your position has been updated", { id: "q-update" });
    };

    const onQueueEtaUpdated = () => {
      toast.info("Your ETA has been updated", { id: "q-eta" });
    };

    const onQueueServiceStarted = () => {
      toast.success("Service started for the next user", { id: "q-started" });
    };

    const onQueueServiceCompleted = () => {
      toast.success("Service completed", { id: "q-completed" });
    };

    const onExtensionFree = (data) => {
      toast.info(`Service delayed: Time extended by ${data.minutes} mins`, { id: "ext-free" });
    };

    const onExtensionPaid = (data) => {
      toast.info(`Service delayed due to extension: ${data.minutes} mins`, { id: "ext-paid" });
    };

    const onServiceCreated = () => {
      toast.success("New business service created", { id: "s-created" });
    };

    const onServiceUpdated = () => {
      toast.success("Business service updated", { id: "s-updated" });
    };

    const onServiceDeleted = () => {
      toast.success("Business service deleted", { id: "s-deleted" });
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("wallet:update", onWalletUpdate);
    socket.on("queue:joined", onQueueJoined);
    socket.on("queue:left", onQueueLeft);
    socket.on("queue:updated", onQueueUpdated);
    socket.on("queue:etaUpdated", onQueueEtaUpdated);
    socket.on("queue:serviceStarted", onQueueServiceStarted);
    socket.on("queue:serviceCompleted", onQueueServiceCompleted);
    socket.on("extension:free", onExtensionFree);
    socket.on("extension:paid", onExtensionPaid);
    socket.on("service:created", onServiceCreated);
    socket.on("service:updated", onServiceUpdated);
    socket.on("service:deleted", onServiceDeleted);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("wallet:update", onWalletUpdate);
      socket.off("queue:joined", onQueueJoined);
      socket.off("queue:left", onQueueLeft);
      socket.off("queue:updated", onQueueUpdated);
      socket.off("queue:etaUpdated", onQueueEtaUpdated);
      socket.off("queue:serviceStarted", onQueueServiceStarted);
      socket.off("queue:serviceCompleted", onQueueServiceCompleted);
      socket.off("extension:free", onExtensionFree);
      socket.off("extension:paid", onExtensionPaid);
      socket.off("service:created", onServiceCreated);
      socket.off("service:updated", onServiceUpdated);
      socket.off("service:deleted", onServiceDeleted);
    };
  }, [setUser]);

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
