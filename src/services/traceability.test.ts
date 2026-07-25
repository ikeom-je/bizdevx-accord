import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

import { createTestDb } from "@/db/client";
import {
  artifactLinks,
  changeRequests,
  customerProblems,
  scopeEntries,
  stageInstances,
  stories,
  storyUnits,
} from "@/db/schema";

import { createProject, createUnit } from "./project";
import { createChangeRequest, linkStory, resurrectOutEntry } from "./traceability";

function seedTraceability(db: ReturnType<typeof createTestDb>) {
  createProject(db, {
    id: "project-trace",
    name: "Trace project",
    depthProfile: "new-service",
    actor: "system",
    members: [
      { id: "bo", name: "事業責任者", roles: ["business_owner"] },
      { id: "pm", name: "PM", roles: ["pm"] },
      { id: "dev", name: "開発者", roles: ["unit_dev"] },
    ],
  });
  createUnit(db, {
    id: "unit-1",
    projectId: "project-trace",
    actor: "pm",
    name: "Unit",
    difficultyAssessment: {},
    assignments: [{ memberId: "dev", isRepresentative: true }],
  });
  const prfaq = db
    .select()
    .from(stageInstances)
    .where(eq(stageInstances.stageDefId, "prfaq"))
    .get()!;
  db.insert(artifactLinks)
    .values({
      id: "artifact-1",
      stageInstanceId: prfaq.id,
      kind: "doc",
      name: "PRFAQ",
      url: "https://example.com/prfaq",
      status: "done",
      createdAt: "2026-07-25T00:00:00.000Z",
    })
    .run();
  db.insert(customerProblems)
    .values({
      id: "problem-1",
      projectId: "project-trace",
      text: "顧客課題",
      artifactLinkId: "artifact-1",
      createdAt: "2026-07-25T00:00:00.000Z",
    })
    .run();
  db.insert(stories)
    .values({
      id: "story-1",
      projectId: "project-trace",
      customerProblemId: null,
      text: "ストーリー",
      createdAt: "2026-07-25T00:00:00.000Z",
    })
    .run();
  db.insert(scopeEntries)
    .values({
      id: "scope-out",
      projectId: "project-trace",
      feature: "後回し機能",
      inOut: "out",
      decidedAt: "2026-07-25T00:00:00.000Z",
      reason: "MVP外",
      createdAt: "2026-07-25T00:00:00.000Z",
    })
    .run();
}

describe("traceability service", () => {
  test("storyを顧客課題とUnitに紐付け、ChangeRequestを作成する", () => {
    const db = createTestDb();
    seedTraceability(db);

    linkStory(db, {
      projectId: "project-trace",
      storyId: "story-1",
      actor: "pm",
      customerProblemId: "problem-1",
      unitIds: ["unit-1"],
    });
    createChangeRequest(db, {
      id: "cr-1",
      projectId: "project-trace",
      actor: "pm",
      text: "追加要望",
      customerProblemId: "problem-1",
      scopeEntryId: "scope-out",
    });

    expect(db.select().from(stories).where(eq(stories.id, "story-1")).get()).toMatchObject({
      customerProblemId: "problem-1",
    });
    expect(db.select().from(storyUnits).all()).toMatchObject([
      { storyId: "story-1", unitId: "unit-1" },
    ]);
    expect(db.select().from(changeRequests).all()).toMatchObject([
      { id: "cr-1", customerProblemId: "problem-1", scopeEntryId: "scope-out" },
    ]);
  });

  test("Out復活はbusiness_ownerロールとreasonを必須にする", () => {
    const db = createTestDb();
    seedTraceability(db);

    expect(() =>
      resurrectOutEntry(db, {
        projectId: "project-trace",
        scopeEntryId: "scope-out",
        actor: "pm",
        reason: "必要になった",
      }),
    ).toThrow("business_owner role is required");
    expect(() =>
      resurrectOutEntry(db, {
        projectId: "project-trace",
        scopeEntryId: "scope-out",
        actor: "bo",
        reason: "",
      }),
    ).toThrow("Resurrection reason is required");

    resurrectOutEntry(db, {
      projectId: "project-trace",
      scopeEntryId: "scope-out",
      actor: "bo",
      reason: "顧客課題に必要",
    });

    expect(db.select().from(scopeEntries).where(eq(scopeEntries.id, "scope-out")).get()).toMatchObject({
      inOut: "in",
      resurrectedBy: "bo",
      resurrectReason: "顧客課題に必要",
    });
  });
});
