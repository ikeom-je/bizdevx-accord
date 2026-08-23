import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";

import {
  artifactLinks,
  checklistResults,
  members,
  mobSessions,
  projects,
  stageInstances,
} from "@/db/schema";
import { canTransition, checkReopen, propagateNeedsUpdate } from "@/domain/stage";
import { parseTemplate, resolveActiveDependencies } from "@/domain/template";
import type { DepthProfile, StageStatus } from "@/domain/types";

import type { AppDb } from "./audit";
import { withAudit } from "./audit";

export function checkItem(
  db: AppDb,
  input: {
    stageInstanceId: string;
    actor: string;
    itemId: string;
    checked: boolean;
    skipReason?: string;
  },
) {
  const context = loadStageContext(db, input.stageInstanceId);
  const item = context.stageDef.checklist.find((entry) => entry.id === input.itemId);

  if (item === undefined) {
    throw new Error("Checklist item not found");
  }

  return withAudit(
    db,
    context.stage.projectId,
    input.actor,
    "stage.check_item",
    { stageInstanceId: input.stageInstanceId, itemId: input.itemId },
    (tx) => {
      const now = new Date().toISOString();
      const existing = item.perMember
        ? undefined
        : tx
            .select()
            .from(checklistResults)
            .where(
              and(
                eq(checklistResults.stageInstanceId, input.stageInstanceId),
                eq(checklistResults.itemId, input.itemId),
              ),
            )
            .get();

      if (existing !== undefined) {
        tx.update(checklistResults)
          .set({
            checked: input.checked,
            by: input.actor,
            at: now,
            skipReason: input.skipReason ?? null,
          })
          .where(eq(checklistResults.id, existing.id))
          .run();
        return { id: existing.id };
      }

      const id = randomUUID();
      tx.insert(checklistResults)
        .values({
          id,
          stageInstanceId: input.stageInstanceId,
          itemId: input.itemId,
          checked: input.checked,
          by: input.actor,
          at: now,
          skipReason: input.skipReason,
        })
        .run();

      return { id };
    },
  );
}

export function registerArtifact(
  db: AppDb,
  input: {
    stageInstanceId: string;
    actor: string;
    kind: string;
    name: string;
    url: string;
    status: string;
  },
) {
  const context = loadStageContext(db, input.stageInstanceId);

  return withAudit(
    db,
    context.stage.projectId,
    input.actor,
    "stage.artifact.register",
    { stageInstanceId: input.stageInstanceId, name: input.name },
    (tx) => {
      const id = randomUUID();
      tx.insert(artifactLinks)
        .values({
          id,
          stageInstanceId: input.stageInstanceId,
          kind: input.kind,
          name: input.name,
          url: input.url,
          status: input.status,
          createdAt: new Date().toISOString(),
        })
        .run();

      return { id };
    },
  );
}

export function updateArtifactStatus(
  db: AppDb,
  input: {
    artifactLinkId: string;
    actor: string;
    status: string;
  },
) {
  const artifact = db
    .select()
    .from(artifactLinks)
    .where(eq(artifactLinks.id, input.artifactLinkId))
    .get();
  if (artifact === undefined) {
    throw new Error("Artifact link not found");
  }
  const context = loadStageContext(db, artifact.stageInstanceId);

  return withAudit(
    db,
    context.stage.projectId,
    input.actor,
    "stage.artifact.update_status",
    { artifactLinkId: input.artifactLinkId, status: input.status },
    (tx) => {
      tx.update(artifactLinks)
        .set({ status: input.status })
        .where(eq(artifactLinks.id, input.artifactLinkId))
        .run();

      return { id: input.artifactLinkId };
    },
  );
}

export function transitionStage(
  db: AppDb,
  input: {
    stageInstanceId: string;
    actor: string;
    to: StageStatus;
    confirmedBackpropagation?: boolean;
  },
) {
  const context = loadStageContext(db, input.stageInstanceId);
  const from = context.stage.status as StageStatus;

  if (!canTransition(from, input.to)) {
    throw new Error("Invalid stage transition");
  }

  const stages = loadSiblingStages(db, context.stage.projectId, context.stage.unitId);
  const reopenCheck =
    from === "needs_update" && input.to === "in_progress"
      ? checkReopen(stages, context.stage.stageDefId)
      : undefined;

  if (reopenCheck?.warn && input.confirmedBackpropagation !== true) {
    throw new Error("Backpropagation confirmation required");
  }

  const mobWarning =
    input.to === "done" && context.stageDef.execution === "mob"
      ? missingMobRoles(db, input.stageInstanceId, context.stageDef.participantRoles)
      : [];

  return withAudit(
    db,
    context.stage.projectId,
    input.actor,
    "stage.transition",
    {
      stageInstanceId: input.stageInstanceId,
      from,
      to: input.to,
      warning: reopenCheck?.warn === true || mobWarning.length > 0,
    },
    (tx) => {
      const now = new Date().toISOString();
      tx.update(stageInstances)
        .set({ status: input.to, statusChangedAt: now })
        .where(eq(stageInstances.id, input.stageInstanceId))
        .run();

      let propagated: string[] = [];
      if (input.to === "needs_update") {
        const updatedStages = stages.map((stage) =>
          stage.defId === context.stage.stageDefId ? { ...stage, status: "needs_update" } : stage,
        );
        propagated = propagateNeedsUpdate(updatedStages, context.stage.stageDefId);
        for (const stageDefId of propagated) {
          tx.update(stageInstances)
            .set({ status: "needs_update", statusChangedAt: now })
            .where(
              and(
                eq(stageInstances.projectId, context.stage.projectId),
                context.stage.unitId === null
                  ? isNull(stageInstances.unitId)
                  : eq(stageInstances.unitId, context.stage.unitId),
                eq(stageInstances.stageDefId, stageDefId),
              ),
            )
            .run();
        }
      }

      return {
        warning: reopenCheck?.warn === true || mobWarning.length > 0,
        upstreamDone: reopenCheck?.upstreamDone ?? [],
        missingMobRoles: mobWarning,
        propagated,
      };
    },
  );
}

