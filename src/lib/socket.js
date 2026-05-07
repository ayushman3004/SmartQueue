import { io } from "socket.io-client";

/**
 * Socket.IO client connection.
 * 
 * In development: VITE_API_URL points to the backend (e.g., http://localhost:3001)
 *                 OR is empty/undefined to use Vite proxy (connects to same origin).
 * In production:  VITE_API_URL points to the Render backend URL.
 * 
 * When VITE_API_URL is empty/undefined, Socket.IO connects to the same origin,
 * which works with the Vite dev proxy.
 */
const SOCKET_URL = import.meta.env.VITE_API_URL || undefined;

const socket = io(SOCKET_URL, {
  withCredentials: true,
  transports: ["websocket", "polling"],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
  autoConnect: true,
});

export default socket;
