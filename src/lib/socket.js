import { io } from "socket.io-client";
import { StreamListInstance } from "twilio/lib/rest/api/v2010/account/call/stream";

const socket = io(import.meta.env.VITE_API_URL, {
  withCredentials: true,
  transports: ["websocket","polling"],
});

export default socket;
