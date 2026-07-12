# BizDevX Accord MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** spec(`.claude/specs/bizdevx-accord-design.md`)とユーザーストーリー20本(`.claude/specs/bizdevx-accord-user-stories.md`)を満たす、LLM 非搭載のプロセスナビゲーター Web アプリ MVP を構築する。

**Architecture:** プロセス定義は YAML(zod でバリデーション)、実行状態は SQLite。ゲート判定・状態遷移・孤児検出などは `src/domain/` のピュア TypeScript モジュール(フレームワーク・DB 非依存、ユニットテスト網羅)。`src/services/` が DB とドメインを組み立て、全状態変更を AuditLog に記録。UI は Next.js App Router + Server Actions。

**Tech Stack:** TypeScript / Next.js 15 (App Router) / better-sqlite3 + Drizzle ORM / zod + js-yaml / Tailwind CSS / Vitest / Playwright

**配置先:** このリポジトリ(github.com/ikeom-je/bizdevx-accord、ローカル `~/develop/bizdevx-accord`)のルート直下。`.claude/` は既存のまま(`docs/` は現時点で未使用。必要になった時点で steering の方針に沿って作成する)。

## 技術選定 ADR(spec 8章「後ろ倒し」の決定)

| 選定 | 理由 | 不採用案 |
|------|------|---------|
| Next.js + Server Actions | 単一プロセスで UI+API が完結しシンプル構成の要件に合う。ロール別画面の SSR が素直 | Express+SPA(2プロセス管理が増える)、Rails/Django(チームの JS 資産と将来の AI Agent 組込みを考慮) |
| SQLite (better-sqlite3) | spec 8章の指定。同期 API でトランザクションが単純 | PostgreSQL(社内シンプル構成には過剰) |
| Drizzle ORM | スキーマが TS で型安全、マイグレーション付き | Prisma(バイナリ依存が重い) |
| zod + js-yaml | YAML テンプレートの起動時バリデーション(spec 9章) | JSON Schema(TS 型との二重管理になる) |

## File Structure

```
/ (repo root)
├── package.json / tsconfig.json / next.config.ts / drizzle.config.ts
├── vitest.config.ts / playwright.config.ts / tailwind 設定
├── templates/
│   └── bizdevx-standard.yaml        # bizdevx 標準テンプレート(3プロファイル)
├── src/
│   ├── domain/                      # ピュアなドメインロジック(import は zod のみ可、DB/Next 禁止)
│   │   ├── types.ts                 # 共有型(StageStatus, GateKind, Role など)
│   │   ├── template.ts              # YAML の zod スキーマ+パース関数
│   │   ├── stage.ts                 # 状態遷移・要更新の下流伝播・VibeCode 警告
│   │   ├── gate.ts                  # ゲート通過判定・承認バリデーション(理解確認+変革ふりかえり)
│   │   ├── traceability.ts          # 孤児検出・Out 再登場サジェスト・G4 承認可否
│   │   ├── contract.ts              # 影響 Unit 算出・Unit 代表解決・変更要求の承認完了判定
│   │   └── signals.ts               # 引き継いだリスク・回帰シグナル集計
│   ├── db/
│   │   ├── schema.ts                # Drizzle スキーマ(spec 6章のエンティティ)
│   │   └── client.ts                # DB 接続(テスト時は :memory:)
│   ├── services/                    # DB⇔ドメイン組み立て。全 mutation が audit() を通る
│   │   ├── audit.ts
│   │   ├── project.ts / stage.ts / gate.ts / traceability.ts / contract.ts
│   │   └── reviewSheet.ts           # クローズドクエスチョン md 生成
│   └── app/
│       ├── layout.tsx               # 全画面ヘッダー(チーム憲章への常設リンク)
│       ├── page.tsx                 # プロジェクト一覧+作成+メンバー選択ログイン
│       └── projects/[id]/
│           ├── dashboard/page.tsx   # 5.1 ロール別ダッシュボード
│           ├── stages/[sid]/page.tsx# 5.4 ステージナビ(汎用レンダラー)
│           ├── traceability/page.tsx# 5.2 トレーサビリティ台帳
│           ├── contracts/page.tsx   # 5.3 契約ボード
│           └── audit/page.tsx       # 5.5 監査証跡
├── e2e/main-flow.spec.ts
└── src/**/*.test.ts                 # ユニットテスト(コロケーション)
```

