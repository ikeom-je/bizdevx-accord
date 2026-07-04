# Architecture Principles and Patterns

## アーキテクチャ方針：ハイブリッド型

**プロセス定義は設定データ、課題直撃の画面は専用実装**とする。

### 2軸の設計判断

1. **YAML 駆動のプロセス定義**: ステージ構成・チェックリスト・ゲート条件・ロール・プロンプト集・深さプロファイルは git 管理された YAML として持つ。ファシリテータはコード変更なしにテーラリングできる
2. **専用実装の3画面**: トレーサビリティ台帳・I/F 契約ボード・ロール別ダッシュボードは専用実装し、UX を妥協しない

### レイヤー構成

```
src/
├── domain/          ← ピュアな TypeScript（zod のみ依存可。DB/Next.js 禁止）
│   ├── types.ts     ← 共有型（StageStatus, GateKind, Role 等）
│   ├── template.ts  ← YAML の zod スキーマ + パース関数
│   ├── stage.ts     ← 状態遷移・下流伝播・VibeCode 警告
│   ├── gate.ts      ← ゲート通過判定・承認バリデーション
│   ├── traceability.ts ← 孤児検出・G4 承認可否
│   ├── contract.ts  ← 影響 Unit 算出・変更要求の承認完了判定
│   └── signals.ts   ← 引き継いだリスク・回帰シグナル集計
├── db/
│   ├── schema.ts    ← Drizzle スキーマ（spec のエンティティ定義）
│   └── client.ts    ← DB 接続（テスト時は :memory:）
├── services/        ← DB ⇔ ドメイン組み立て。全 mutation が audit() を通る
│   ├── audit.ts
│   ├── project.ts / stage.ts / gate.ts / traceability.ts / contract.ts
│   └── reviewSheet.ts ← クローズドクエスチョン md 生成
└── app/             ← Next.js App Router（UI のみ）
    ├── layout.tsx
    ├── page.tsx
    └── projects/[id]/
        ├── dashboard/page.tsx
        ├── stages/[sid]/page.tsx
        ├── traceability/page.tsx
        ├── contracts/page.tsx
        └── audit/page.tsx
```

## ドメイン純粋性の原則

`src/domain/` は **最重要の純粋性制約** を持つ。

```typescript
// ✅ Good: domain は zod のみに依存
import { z } from "zod";

// ❌ Bad: domain から Next.js / Drizzle を import
import { db } from "@/db/client";   // 禁止
import { NextRequest } from "next/server"; // 禁止
```

この制約は ESLint `no-restricted-imports` で機械的に強制する。ドメインロジックは独立してユニットテストできることが保証される。

## YAML テンプレート構造

プロセス定義の YAML は `templates/` に配置する。起動時に zod でバリデーションをかけ、不正な定義ならば起動を止める。

```yaml
# templates/bizdevx-standard.yaml（概略）
version: 1
name: bizdevx-standard
profiles: [poc, new-service, brownfield]   # 深さプロファイル一覧（トップレベルはフラット）
stages:
  - id: prfaq
    name: PRFAQ 作成
    phase: phase0
    roles: [pm]
    profiles: [poc, new-service, brownfield]  # このステージを含むプロファイル
    transformationLens:               # 変革視座（spec 4.4）
      differs: ...
      unlearn: ...
    checklist: [...]
    prompts: [...]
    dependsOn: []
gates:                                 # ステージとは独立したトップレベル配列
  - id: G1
    afterStage: prfaq
    kind: approval                    # ★承認必須
    approverRoles: [business_owner]
    regressionChecks: [...]           # 旧習慣回帰チェック（spec 4.4）
```

`stage.gate` のようなネストはしない。ゲートはステージへの参照（`afterStage`）を持つ独立エンティティであり、`approverRoles` には `unit_reps`（全 Unit 代表の動的解決マーカー）も入り得る。詳細は spec 4.1・plan Task 1/2 を参照。

