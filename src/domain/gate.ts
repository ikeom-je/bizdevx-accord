import { ApproverRole } from "./types";

export interface Gate {
  id: string;
  kind: "approval" | "warning";
  approverRoles: ApproverRole[];
  regressionChecks: string[];
  requires?: ("scope_ledger")[];
}

export interface GateStateContext {
  checklistDone: boolean;
  approvals: { approverId: string; decision: "approve" }[];
  requiredApprovers: string[];
  unmetRequires?: string[];
  uncheckedItems?: string[];
}

export interface GateStateResult {
  passable: boolean;
  reason?: "checklist_incomplete" | "requires_unmet" | "approvals_incomplete";
  carriedRisks?: string[];
}

export interface ApprovalAnswers {
  understanding: {
    intent: boolean;
    impact: boolean;
    ops: boolean;
  };
  regression: {
    item: string;
    regressed: boolean;
  }[];
}

export function gateState(gate: Gate, context: GateStateContext): GateStateResult {
  if (gate.kind === "warning") {
    return {
      passable: true,
      carriedRisks: context.uncheckedItems || [],
    };
  }

  if (!context.checklistDone) {
    return {
      passable: false,
      reason: "checklist_incomplete",
    };
  }

  if (context.unmetRequires && context.unmetRequires.length > 0) {
    return {
      passable: false,
      reason: "requires_unmet",
    };
  }

  const approvedIds = new Set(
    context.approvals
      .filter((a) => a.decision === "approve")
      .map((a) => a.approverId)
  );

  const allApproved = context.requiredApprovers.every((id) => approvedIds.has(id));
  if (!allApproved) {
    return {
      passable: false,
      reason: "approvals_incomplete",
    };
  }

  return {
    passable: true,
  };
}

export function validateApproval(gate: Gate, answers: ApprovalAnswers): { ok: boolean } {
  const { understanding, regression } = answers;
  if (!understanding || !understanding.intent || !understanding.impact || !understanding.ops) {
    return { ok: false };
  }

  if (!regression || !Array.isArray(regression)) {
    return { ok: false };
  }

  const answeredItems = new Map(regression.map((r) => [r.item, r.regressed]));

  for (const check of gate.regressionChecks) {
    if (answeredItems.get(check) === undefined) {
      return { ok: false };
    }
  }

  return { ok: true };
}