**規律:** `src/domain/` は Next.js・Drizzle を import してはならない(ESLint ルールで強制)。UI からの状態変更は必ず services を経由する。

---

### Task 0: プロジェクト scaffolding

**Files:** Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, tailwind 設定, `.gitignore` 追記, `src/app/layout.tsx`, `src/app/page.tsx`(仮)

- [ ] **Step 1:** `npx create-next-app@latest . --ts --app --tailwind --src-dir --import-alias "@/*"` をリポジトリルートで実行(既存の `.claude/` は保持。git は初期化済みなので再初期化しない。ディレクトリ非空で拒否される場合は一時ディレクトリに生成して中身を移す)
- [ ] **Step 2:** `npm i better-sqlite3 drizzle-orm zod js-yaml && npm i -D drizzle-kit vitest @types/better-sqlite3 @types/js-yaml @playwright/test`
- [ ] **Step 3:** `vitest.config.ts` を作成(`test: { include: ["src/**/*.test.ts"] }`)
- [ ] **Step 4:** ESLint ルールで `src/domain/` の純粋性を強制: `no-restricted-imports` で `src/domain/**` から `next*`・`drizzle-orm*`・`better-sqlite3`・`@/db/*`・`@/services/*` の import を禁止(File Structure の「規律」を機械化)
- [ ] **Step 5:** `npm run dev` で起動確認、`npx vitest run` が「no tests」で正常終了、`npx eslint src` が通ることを確認
- [ ] **Step 6:** Commit: `chore: scaffold Next.js + SQLite + Vitest project with domain purity lint`

### Task 1: ドメイン共有型とテンプレート zod スキーマ

**Files:** Create: `src/domain/types.ts`, `src/domain/template.ts`, `src/domain/template.test.ts`

- [x] **Step 1: 型定義を書く**

```ts
// src/domain/types.ts
export type StageStatus = "not_started" | "in_progress" | "done" | "needs_update";
export type GateKind = "approval" | "warning"; // ★承認必須 / ⚠警告型
export type Role = "business_owner" | "pm" | "facilitator" | "architect" | "unit_dev";
// ゲートの approverRoles には Role に加え動的解決マーカー "unit_reps"(全 Unit 代表)を許す。
// マーカーの展開は services 層が Task 7 の requiredG3Approvers/resolveRepresentative で行う。
export type ApproverRole = Role | "unit_reps";
export type DepthProfile = "poc" | "new-service" | "brownfield";
export type StageExecution = "mob" | "solo"; // spec 4.1: モブ実施か個人作業か(課題K)
```

zod 側も `approverRoles: z.array(ApproverRoleSchema)` とすること(`unit_reps` を含む Task 2 の標準テンプレートがバリデーションを通る必要がある)。

- [x] **Step 2: 失敗するテストを書く**(spec 4.1 のフィールドを検証)

```ts
// src/domain/template.test.ts
import { parseTemplate } from "./template";

const minimalYaml = `
version: 1
name: bizdevx-standard
profiles: [poc, new-service, brownfield]
stages:
  - id: team_charter
    name: チーム憲章
    phase: phase0
    roles: [facilitator]
    purpose: AIネイティブな働き方に合意する
    transformationLens:            # 変革視座(spec 4.4)
      differs: 従来はキックオフで体制だけ決めていた
      unlearn: 個人の暗黙の働き方のまま始めること
    profiles: [poc, new-service, brownfield]
    contextChecklist: []
    checklist:
      - id: agree_ai_native
        text: 人間は成果物を書かず、意図の提示とレビューに集中することに合意した
        perMember: true            # メンバーごとに記録(spec 6章)
    prompts: []
    escalations: []
    dependsOn: []
gates:
  - id: G1
    afterStage: team_charter
    kind: approval
    approverRoles: [business_owner]
    regressionChecks:              # 旧習慣回帰チェック(spec 4.1/4.4)
      - 人間が成果物を直接書き始めていないか
