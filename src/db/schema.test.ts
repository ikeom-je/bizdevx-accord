import { describe, expect, test } from "vitest";

import { createTestDb } from "./client";
import {
  artifactLinks,
  auditLogs,
  changeRequests,
  checklistResults,
  contractChangeRequests,
  contracts,
  customerProblems,
  gateApprovals,
  members,
  mobSessions,
  projects,
  scopeEntries,
  stageInstances,
  stories,
  storyUnits,
  unitAssignments,
  units,
} from "./schema";

const now = "2026-07-12T00:00:00.000Z";

function createIds(prefix: string) {
  return {
    projectId: `${prefix}-project`,
    memberId: `${prefix}-member`,
    unitAId: `${prefix}-unit-a`,
    unitBId: `${prefix}-unit-b`,
    stageInstanceId: `${prefix}-stage`,
    artifactLinkId: `${prefix}-artifact`,
    customerProblemId: `${prefix}-problem`,
    storyId: `${prefix}-story`,
    scopeEntryId: `${prefix}-scope`,
    contractId: `${prefix}-contract`,
  };
}

function seedProjectGraph(db: ReturnType<typeof createTestDb>, prefix: string) {
  const ids = createIds(prefix);

  db.insert(projects)
    .values({
      id: ids.projectId,
      name: "BizDevX Accord",
      depthProfile: "new-service",
      templateVersion: "2026.07.12",
      templateSnapshot: { version: "2026.07.12", stages: [] },
      createdAt: now,
    })
    .run();

  db.insert(members)
    .values({
      id: ids.memberId,
      projectId: ids.projectId,
      name: "Aki",
      roles: ["business_owner", "developer"],
      createdAt: now,
    })
    .run();

  db.insert(units)
    .values({
      id: ids.unitAId,
      projectId: ids.projectId,
      name: "Core Unit",
      difficultyAssessment: { teamExperience: "high" },
      createdAt: now,
    })
    .run();

  db.insert(units)
    .values({
      id: ids.unitBId,
      projectId: ids.projectId,
      name: "Adapter Unit",
      difficultyAssessment: { externalDependency: "medium" },
      createdAt: now,
    })
    .run();

  db.insert(stageInstances)
    .values({
      id: ids.stageInstanceId,
      projectId: ids.projectId,
      unitId: ids.unitAId,
      stageDefId: "prfaq",
      status: "in_progress",
      statusChangedAt: now,
      createdAt: now,
    })
    .run();

  db.insert(artifactLinks)
    .values({
      id: ids.artifactLinkId,
      stageInstanceId: ids.stageInstanceId,
      kind: "artifact",
      name: "PRFAQ",
      url: "https://example.com/prfaq",
      status: "done",
      createdAt: now,
    })
    .run();

  db.insert(customerProblems)
    .values({
      id: ids.customerProblemId,
      projectId: ids.projectId,
      text: "顧客が構想から実装へ移る時に文脈を失う",
      artifactLinkId: ids.artifactLinkId,
      createdAt: now,
    })
    .run();

  db.insert(stories)
    .values({
      id: ids.storyId,
      projectId: ids.projectId,
      customerProblemId: ids.customerProblemId,
      text: "企画者として文脈を引き継ぎたい",
      createdAt: now,
    })
    .run();

  db.insert(scopeEntries)
    .values({
      id: ids.scopeEntryId,
      projectId: ids.projectId,
      feature: "Context handoff",
      inOut: "in",
      decidedAt: now,
      reason: "MVP core",
      createdAt: now,
    })
    .run();

  db.insert(contracts)
    .values({
      id: ids.contractId,
      unitAId: ids.unitAId,
      unitBId: ids.unitBId,
      name: "Context API",
      url: "https://example.com/contracts/context-api",
      status: "draft",
      createdAt: now,
    })
    .run();

  return ids;
}

