import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./src/modules/auth/auth.model.js";

dotenv.config();

const email = process.argv[2];

if (!email) {
  console.log("Usage: node promote_admin.js <email>");
  process.exit(1);
}

async function promote() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("📦 Connected to MongoDB");

  const res = await User.updateOne({ email }, { $set: { role: "admin" } });

  if (res.modifiedCount > 0) {
    console.log(`✅ ${email} is now an Administrator.`);
  } else {
    console.log(`❌ No account found with email ${email} or it is already an admin.`);
  }

  await mongoose.disconnect();
}

promote().catch(console.error);