`;

test("有効なYAMLをパースできる", () => {
  const t = parseTemplate(minimalYaml);
  expect(t.stages[0].transformationLens.unlearn).toContain("暗黙");
  expect(t.gates[0].regressionChecks).toHaveLength(1);
});

test("不正なYAML(kind不正)は明示エラー", () => {
  expect(() => parseTemplate(minimalYaml.replace("kind: approval", "kind: bogus")))
    .toThrow(/gates/);
});

test("dependsOn が存在しないステージIDを指すとエラー", () => {
  expect(() => parseTemplate(minimalYaml.replace("dependsOn: []", "dependsOn: [nope]")))
    .toThrow(/nope/);
});
```

- [x] **Step 3:** `npx vitest run src/domain/template.test.ts` → FAIL(parseTemplate 未定義)を確認
- [x] **Step 4: 実装**(zod スキーマ: stage{id,name,phase,roles(主導ロール),participantRoles[](必須参加ロール。spec 4.1/課題K),execution("mob"|"solo"、デフォルト "solo"),purpose,transformationLens{differs,unlearn},profiles,contextChecklist[],checklist[{id,text,good?,bad?,perMember?}],prompts[{title,purpose,editHints,body}],escalations[{symptom,askRole,howToAsk}],dependsOn[]}, gate{id,afterStage,kind,approverRoles(ApproverRole 配列),regressionChecks[],requires?[](追加通過条件キー。MVP では "scope_ledger" のみ)}。`superRefine` で dependsOn/afterStage の参照整合を検証。テストに「execution: mob かつ participantRoles 空はエラー」を1ケース追加)
- [x] **Step 5:** テスト PASS を確認 → Commit: `feat(domain): process template schema and parser`

### Task 2: bizdevx 標準テンプレート YAML

**Files:** Create: `templates/bizdevx-standard.yaml`, `src/domain/standardTemplate.test.ts`

- [ ] **Step 1: テストを書く** — 「templates/bizdevx-standard.yaml が parseTemplate を通る」「G1〜G4 が定義されている」「new-service プロファイルに spec 4.2 の全ステージ(team_charter, persona, problem_selection, prfaq, user_stories, mock, unit_of_work, context_map, difficulty_assessment, contract, domain_modeling, code, test, architecture, qa, user_review)が含まれる」「poc プロファイルでは mock/difficulty_assessment などが省かれる」→ FAIL 確認
- [ ] **Step 2: YAML 本体を書く。** 内容は既存資料から具体化する:
  - チェックリスト・プロンプトは `.claude/knowledge/bizdevx-prompt-patterns.md`(ステージ別プロンプト骨格: 目的・修正観点つき)と `.claude/knowledge/bizdevx-process-flow.md`(実践知見。例:「ストーリーが20を超えていないか」「非機能・見積もりを含めていないか」)から具体化する
  - 変革視座は spec 1.0 の視座転換表をステージごとに具体化(例: user_stories → 「網羅ではなく削ぎ落とす」)
  - **実施形態と参加ロール(spec 4.2 の《mob》注記/課題K)**: Phase 0 の全ステージ(team_charter, persona, problem_selection, prfaq)= `execution: mob` + participantRoles に全5ロール(開発者を含む)。Phase 1 の全ステージ(user_stories, mock, unit_of_work, context_map, difficulty_assessment, contract)= architect 主導 + `execution: mob` + participantRoles: [pm, business_owner](spec 4.2 のフェーズ見出しどおり)。domain_modeling = unit_dev 主導 + `execution: mob` + participantRoles: [pm]。Phase 3 の qa・user_review = pm 主導 + `execution: mob` + participantRoles: [unit_dev, business_owner]。code/test/architecture = solo(execution のデフォルト)
  - **KGI/KPI(spec 4.2 注記)**: prfaq ステージのチェックリストに「KGI/KPI を定義し測定方法を決めたか」「KGI/KPI を開発者を含むモブで合意したか」を含める(US-04)
  - **チーム憲章の合意項目**に「企画に開発者が、開発にビジネスが参加する(重要な意思決定はモブで行う)」を含め、各 approval ゲートの regressionChecks に「ロール分業・引き継ぎ駆動に戻っていないか(モブを省略していないか)」を含める(spec 4.4)
  - **GAP 分析プロンプト(spec 12章 段階1)**: フェーズ節目のステージ(prfaq, contract, user_review)のプロンプト集に「構想→設計→開発の GAP 分析」プロンプトを同梱する。本文は (a) アプリのトレーサビリティ台帳の内容(顧客課題・ストーリー・Unit・ステータス)と成果物リンク一覧を貼り付ける指示、(b) 「PRFAQ の顧客課題ごとに、対応する設計・実装成果物と KGI/KPI 上の不足を表で挙げよ。対応が無い課題・課題に繋がらない成果物を GAP として指摘せよ」という指示、で構成し、目的(意味的な乖離の早期発見)と修正観点(指摘を鵜呑みにせず要更新差し戻し/機能追加要望のどちらに落とすか人間が判断)を併記する
  - エスカレーション例:「Unit 間で用語の意味が食い違う → architect+pm に、コンテキストマップを見ながら確認」
  - ゲート: G1(prfaq 後, approval, business_owner, `requires: [scope_ledger]` — スコープ台帳の登録完了が通過条件。US-04 AC3)、G2(unit_of_work 後, warning。spec 4.2 の図と一致)、G3(contract 後, approval, architect+unit_reps ※unit_reps は動的解決マーカー、Task 1 参照)、G4(user_review 後, approval, pm)。各 approval ゲートに regressionChecks 3項目
