import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

import { createTestDb } from "@/db/client";
import { auditLogs, gateApprovals, scopeEntries, stageInstances } from "@/db/schema";

import { createProject, createUnit } from "./project";
import { checkItem } from "./stage";
import { approveGate } from "./gate";
import { createChangeRequest as createTraceChangeRequest } from "./traceability";

function answers(items: string[]) {
  return {
  understanding: { intent: true, impact: true, ops: true },
    regression: items.map((item) => ({ item, regressed: false })),
  };
}

const g1Checks = [
  "人間が成果物を直接書き始めていないか",
  "口頭決定で質問ファイルやスコープ台帳への記録を省略していないか",
  "ロール分業・引き継ぎ駆動に戻っていないか(モブを省略していないか)",
];

const g2Checks = [
  "Unit 分割が技術分担表や人員割りに戻っていないか",
  "PM・ビジネスオーナーの同席なしに境界を決めていないか",
  "未完了リスクを次工程のダッシュボードに残せているか",
];

const g3Checks = [
  "契約をコードや口頭合意で代替していないか",
  "影響 Unit の代表を含めずに承認していないか",
  "ロール分業・引き継ぎ駆動に戻っていないか(モブを省略していないか)",
];

const g4Checks = [
  "追加要望を PRFAQ の顧客課題に紐付けずに採用していないか",
  "AI の GAP 指摘を無批判に受け入れていないか",
  "ロール分業・引き継ぎ駆動に戻っていないか(モブを省略していないか)",
];

function seedProject(db: ReturnType<typeof createTestDb>) {
  createProject(db, {
    id: "project-gate",
    name: "Gate project",
    depthProfile: "new-service",
    actor: "system",
    members: [
      { id: "bo", name: "事業責任者", roles: ["business_owner"] },
      { id: "architect", name: "設計者", roles: ["architect"] },
      { id: "dev", name: "開発者", roles: ["unit_dev"] },
      { id: "pm", name: "PM", roles: ["pm"] },
    ],
  });
}

describe("gate service", () => {
  test("G1はscope_ledger未登録なら拒否し、登録後に承認を記録する", () => {
    const db = createTestDb();
    seedProject(db);
    const prfaq = db
      .select()
      .from(stageInstances)
      .where(eq(stageInstances.stageDefId, "prfaq"))
      .get()!;
    for (const itemId of [
      "customer_problem_clear",
      "define_kgi_kpi",
      "agree_kgi_kpi_in_mob",
      "register_scope_ledger",
    ]) {
      checkItem(db, { stageInstanceId: prfaq.id, actor: "pm", itemId, checked: true });
    }

    expect(() =>
      approveGate(db, {
        projectId: "project-gate",
        gateId: "G1",
        approverId: "bo",
        answers: answers(g1Checks),
      }),
    ).toThrow("Gate requirements are unmet: scope_ledger");

    db.insert(scopeEntries)
      .values({
        id: "scope-1",
        projectId: "project-gate",
        feature: "主要機能",
        inOut: "in",
        decidedAt: "2026-07-25T00:00:00.000Z",
        reason: "MVP",
        createdAt: "2026-07-25T00:00:00.000Z",
      })
      .run();

    expect(
      approveGate(db, {
        projectId: "project-gate",
        gateId: "G1",
        approverId: "bo",
        answers: answers(g1Checks),
      }),
    ).toMatchObject({ passable: true });
    expect(db.select().from(gateApprovals).all()).toMatchObject([
      { projectId: "project-gate", gateId: "G1", approverId: "bo" },
    ]);
  });

  test("warningゲートは未完了チェックをcarriedRisksとして監査detailへ残す", () => {
    const db = createTestDb();
    seedProject(db);

    expect(
      approveGate(db, {
        projectId: "project-gate",
        gateId: "G2",
        approverId: "architect",
        answers: answers(g2Checks),
      }),
    ).toMatchObject({ passable: true, carriedRisks: expect.any(Array) });
    expect(db.select().from(auditLogs).all()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: "gate.approve",
          detail: expect.objectContaining({ carriedRisks: expect.any(Array) }),
        }),
      ]),
    );
  });

  test("G3はunit_repsを具体memberIdへ展開し、二重承認をわかりやすく拒否する", () => {
    const db = createTestDb();
    seedProject(db);
    createUnit(db, {
      id: "unit-1",
      projectId: "project-gate",
      actor: "architect",
      name: "Unit",
      difficultyAssessment: {},
      assignments: [{ memberId: "dev", isRepresentative: true }],
    });
    const contractStage = db
      .select()
      .from(stageInstances)
      .where(eq(stageInstances.stageDefId, "contract"))
      .get()!;
    for (const itemId of ["define_unit_contracts", "no_construction_before_contract"]) {
      checkItem(db, { stageInstanceId: contractStage.id, actor: "architect", itemId, checked: true });
    }

    expect(
      approveGate(db, {
        projectId: "project-gate",
        gateId: "G3",
        approverId: "architect",
        answers: answers(g3Checks),
      }),
    ).toMatchObject({ passable: false, reason: "approvals_incomplete" });
    expect(
      approveGate(db, {
        projectId: "project-gate",
        gateId: "G3",
        approverId: "dev",
        answers: answers(g3Checks),
      }),
    ).toMatchObject({ passable: true });
    expect(() =>
      approveGate(db, {
        projectId: "project-gate",
        gateId: "G3",
        approverId: "dev",
        answers: answers(g3Checks),
      }),
    ).toThrow("Gate approval already exists");
  });

  test("G4は顧客課題に未紐付けのChangeRequestがある場合に拒否する", () => {
    const db = createTestDb();
    seedProject(db);
    const userReview = db
      .select()
      .from(stageInstances)
      .where(eq(stageInstances.stageDefId, "user_review"))
      .get()!;
    for (const itemId of ["closed_questions_used", "link_change_requests"]) {
      checkItem(db, { stageInstanceId: userReview.id, actor: "pm", itemId, checked: true });
    }
    createTraceChangeRequest(db, {
      id: "cr-unlinked",
      projectId: "project-gate",
      actor: "pm",
      text: "未紐付け要望",
      customerProblemId: null,
    });

    expect(() =>
      approveGate(db, {
        projectId: "project-gate",
        gateId: "G4",
        approverId: "pm",
        answers: answers(g4Checks),
      }),
    ).toThrow("G4 approval requires linked change requests");
  });
});
