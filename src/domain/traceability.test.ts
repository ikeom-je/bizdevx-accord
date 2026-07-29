import { expect, test } from "vitest";
import { findOrphans, suggestOutEntry, canApproveAtG4 } from "./traceability";

test("孤児: 未紐付け・参照切れ・削除済み課題参照・Out課題参照の4種を検出", () => {
  const problems = [
    { id: "p1", deleted: false },
    { id: "p_del", deleted: true },              // 削除済み課題
    { id: "p_out", deleted: false },             // Out スコープに紐付く課題
  ];
  const outProblemIds = ["p_out"];               // services 層が ScopeEntry(inOut=out) から算出して渡す
  const items = [
    { id: "s1", customerProblemId: null },       // 未紐付け → 孤児
    { id: "s2", customerProblemId: "p1" },       // 正常
    { id: "s3", customerProblemId: "missing" },  // 参照切れ → 孤児
    { id: "s4", customerProblemId: "p_del" },    // 削除済み参照 → 孤児
    { id: "s5", customerProblemId: "p_out" },    // Out 課題参照 → 孤児
  ];
  expect(findOrphans(items, problems, outProblemIds).map(o => o.id)).toEqual(["s1", "s3", "s4", "s5"]);
});

test("Out再登場: 名称完全一致のみサジェスト(類似判定しない)", () => {
  const scope = [{ feature: "サブスク課金", inOut: "out" as const }];
  expect(suggestOutEntry("サブスク課金", scope)?.feature).toBe("サブスク課金");
  expect(suggestOutEntry("サブスクリプション課金", scope)).toBeNull();
});

test("G4: 顧客課題に未紐付けのChangeRequestは承認不可", () => {
  expect(canApproveAtG4({ customerProblemId: null }).ok).toBe(false);
  expect(canApproveAtG4({ customerProblemId: "p1" }).ok).toBe(true);
});

test("G4: customerProblemIdが空文字の場合もnullと同様に承認不可", () => {
  expect(canApproveAtG4({ customerProblemId: "" }).ok).toBe(false);
});

// spec 5.2「復活の検出は名称の完全一致による自動サジェスト」に基づき、
// トリムや大文字小文字の正規化はしない(=== による完全一致のまま)。
test("Out再登場: 前後の空白差異は一致しない(トリムしない)", () => {
  const scope = [{ feature: "サブスク課金", inOut: "out" as const }];
  expect(suggestOutEntry(" サブスク課金", scope)).toBeNull();
  expect(suggestOutEntry("サブスク課金 ", scope)).toBeNull();
});

test("Out再登場: 大文字小文字の差異は一致しない(大小無視しない)", () => {
  const scope = [{ feature: "Subscription", inOut: "out" as const }];
  expect(suggestOutEntry("subscription", scope)).toBeNull();
  expect(suggestOutEntry("Subscription", scope)?.feature).toBe("Subscription");
});