- [ ] **Step 3:** テスト PASS 確認 → Commit: `feat(template): bizdevx standard process template with 3 depth profiles`

### Task 3: DB スキーマ(Drizzle)

**Files:** Create: `src/db/schema.ts`, `src/db/client.ts`, `drizzle.config.ts`, `src/db/schema.test.ts`

- [ ] **Step 1:** spec 6章のエンティティをそのまま Drizzle テーブルに定義: `projects`(name, depthProfile, templateVersion, templateSnapshot=パース済みJSON格納), `members`(projectId, name, roles JSON), `units`(projectId, name, difficultyAssessment JSON), `unitAssignments`(unitId, memberId, isRepresentative), `stageInstances`(projectId, unitId?, stageDefId, status, statusChangedAt — ダッシュボードの滞留日数算出用), `checklistResults`(stageInstanceId, itemId, checked, by, at, skipReason — **UNIQUE 制約を張らない**: perMember 項目は複数行), `artifactLinks`, `gateApprovals`(gateId, projectId, unitId?, approverId, understandingCheck JSON, regressionCheck JSON, decision, at), `customerProblems`, `stories`(customerProblemId nullable), `storyUnits`, `changeRequests`(customerProblemId nullable, scopeEntryId nullable — 「Out 済み」リンク, status), `scopeEntries`(projectId, feature, inOut, decidedAt, reason, resurrectedAt/resurrectedBy/resurrectReason nullable — Out→In 復活の承認記録。spec 6章 / US-08), `contracts`(unitAId, unitBId, name, url, status), `contractChangeRequests`(contractId, description, approvals JSON, status), `auditLogs`(projectId, event, actor, at, detail JSON)
  - `artifactLinks` には `kind`("artifact" | "question")と `status`("draft"|"done" / question は "awaiting_answer"|"answered")を持たせる。**「回答待ちの質問ファイル」(spec 5.1 / US-14)は kind=question の ArtifactLink として表現する**(専用エンティティは作らない)
  - `mobSessions`(stageInstanceId, participantMemberIds JSON, heldAt, note?)— spec 6章 MobSession(課題K / US-20)
  - `templateSnapshot` を projects に持たせるのが「テンプレ ver 固定」(spec 4.1)の実装: 作成時にパース結果を凍結保存し、以後 YAML が変わっても影響しない
- [ ] **Step 2:** `src/db/client.ts` — `new Database(process.env.DB_PATH ?? "data/app.db")`。`createTestDb()`(`:memory:` + migrate)をエクスポート
- [ ] **Step 3:** テスト: createTestDb で全テーブルに insert→select できる(1エンティティ1ケースの薄い煙テスト)→ FAIL→実装→PASS
- [ ] **Step 4:** Commit: `feat(db): drizzle schema for all spec entities`

