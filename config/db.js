import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

    // Drop legacy obsolete unique index that blocks repeated bookings/queue joins
    try {
      const coll = conn.connection.collection("bookings");
      const indexes = await coll.indexes();
      if (indexes.some((i) => i.name === "businessId_1_userId_1_scheduledAt_1")) {
        await coll.dropIndex("businessId_1_userId_1_scheduledAt_1");
        console.log("🧹 Dropped obsolete index businessId_1_userId_1_scheduledAt_1 from bookings collection");
      }
    } catch {
      // Non-critical if index does not exist or already dropped
    }
  } catch (err) {
    console.error(`❌ MongoDB connection error: ${err.message}`);
    process.exit(1);
  }
};

export default connectDB;
