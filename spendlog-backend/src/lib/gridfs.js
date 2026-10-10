
import mongoose from "mongoose";
import { GridFSBucket } from "mongodb";

let bucket;

export default async function getGridFSBucket() {
  if (bucket) {
    return bucket;
  }

  // Reuse the existing MongoDB connection.
  if (mongoose.connection.readyState !== 1) {
    throw new Error("MongoDB is not connected");
  }

  const db = mongoose.connection.db;

  if (!db) {
    throw new Error("MongoDB database is unavailable");
  }

  bucket = new GridFSBucket(db, {
    bucketName: "receipts",
  });

  return bucket;
}