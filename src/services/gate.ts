import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";

import {
  changeRequests,
  checklistResults,
  gateApprovals,
  members,
  projects,
  scopeEntries,
  stageInstances,
  unitAssignments,
  units,
} from "@/db/schema";
import { requiredG3Approvers } from "@/domain/contract";
import { gateState, validateApproval, type ApprovalAnswers } from "@/domain/gate";
import { canApproveAtG4 } from "@/domain/traceability";
import { parseTemplate } from "@/domain/template";
import type { Role } from "@/domain/types";

import type { AppDb } from "./audit";
import { withAudit } from "./audit";

export function approveGate(
  db: AppDb,
  input: {
    projectId: string;
    gateId: string;
    unitId?: string;
    approverId: string;
    answers: ApprovalAnswers;
  },
) {
  const context = loadGateContext(db, input.projectId, input.gateId, input.unitId);
  if (!validateApproval(context.gate, input.answers).ok) {
    throw new Error("Approval answers are incomplete");
  }

  const requiredApprovers = resolveRequiredApprovers(db, input.projectId, context.gate.approverRoles);
  if (!requiredApprovers.includes(input.approverId)) {
    throw new Error("Approver is not required for this gate");
  }

  if (input.gateId === "G4") {
    const unlinked = db
      .select()
      .from(changeRequests)
      .where(eq(changeRequests.projectId, input.projectId))
      .all()
      .find((request) => !canApproveAtG4(request).ok);
    if (unlinked !== undefined) {
      throw new Error("G4 approval requires linked change requests");
    }
  }

  const checklist = evaluateChecklist(db, context.afterStage.id, context.stageDef.checklist.map((item) => item.id));
  const unmetRequires =
    context.gate.requires?.includes("scope_ledger") && !hasScopeLedger(db, input.projectId)
      ? ["scope_ledger"]
      : [];
  const existingApprovals = db
    .select()
    .from(gateApprovals)
    .where(
      and(
        eq(gateApprovals.projectId, input.projectId),
        eq(gateApprovals.gateId, input.gateId),
        input.unitId === undefined ? isNull(gateApprovals.unitId) : eq(gateApprovals.unitId, input.unitId),
      ),
    )
    .all();
  const state = gateState(context.gate, {
    checklistDone: checklist.done,
    approvals: [
      ...existingApprovals.map((approval) => ({
        approverId: approval.approverId,
        decision: "approve" as const,
      })),
      { approverId: input.approverId, decision: "approve" as const },
    ],
    requiredApprovers,
    unmetRequires,
    uncheckedItems: checklist.uncheckedItems,
  });

  if (state.reason === "checklist_incomplete") {
    throw new Error("Gate checklist is incomplete");
  }
  if (state.reason === "requires_unmet") {
    throw new Error(`Gate requirements are unmet: ${unmetRequires.join(", ")}`);
  }

  return withAudit(
    db,
    input.projectId,
    input.approverId,
    "gate.approve",
    {
      gateId: input.gateId,
      unitId: input.unitId ?? null,
      passable: state.passable,
      carriedRisks: state.carriedRisks ?? [],
    },
    (tx) => {
      try {
        tx.insert(gateApprovals)
          .values({
            id: randomUUID(),
            gateId: input.gateId,
            projectId: input.projectId,
            unitId: input.unitId,
            approverId: input.approverId,
            understandingCheck: input.answers.understanding,
            regressionCheck: { items: input.answers.regression },
            decision: "approve",
            at: new Date().toISOString(),
          })
          .run();
      } catch (error) {
        if (error instanceof Error && error.message.includes("UNIQUE")) {
          throw new Error("Gate approval already exists");
        }
        throw error;
      }

      return state;
    },
  );
}

function loadGateContext(db: AppDb, projectId: string, gateId: string, unitId?: string) {
  const project = db.select().from(projects).where(eq(projects.id, projectId)).get();
  if (project === undefined) {
    throw new Error("Project not found");
  }

  const template = parseTemplate(JSON.stringify(project.templateSnapshot));
  const gate = template.gates.find((candidate) => candidate.id === gateId);
  if (gate === undefined) {
    throw new Error("Gate not found");
  }

  const stageDef = template.stages.find((stage) => stage.id === gate.afterStage);
  if (stageDef === undefined) {
    throw new Error("Gate stage definition not found");
  }

  const afterStage = db
    .select()
    .from(stageInstances)
    .where(
      and(
        eq(stageInstances.projectId, projectId),
        eq(stageInstances.stageDefId, gate.afterStage),
        unitId === undefined ? isNull(stageInstances.unitId) : eq(stageInstances.unitId, unitId),
      ),
    )
    .get();
  if (afterStage === undefined) {
    throw new Error("Gate stage instance not found");
  }

  return { gate, stageDef, afterStage };
}

function resolveRequiredApprovers(db: AppDb, projectId: string, roles: readonly string[]) {
  const projectMembers = db.select().from(members).where(eq(members.projectId, projectId)).all();
  if (roles.includes("unit_reps")) {
    const projectUnits = db.select().from(units).where(eq(units.projectId, projectId)).all();
    const assignments = db
      .select({
        unitId: unitAssignments.unitId,
        memberId: unitAssignments.memberId,
        isRepresentative: unitAssignments.isRepresentative,
      })
      .from(unitAssignments)
      .innerJoin(units, eq(unitAssignments.unitId, units.id))
      .where(eq(units.projectId, projectId))
      .all();
    return requiredG3Approvers(projectUnits, assignments, projectMembers);
  }

  return projectMembers
    .filter((member) => member.roles.some((role) => roles.includes(role as Role)))
    .map((member) => member.id);
}

function evaluateChecklist(db: AppDb, stageInstanceId: string, itemIds: string[]) {
  const checkedItems = new Set(
    db
      .select()
      .from(checklistResults)
      .where(eq(checklistResults.stageInstanceId, stageInstanceId))
      .all()
      .filter((result) => result.checked)
      .map((result) => result.itemId),
  );
  const uncheckedItems = itemIds.filter((itemId) => !checkedItems.has(itemId));

  return { done: uncheckedItems.length === 0, uncheckedItems };
}

function hasScopeLedger(db: AppDb, projectId: string) {
  return db.select().from(scopeEntries).where(eq(scopeEntries.projectId, projectId)).get() !== undefined;
}