export function recordMobSession(
  db: AppDb,
  input: {
    stageInstanceId: string;
    actor: string;
    participantMemberIds: string[];
    heldAt: string;
    note?: string;
  },
) {
  const context = loadStageContext(db, input.stageInstanceId);

  return withAudit(
    db,
    context.stage.projectId,
    input.actor,
    "stage.mob_session.record",
    { stageInstanceId: input.stageInstanceId, participantMemberIds: input.participantMemberIds },
    (tx) => {
      const id = randomUUID();
      tx.insert(mobSessions)
        .values({
          id,
          stageInstanceId: input.stageInstanceId,
          participantMemberIds: input.participantMemberIds,
          heldAt: input.heldAt,
          note: input.note,
          createdAt: new Date().toISOString(),
        })
        .run();

      return { id };
    },
  );
}

/**
 * ステージナビ画面(spec 5.4)のレンダリングに必要な情報を1回で集約する読み取り専用クエリ。
 */
export function getStageNavigatorData(db: AppDb, stageInstanceId: string) {
  const context = loadStageContext(db, stageInstanceId);

  const projectMembers = db
    .select()
    .from(members)
    .where(eq(members.projectId, context.stage.projectId))
    .all();

  const results = db
    .select()
    .from(checklistResults)
    .where(eq(checklistResults.stageInstanceId, stageInstanceId))
    .all();

  const artifacts = db
    .select()
    .from(artifactLinks)
    .where(eq(artifactLinks.stageInstanceId, stageInstanceId))
    .all();

  const sessions = db
    .select()
    .from(mobSessions)
    .where(eq(mobSessions.stageInstanceId, stageInstanceId))
    .all();

  const siblings = loadSiblingStages(db, context.stage.projectId, context.stage.unitId);
  const reopenCheck = checkReopen(siblings, context.stage.stageDefId);

  // propagateNeedsUpdate により通常は上流が needs_update になると下流も
  // 連動して needs_update になるが(spec 4.5)、それでも「上流だけ要更新で
  // 自分は done のまま」という状態を取りこぼさないための別系統のバッジ判定。
  const effectiveDependsOn = resolveActiveDependencies(
    context.template.stages.map((stage) => ({
      id: stage.id,
      profiles: stage.profiles,
      dependsOn: stage.dependsOn,
    })),
    context.project.depthProfile as DepthProfile,
    context.stage.stageDefId,
  );
  const siblingsByDefId = new Map(siblings.map((stage) => [stage.defId, stage]));
  const upstreamNeedsUpdate = effectiveDependsOn.filter(
    (defId) => siblingsByDefId.get(defId)?.status === "needs_update",
  );

  return {
    project: context.project,
    stage: context.stage,
    stageDef: context.stageDef,
    members: projectMembers,
    checklistResults: results,
    artifactLinks: artifacts,
    mobSessions: sessions,
    upstreamNeedsUpdate,
    reopenCheck,
  };
}

function loadStageContext(db: AppDb, stageInstanceId: string) {
  const stage = db
    .select()
    .from(stageInstances)
    .where(eq(stageInstances.id, stageInstanceId))
    .get();

  if (stage === undefined) {
    throw new Error("Stage instance not found");
  }

  const project = db.select().from(projects).where(eq(projects.id, stage.projectId)).get();
  if (project === undefined) {
    throw new Error("Project not found");
  }

  const template = parseTemplate(JSON.stringify(project.templateSnapshot));
  const stageDef = template.stages.find((candidate) => candidate.id === stage.stageDefId);
  if (stageDef === undefined) {
    throw new Error("Stage definition not found");
  }

  return { project, stage, stageDef, template };
}

function loadSiblingStages(db: AppDb, projectId: string, unitId: string | null) {
  return db
    .select()
    .from(stageInstances)
    .where(
      and(
        eq(stageInstances.projectId, projectId),
        unitId === null ? isNull(stageInstances.unitId) : eq(stageInstances.unitId, unitId),
      ),
    )
    .all()
    .map((stage) => {
      const project = db.select().from(projects).where(eq(projects.id, projectId)).get();
      const template = parseTemplate(JSON.stringify(project!.templateSnapshot));
      const stageDef = template.stages.find((candidate) => candidate.id === stage.stageDefId);
      return {
        defId: stage.stageDefId,
        status: stage.status,
        dependsOn: stageDef?.dependsOn ?? [],
      };
    });
}

function missingMobRoles(db: AppDb, stageInstanceId: string, requiredRoles: string[]) {
  const sessions = db
    .select()
    .from(mobSessions)
    .where(eq(mobSessions.stageInstanceId, stageInstanceId))
    .all();
  const participantIds = new Set(sessions.flatMap((session) => session.participantMemberIds));
  const participantRoles = new Set(
    db
      .select()
      .from(members)
      .all()
      .filter((member) => participantIds.has(member.id))
      .flatMap((member) => member.roles),
  );

  return requiredRoles.filter((role) => !participantRoles.has(role));
}
