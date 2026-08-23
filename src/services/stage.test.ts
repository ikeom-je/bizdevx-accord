import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

import { createTestDb } from "@/db/client";
import { artifactLinks, auditLogs, checklistResults, mobSessions, stageInstances } from "@/db/schema";

import { createProject } from "./project";
import {
  checkItem,
  getStageNavigatorData,
  recordMobSession,
  registerArtifact,
  transitionStage,
  updateArtifactStatus,
} from "./stage";

function seedProject(db: ReturnType<typeof createTestDb>) {
  createProject(db, {
    id: "project-stage",
    name: "Stage project",
    depthProfile: "new-service",
    actor: "system",
    members: [
      { id: "bo", name: "事業責任者", roles: ["business_owner"] },
      { id: "pm", name: "PM", roles: ["pm"] },
      { id: "facilitator", name: "ファシリ", roles: ["facilitator"] },
      { id: "architect", name: "設計者", roles: ["architect"] },
      { id: "dev", name: "開発者", roles: ["unit_dev"] },
    ],
  });
}

describe("stage service", () => {
  test("perMemberでないチェック項目は重複INSERTせず既存行を更新する", () => {
    const db = createTestDb();
    seedProject(db);
    const persona = db
      .select()
      .from(stageInstances)
      .where(eq(stageInstances.stageDefId, "persona"))
      .get();

    checkItem(db, {
      stageInstanceId: persona!.id,
      actor: "pm",
      itemId: "avoid_solution_first",
      checked: true,
    });
    checkItem(db, {
      stageInstanceId: persona!.id,
      actor: "architect",
      itemId: "avoid_solution_first",
      checked: false,
      skipReason: "再確認",
    });

    expect(db.select().from(checklistResults).all()).toMatchObject([
      {
        stageInstanceId: persona!.id,
        itemId: "avoid_solution_first",
        checked: false,
        by: "architect",
        skipReason: "再確認",
      },
    ]);
  });

  test("artifact登録と不正な状態遷移拒否、needs_update伝播、再開確認を扱う", () => {
    const db = createTestDb();
    seedProject(db);
    const team = db
      .select()
      .from(stageInstances)
      .where(eq(stageInstances.stageDefId, "team_charter"))
      .get()!;
    const persona = db
      .select()
      .from(stageInstances)
      .where(eq(stageInstances.stageDefId, "persona"))
      .get()!;

    expect(() =>
      transitionStage(db, {
        stageInstanceId: team.id,
        actor: "facilitator",
        to: "done",
      }),
    ).toThrow("Invalid stage transition");

    registerArtifact(db, {
      stageInstanceId: team.id,
      actor: "facilitator",
      kind: "doc",
      name: "チーム憲章",
      url: "https://example.com/team",
      status: "done",
    });
    transitionStage(db, { stageInstanceId: team.id, actor: "facilitator", to: "in_progress" });
    transitionStage(db, { stageInstanceId: team.id, actor: "facilitator", to: "done" });
    transitionStage(db, { stageInstanceId: persona.id, actor: "pm", to: "in_progress" });
    transitionStage(db, { stageInstanceId: persona.id, actor: "pm", to: "done" });
    transitionStage(db, { stageInstanceId: team.id, actor: "facilitator", to: "needs_update" });

    expect(
      db.select().from(stageInstances).where(eq(stageInstances.id, persona.id)).get(),
    ).toMatchObject({ status: "needs_update" });
    db.update(stageInstances)
      .set({ status: "done" })
      .where(eq(stageInstances.id, team.id))
      .run();
    expect(() =>
      transitionStage(db, { stageInstanceId: persona.id, actor: "pm", to: "in_progress" }),
    ).toThrow("Backpropagation confirmation required");

    const result = transitionStage(db, {
      stageInstanceId: persona.id,
      actor: "pm",
      to: "in_progress",
      confirmedBackpropagation: true,
    });

    expect(result).toMatchObject({ warning: true });
    expect(db.select().from(auditLogs).all()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ event: "stage.artifact.register" }),
        expect.objectContaining({ event: "stage.transition" }),
      ]),
    );
  });

  test("mobステージのdone遷移は参加ロール不足をwarningとして返し、ブロックしない", () => {
    const db = createTestDb();
    seedProject(db);
    const prfaq = db
      .select()
      .from(stageInstances)
      .where(eq(stageInstances.stageDefId, "prfaq"))
      .get()!;

    recordMobSession(db, {
      stageInstanceId: prfaq.id,
      actor: "pm",
      participantMemberIds: ["pm"],
      heldAt: "2026-07-25T00:00:00.000Z",
      note: "PMのみで実施",
    });
    transitionStage(db, { stageInstanceId: prfaq.id, actor: "pm", to: "in_progress" });
    const result = transitionStage(db, {
      stageInstanceId: prfaq.id,
      actor: "pm",
      to: "done",
    });

    expect(result).toMatchObject({ warning: true });
    expect(db.select().from(mobSessions).all()).toHaveLength(1);
  });

  test("updateArtifactStatusは質問リンクの回答待ち→回答済み切替を監査記録付きで行う", () => {
    const db = createTestDb();
    seedProject(db);
    const team = db
      .select()
      .from(stageInstances)
      .where(eq(stageInstances.stageDefId, "team_charter"))
      .get()!;

    const { id: artifactId } = registerArtifact(db, {
      stageInstanceId: team.id,
      actor: "facilitator",
      kind: "question",
      name: "AIツールの選定は誰が決める?",
      url: "https://example.com/q/1",
      status: "awaiting_answer",
    });

    updateArtifactStatus(db, {
      artifactLinkId: artifactId,
      actor: "pm",
      status: "answered",
    });

    expect(
      db.select().from(artifactLinks).where(eq(artifactLinks.id, artifactId)).get(),
    ).toMatchObject({ status: "answered" });
    expect(db.select().from(auditLogs).all()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ event: "stage.artifact.update_status" }),
      ]),
    );
  });

  test("getStageNavigatorDataはステージナビ描画に必要な情報一式を返す", () => {
    const db = createTestDb();
    seedProject(db);
    const team = db
      .select()
      .from(stageInstances)
      .where(eq(stageInstances.stageDefId, "team_charter"))
      .get()!;
    const persona = db
      .select()
      .from(stageInstances)
      .where(eq(stageInstances.stageDefId, "persona"))
      .get()!;

    checkItem(db, {
      stageInstanceId: team.id,
      actor: "pm",
      itemId: "agree_ai_native",
      checked: true,
    });
    registerArtifact(db, {
      stageInstanceId: team.id,
      actor: "facilitator",
      kind: "doc",
      name: "チーム憲章",
      url: "https://example.com/team",
      status: "done",
    });
    recordMobSession(db, {
      stageInstanceId: team.id,
      actor: "facilitator",
      participantMemberIds: ["pm"],
      heldAt: "2026-07-25T00:00:00.000Z",
      note: "PMのみ",
    });

    const view = getStageNavigatorData(db, team.id);

    expect(view.stage.id).toBe(team.id);
    expect(view.stageDef.id).toBe("team_charter");
    expect(view.members).toHaveLength(5);
    expect(view.checklistResults).toHaveLength(1);
    expect(view.artifactLinks).toHaveLength(1);
    expect(view.mobSessions).toHaveLength(1);
    expect(view.upstreamNeedsUpdate).toEqual([]);

    transitionStage(db, { stageInstanceId: team.id, actor: "facilitator", to: "in_progress" });
    transitionStage(db, { stageInstanceId: team.id, actor: "facilitator", to: "done" });
    transitionStage(db, { stageInstanceId: persona.id, actor: "pm", to: "in_progress" });
    transitionStage(db, { stageInstanceId: persona.id, actor: "pm", to: "done" });
    transitionStage(db, { stageInstanceId: team.id, actor: "facilitator", to: "needs_update" });

    const personaView = getStageNavigatorData(db, persona.id);
    // team_charter が needs_update になった時点で、依存する persona は
    // 自動伝播で自身も needs_update になる(services/stage.ts transitionStage)。
    // そのため upstreamNeedsUpdate バッジは「上流だけが要更新で自分は
    // done のまま」という取りこぼしケースを補う目的で別途保持する。
    expect(personaView.upstreamNeedsUpdate).toEqual(["team_charter"]);
  });
});