describe("DB schema", () => {
  test("projects can be inserted and selected", () => {
    const db = createTestDb();

    db.insert(projects)
      .values({
        id: "project-1",
        name: "BizDevX Accord",
        depthProfile: "new-service",
        templateVersion: "2026.07.12",
        templateSnapshot: { version: "2026.07.12" },
        createdAt: now,
      })
      .run();

    expect(db.select().from(projects).all()).toHaveLength(1);
  });

  test("members can be inserted and selected", () => {
    const db = createTestDb();
    const ids = seedProjectGraph(db, "members");

    expect(db.select().from(members).all()).toMatchObject([
      { id: ids.memberId, projectId: ids.projectId, name: "Aki" },
    ]);
  });

  test("units can be inserted and selected", () => {
    const db = createTestDb();
    const ids = seedProjectGraph(db, "units");

    expect(db.select().from(units).all()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: ids.unitAId, name: "Core Unit" }),
      ]),
    );
  });

  test("unitAssignments can be inserted and selected", () => {
    const db = createTestDb();
    const ids = seedProjectGraph(db, "unit-assignments");

    db.insert(unitAssignments)
      .values({
        id: "unit-assignment-1",
        unitId: ids.unitAId,
        memberId: ids.memberId,
        isRepresentative: true,
        createdAt: now,
      })
      .run();

    expect(db.select().from(unitAssignments).all()).toHaveLength(1);
  });

  test("stageInstances can be inserted and selected", () => {
    const db = createTestDb();
    const ids = seedProjectGraph(db, "stage-instances");

    expect(db.select().from(stageInstances).all()).toMatchObject([
      { id: ids.stageInstanceId, stageDefId: "prfaq" },
    ]);
  });

  test("checklistResults can be inserted and selected", () => {
    const db = createTestDb();
    const ids = seedProjectGraph(db, "checklist-results");

    db.insert(checklistResults)
      .values({
        id: "checklist-result-1",
        stageInstanceId: ids.stageInstanceId,
        itemId: "problem-fit",
        checked: true,
        by: ids.memberId,
        at: now,
      })
      .run();

    expect(db.select().from(checklistResults).all()).toHaveLength(1);
  });

  test("artifactLinks can be inserted and selected", () => {
    const db = createTestDb();
    seedProjectGraph(db, "artifact-links");

    expect(db.select().from(artifactLinks).all()).toMatchObject([
      { kind: "artifact", status: "done" },
    ]);
  });

  test("gateApprovals can be inserted and selected", () => {
    const db = createTestDb();
    const ids = seedProjectGraph(db, "gate-approvals");

    db.insert(gateApprovals)
      .values({
        id: "gate-approval-1",
        gateId: "G1",
        projectId: ids.projectId,
        approverId: ids.memberId,
        understandingCheck: { intent: true, scope: true, operation: true },
        regressionCheck: { regressed: false, items: [] },
        decision: "approved",
        at: now,
      })
      .run();

    expect(db.select().from(gateApprovals).all()).toHaveLength(1);
  });

  test("gateApprovals reject duplicate project-level approvals with null unitId", () => {
    const db = createTestDb();
    const ids = seedProjectGraph(db, "duplicate-gate-approvals");

    const approval = {
      gateId: "G1",
      projectId: ids.projectId,
      approverId: ids.memberId,
      understandingCheck: { intent: true, scope: true, operation: true },
      regressionCheck: { regressed: false, items: [] },
      decision: "approved",
      at: now,
    };

    db.insert(gateApprovals)
      .values({ id: "gate-approval-a", ...approval })
      .run();

    expect(() =>
      db
        .insert(gateApprovals)
        .values({ id: "gate-approval-b", ...approval })
        .run(),
    ).toThrow();
  });

  test("mobSessions can be inserted and selected", () => {
    const db = createTestDb();
    const ids = seedProjectGraph(db, "mob-sessions");

    db.insert(mobSessions)
      .values({
        id: "mob-session-1",
        stageInstanceId: ids.stageInstanceId,
        participantMemberIds: [ids.memberId],
        heldAt: now,
        note: "全ロール参加",
        createdAt: now,
      })
      .run();

    expect(db.select().from(mobSessions).all()).toHaveLength(1);
  });

  test("customerProblems can be inserted and selected", () => {
    const db = createTestDb();
    const ids = seedProjectGraph(db, "customer-problems");

    expect(db.select().from(customerProblems).all()).toMatchObject([
      { id: ids.customerProblemId, projectId: ids.projectId },
    ]);
  });

  test("stories can be inserted and selected", () => {
    const db = createTestDb();
    const ids = seedProjectGraph(db, "stories");

    expect(db.select().from(stories).all()).toMatchObject([
      { id: ids.storyId, customerProblemId: ids.customerProblemId },
    ]);
  });

  test("storyUnits can be inserted and selected", () => {
    const db = createTestDb();
    const ids = seedProjectGraph(db, "story-units");

    db.insert(storyUnits)
      .values({
        id: "story-unit-1",
        storyId: ids.storyId,
        unitId: ids.unitAId,
        createdAt: now,
      })
      .run();

    expect(db.select().from(storyUnits).all()).toHaveLength(1);
  });

  test("changeRequests can be inserted and selected", () => {
    const db = createTestDb();
    const ids = seedProjectGraph(db, "change-requests");

    db.insert(changeRequests)
      .values({
        id: "change-request-1",
        projectId: ids.projectId,
        text: "回答待ち質問をダッシュボードに出す",
        customerProblemId: ids.customerProblemId,
        scopeEntryId: ids.scopeEntryId,
        status: "draft",
        approvals: [],
        createdAt: now,
      })
      .run();

    expect(db.select().from(changeRequests).all()).toHaveLength(1);
  });

  test("scopeEntries can be inserted and selected", () => {
    const db = createTestDb();
    const ids = seedProjectGraph(db, "scope-entries");

    expect(db.select().from(scopeEntries).all()).toMatchObject([
      { id: ids.scopeEntryId, inOut: "in" },
    ]);
  });

  test("contracts can be inserted and selected", () => {
    const db = createTestDb();
    const ids = seedProjectGraph(db, "contracts");

    expect(db.select().from(contracts).all()).toMatchObject([
      { id: ids.contractId, status: "draft" },
    ]);
  });

  test("contractChangeRequests can be inserted and selected", () => {
    const db = createTestDb();
    const ids = seedProjectGraph(db, "contract-change-requests");

    db.insert(contractChangeRequests)
      .values({
        id: "contract-change-request-1",
        contractId: ids.contractId,
        description: "レスポンス項目を追加する",
        impactedUnitIds: [ids.unitAId, ids.unitBId],
        approvals: [],
        status: "draft",
        createdAt: now,
      })
      .run();

    expect(db.select().from(contractChangeRequests).all()).toHaveLength(1);
  });

  test("auditLogs can be inserted and selected", () => {
    const db = createTestDb();
    const ids = seedProjectGraph(db, "audit-logs");

    db.insert(auditLogs)
      .values({
        id: "audit-log-1",
        projectId: ids.projectId,
        event: "project.created",
        actor: ids.memberId,
        at: now,
        detail: { projectId: ids.projectId },
      })
      .run();

    expect(db.select().from(auditLogs).all()).toHaveLength(1);
  });
});
