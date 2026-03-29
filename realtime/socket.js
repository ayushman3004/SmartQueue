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

    // Special room for owners (includes sensitive customer names)
    socket.on("join:admin", ({ businessId }) => {
      if (businessId) {
        socket.join(`business:${businessId}:admin`);
        console.log(`  🔑 ${socket.id} joined admin room: business:${businessId}`);
      }
    });

    // Private room for targeted user notifications
    socket.on("join:user", ({ userId }) => {
      if (userId) {
        socket.join(`user:${userId}`);
        console.log(`  👤 ${socket.id} joined private room: user:${userId}`);
      }
    });

    // Leave rooms
    socket.on("leave:room", ({ businessId, userId }) => {
      if (businessId) {
        socket.leave(`business:${businessId}`);
        socket.leave(`business:${businessId}:admin`);
      }
      if (userId) {
        socket.leave(`user:${userId}`);
      }
    });

    socket.on("disconnect", () => {
      console.log(`❌ Socket disconnected: ${socket.id}`);
    });
  });
};
