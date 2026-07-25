import { randomUUID } from "node:crypto";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import * as schema from "@/db/schema";
import { auditLogs } from "@/db/schema";

export type AppDb = BetterSQLite3Database<typeof schema>;

export function withAudit<T>(
  db: AppDb,
  projectId: string,
  actor: string,
  event: string,
  detail: Record<string, unknown>,
  fn: (tx: AppDb) => T,
): T {
  return db.transaction((tx) => {
    const result = fn(tx as AppDb);

    tx.insert(auditLogs)
      .values({
        id: randomUUID(),
        projectId,
        event,
        actor,
        at: new Date().toISOString(),
        detail,
      })
      .run();

    return result;
  });
}
