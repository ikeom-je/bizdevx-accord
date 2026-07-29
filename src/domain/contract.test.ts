import { expect, test } from "vitest";
import { impactedUnits, resolveRepresentative, changeApproved, requiredG3Approvers } from "./contract";

test("契約変更の影響Unitは当事者2Unit", () => {
  expect(impactedUnits({ unitAId: "u1", unitBId: "u2" })).toEqual(["u1", "u2"]);
});

test("Unit代表: isRepresentative=true のメンバー。未指定ならアーキテクトにフォールバック", () => {
  const asg = [{ unitId: "u1", memberId: "m1", isRepresentative: true }];
  const members = [{ id: "m9", roles: ["architect"] }];
  expect(resolveRepresentative("u1", asg, members)).toBe("m1");
  expect(resolveRepresentative("u2", asg, members)).toBe("m9"); // fallback
});

test("変更要求は影響Unit代表全員の承認で完了", () => {
  expect(changeApproved(["m1", "m2"], [{ approverId: "m1" }])).toBe(false);
  expect(changeApproved(["m1", "m2"], [{ approverId: "m1" }, { approverId: "m2" }])).toBe(true);
});

test("G3必要承認者 = アーキテクト全員 + 全Unitの代表(重複除去)", () => {
  const members = [{ id: "a1", roles: ["architect"] }, { id: "m1", roles: ["unit_dev"] }];
  const asg = [{ unitId: "u1", memberId: "m1", isRepresentative: true }];
  expect(requiredG3Approvers([{ id: "u1" }], asg, members).sort()).toEqual(["a1", "m1"]);
});

// spec上は代表未指定時の代行者決定方法が未定義。実装は members 配列の先頭に
// 見つかったアーキテクト1名にフォールバックする(Array.prototype.find の挙動)。
// このテストはその現在の意図を記録する目的で追加する(issue #39)。
test("resolveRepresentative: 代表未指定でアーキテクトが複数いる場合、先頭1名にフォールバックする", () => {
  const members = [
    { id: "a1", roles: ["architect"] },
    { id: "a2", roles: ["architect"] },
  ];
  expect(resolveRepresentative("u1", [], members)).toBe("a1");
});

test("requiredG3Approvers: アーキテクト本人がUnit代表を兼ねても重複除去される", () => {
  const members = [{ id: "a1", roles: ["architect"] }];
  const asg = [{ unitId: "u1", memberId: "a1", isRepresentative: true }];
  expect(requiredG3Approvers([{ id: "u1" }], asg, members)).toEqual(["a1"]);
});

test("requiredG3Approvers: 複数Unitが同一アーキテクトにフォールバックしても重複除去される", () => {
  const members = [{ id: "a1", roles: ["architect"] }];
  // u1, u2 とも代表未指定 → いずれも a1 にフォールバック
  const asg: { unitId: string; memberId: string; isRepresentative: boolean }[] = [];
  expect(
    requiredG3Approvers([{ id: "u1" }, { id: "u2" }], asg, members)
  ).toEqual(["a1"]);
});