## データアーキテクチャ

### エンティティ（Drizzle スキーマ）

spec 6章のエンティティをそのまま反映する（テーブル名は plan Task 3 の TS 変数名に対応）:

**基本**
- `projects` - プロジェクト（深さプロファイル・templateVersion・templateSnapshot で ver 固定）
- `members` - メンバーとロール（複数ロール可）
- `units` - 開発 Unit（難易度アセスメント）
- `unitAssignments` - Unit ⇔ メンバー割当（`isRepresentative` で Unit 代表を1名指定）
- `stageInstances` - ステージ実行状態（project または unit 単位、status: not_started/in_progress/done/needs_update、statusChangedAt で滞留日数を算出）
- `checklistResults` - チェックリスト回答（`(stageInstanceId, itemId)` に複数行を許す。チーム憲章のようなメンバーごとの合意記録のため UNIQUE 制約は張らない）
- `artifactLinks` - 成果物リンク（URL + ステータス + `kind: artifact|question`。回答待ち質問ファイルは `kind=question` として表現し専用エンティティは持たない）
- `gateApprovals` - ゲート承認記録（理解確認 + 変革ふりかえり回答 + decision）

**トレーサビリティ**（課題B の中核。汎用の `user_stories` 単体ではなく以下4種で構成）
- `customerProblems` - PRFAQ 由来の顧客課題
- `stories` - ユーザーストーリー（`customerProblemId` は nullable = 未紐付けは孤児として警告）
- `changeRequests` - 機能追加要望（G4 承認時に `customerProblemId` 紐付けが必須）
- `scopeEntries` - スコープ台帳（In/Out。Out 再登場の検出元）

**契約**（課題D の中核。汎用の `interface_contracts` 単体ではなく変更フローを持つ2テーブル構成）
- `contracts` - Unit 間 I/F 契約（`unitAId`/`unitBId` の2者間のみ。意図的な制約）
- `contractChangeRequests` - 契約変更要求（影響 Unit 代表全員の承認で確定）

**横断**
- `auditLogs` - 全操作の監査証跡（全 mutation から自動生成）

### 同時実行制御（二重承認の防止）

MVP で楽観ロックが要る箇所は「同じゲートへの二重承認」の防止であり、汎用の `version` カラム方式ではなく **`gateApprovals` への複合 UNIQUE インデックス**で行う: `(projectId, gateId, coalesce(unitId, ''), approverId)`。

- `unitId` は NULL 許容だが、素の UNIQUE では SQLite が NULL 同士を別値扱いするため素の UNIQUE では G1/G3/G4（プロジェクトレベル=unitId なし）の二重承認を防げない。`coalesce` 式インデックス（または NULL の代わりに空文字センチネル）を使う
- `gateId`（`"G1"` 等）はプロジェクト間で重複するため、`projectId` を必ずキーに含める
- 二重承認は UNIQUE 制約違反として INSERT 時に拒否する（UPDATE 時の `version` 比較ではない）。詳細は plan Task 3/9 を参照

## Server Actions パターン

UI からの全状態変更は Server Actions 経由で services を呼び出す。

```typescript
// ✅ Good: Server Action → service → domain + db
"use server";
import { gateService } from "@/services/gate";

export async function approveGateAction(gateId: string, answers: ApprovalAnswers) {
  return gateService.approve(gateId, answers);  // audit() は service 内で実行
}

// ❌ Bad: UI から直接 DB を操作
import { db } from "@/db/client";
db.update(gates).set({ status: "approved" }); // 禁止
```

## エラーハンドリング

```typescript
// ✅ Good: ドメインエラーを定義して型安全に扱う
export class GateNotReadyError extends Error {
  constructor(incompleteItems: string[]) {
    super(`Gate not ready: ${incompleteItems.length} items incomplete`);
  }
}

// ❌ Bad: 生の Error を throw
throw new Error("something went wrong");
```
