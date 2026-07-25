import { eq, isNull } from "drizzle-orm";
import { describe, expect, test } from "vitest";

import { createTestDb } from "@/db/client";
import {
  auditLogs,
  members,
  projects,
  stageInstances,
  unitAssignments,
  units,
} from "@/db/schema";

import { createProject, createUnit } from "./project";

describe("project service", () => {
  test("createProjectはテンプレートsnapshotを保存し、Construction系以外のstageInstancesを生成する", () => {
    const db = createTestDb();

    const project = createProject(db, {
      id: "project-1",
      name: "新規サービス",
      depthProfile: "new-service",
      actor: "system",
      members: [
        {
          id: "architect-1",
          name: "設計者",
          roles: ["architect"],
        },
      ],
    });

    const savedProject = db
      .select()
      .from(projects)
      .where(eq(projects.id, project.id))
      .get();
    const projectStages = db
      .select()
      .from(stageInstances)
      .where(isNull(stageInstances.unitId))
      .all();

    expect(savedProject?.templateSnapshot).toMatchObject({
      name: "bizdevx-standard",
      version: 1,
    });
    expect(projectStages.map((stage) => stage.stageDefId)).toContain("prfaq");
    expect(projectStages.map((stage) => stage.stageDefId)).not.toEqual(
      expect.arrayContaining(["domain_modeling", "code", "test", "architecture"]),
    );
    expect(db.select().from(members).all()).toMatchObject([
      { id: "architect-1", projectId: "project-1" },
    ]);
    expect(db.select().from(auditLogs).all()).toMatchObject([
      { projectId: "project-1", event: "project.create", actor: "system" },
    ]);
  });

  test("createUnitはConstruction系stageInstancesをUnit単位で生成し、代表を割り当てる", () => {
    const db = createTestDb();
    createProject(db, {
      id: "project-1",
      name: "新規サービス",
      depthProfile: "new-service",
      actor: "system",
      members: [
        { id: "dev-1", name: "開発者", roles: ["unit_dev"] },
        { id: "architect-1", name: "設計者", roles: ["architect"] },
      ],
    });

    createUnit(db, {
      id: "unit-1",
      projectId: "project-1",
      actor: "architect-1",
      name: "決済Unit",
      difficultyAssessment: { externalDependency: "high" },
      assignments: [
        { memberId: "dev-1", isRepresentative: true },
        { memberId: "architect-1", isRepresentative: false },
      ],
    });

    expect(db.select().from(units).all()).toMatchObject([
      { id: "unit-1", projectId: "project-1", name: "決済Unit" },
    ]);
    expect(
      db.select().from(stageInstances).where(eq(stageInstances.unitId, "unit-1")).all(),
    ).toMatchObject([
      { stageDefId: "domain_modeling" },
      { stageDefId: "code" },
      { stageDefId: "test" },
      { stageDefId: "architecture" },
    ]);
    expect(db.select().from(unitAssignments).all()).toMatchObject([
      { unitId: "unit-1", memberId: "dev-1", isRepresentative: true },
      { unitId: "unit-1", memberId: "architect-1", isRepresentative: false },
    ]);
    expect(db.select().from(auditLogs).all()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ event: "unit.create", actor: "architect-1" }),
      ]),
    );
  });
});
