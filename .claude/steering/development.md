# Development Style

# 開発ガイド

BizDevX Accord プロジェクトの標準開発手順、デバッグ方法、Next.js + SQLite 実装パターンを定義する。

## ドキュメント管理方針

**各作業の記述分担4原則: コードには How、テストコードには What、コミットログには Why、コードコメントには Why not。** 同じ情報を複数の場所に書かない — How をコメントで繰り返さない、What をコミットログで繰り返さない(diff とテストが語る)。

| 文書種別 | 記述方針 | 内容 | 場所 |
|---------|---------|------|------|
| **コード** | How | どう実現するか(実装自体が語る) | `src/` |
| **テストコード** | What | 何が満たされるべきか(振る舞いの仕様書) | `src/**/*.test.ts`, `e2e/` |
| **コミットログ** | Why | なぜ変更したか(What は diff が語る) | git 履歴 |
| **コードコメント** | Why not | なぜ素直な方法を採らなかったか(非自明な判断理由) | - |
| **README.md** | What + How to start | プロジェクト概要と導入手順 | `/` |
| **.claude/steering/development.md** | How + What for | 開発手順・パターン集 | `.claude/steering/` |
| **API docs** | What + When | API の機能と使うタイミング | `docs/` |
| **Design Docs** | Why + What if | 設計判断と代替案の検討 | `docs/design/` |
| **ADR** | Why + When | アーキテクチャ決定の理由と時期 | `docs/design/adr/` |

## 言語

ドキュメント、コードコメント、および AI によるチャット応答には日本語を使用すること。

## 作業ディレクトリ（./working）

一時的なファイルや中間データが必要な場合は、プロジェクトルートの `./working` ディレクトリを使用すること。

- `./working` は `.gitignore` に追加し、リポジトリにコミットしない
- 永続化が必要な成果物は適切なディレクトリ（`docs/design/` 等）に移動する
- 不要になったファイルは適宜削除する

## 環境設定ファイル（.env.local）

### 管理方針

- **テンプレ（Git 管理対象）**: `.env.local.example`
- **実値（Git 管理外）**: `.env.local`
- 開発者は `.env.local.example` をコピーして `.env.local` を作成し、自分の値を記入する
- 変数を追加・変更する場合は `.env.local.example` のテンプレートも同時に更新してチームに共有する
- 実値ファイル（`.env.local`）は絶対にコミットしない

### 初回セットアップ

```bash
cp .env.local.example .env.local
# エディタで .env.local を開き、値を記入
```

### .env.local の主要変数

| 変数名 | 説明 | 例 |
|-------|------|---|
| `NODE_ENV` | 実行環境 | `development` |
| `PORT` | Next.js 開発サーバーポート | `3000` |
| `DATABASE_URL` | SQLite DB ファイルパス | `./data/bizdevx.db` |
| `PROCESS_TEMPLATE_DIR` | YAML テンプレートディレクトリ | `./templates` |
| `NEXT_PUBLIC_APP_URL` | アプリのベース URL | `http://localhost:3000` |
| `PLAYWRIGHT_BASE_URL` | Playwright が接続する URL | `http://localhost:3000` |

### 使い方

```bash
# 開発・テスト前に必ず source で環境変数を適用する
source .env.local

# 開発サーバー起動
npm run dev

# Playwright E2E テスト（PLAYWRIGHT_BASE_URL 設定後）
npm run test:e2e
```

## 開発環境のセットアップ

### 必須ツール

- **Node.js**: v20 以上
- **npm**: パッケージマネージャー

### 初回セットアップ

```bash
# 1. リポジトリのクローン
git clone https://github.com/ikeom-je/bizdevx-accord
cd bizdevx-accord

# 2. 依存関係のインストール
npm install

# 3. 環境変数の設定
cp .env.local.example .env.local
# エディタで .env.local を編集

# 4. DB ディレクトリを作成
mkdir -p data

# 5. DB マイグレーション適用
npm run db:migrate

# 6. 開発サーバー起動
source .env.local
npm run dev
```

## 開発コマンド

