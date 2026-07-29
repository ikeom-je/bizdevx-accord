import { load, JSON_SCHEMA } from "js-yaml";
import { z } from "zod";
import type { DepthProfile } from "./types";

const RoleSchema = z.enum([
  "business_owner",
  "pm",
  "facilitator",
  "architect",
  "unit_dev",
]);

const ApproverRoleSchema = z.union([RoleSchema, z.literal("unit_reps")]);

const DepthProfileSchema = z.enum(["poc", "new-service", "brownfield"]);

const StageExecutionSchema = z.enum(["mob", "solo"]);

const TransformationLensSchema = z.object({
  differs: z.string().min(1),
  unlearn: z.string().min(1),
});

const ChecklistItemSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  good: z.string().min(1).optional(),
  bad: z.string().min(1).optional(),
  perMember: z.boolean().optional(),
});

const PromptSchema = z.object({
  title: z.string().min(1),
  purpose: z.string().min(1),
  editHints: z.string().min(1),
  body: z.string().min(1),
});

const EscalationSchema = z.object({
  symptom: z.string().min(1),
  askRole: RoleSchema,
  howToAsk: z.string().min(1),
});

const StageSchema = z
  .strictObject({
    id: z.string().min(1),
    name: z.string().min(1),
    phase: z.string().min(1),
    roles: z.array(RoleSchema).min(1),
    participantRoles: z.array(RoleSchema).default([]),
    execution: StageExecutionSchema.default("solo"),
    purpose: z.string().min(1),
    transformationLens: TransformationLensSchema,
    profiles: z.array(DepthProfileSchema).min(1),
    contextChecklist: z.array(z.string().min(1)),
    checklist: z.array(ChecklistItemSchema),
    prompts: z.array(PromptSchema),
    escalations: z.array(EscalationSchema),
    dependsOn: z.array(z.string().min(1)),
  })
  .superRefine((stage, ctx) => {
    if (stage.execution === "mob" && stage.participantRoles.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "mob stage requires participantRoles",
        path: ["participantRoles"],
      });
    }
  });

const GateSchema = z.strictObject({
  id: z.string().min(1),
  afterStage: z.string().min(1),
  kind: z.enum(["approval", "warning"]),
  approverRoles: z.array(ApproverRoleSchema).min(1),
  regressionChecks: z.array(z.string().min(1)),
  requires: z.array(z.literal("scope_ledger")).optional(),
});

const ProcessTemplateSchema = z
  .object({
    version: z.number().int().positive(),
    name: z.string().min(1),
    profiles: z.array(DepthProfileSchema).min(1),
    stages: z.array(StageSchema).min(1),
    gates: z.array(GateSchema),
  })
  .superRefine((template, ctx) => {
    const stageIds = new Set<string>();

    for (const [index, stage] of template.stages.entries()) {
      if (stageIds.has(stage.id)) {
        ctx.addIssue({
          code: "custom",
          message: `duplicate stage id: ${stage.id}`,
          path: ["stages", index, "id"],
        });
      }
      stageIds.add(stage.id);
    }

    for (const [stageIndex, stage] of template.stages.entries()) {
      for (const [dependsOnIndex, dependency] of stage.dependsOn.entries()) {
        if (!stageIds.has(dependency)) {
          ctx.addIssue({
            code: "custom",
            message: `unknown dependsOn stage: ${dependency}`,
            path: ["stages", stageIndex, "dependsOn", dependsOnIndex],
          });
        }
      }
    }

    const gateIds = new Set<string>();

    for (const [gateIndex, gate] of template.gates.entries()) {
      if (!stageIds.has(gate.afterStage)) {
        ctx.addIssue({
          code: "custom",
          message: `unknown afterStage: ${gate.afterStage}`,
          path: ["gates", gateIndex, "afterStage"],
        });
      }

      if (gateIds.has(gate.id)) {
        ctx.addIssue({
          code: "custom",
          message: `duplicate gate id: ${gate.id}`,
          path: ["gates", gateIndex, "id"],
        });
      }
      gateIds.add(gate.id);

      if (gate.kind === "approval" && gate.regressionChecks.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: `approval gate must have at least one regressionChecks item (spec 4.3): ${gate.id}`,
          path: ["gates", gateIndex, "regressionChecks"],
        });
      }
    }

    const dependsOnById = new Map(
      template.stages.map((stage) => [stage.id, stage.dependsOn] as const),
    );

    for (const [stageIndex, stage] of template.stages.entries()) {
      const cycle = findDependsOnCycle(stage.id, dependsOnById);
      if (cycle !== null) {
        ctx.addIssue({
          code: "custom",
          message: `circular dependsOn: ${cycle.join(" -> ")}`,
          path: ["stages", stageIndex, "dependsOn"],
        });
      }
    }
  });