### Task 4: domain/stage — 状態遷移・伝播・VibeCode 警告

**Files:** Create: `src/domain/stage.ts`, `src/domain/stage.test.ts`

- [x] **Step 1: 失敗するテストを書く**(spec 4.5 が仕様)

```ts
import { canTransition, propagateNeedsUpdate, checkReopen } from "./stage";

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
  expect(checkReopen(stages, "code")).toEqual({ warn: true, upstreamDone: ["design"] });
});

test("上流がneeds_updateなら警告なしで再オープン可", () => {
  const stages = [
    { defId: "design", status: "needs_update", dependsOn: [] },
    { defId: "code", status: "done", dependsOn: ["design"] },
  ];
  expect(checkReopen(stages, "code")).toEqual({ warn: false, upstreamDone: [] });
});
```

- [x] **Step 2:** FAIL 確認 → **Step 3:** 実装(遷移表+ dependsOn グラフの DFS)→ **Step 4:** PASS 確認
- [ ] **Step 5:** Commit: `feat(domain): stage state machine, propagation, vibe-code guard`

### Task 5: domain/gate — 通過判定と承認バリデーション

**Files:** Create: `src/domain/gate.ts`, `src/domain/gate.test.ts`

- [ ] **Step 1: 失敗するテストを書く**(spec 4.3 が仕様)

```ts
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
```

- [ ] **Step 2:** FAIL 確認 → **Step 3:** 実装 → **Step 4:** PASS → **Step 5:** Commit: `feat(domain): gate pass state and approval validation`

### Task 6: domain/traceability — 孤児検出・Out 再登場・G4

**Files:** Create: `src/domain/traceability.ts`, `src/domain/traceability.test.ts`

- [ ] **Step 1: 失敗するテストを書く**(spec 5.2 が仕様)

```ts
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
```

- [ ] **Step 2〜5:** FAIL 確認 → 実装 → PASS → Commit: `feat(domain): orphan detection, out-scope resurface, G4 rule`

### Task 7: domain/contract — 影響 Unit・代表解決・承認完了

**Files:** Create: `src/domain/contract.ts`, `src/domain/contract.test.ts`

- [ ] **Step 1: 失敗するテストを書く**(spec 5.3・3章が仕様)

```ts
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
```

- [ ] **Step 2〜5:** FAIL → 実装 → PASS → Commit: `feat(domain): contract impact, representative resolution, G3 approvers`

### Task 8: domain/signals — 引き継いだリスク・回帰シグナル

**Files:** Create: `src/domain/signals.ts`, `src/domain/signals.test.ts`

- [ ] **Step 1: テスト** — `carriedRisks(warningGatePassEvents, currentChecklistResults)`: 警告型ゲート通過イベント(未完了項目つき)と**現在のチェックリスト状態**を突き合わせて未解消リスク一覧を返す(通過後に checked になった項目は除外 — そのため現在状態が引数に必要)。`regressionSummary(gateApprovals)`: regressionCheck で regressed=true の項目をゲート別に集計(US-17)。`roleBiasSignals(stageInstances, stageDefs, mobSessions, checklistResults, members)`: (a) execution=mob のステージが必須参加ロールを1つ以上欠いたモブ記録のみ(または記録なし)で done になった場合、(b) 同一フェーズのチェック・承認の実行者ロールが単一に偏っている場合、をシグナルとして返す(spec 4.4-4 / US-20。テストは a: 参加ロール欠落 done で検出+全ロール揃いで非検出、b: 単一ロール完結で検出、の3ケース)
- [ ] **Step 2〜5:** FAIL → 実装 → PASS → Commit: `feat(domain): carried risks and regression signal aggregation`

### Task 9: services 層+監査記録

**Files:** Create: `src/services/audit.ts`, `src/services/project.ts`, `src/services/stage.ts`, `src/services/gate.ts`, `src/services/traceability.ts`, `src/services/contract.ts`, `src/services/*.test.ts`(createTestDb を使う統合テスト)

