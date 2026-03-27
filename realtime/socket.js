/**
 * Socket.IO event handler initialization
 * 
 * Events:
 *  client emits:  "join:room"  { businessId }
 *  client emits:  "leave:room" { businessId }
 *  server emits:  "queue:update" <queueDoc>
 */
export const initSocket = (io) => {
  io.on("connection", (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // Join a business-specific room to receive queue updates
    socket.on("join:room", ({ businessId }) => {
      if (businessId) {
        socket.join(`business:${businessId}`);
        console.log(`  📌 ${socket.id} joined room: business:${businessId}`);
      }
    });

    // Leave a business room
    socket.on("leave:room", ({ businessId }) => {
      if (businessId) {
        socket.leave(`business:${businessId}`);
      }
    });

    socket.on("disconnect", () => {
      console.log(`❌ Socket disconnected: ${socket.id}`);
    });
  });
};
