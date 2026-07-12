import { Role, StageStatus, StageExecution } from "./types";

export interface WarningGatePassEvent {
  gateId: string;
  stageInstanceId: string;
  uncheckedItemIds: string[];
}

export interface ChecklistResult {
  stageInstanceId: string;
  itemId: string;
  checked: boolean;
  by?: string;
}

export interface CarriedRisk {
  gateId: string;
  stageInstanceId: string;
  itemId: string;
}

export interface GateApproval {
  gateId: string;
  regressionCheck: { item: string; regressed: boolean }[];
}

export interface RegressionSummary {
  [gateId: string]: {
    [item: string]: number;
  };
}

export interface StageInstance {
  id: string;
  stageDefId: string;
  status: StageStatus;
}

export interface StageDef {
  id: string;
  execution: StageExecution;
  participantRoles: Role[];
  phase: string;
}

export interface MobSession {
  stageInstanceId: string;
  participantMemberIds: string[];
}

export interface Member {
  id: string;
  roles: Role[];
}

export interface RoleBiasSignal {
  type: "missing_mob_role" | "single_role_bias";
  stageInstanceId?: string;
  stageDefId?: string;
  phase?: string;
  message: string;
}

export function carriedRisks(
  warningGatePassEvents: WarningGatePassEvent[],
  currentChecklistResults: ChecklistResult[]
): CarriedRisk[] {
  const risks: CarriedRisk[] = [];
  for (const event of warningGatePassEvents) {
    for (const itemId of event.uncheckedItemIds) {
      const isChecked = currentChecklistResults.some(
        (r) =>
          r.stageInstanceId === event.stageInstanceId &&
          r.itemId === itemId &&
          r.checked
      );
      if (!isChecked) {
        risks.push({
          gateId: event.gateId,
          stageInstanceId: event.stageInstanceId,
          itemId,
        });
      }
    }
  }
  return risks;
}

export function regressionSummary(
  gateApprovals: GateApproval[]
): RegressionSummary {
  const summary: RegressionSummary = {};
  for (const approval of gateApprovals) {
    const gateId = approval.gateId;
    if (!summary[gateId]) {
      summary[gateId] = {};
    }
    for (const check of approval.regressionCheck) {
      if (check.regressed) {
        summary[gateId][check.item] = (summary[gateId][check.item] || 0) + 1;
      }
    }
  }
  for (const gateId of Object.keys(summary)) {
    if (Object.keys(summary[gateId]).length === 0) {
      delete summary[gateId];
    }
  }
  return summary;
}

export function roleBiasSignals(
  stageInstances: StageInstance[],
  stageDefs: StageDef[],
  mobSessions: MobSession[],
  checklistResults: ChecklistResult[],
  members: Member[]
): RoleBiasSignal[] {
  const signals: RoleBiasSignal[] = [];

  // (a) モブステージの必須参加ロール欠落チェック
  for (const instance of stageInstances) {
    if (instance.status !== "done") {
      continue;
    }
    const def = stageDefs.find((d) => d.id === instance.stageDefId);
    if (!def || def.execution !== "mob") {
      continue;
    }

    const sessions = mobSessions.filter(
      (s) => s.stageInstanceId === instance.id
    );

    const requiredRoles = def.participantRoles || [];

    let isBiased = false;
    if (sessions.length === 0) {
      isBiased = true;
    } else {
      const allSessionsDeficient = sessions.every((session) => {
        const sessionRoles = new Set<Role>();
        for (const memberId of session.participantMemberIds) {
          const member = members.find((m) => m.id === memberId);
          if (member) {
            for (const r of member.roles) {
              sessionRoles.add(r);
            }
          }
        }
        return requiredRoles.some((r) => !sessionRoles.has(r));
      });
      if (allSessionsDeficient) {
        isBiased = true;
      }
    }

    if (isBiased) {
      signals.push({
        type: "missing_mob_role",
        stageInstanceId: instance.id,
        stageDefId: def.id,
        message: `モブステージ '${def.id}' は必要な参加ロールを欠いた状態で完了しています。`,
      });
    }
  }

  // (b) 単一ロールへの偏り
  const phaseRolesMap = new Map<string, Set<Role>>();
  
  for (const result of checklistResults) {
    if (!result.checked || !result.by) {
      continue;
    }
    const instance = stageInstances.find((si) => si.id === result.stageInstanceId);
    if (!instance) {
      continue;
    }
    const def = stageDefs.find((d) => d.id === instance.stageDefId);
    if (!def) {
      continue;
    }
    const phase = def.phase;
    const member = members.find((m) => m.id === result.by);
    if (!member) {
      continue;
    }

    if (!phaseRolesMap.has(phase)) {
      phaseRolesMap.set(phase, new Set<Role>());
    }
    const rolesSet = phaseRolesMap.get(phase)!;
    for (const r of member.roles) {
      rolesSet.add(r);
    }
  }

  for (const [phase, rolesSet] of phaseRolesMap.entries()) {
    if (rolesSet.size === 1) {
      const singleRole = Array.from(rolesSet)[0];
      signals.push({
        type: "single_role_bias",
        phase,
        message: `フェーズ '${phase}' の作業が単一のロール '${singleRole}' に偏っています。`,
      });
    }
  }

  return signals;
}
