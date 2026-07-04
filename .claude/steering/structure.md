# Project Structure

## Root Directory Layout

```
bizdevx-accord/
├── .env.local              # ローカル環境変数（Git 管理外）
├── .env.local.example      # 環境変数テンプレート（Git 管理対象）
├── .claude/                # AI エージェント設定
│   ├── settings.json       # チーム共有設定（Git 管理対象、任意）
│   ├── settings.local.json # 個人用ローカル設定（Git 管理外）
│   ├── steering/           # 開発規約・ガイドライン（Git 管理対象）
│   ├── specs/              # 設計仕様書・ユーザーストーリー（Git 管理対象）
│   └── plans/              # 実装計画（Git 管理対象）
├── .github/
│   └── workflows/          # CI/CD（GitHub Actions）
├── data/                   # SQLite DB ファイル（Git 管理外）
│   └── bizdevx.db
├── docs/                   # ユーザーガイド・設計ドキュメント
│   └── design/
│       └── adr/            # Architecture Decision Records
├── drizzle/                # Drizzle マイグレーションファイル
├── e2e/                    # Playwright E2E テスト
│   └── main-flow.spec.ts
├── src/
│   ├── domain/             # ピュアなドメインロジック（Next.js/Drizzle 禁止）
│   ├── db/                 # Drizzle スキーマ・DB クライアント
│   ├── services/           # DB ⇔ ドメイン組み立て
│   └── app/                # Next.js App Router
├── templates/
│   └── bizdevx-standard.yaml  # bizdevx 標準プロセステンプレート
├── working/                # 一時ファイル・中間データ（Git 管理外）
├── package.json
├── tsconfig.json
├── next.config.ts
├── drizzle.config.ts
├── vitest.config.ts
├── playwright.config.ts
└── tailwind.config.ts
```

## 開発設定（必須）

- `.env.local` にアプリケーション設定・DB パス・テンプレートディレクトリを格納する
- エラーが発生した場合はまず `.env.local` の設定値を確認する
- SQLite DB ファイルは `data/` ディレクトリに配置する

## Key Directories

### `/src/domain` — ドメインロジック（最重要）

- ピュアな TypeScript モジュール（zod のみ依存可）
- Next.js・Drizzle・better-sqlite3 の import を ESLint で禁止
- 各モジュールは独立してユニットテスト可能であること
- 変更時は必ず対応する `*.test.ts` を更新する

### `/src/db` — データベース層

- `schema.ts`: Drizzle テーブル定義（spec のエンティティをそのまま反映）
- `client.ts`: DB 接続（`DATABASE_URL` 環境変数を使用。テスト時は `:memory:`）

### `/src/services` — サービス層

- DB とドメインロジックを組み合わせる
- 全状態変更（mutation）は `audit.ts` の `audit()` を通じて監査証跡を記録する
- UI（Next.js）は直接 DB にアクセスせず、必ず services を経由する

### `/src/app` — Next.js App Router

- `layout.tsx`: 全画面共通ヘッダー（チーム憲章への常設リンク）
- `page.tsx`: プロジェクト一覧 + 作成 + メンバー選択ログイン
- `projects/[id]/dashboard/page.tsx`: ロール別ダッシュボード
- `projects/[id]/stages/[sid]/page.tsx`: ステージナビ（YAML から汎用レンダリング）
- `projects/[id]/traceability/page.tsx`: トレーサビリティ台帳
- `projects/[id]/contracts/page.tsx`: I/F 契約ボード
- `projects/[id]/audit/page.tsx`: 監査証跡

### `/templates` — プロセス定義 YAML

- `bizdevx-standard.yaml`: 3つの深さプロファイル（poc / new-service / brownfield）を含む標準テンプレート
- 新規テンプレートは同ディレクトリに追加する
- 起動時に `src/domain/template.ts` の zod スキーマで自動バリデーション

### `/e2e` — Playwright E2E テスト

- `main-flow.spec.ts`: 主要ユーザーフロー（プロジェクト作成→ステージ実施→ゲート通過）
- 画面別の spec は `e2e/` 直下に追加

### `/docs` — ドキュメント

- `design/`: 設計判断（Why）を記述
- `design/adr/`: Architecture Decision Records
- ユーザーガイド（How to use）は `docs/` 直下に配置

## Naming Conventions

- **ファイル**: kebab-case（`gate-service.ts`, `checklist-item.ts`）
- **React コンポーネント**: PascalCase（`GateApprovalForm.tsx`）
- **型・インターフェース**: PascalCase（`StageStatus`, `GateKind`）
- **定数**: UPPER_SNAKE_CASE（`MAX_CHECKLIST_ITEMS`）
- **関数・変数**: camelCase（`approveGate`, `templateVersion`）
- **テストファイル**: `*.test.ts`（src 直下にコロケーション）
- **E2E テスト**: `*.spec.ts`（`e2e/` ディレクトリ）

## ユニットテストのコロケーション

ユニットテストはソースファイルと同じディレクトリに配置する（コロケーション方式）。

```
src/domain/
├── gate.ts
├── gate.test.ts      ← コロケーション
├── stage.ts
└── stage.test.ts     ← コロケーション
```