- [ ] **Step 1:** `audit.ts` — `withAudit(db, projectId, actor, event, detail, fn)`: fn 実行と auditLogs insert を同一トランザクションで行うヘルパー。**全 services の mutation はこれを経由する**(spec 課題I: 「全状態変更から自動生成」)
- [ ] **Step 2:** 各 service を TDD で実装。カバーすべき統合シナリオ(それぞれ失敗するテスト→実装→PASS→コミットの5ステップで進める):
  - `project.createProject`: テンプレ snapshot 凍結、プロファイルに応じた stageInstances 生成(US-01)。Construction 系ステージは Unit 作成時に unit 単位で生成
  - `stage.checkItem / registerArtifact / transition`: canTransition 違反は拒否。needs_update 時は propagateNeedsUpdate の結果を一括反映。checkReopen が warn を返す場合は `confirmedBackpropagation: true` フラグ必須(US-16)。checkItem は perMember でない項目について同一 (stageInstance, itemId) の重複行を作らない(DB に UNIQUE がないため services 層でガード)
  - `stage.recordMobSession`: mob 指定ステージにモブセッション(参加者・日時・メモ)を記録(監査記録)。mob ステージを done に遷移させる際、必須参加ロールを満たすモブ記録がなければ**警告付きで許可**(ブロックはしない — シグナルとして roleBiasSignals が拾う)(US-20)
  - `gate.approve / pass`: validateApproval → gateState → 通過。warning ゲート通過時は carriedRisks を auditLog.detail に保存(US-05)。G4 は canApproveAtG4 を追加検証(US-09)
  - `traceability.linkStory / createChangeRequest / resurrectOutEntry`: Out 復活は business_owner ロール+reason 必須(US-08)
  - `contract.createChangeRequest / approveChange`: changeApproved 完了で contract.status を確定に戻す。直接の status 更新 API は公開しない(US-13)
  - 楽観ロック: gateApprovals に一意インデックス **`(projectId, gateId, coalesce(unitId, ''), approverId)`** を張り二重承認を拒否(spec 9章)。注意: (a) `unitId` は NULL 可のため素の UNIQUE では SQLite が NULL 同士を別値扱いし G1/G3/G4(プロジェクトレベル)で効かない → `coalesce` 式インデックスか NULL の代わりに空文字センチネルを使う。(b) `gateId`("G1" 等)はプロジェクト間で重複するため projectId をキーに含める
  - G3 の承認者: テンプレートの `approverRoles: [architect, unit_reps]` の `unit_reps` マーカーを、services 層が Task 7 の `requiredG3Approvers`(アーキテクト全員+全 Unit 代表、代表未指定はアーキテクトにフォールバック)で具体的な memberId 集合に展開する
  - G1 の `requires: [scope_ledger]`: services 層が「scopeEntries に1件以上登録済みか」を評価し、未充足なら gateState に `unmetRequires` として渡す(US-04 AC3 / US-08 AC1)
- [ ] **Step 3:** Commit(サービスごと): `feat(services): ...`

### Task 10: 認証(メンバー選択)+プロジェクト作成画面

**Files:** Create: `src/app/page.tsx`, `src/app/actions/auth.ts`, `src/lib/session.ts` / Test: E2E は Task 17 に集約、ここでは手動確認

- [ ] **Step 1:** `session.ts` — cookie に `{ projectId, memberId }` を保存/取得(MVP の認証は spec 8章どおりメンバー選択式)
- [ ] **Step 2:** プロジェクト一覧+作成フォーム(名前・深さプロファイル選択・メンバー登録(名前+ロール複数選択))。作成後メンバーを選んで「入室」→ dashboard へ
- [ ] **Step 3:** 手動確認: 3プロファイルで作成でき、poc ではステージ数が減っている
- [ ] **Step 4:** Commit: `feat(ui): project creation and member-select login`

### Task 11: ステージナビ(汎用レンダラー)

**Files:** Create: `src/app/projects/[id]/stages/[sid]/page.tsx`, `src/app/actions/stage.ts`, `src/components/Checklist.tsx`, `src/components/PromptCard.tsx`

