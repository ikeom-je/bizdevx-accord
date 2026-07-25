import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";

import {
  changeRequests,
  members,
  scopeEntries,
  stories,
  storyUnits,
} from "@/db/schema";

import type { AppDb } from "./audit";
import { withAudit } from "./audit";

export function linkStory(
  db: AppDb,
  input: {
    projectId: string;
    storyId: string;
    actor: string;
    customerProblemId: string | null;
    unitIds: string[];
  },
) {
  return withAudit(
    db,
    input.projectId,
    input.actor,
    "traceability.story.link",
    { storyId: input.storyId, customerProblemId: input.customerProblemId, unitIds: input.unitIds },
    (tx) => {
      tx.update(stories)
        .set({ customerProblemId: input.customerProblemId })
        .where(eq(stories.id, input.storyId))
        .run();

      for (const unitId of input.unitIds) {
        tx.insert(storyUnits)
          .values({
            id: randomUUID(),
            storyId: input.storyId,
            unitId,
            createdAt: new Date().toISOString(),
          })
          .run();
      }

      return { id: input.storyId };
    },
  );
}

export function createChangeRequest(
  db: AppDb,
  input: {
    id?: string;
    projectId: string;
    actor: string;
    text: string;
    customerProblemId?: string | null;
    scopeEntryId?: string | null;
  },
) {
  const id = input.id ?? randomUUID();

  return withAudit(
    db,
    input.projectId,
    input.actor,
    "traceability.change_request.create",
    { changeRequestId: id, customerProblemId: input.customerProblemId ?? null },
    (tx) => {
      tx.insert(changeRequests)
        .values({
          id,
          projectId: input.projectId,
          text: input.text,
          customerProblemId: input.customerProblemId ?? null,
          scopeEntryId: input.scopeEntryId ?? null,
          status: "open",
          approvals: [],
          createdAt: new Date().toISOString(),
        })
        .run();

      return { id };
    },
  );
}

export function resurrectOutEntry(
  db: AppDb,
  input: {
    projectId: string;
    scopeEntryId: string;
    actor: string;
    reason: string;
  },
) {
  if (input.reason.trim().length === 0) {
    throw new Error("Resurrection reason is required");
  }

  const actor = db.select().from(members).where(eq(members.id, input.actor)).get();
  if (actor === undefined || !actor.roles.includes("business_owner")) {
    throw new Error("business_owner role is required");
  }

  return withAudit(
    db,
    input.projectId,
    input.actor,
    "traceability.scope.resurrect",
    { scopeEntryId: input.scopeEntryId, reason: input.reason },
    (tx) => {
      tx.update(scopeEntries)
        .set({
          inOut: "in",
          resurrectedAt: new Date().toISOString(),
          resurrectedBy: input.actor,
          resurrectReason: input.reason,
        })
        .where(eq(scopeEntries.id, input.scopeEntryId))
        .run();

      return { id: input.scopeEntryId };
    },
  );
}