/**
 * stageId を起点に dependsOn を辿り、循環参照(自己参照含む)があれば
 * 経路(例: ["a", "b", "a"])を返す。ないなら null。
 * 未知の dependsOn 先(存在しないステージID)は別の superRefine チェックで
 * 検出済み前提のため、ここでは単に辿るのを打ち切る。
 */
function findDependsOnCycle(
  stageId: string,
  dependsOnById: ReadonlyMap<string, readonly string[]>,
): string[] | null {
  const path: string[] = [];
  const onPath = new Set<string>();

  function visit(currentId: string): string[] | null {
    if (onPath.has(currentId)) {
      return [...path, currentId];
    }
    path.push(currentId);
    onPath.add(currentId);

    for (const dependency of dependsOnById.get(currentId) ?? []) {
      const cycle = visit(dependency);
      if (cycle !== null) {
        return cycle;
      }
    }

    path.pop();
    onPath.delete(currentId);
    return null;
  }

  return visit(stageId);
}

export type ProcessTemplate = z.infer<typeof ProcessTemplateSchema>;

export function parseTemplate(yaml: string): ProcessTemplate {
  const parsed = load(yaml, { schema: JSON_SCHEMA });
  const result = ProcessTemplateSchema.safeParse(parsed);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => {
        const path = issue.path.join(".");
        return path.length > 0 ? `${path}: ${issue.message}` : issue.message;
      })
      .join("; ");

    throw new Error(`Invalid process template: ${details}`);
  }

  return result.data;
}

export type DependencyStage = {
  id: string;
  profiles: readonly DepthProfile[];
  dependsOn: readonly string[];
};

/**
 * spec 4.1: dependsOn はプロファイル非依存の単一チェーンとして書かれる。
 * 対象ステージの dependsOn 先が指定プロファイルで非アクティブな場合、
 * そのステージ自身の dependsOn をさらに遡り、プロファイルでアクティブな
 * 最初の祖先ステージを実効的な依存先として返す。
 *
 * 前提条件: stageId 自身は対象プロファイルでアクティブであること
 * (非アクティブなステージの依存解決は呼び出し側の対象外)。
 */
export function resolveActiveDependencies(
  stages: readonly DependencyStage[],
  profile: DepthProfile,
  stageId: string,
): string[] {
  const stageById = new Map(stages.map((stage) => [stage.id, stage]));
  const resolved: string[] = [];
  const seen = new Set<string>();

  const stage = stageById.get(stageId);
  if (stage === undefined) {
    return resolved;
  }

  for (const dependency of stage.dependsOn) {
    resolveAncestor(dependency, stageById, profile, new Set(), seen, resolved);
  }

  return resolved;
}

function resolveAncestor(
  candidateId: string,
  stageById: Map<string, DependencyStage>,
  profile: DepthProfile,
  visiting: Set<string>,
  seen: Set<string>,
  resolved: string[],
): void {
  if (visiting.has(candidateId)) {
    // 循環参照: これ以上遡らない
    return;
  }
  visiting.add(candidateId);

  const candidate = stageById.get(candidateId);
  if (candidate === undefined) {
    return;
  }

  if (candidate.profiles.includes(profile)) {
    if (!seen.has(candidateId)) {
      seen.add(candidateId);
      resolved.push(candidateId);
    }
    return;
  }

  for (const dependency of candidate.dependsOn) {
    resolveAncestor(dependency, stageById, profile, visiting, seen, resolved);
  }
}
