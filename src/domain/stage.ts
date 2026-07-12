import type { StageStatus } from "./types";

export type StageState = {
  defId: string;
  status: StageStatus | string;
  dependsOn: readonly string[];
};

export type ReopenCheck = {
  warn: boolean;
  upstreamDone: string[];
};

const allowedTransitions: Record<StageStatus, readonly StageStatus[]> = {
  not_started: ["in_progress"],
  in_progress: ["done"],
  done: ["needs_update"],
  needs_update: ["in_progress"],
};

export function canTransition(from: StageStatus, to: StageStatus): boolean {
  return allowedTransitions[from].includes(to);
}

export function propagateNeedsUpdate(
  stages: readonly StageState[],
  changedStageId: string,
): string[] {
  const changedStage = stages.find((stage) => stage.defId === changedStageId);

  if (changedStage?.status !== "needs_update") {
    return [];
  }

  const downstreamByStageId = buildDownstreamGraph(stages);
  const affected: string[] = [];
  const visited = new Set<string>();

  visitDownstream(changedStageId, downstreamByStageId, visited, affected);

  return affected;
}

export function checkReopen(
  stages: readonly StageState[],
  targetStageId: string,
): ReopenCheck {
  const stageById = new Map(stages.map((stage) => [stage.defId, stage]));
  const upstreamDone: string[] = [];
  const visited = new Set<string>();

  visitUpstreamDone(targetStageId, stageById, visited, upstreamDone);

  return {
    warn: upstreamDone.length > 0,
    upstreamDone,
  };
}

function buildDownstreamGraph(
  stages: readonly StageState[],
): Map<string, string[]> {
  const downstreamByStageId = new Map<string, string[]>();

  for (const stage of stages) {
    for (const dependency of stage.dependsOn) {
      const downstream = downstreamByStageId.get(dependency) ?? [];
      downstream.push(stage.defId);
      downstreamByStageId.set(dependency, downstream);
    }
  }

  return downstreamByStageId;
}

function visitDownstream(
  stageId: string,
  downstreamByStageId: Map<string, string[]>,
  visited: Set<string>,
  affected: string[],
): void {
  const downstreamStages = downstreamByStageId.get(stageId) ?? [];

  for (const downstreamStageId of downstreamStages) {
    if (visited.has(downstreamStageId)) {
      continue;
    }

    visited.add(downstreamStageId);
    affected.push(downstreamStageId);
    visitDownstream(
      downstreamStageId,
      downstreamByStageId,
      visited,
      affected,
    );
  }
}

function visitUpstreamDone(
  stageId: string,
  stageById: Map<string, StageState>,
  visited: Set<string>,
  upstreamDone: string[],
): void {
  const stage = stageById.get(stageId);

  if (stage === undefined) {
    return;
  }

  for (const dependency of stage.dependsOn) {
    if (visited.has(dependency)) {
      continue;
    }

    visited.add(dependency);
    const upstreamStage = stageById.get(dependency);

    if (upstreamStage?.status === "done") {
      upstreamDone.push(dependency);
    }

    visitUpstreamDone(dependency, stageById, visited, upstreamDone);
  }
}
