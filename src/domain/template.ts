import { load } from "js-yaml";
import { z } from "zod";

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
  .object({
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

const GateSchema = z.object({
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

    for (const [gateIndex, gate] of template.gates.entries()) {
      if (!stageIds.has(gate.afterStage)) {
        ctx.addIssue({
          code: "custom",
          message: `unknown afterStage: ${gate.afterStage}`,
          path: ["gates", gateIndex, "afterStage"],
        });
      }
    }
  });

export type ProcessTemplate = z.infer<typeof ProcessTemplateSchema>;

export function parseTemplate(yaml: string): ProcessTemplate {
  const parsed = load(yaml);
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