```bash
# 開発サーバー（http://localhost:3000）
npm run dev

# TypeScript + Next.js ビルド
npm run build

# ビルド済みアプリを起動
npm run start

# ESLint（domain 純粋性チェック含む）
npm run lint

# Vitest ユニットテスト
npm run test

# Vitest ウォッチモード
npm run test -- --watch

# Playwright E2E テスト
npm run test:e2e

# Drizzle スキーマからマイグレーション生成
npm run db:generate

# マイグレーション適用
npm run db:migrate

# Drizzle Studio（DB ブラウザ）
npm run db:studio
```

## Next.js App Router 実装パターン

### Server Actions のパターン

全状態変更は Server Actions 経由で services を呼び出す。直接 DB を操作してはならない。

```typescript
// src/app/projects/[id]/stages/[sid]/actions.ts
"use server";

import { stageService } from "@/services/stage";
import { revalidatePath } from "next/cache";

export async function completeChecklistItemAction(
  projectId: string,
  stageId: string,
  itemId: string,
  comment: string
) {
  await stageService.completeItem(stageId, itemId, comment);
  revalidatePath(`/projects/${projectId}/stages/${stageId}`);
}
```

### Server Components でのデータ取得

```typescript
// src/app/projects/[id]/page.tsx
import { projectService } from "@/services/project";

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const project = await projectService.findById(params.id);
  if (!project) notFound();
  return <ProjectView project={project} />;
}
```

### YAML テンプレートのロード

起動時に `templates/` を読み込み、zod でバリデーションをかける。エラーがあれば起動を止める。

```typescript
// src/domain/template.ts
import { parseTemplate } from "@/domain/template";
import fs from "fs";
import path from "path";

export function loadTemplate(name: string) {
  const filePath = path.join(process.env.PROCESS_TEMPLATE_DIR!, `${name}.yaml`);
  const raw = fs.readFileSync(filePath, "utf-8");
  return parseTemplate(raw); // zod バリデーション込み
}
```

## SQLite + Drizzle パターン

### スキーマ定義

```typescript
// src/db/schema.ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  depthProfile: text("depth_profile").notNull(),
  templateVersion: integer("template_version").notNull(),
  createdAt: text("created_at").notNull(),
  version: integer("version").notNull().default(0),
});
```

### 二重承認の防止（gateApprovals の複合 UNIQUE インデックス）

同一ゲートへの二重承認は `gateApprovals` に張った複合 UNIQUE インデックスで防ぐ（`stageInstances` 等に汎用の `version` カラムは持たない）。

```typescript
// src/db/schema.ts
export const gateApprovals = sqliteTable(
  "gate_approvals",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    gateId: text("gate_id").notNull(),       // "G1" 等。projectId 間で重複するため必ず併記
    unitId: text("unit_id"),                 // NULL 許容（G1/G3/G4 はプロジェクトレベル）
    approverId: text("approver_id").notNull(),
    // ...
  },
  (table) => ({
    // unitId が NULL でも一意性が効くよう coalesce で吸収する
    uniqueApproval: uniqueIndex("unique_gate_approval").on(
      table.projectId,
      table.gateId,
      sql`coalesce(${table.unitId}, '')`,
      table.approverId
    ),
  })
);
```

```typescript
// src/services/gate.ts
export const gateService = {
  async approve(input: GateApprovalInput) {
    try {
      db.insert(gateApprovals).values(input).run();
    } catch (e) {
      if (isUniqueConstraintError(e)) {
        throw new Error("この承認者は既にこのゲートを承認済みです");
      }
      throw e;
    }
  },
};
```

## コード品質

1. **型安全**: `any` 型の使用を最小限にする。zod で境界値を検証する
2. **コミット前**: `npm run build` + `npm run test` が通ることを確認
3. **Lint**: ESLint の警告を無視せず、すべて修正する
4. **ログ**: `console.log` 直接使用ではなく、構造化ログを使う

## トラブルシューティング

| 問題 | 解決方法 |
|------|---------|
| TypeScript ビルドエラー | `npm run build` で型チェック |
| DB が見つからない | `mkdir -p data && npm run db:migrate` |
| YAML バリデーションエラー | `templates/*.yaml` の構造を `src/domain/template.ts` の zod スキーマで確認 |
| ESLint domain 違反 | `src/domain/` から Next.js / Drizzle の import を削除 |
| Playwright E2E 失敗 | `PLAYWRIGHT_BASE_URL` が `.env.local` に設定されているか確認 |
| 環境変数が読めない | `source .env.local` を実行してから再試行 |
