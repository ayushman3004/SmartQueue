import "dotenv/config";
import mongoose from "mongoose";
import Application from "../src/modules/business-application/business-application.model.js";
try {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required.");
  await mongoose.connect(process.env.MONGO_URI);
  const topology = await mongoose.connection.db.admin().command({
    hello: 1,
  });
  if (!topology.setName && topology.msg !== "isdbgrid") {
    throw new Error(
      "Business approval requires a MongoDB replica set or sharded cluster with transactions.",
    );
  }
  await Application.createIndexes();
  console.log(
    "Business application collection and indexes are ready. Existing users were not modified.",
  );
} catch (error) {
  console.error(
    "Business admission preparation failed:",
    `${error.name}: check MONGO_URI, transaction support, index conflicts and database permissions.`,
  );
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
