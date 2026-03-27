import { createContext, useContext, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = io("http://localhost:3001", { 
      withCredentials: true,
      transports: ["websocket"]
    });
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    return () => socket.disconnect();
  }, []);

  const joinRoom = (businessId) => {
    socketRef.current?.emit("join:room", { businessId });
  };

  const leaveRoom = (businessId) => {
    socketRef.current?.emit("leave:room", { businessId });
  };

  const onQueueUpdate = (cb) => {
    socketRef.current?.on("queue:update", cb);
    return () => socketRef.current?.off("queue:update", cb);
  };

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected, joinRoom, leaveRoom, onQueueUpdate }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
