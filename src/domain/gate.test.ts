import { test, expect } from "vitest";
import { gateState, validateApproval } from "./gate";

const gate = { id: "G1", kind: "approval" as const, approverRoles: ["business_owner"], regressionChecks: ["人間が成果物を直接書いていないか"] };

test("approvalゲート: チェックリスト未完了なら blocked", () => {
  const s = gateState(gate, { checklistDone: false, approvals: [] , requiredApprovers: ["m1"]});
  expect(s.passable).toBe(false);
  expect(s.reason).toBe("checklist_incomplete");
});

test("approvalゲート: 必要承認者全員のapproveで通過可能", () => {
  const ok = { approverId: "m1", decision: "approve" as const };
  expect(gateState(gate, { checklistDone: true, approvals: [ok], requiredApprovers: ["m1"] }).passable).toBe(true);
  expect(gateState(gate, { checklistDone: true, approvals: [], requiredApprovers: ["m1"] }).passable).toBe(false);
});

test("追加通過条件(requires)が未充足なら承認が揃っていても blocked", () => {
  // G1 の requires: [scope_ledger]。services 層が「スコープ台帳に1件以上登録済みか」を評価して渡す
  const g1 = { ...gate, requires: ["scope_ledger"] };
  const ok = { approverId: "m1", decision: "approve" as const };
  const s = gateState(g1, { checklistDone: true, approvals: [ok], requiredApprovers: ["m1"], unmetRequires: ["scope_ledger"] });
  expect(s.passable).toBe(false);
  expect(s.reason).toBe("requires_unmet");
});

test("warningゲート: 未完了でも通過可能だが carriedRisks に未完了項目が入る", () => {
  const w = { ...gate, kind: "warning" as const };
  const s = gateState(w, { checklistDone: false, approvals: [], requiredApprovers: [], uncheckedItems: ["i1"] });
  expect(s.passable).toBe(true);
  expect(s.carriedRisks).toEqual(["i1"]);
});

test("承認は理解確認3項目すべてtrue+全回帰チェック回答済みが必須", () => {
  const bad = { understanding: { intent: true, impact: false, ops: true }, regression: [{ item: gate.regressionChecks[0], regressed: false }] };
  expect(validateApproval(gate, bad).ok).toBe(false);
  const good = { understanding: { intent: true, impact: true, ops: true }, regression: [{ item: gate.regressionChecks[0], regressed: true }] };
  expect(validateApproval(gate, good).ok).toBe(true); // 回帰「あり」でも承認自体は可、シグナルとして記録される
});
