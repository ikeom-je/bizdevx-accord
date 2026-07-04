# Testing Standards and Strategy

## Testing Philosophy

### Core Principles

1. **テストは仕様書**: テストコードは実装の意図を明確に表現する
2. **高速なフィードバック**: ユニットテストは全体で数秒以内を目標
3. **信頼性**: テストは決定的で、環境に依存せず、常に同じ結果を返す
4. **ドメイン純粋性の保証**: `src/domain/` は外部依存なしでテストできることを保証する

### Testing Pyramid

```
        /\
       /E2E\      ← 少数（主要ユーザーフロー）
      /------\
     / ユニット \  ← 多数（domain 層中心）
    /-----------\
```

- **ユニットテスト**: 80-90%（`src/domain/` を中心に、外部依存ゼロ）
- **E2E テスト**: 10-20%（主要ユーザーフロー）

## Test Categories

### 1. Unit Tests（Vitest）

**目的**: ドメインロジックの振る舞いを検証

**特徴**:
- 外部依存は全てモック（特に `src/domain/` は依存なし）
- 高速実行（全体で数秒）
- SQLite はインメモリ DB（`:memory:`）を使用

**実行コマンド**:
```bash
npm run test
# ウォッチモード
npm run test -- --watch
```

**配置場所**: ソースファイルと同じディレクトリ（コロケーション）
```
src/domain/
├── gate.ts
└── gate.test.ts   ← コロケーション
```

**例**:
```typescript
// src/domain/gate.test.ts
import { describe, it, expect } from "vitest";
import { validateGateApproval } from "./gate";

describe("validateGateApproval", () => {
  it("should reject approval when checklist items are incomplete", () => {
    const result = validateGateApproval({
      incompleteItems: ["PRFAQのPlain Language原則確認"],
      reflectionAnswers: { isHumanMakingArtifacts: false },
    });

    expect(result.canApprove).toBe(false);
    expect(result.reasons).toContain("チェックリスト未完了");
  });

  it("should allow approval when all conditions are met", () => {
    const result = validateGateApproval({
      incompleteItems: [],
      reflectionAnswers: { isHumanMakingArtifacts: false },
    });

    expect(result.canApprove).toBe(true);
  });
});
```

### 2. E2E Tests（Playwright）

**目的**: エンドツーエンドのユーザーフローを検証

**特徴**:
- 実際のブラウザで動作確認
- SQLite インメモリまたはテスト専用 DB を使用
- 主要な「承認→ゲート通過」フローを必ず網羅

**実行コマンド**:
```bash
# 開発サーバーを起動した上で
npm run test:e2e

# ヘッドレスモード
npm run test:e2e -- --reporter=html
```

**配置場所**:
```
e2e/
├── main-flow.spec.ts          # プロジェクト作成〜ゲート通過のメインフロー
├── traceability.spec.ts       # トレーサビリティ台帳
└── contract-board.spec.ts     # I/F 契約ボード
```

**例**:
```typescript
// e2e/main-flow.spec.ts
import { test, expect } from "@playwright/test";

test.describe("メインフロー: プロジェクト作成〜G1 承認", () => {
  test("ファシリテータがプロジェクトを作成し G1 ゲートを通過できる", async ({ page }) => {
    // プロジェクト作成
    await page.goto("/");
    await page.getByRole("button", { name: "新規プロジェクト" }).click();
    await page.getByLabel("プロジェクト名").fill("テストプロジェクト");
    await page.getByRole("combobox", { name: "深さプロファイル" }).selectOption("poc");
    await page.getByRole("button", { name: "作成" }).click();

    // ステージナビでチェックリストを完了
    await page.getByRole("link", { name: "PRFAQ 作成" }).click();
    await page.getByTestId("checklist-item-0").check();

    // G1 ゲート承認
    await page.getByRole("button", { name: "G1 ゲートへ進む" }).click();
    await expect(page.getByTestId("gate-status")).toContainText("承認済み");
  });
});
```

## Test Naming Conventions

### ファイル命名

- **ユニットテスト**: `<module-name>.test.ts`（コロケーション）
- **E2E テスト**: `<feature-name>.spec.ts`（`e2e/` ディレクトリ）

### テストケース命名

```typescript
// ✅ Good: 明確で読みやすい
describe("gateService.approve", () => {
  it("should record audit log when gate is approved", async () => { ... });
  it("should throw GateNotReadyError when checklist is incomplete", async () => { ... });
});

// ❌ Bad: 曖昧で意図が不明
describe("gate", () => {
  it("test1", () => { ... });
  it("works", () => { ... });
});
```

### 命名パターン

- `should <expected behavior> when <condition>`
- `should throw <error> when <invalid condition>`
- `should return <result> for <input>`

## Test Structure (AAA Pattern)

```typescript
it("should detect orphaned user stories without parent goal", () => {
  // Arrange: テストデータを準備
  const stories = [
    { id: "us-1", goalId: "goal-1" },
    { id: "us-2", goalId: null },  // 孤児
  ];
  const goals = [{ id: "goal-1" }];

  // Act: テスト対象を実行
  const orphans = detectOrphans({ stories, goals });

  // Assert: 期待する結果を検証
  expect(orphans).toHaveLength(1);
  expect(orphans[0].id).toBe("us-2");
});
```

## Mocking Guidelines

### ドメイン層のテスト（モック不要）

`src/domain/` は外部依存なしでテストできるため、基本的にモック不要。

```typescript
// ✅ Good: domain は純粋関数のため直接呼び出し
import { detectOrphans } from "@/domain/traceability";

const result = detectOrphans({ stories, goals });
expect(result).toHaveLength(1);
```

### サービス層のテスト（DB モック）

```typescript
// ✅ Good: SQLite インメモリ DB でテスト
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";

const db = drizzle(new Database(":memory:"));
// マイグレーション適用後にテスト
```

## Test Coverage Guidelines

### カバレッジ目標

- **`src/domain/`**: 100%（ドメインロジックは全ての分岐をテスト）
- **`src/services/`**: 80%以上
- **全体**: 75%以上

### カバレッジ確認

```bash
npm run test -- --coverage
```

## Testing Anti-Patterns

```typescript
// ❌ Bad: 実装の詳細をテスト
it("should call db.insert exactly once", async () => {
  await gateService.approve(gateId, answers);
  expect(mockDb.insert).toHaveBeenCalledTimes(1); // 実装の詳細
});

// ✅ Good: 振る舞いをテスト
it("should create audit log after gate approval", async () => {
  await gateService.approve(gateId, answers);
  const log = await auditService.findByGate(gateId);
  expect(log).toBeDefined();
  expect(log.action).toBe("gate_approved");
});
```

## Flaky Tests Prevention

```typescript
// ✅ Good: 固定された時刻を使用
import { vi } from "vitest";

vi.useFakeTimers();
vi.setSystemTime(new Date("2026-07-04T10:00:00Z"));

const result = stageService.getCurrentTimestamp();
expect(result).toBe("2026-07-04T10:00:00Z");

// ❌ Bad: 実際の時刻に依存
const result = stageService.getCurrentTimestamp();
expect(result).toMatch(/2026/); // 年が変わると失敗
```
