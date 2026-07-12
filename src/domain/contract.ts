import { Role } from "./types";

export interface Contract {
  unitAId: string;
  unitBId: string;
}

export interface UnitAssignment {
  unitId: string;
  memberId: string;
  isRepresentative: boolean;
}

export interface Member {
  id: string;
  roles: Role[] | string[];
}

export interface Approval {
  approverId: string;
}

export interface Unit {
  id: string;
}

/**
 * 契約変更の影響Unitは当事者2Unit
 */
export function impactedUnits(contract: Contract): string[] {
  return [contract.unitAId, contract.unitBId];
}

/**
 * Unit代表を解決する。isRepresentative=true のメンバー。未指定ならアーキテクトにフォールバック
 */
export function resolveRepresentative(
  unitId: string,
  assignments: UnitAssignment[],
  members: Member[]
): string | undefined {
  const repAssignment = assignments.find(
    (a) => a.unitId === unitId && a.isRepresentative
  );
  if (repAssignment) {
    return repAssignment.memberId;
  }
  // アーキテクトにフォールバック
  const architect = members.find((m) => m.roles.includes("architect"));
  return architect ? architect.id : undefined;
}

/**
 * 変更要求は影響Unit代表全員の承認で完了
 */
export function changeApproved(
  requiredIds: string[],
  approvals: Approval[]
): boolean {
  const approvedIds = new Set(approvals.map((a) => a.approverId));
  return requiredIds.every((id) => approvedIds.has(id));
}

/**
 * G3必要承認者 = アーキテクト全員 + 全Unitの代表(重複除去)
 */
export function requiredG3Approvers(
  units: Unit[],
  assignments: UnitAssignment[],
  members: Member[]
): string[] {
  const approverIds = new Set<string>();

  // アーキテクト全員
  for (const member of members) {
    if (member.roles.includes("architect")) {
      approverIds.add(member.id);
    }
  }

  // 全Unitの代表
  for (const unit of units) {
    const repId = resolveRepresentative(unit.id, assignments, members);
    if (repId) {
      approverIds.add(repId);
    }
  }

  return Array.from(approverIds);
}
