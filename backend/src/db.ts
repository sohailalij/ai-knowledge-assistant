import { MongoClient, Db } from "mongodb";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectToDatabase(): Promise<Db> {
  if (db) return db;

  client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();

  // Database name can be anything; this creates/uses "knowledge_assistant"
  db = client.db("knowledge_assistant");
  console.log("Connected to MongoDB");
  return db;
}

export function getDb(): Db {
  if (!db) {
    throw new Error("Database not connected yet. Call connectToDatabase() first.");
  }
  return db;
}
