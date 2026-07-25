import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";

import { projects, members, stageInstances, unitAssignments, units } from "@/db/schema";
import { parseTemplate } from "@/domain/template";
import type { DepthProfile, Role } from "@/domain/types";

import type { AppDb } from "./audit";
import { withAudit } from "./audit";

const constructionStageIds = new Set([
  "domain_modeling",
  "code",
  "test",
  "architecture",
]);

type MemberInput = {
  id?: string;
  name: string;
  roles: Role[];
};

export type CreateProjectInput = {
  id?: string;
  name: string;
  depthProfile: DepthProfile;
  actor: string;
  members: MemberInput[];
};

export type CreateUnitInput = {
  id?: string;
  projectId: string;
  actor: string;
  name: string;
  difficultyAssessment: Record<string, unknown>;
  assignments: {
    memberId: string;
    isRepresentative: boolean;
  }[];
};

export function listProjects(db: AppDb) {
  return db.select().from(projects).all();
}

export function findProjectWithMembers(db: AppDb, projectId: string) {
  const project = db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .get();

  if (project === undefined) {
    return undefined;
  }

  const projectMembers = db
    .select()
    .from(members)
    .where(eq(members.projectId, projectId))
    .all();

  return { project, members: projectMembers };
}

export function createProject(db: AppDb, input: CreateProjectInput) {
  const projectId = input.id ?? randomUUID();

  return withAudit(
    db,
    projectId,
    input.actor,
    "project.create",
    { name: input.name, depthProfile: input.depthProfile },
    (tx) => {
      const template = loadStandardTemplate();
      const now = new Date().toISOString();

      tx.insert(projects)
        .values({
          id: projectId,
          name: input.name,
          depthProfile: input.depthProfile,
          templateVersion: String(template.version),
          templateSnapshot: template,
          createdAt: now,
        })
        .run();

      if (input.members.length > 0) {
        tx.insert(members)
          .values(
            input.members.map((member) => ({
              id: member.id ?? randomUUID(),
              projectId,
              name: member.name,
              roles: member.roles,
              createdAt: now,
            })),
          )
          .run();
      }

      const initialStages = template.stages.filter(
        (stage) =>
          stage.profiles.includes(input.depthProfile) &&
          !constructionStageIds.has(stage.id),
      );

      if (initialStages.length > 0) {
        tx.insert(stageInstances)
          .values(
            initialStages.map((stage) => ({
              id: randomUUID(),
              projectId,
              unitId: null,
              stageDefId: stage.id,
              status: "not_started",
              statusChangedAt: now,
              createdAt: now,
            })),
          )
          .run();
      }

      return { id: projectId };
    },
  );
}

export function createUnit(db: AppDb, input: CreateUnitInput) {
  return withAudit(
    db,
    input.projectId,
    input.actor,
    "unit.create",
    { unitId: input.id, name: input.name },
    (tx) => {
      const project = tx
        .select()
        .from(projects)
        .where(eq(projects.id, input.projectId))
        .get();

      if (project === undefined) {
        throw new Error("Project not found");
      }

      const unitId = input.id ?? randomUUID();
      const now = new Date().toISOString();
      const template = project.templateSnapshot;
      const stages = parseTemplateObject(template).stages.filter(
        (stage) =>
          stage.profiles.includes(project.depthProfile as DepthProfile) &&
          constructionStageIds.has(stage.id),
      );

      tx.insert(units)
        .values({
          id: unitId,
          projectId: input.projectId,
          name: input.name,
          difficultyAssessment: input.difficultyAssessment,
          createdAt: now,
        })
        .run();

      if (input.assignments.length > 0) {
        tx.insert(unitAssignments)
          .values(
            input.assignments.map((assignment) => ({
              id: randomUUID(),
              unitId,
              memberId: assignment.memberId,
              isRepresentative: assignment.isRepresentative,
              createdAt: now,
            })),
          )
          .run();
      }

      if (stages.length > 0) {
        tx.insert(stageInstances)
          .values(
            stages.map((stage) => ({
              id: randomUUID(),
              projectId: input.projectId,
              unitId,
              stageDefId: stage.id,
              status: "not_started",
              statusChangedAt: now,
              createdAt: now,
            })),
          )
          .run();
      }

      return { id: unitId };
    },
  );
}

function loadStandardTemplate() {
  const path = join(process.cwd(), "templates", "bizdevx-standard.yaml");
  return parseTemplate(readFileSync(path, "utf8"));
}

function parseTemplateObject(value: Record<string, unknown>) {
  return parseTemplate(JSON.stringify(value));
}
