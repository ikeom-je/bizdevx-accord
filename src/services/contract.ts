import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";

import {
  contractChangeRequests,
  contracts,
  members,
  unitAssignments,
  units,
} from "@/db/schema";
import type { Approval } from "@/domain/contract";
import { changeApproved, impactedUnits, resolveRepresentative } from "@/domain/contract";

import type { AppDb } from "./audit";
import { withAudit } from "./audit";

export function createChangeRequest(
  db: AppDb,
  input: {
    id?: string;
    projectId: string;
    contractId: string;
    actor: string;
    description: string;
  },
) {
  const contract = db.select().from(contracts).where(eq(contracts.id, input.contractId)).get();
  if (contract === undefined) {
    throw new Error("Contract not found");
  }

  const id = input.id ?? randomUUID();
  const impactedUnitIds = impactedUnits(contract);

  return withAudit(
    db,
    input.projectId,
    input.actor,
    "contract.change_request.create",
    { contractChangeRequestId: id, contractId: input.contractId, impactedUnitIds },
    (tx) => {
      tx.insert(contractChangeRequests)
        .values({
          id,
          contractId: input.contractId,
          description: input.description,
          impactedUnitIds,
          approvals: [],
          status: "open",
          createdAt: new Date().toISOString(),
        })
        .run();

      return { id };
    },
  );
}

export function approveChange(
  db: AppDb,
  input: {
    projectId: string;
    changeRequestId: string;
    actor: string;
  },
) {
  const changeRequest = db
    .select()
    .from(contractChangeRequests)
    .where(eq(contractChangeRequests.id, input.changeRequestId))
    .get();
  if (changeRequest === undefined) {
    throw new Error("Contract change request not found");
  }

  const requiredApproverIds = resolveRequiredApproverIds(db, input.projectId, changeRequest.impactedUnitIds);
  if (!requiredApproverIds.includes(input.actor)) {
    throw new Error("Actor is not an impacted unit representative");
  }

  const approvals = [
    ...changeRequest.approvals.filter((approval) => typeof approval.approverId === "string"),
    { approverId: input.actor, at: new Date().toISOString() },
  ];
  // DB列は Record<string, unknown>[] だが、直前の filter で approverId が
  // string であることを保証済みなので Approval[] として domain 層へ渡す。
  const approved = changeApproved(requiredApproverIds, approvals as unknown as Approval[]);

  return withAudit(
    db,
    input.projectId,
    input.actor,
    "contract.change_request.approve",
    { contractChangeRequestId: input.changeRequestId, approved },
    (tx) => {
      tx.update(contractChangeRequests)
        .set({
          approvals,
          status: approved ? "approved" : "open",
        })
        .where(eq(contractChangeRequests.id, input.changeRequestId))
        .run();

      if (approved) {
        tx.update(contracts)
          .set({ status: "confirmed" })
          .where(eq(contracts.id, changeRequest.contractId))
          .run();
      }

      return { approved };
    },
  );
}

function resolveRequiredApproverIds(db: AppDb, projectId: string, unitIds: string[]) {
  const projectMembers = db.select().from(members).where(eq(members.projectId, projectId)).all();
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

  return unitIds
    .map((unitId) => resolveRepresentative(unitId, assignments, projectMembers))
    .filter((memberId): memberId is string => memberId !== undefined);
}
