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

type AppDb = ReturnType<typeof openDatabase>;

let realDb: AppDb | undefined;

function getDb(): AppDb {
  if (!realDb) {
    realDb = openDatabase(process.env.DATABASE_URL ?? "data/bizdevx.db");
  }

  return realDb;
}

// db は Proxy 越しの遅延初期化にする。`import { db } from "@/db/client"` という
// 既存の呼び出し側のAPIをそのまま保ちつつ、実際にプロパティへアクセスした瞬間まで
// openDatabase()(実DBファイルの作成・接続)を遅らせるため(issue #37)。
export const db: AppDb = new Proxy({} as AppDb, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb() as object, prop, receiver);
  },
});

export function createTestDb() {
  const testDb = openDatabase(":memory:");
  migrate(testDb, { migrationsFolder });

  return testDb;
}
