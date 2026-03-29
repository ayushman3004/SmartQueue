import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const mongoUri = process.env.MONGO_URI;

async function migrate() {
  await mongoose.connect(mongoUri);
  console.log("📦 Connected to MongoDB");

  const users = await mongoose.connection.collection("users").find({ role: "user" }).toArray();
  console.log(`🔍 Found ${users.length} users with legacy role 'user'`);

  if (users.length > 0) {
    const res = await mongoose.connection.collection("users").updateMany(
      { role: "user" },
      { $set: { role: "customer" } }
    );
    console.log(`✅ Successfully updated ${res.modifiedCount} accounts to 'customer'`);
  } else {
    console.log("✨ No legacy roles found.");
  }

  await mongoose.disconnect();
}

migrate().catch(console.error);
