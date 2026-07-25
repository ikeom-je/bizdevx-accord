import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

import { createTestDb } from "@/db/client";
import { contractChangeRequests, contracts } from "@/db/schema";

import { createProject, createUnit } from "./project";
import {
  approveChange,
  createChangeRequest as createContractChangeRequest,
} from "./contract";

function seedContract(db: ReturnType<typeof createTestDb>) {
  createProject(db, {
    id: "project-contract",
    name: "Contract project",
    depthProfile: "new-service",
    actor: "system",
    members: [
      { id: "architect", name: "設計者", roles: ["architect"] },
      { id: "dev-a", name: "A代表", roles: ["unit_dev"] },
      { id: "dev-b", name: "B代表", roles: ["unit_dev"] },
    ],
  });
  createUnit(db, {
    id: "unit-a",
    projectId: "project-contract",
    actor: "architect",
    name: "Unit A",
    difficultyAssessment: {},
    assignments: [{ memberId: "dev-a", isRepresentative: true }],
  });
  createUnit(db, {
    id: "unit-b",
    projectId: "project-contract",
    actor: "architect",
    name: "Unit B",
    difficultyAssessment: {},
    assignments: [{ memberId: "dev-b", isRepresentative: true }],
  });
  db.insert(contracts)
    .values({
      id: "contract-1",
      unitAId: "unit-a",
      unitBId: "unit-b",
      name: "API契約",
      url: "https://example.com/contract",
      status: "draft",
      createdAt: "2026-07-25T00:00:00.000Z",
    })
    .run();
}

describe("contract service", () => {
  test("契約変更要求を作成し、影響Unit代表全員の承認で契約をconfirmedにする", () => {
    const db = createTestDb();
    seedContract(db);

    createContractChangeRequest(db, {
      id: "ccr-1",
      projectId: "project-contract",
      contractId: "contract-1",
      actor: "architect",
      description: "レスポンス項目を追加",
    });

    expect(db.select().from(contractChangeRequests).all()).toMatchObject([
      {
        id: "ccr-1",
        contractId: "contract-1",
        impactedUnitIds: ["unit-a", "unit-b"],
        status: "open",
      },
    ]);

    expect(
      approveChange(db, {
        projectId: "project-contract",
        changeRequestId: "ccr-1",
        actor: "dev-a",
      }),
    ).toMatchObject({ approved: false });
    expect(db.select().from(contracts).where(eq(contracts.id, "contract-1")).get()).toMatchObject({
      status: "draft",
    });

    expect(
      approveChange(db, {
        projectId: "project-contract",
        changeRequestId: "ccr-1",
        actor: "dev-b",
      }),
    ).toMatchObject({ approved: true });
    expect(db.select().from(contracts).where(eq(contracts.id, "contract-1")).get()).toMatchObject({
      status: "confirmed",
    });
  });
});
