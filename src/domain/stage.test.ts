import { expect, test } from "vitest";
import { canTransition, checkReopen, propagateNeedsUpdate } from "./stage";

test("正常遷移: not_started→in_progress→done, done→needs_update→in_progress", () => {
  expect(canTransition("not_started", "in_progress")).toBe(true);
  expect(canTransition("done", "needs_update")).toBe(true);
  expect(canTransition("needs_update", "in_progress")).toBe(true);
  expect(canTransition("not_started", "done")).toBe(false);
});

test("上流がneeds_updateになると依存下流(推移的)が影響リストに入る", () => {
  const stages = [
    { defId: "design", status: "needs_update", dependsOn: [] },
    { defId: "code", status: "done", dependsOn: ["design"] },
    { defId: "test", status: "done", dependsOn: ["code"] },
  ];
  expect(propagateNeedsUpdate(stages, "design")).toEqual(["code", "test"]);
});

test("VibeCode警告: 上流doneのまま下流を再オープンすると警告+上流ID返却", () => {
  const stages = [
    { defId: "design", status: "done", dependsOn: [] },
    { defId: "code", status: "done", dependsOn: ["design"] },
  ];
  expect(checkReopen(stages, "code")).toEqual({
    warn: true,
    upstreamDone: ["design"],
  });
});

test("上流がneeds_updateなら警告なしで再オープン可", () => {
  const stages = [
    { defId: "design", status: "needs_update", dependsOn: [] },
    { defId: "code", status: "done", dependsOn: ["design"] },
  ];
  expect(checkReopen(stages, "code")).toEqual({
    warn: false,
    upstreamDone: [],
  });
});
