import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import * as schema from "./schema";

const migrationsFolder = "drizzle";

function openDatabase(path: string) {
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }

  const sqlite = new Database(path);
  sqlite.pragma("foreign_keys = ON");

  return drizzle(sqlite, { schema });
}

export const db = openDatabase(process.env.DB_PATH ?? "data/app.db");

export function createTestDb() {
  const testDb = openDatabase(":memory:");
  migrate(testDb, { migrationsFolder });

  return testDb;
}
