import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  depthProfile: text("depth_profile").notNull(),
  templateVersion: text("template_version").notNull(),
  templateSnapshot: text("template_snapshot", { mode: "json" })
    .$type<Record<string, unknown>>()
    .notNull(),
  createdAt: text("created_at").notNull(),
});

export const members = sqliteTable("members", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  roles: text("roles", { mode: "json" }).$type<string[]>().notNull(),
  createdAt: text("created_at").notNull(),
});

export const units = sqliteTable("units", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  difficultyAssessment: text("difficulty_assessment", { mode: "json" })
    .$type<Record<string, unknown>>()
    .notNull(),
  createdAt: text("created_at").notNull(),
});

export const unitAssignments = sqliteTable(
  "unit_assignments",
  {
    id: text("id").primaryKey(),
    unitId: text("unit_id")
      .notNull()
      .references(() => units.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    isRepresentative: integer("is_representative", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    // 代表は Unit ごとに1名(spec 6章 UnitAssignment)。isRepresentative=true の行にのみ
    // 効く部分UNIQUEインデックスで、同一Unitへの複数代表登録をINSERT時に拒否する。
    // SQLite の部分インデックスの WHERE 句はテーブル修飾なしの裸のカラム名を要求するため sql.raw を使う。
    uniqueIndex("unit_assignments_one_representative_per_unit")
      .on(table.unitId)
      .where(sql.raw("is_representative = 1")),
  ],
);

export const stageInstances = sqliteTable("stage_instances", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  unitId: text("unit_id").references(() => units.id, { onDelete: "cascade" }),
  stageDefId: text("stage_def_id").notNull(),
  status: text("status").notNull(),
  statusChangedAt: text("status_changed_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export const checklistResults = sqliteTable("checklist_results", {
  id: text("id").primaryKey(),
  stageInstanceId: text("stage_instance_id")
    .notNull()
    .references(() => stageInstances.id, { onDelete: "cascade" }),
  itemId: text("item_id").notNull(),
  checked: integer("checked", { mode: "boolean" }).notNull(),
  by: text("by")
    .notNull()
    .references(() => members.id, { onDelete: "restrict" }),
  at: text("at").notNull(),
  skipReason: text("skip_reason"),
});

export const artifactLinks = sqliteTable("artifact_links", {
  id: text("id").primaryKey(),
  stageInstanceId: text("stage_instance_id")
    .notNull()
    .references(() => stageInstances.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
});

export const gateApprovals = sqliteTable(
  "gate_approvals",
  {
    id: text("id").primaryKey(),
    gateId: text("gate_id").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    unitId: text("unit_id").references(() => units.id, { onDelete: "cascade" }),
    approverId: text("approver_id")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
    understandingCheck: text("understanding_check", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull(),
    regressionCheck: text("regression_check", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull(),
    decision: text("decision").notNull(),
    at: text("at").notNull(),
  },
  (table) => [
    uniqueIndex("gate_approvals_unique_approval").on(
      table.projectId,
      table.gateId,
      sql.raw("coalesce(unit_id, '')"),
      table.approverId,
    ),
  ],
);

export const mobSessions = sqliteTable("mob_sessions", {
  id: text("id").primaryKey(),
  stageInstanceId: text("stage_instance_id")
    .notNull()
    .references(() => stageInstances.id, { onDelete: "cascade" }),
  participantMemberIds: text("participant_member_ids", { mode: "json" })
    .$type<string[]>()
    .notNull(),
  heldAt: text("held_at").notNull(),
  note: text("note"),
  createdAt: text("created_at").notNull(),
});

export const customerProblems = sqliteTable("customer_problems", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  artifactLinkId: text("artifact_link_id")
    .notNull()
    .references(() => artifactLinks.id, { onDelete: "cascade" }),
  createdAt: text("created_at").notNull(),
});

export const stories = sqliteTable("stories", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  customerProblemId: text("customer_problem_id").references(
    () => customerProblems.id,
    { onDelete: "set null" },
  ),
  text: text("text").notNull(),
  createdAt: text("created_at").notNull(),
});

export const storyUnits = sqliteTable("story_units", {
  id: text("id").primaryKey(),
  storyId: text("story_id")
    .notNull()
    .references(() => stories.id, { onDelete: "cascade" }),
  unitId: text("unit_id")
    .notNull()
    .references(() => units.id, { onDelete: "cascade" }),
  createdAt: text("created_at").notNull(),
});

export const scopeEntries = sqliteTable("scope_entries", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  feature: text("feature").notNull(),
  inOut: text("in_out").notNull(),
  decidedAt: text("decided_at").notNull(),
  reason: text("reason").notNull(),
  resurrectedAt: text("resurrected_at"),
  resurrectedBy: text("resurrected_by").references(() => members.id, {
    onDelete: "set null",
  }),
  resurrectReason: text("resurrect_reason"),
  createdAt: text("created_at").notNull(),
});

export const changeRequests = sqliteTable("change_requests", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  customerProblemId: text("customer_problem_id").references(
    () => customerProblems.id,
    { onDelete: "set null" },
  ),
  scopeEntryId: text("scope_entry_id").references(() => scopeEntries.id, {
    onDelete: "set null",
  }),
  status: text("status").notNull(),
  approvals: text("approvals", { mode: "json" })
    .$type<Record<string, unknown>[]>()
    .notNull(),
  createdAt: text("created_at").notNull(),
});

export const contracts = sqliteTable("contracts", {
  id: text("id").primaryKey(),
  unitAId: text("unit_a_id")
    .notNull()
    .references(() => units.id, { onDelete: "cascade" }),
  unitBId: text("unit_b_id")
    .notNull()
    .references(() => units.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  url: text("url").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
});

export const contractChangeRequests = sqliteTable("contract_change_requests", {
  id: text("id").primaryKey(),
  contractId: text("contract_id")
    .notNull()
    .references(() => contracts.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  impactedUnitIds: text("impacted_unit_ids", { mode: "json" })
    .$type<string[]>()
    .notNull(),
  approvals: text("approvals", { mode: "json" })
    .$type<Record<string, unknown>[]>()
    .notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  event: text("event").notNull(),
  actor: text("actor").notNull(),
  at: text("at").notNull(),
  detail: text("detail", { mode: "json" })
    .$type<Record<string, unknown>>()
    .notNull(),
});