- [ ] **Step 1:** spec 5.4 の要素を上から順に1画面でレンダリング: ①目的+**変革視座**(differs/unlearn を目立つ枠で)+**主導ロール・必須参加ロール**(execution=mob なら「モブで実施」バナー) ①b mob ステージには**モブセッション記録フォーム**(参加メンバー複数選択・日時・決定メモ)+記録一覧。必須参加ロールが欠けた記録には警告表示(US-20) ②コンテキスト準備チェック(未完了なら黄色警告) ③プロンプト集(目的・修正観点+コピーボタン) ④完了チェックリスト(良/悪例を折りたたみ表示、perMember 項目は自分の行だけ操作可) ⑤成果物リンク登録(URL 形式バリデーション。kind を artifact/question から選択でき、question は「回答待ち→回答済み」のステータス切替 UI を持つ — Task 13 の「回答待ち質問ファイル」の供給元) ⑥上流「要更新」警告バッジ+再オープン時の逆方向伝播チェックダイアログ
- [ ] **Step 2:** 画面下部に「困ったら」(escalations: 症状→相談先ロール→該当メンバー名→聞き方テンプレート)(US-15)
- [ ] **Step 3:** 手動確認(チェック→リロードで保持、コピーボタン動作)→ Commit: `feat(ui): generic stage navigator`

### Task 12: ゲート承認 UI

**Files:** Create: `src/components/GateApprovalDialog.tsx`, `src/app/actions/gate.ts`

- [ ] **Step 1:** ステージナビ末尾にゲートカードを表示: 通過条件の充足状況(gateState の結果)、承認者一覧と承認状況。承認ダイアログは (1)理解確認3項目(意図・影響範囲・運用影響、全チェック必須) (2)変革ふりかえり(regressionChecks を「回帰なし/あり」で回答、必須) を含む(US-04, US-06)
- [ ] **Step 2:** 通過時トースト:「ここで AI ツールのコンテキストをリセットしましょう(必要な文脈はファイルに出力済みのはず)」(spec 4.3)
- [ ] **Step 3:** warning ゲートは「未完了のまま通過」ボタン+引き継ぐリスクの明示(US-05)
- [ ] **Step 4:** 手動確認 → Commit: `feat(ui): gate approval with understanding & regression checks`

### Task 13: ロール別ダッシュボード

**Files:** Create: `src/app/projects/[id]/dashboard/page.tsx`, `src/services/dashboard.ts`, `src/services/dashboard.test.ts`

