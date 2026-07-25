import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

import { createTestDb } from "@/db/client";
import { auditLogs, projects } from "@/db/schema";

import { withAudit } from "./audit";

const now = "2026-07-25T00:00:00.000Z";

function seedProject(db: ReturnType<typeof createTestDb>) {
  db.insert(projects)
    .values({
      id: "project-audit",
      name: "Audit project",
      depthProfile: "new-service",
      templateVersion: "1",
      templateSnapshot: { version: 1, stages: [] },
      createdAt: now,
    })
    .run();
}

describe("withAudit", () => {
  test("fnの戻り値を返し、同一トランザクションでauditLogsへ記録する", () => {
    const db = createTestDb();
    seedProject(db);

    const result = withAudit(
      db,
      "project-audit",
      "member-1",
      "project.test",
      { target: "example" },
      () => "created",
    );

    expect(result).toBe("created");
    expect(
      db.select().from(auditLogs).where(eq(auditLogs.projectId, "project-audit")).all(),
    ).toMatchObject([
      {
        projectId: "project-audit",
        actor: "member-1",
        event: "project.test",
        detail: { target: "example" },
      },
    ]);
  });

  test("fnが失敗した場合はauditLogsもロールバックする", () => {
    const db = createTestDb();
    seedProject(db);

    expect(() =>
      withAudit(
        db,
        "project-audit",
        "member-1",
        "project.test",
        { target: "example" },
        () => {
          throw new Error("mutation failed");
        },
      ),
    ).toThrow("mutation failed");

    expect(db.select().from(auditLogs).all()).toHaveLength(0);
  });
});
