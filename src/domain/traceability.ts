export interface Problem {
  id: string;
  deleted: boolean;
}

export interface TraceableItem {
  id: string;
  customerProblemId: string | null;
}

export interface ScopeEntry {
  feature: string;
  inOut: "in" | "out";
}

export interface ChangeRequest {
  customerProblemId: string | null;
}

/**
 * 孤児（Orphans）であるアイテム（ストーリー等）を検出する。
 * 検出対象:
 * 1. 未紐付け (customerProblemId が null)
 * 2. 参照切れ (customerProblemId の ID が problems に存在しない)
 * 3. 削除済み課題参照 (対象の problem.deleted が true)
 * 4. Outスコープに紐付く課題参照 (customerProblemId が outProblemIds に含まれる)
 */
export function findOrphans(
  items: TraceableItem[],
  problems: Problem[],
  outProblemIds: string[]
): TraceableItem[] {
  const problemMap = new Map<string, Problem>();
  for (const p of problems) {
    problemMap.set(p.id, p);
  }

  const outSet = new Set(outProblemIds);

  return items.filter((item) => {
    const pid = item.customerProblemId;
    if (pid === null || pid === undefined || pid === "") {
      return true; // 1. 未紐付け
    }

    const problem = problemMap.get(pid);
    if (!problem) {
      return true; // 2. 参照切れ
    }

    if (problem.deleted) {
      return true; // 3. 削除済み課題参照
    }

    if (outSet.has(pid)) {
      return true; // 4. Outスコープに紐付く課題参照
    }

    return false;
  });
}

/**
 * Outスコープに指定されている機能名と完全一致する ScopeEntry があればサジェストする。
 */
export function suggestOutEntry(
  name: string,
  scope: ScopeEntry[]
): ScopeEntry | null {
  for (const entry of scope) {
    if (entry.feature === name && entry.inOut === "out") {
      return entry;
    }
  }
  return null;
}

/**
 * G4ゲートでの承認可否を判定する。
 * 顧客課題に未紐付けの ChangeRequest は承認不可。
 */
export function canApproveAtG4(changeRequest: ChangeRequest): { ok: boolean } {
  if (changeRequest.customerProblemId === null || changeRequest.customerProblemId === undefined || changeRequest.customerProblemId === "") {
    return { ok: false };
  }
  return { ok: true };
}