- [ ] **Step 1(TDD):** `dashboard.ts` の集計クエリをテストファースト: **プロセスマップ(spec 5.0: フェーズ順のステージ一覧。プロジェクト共通+自分の割当 Unit の StageInstance、ステータス+直後ゲート状況つき、ステージナビへの導線)**、あなたの番です(自ロールが承認者のゲート/担当ステージの未完了/**回答待ちの質問ファイル = kind=question・status=awaiting_answer の ArtifactLink**)、ブロックされている人(自分の承認待ちに依存する相手)、引き継いだリスク(signals.carriedRisks)、**困ったら(現在進行中ステージのエスカレーション案内。spec 5.1)**、ロール別セクション(business_owner: 孤児件数+Out再登場+承認待ちスコープ変更 / facilitator: フェーズ×Unit 進捗マトリクス+滞留日数+回帰シグナル集計+**分業化シグナル(signals.roleBiasSignals)**)(US-14, US-15, US-17, US-20)
- [ ] **Step 2:** UI 実装。ヘッダーに常設の「チーム憲章」リンク(モーダルで合意内容+合意者を表示)(US-02)
- [ ] **Step 3:** Commit: `feat(ui): role-based dashboard`

### Task 14: トレーサビリティ台帳

**Files:** Create: `src/app/projects/[id]/traceability/page.tsx`, `src/app/actions/traceability.ts`, `src/services/reviewSheet.ts`, `src/services/reviewSheet.test.ts`

- [ ] **Step 1:** **顧客課題・ストーリーの登録フォーム**(この画面がトレーサビリティノードの作成場所): 顧客課題(テキスト+PRFAQ 成果物リンク)、ストーリー(テキスト+課題への紐付けは任意+Unit への多対多割当)。登録は services 経由(監査記録)
- [ ] **Step 1b:** ツリー表示(顧客課題→ストーリー→Unit、機能追加要望は課題直下)。孤児は赤ハイライト(findOrphans)。ノードから成果物リンクへ(US-07)
- [ ] **Step 2:** スコープ台帳タブ: In/Out 登録、Out 再登場サジェスト(完全一致)、復活フロー(business_owner 承認+理由)(US-08)
- [ ] **Step 3:** 機能追加要望の起票と G4 承認(未紐付けは承認ボタン無効+理由表示)(US-09)
- [ ] **Step 4(TDD):** `reviewSheet.ts`: ストーリー一覧から「〜できましたか(はい/いいえ/条件付き)」md を生成、選択式設問が自由記述より先($US-10$ の AC をそのままテストに)
- [ ] **Step 5:** Commit: `feat(ui): traceability ledger, scope register, review sheet`

### Task 15: 契約ボード

**Files:** Create: `src/app/projects/[id]/contracts/page.tsx`, `src/app/actions/contract.ts`, `src/components/MermaidView.tsx`(このタスクで `npm i mermaid` を追加し dynamic import する)

- [ ] **Step 0:** **Unit 管理セクション**(この画面が Unit の作成場所): Unit 作成(作成時に services が Construction 系 StageInstance を unit 単位で生成)、メンバー割当、**代表(isRepresentative)の指定**。代表未指定の Unit には「承認はアーキテクトが代行」と表示
- [ ] **Step 1:** 契約一覧(当事者 Unit・リンク・ステータス)+登録フォーム。コンテキストマップ(Mermaid テキスト登録→レンダリング)(US-12)
- [ ] **Step 2:** 変更要求フロー: 起票→影響 Unit と代表の自動表示→代表の承認ボタン→全員揃うと確定(US-13)。ステータス直接変更 UI は置かない
- [ ] **Step 3:** Unit 難易度アセスメント(チーム経験・技術新規性・外部依存の3観点をチェックリスト評価、高難易度なら定石ガイド文言を表示)(US-11)
- [ ] **Step 4:** Commit: `feat(ui): contract board with change-request flow`

### Task 16: 監査証跡ビュー

**Files:** Create: `src/app/projects/[id]/audit/page.tsx`, `src/services/auditExport.ts`, `src/services/auditExport.test.ts`

- [ ] **Step 1(TDD):** `auditExport.ts`: 種別・期間フィルタ+markdown 生成(US-18)
- [ ] **Step 2:** 時系列テーブル UI+フィルタ+「md エクスポート」ボタン(ダウンロード)
- [ ] **Step 3:** Commit: `feat(ui): audit trail view and export`

### Task 17: E2E 主要フロー

**Files:** Create: `e2e/main-flow.spec.ts`, `playwright.config.ts`

- [ ] **Step 1:** spec 10章の主要フローを1本のシナリオで: プロジェクト作成(new-service)→チーム憲章合意→PRFAQ ステージで**モブセッションを記録**(全ロール参加)→PRFAQ チェック完了(KGI/KPI 項目含む)→**スコープ台帳が空のうちは G1 が通過不可であることを assert**→スコープ台帳登録→G1 承認(理解確認+回帰チェック)→Unit 作成(代表指定)+契約登録→G3 承認→契約変更要求→承認で確定→機能追加要望(未紐付けで G4 承認不可→紐付けて承認)→監査証跡に全イベントが並ぶ
- [ ] **Step 2:** `npx playwright test` PASS 確認 → Commit: `test(e2e): main flow`

### Task 18: 仕上げ

**Files:** Create: `README.md` / Modify: `package.json`

- [ ] **Step 1:** README: プロジェクトビジョン(spec 1.0 要約)、起動手順(`npm i && npm run db:migrate && npm run dev`)、テンプレートのテーラリング方法(YAML 編集→再起動、US-19)、spec/stories へのリンク
- [ ] **Step 2:** 全テスト実行(`npx vitest run && npx playwright test`)+ `npm run build` PASS 確認
- [ ] **Step 3:** Commit: `docs: README with vision, setup, tailoring guide`

---

## 検収基準

- ユーザーストーリー US-01〜US-20 の受け入れ基準をすべて満たす(ストーリー→課題マトリクスで課題 A〜K をカバー)
- `src/domain/` に DB/Next 依存がない(ESLint で強制)
- 全 mutation が auditLogs に記録される
