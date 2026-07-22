# Technology Stack

## Core Technologies

- **Language**: TypeScript（strict mode）
- **Runtime**: Node.js v20 以上
- **Package Manager**: npm（pnpm・yarn 不使用）

## Frontend / Full-stack

- **Framework**: Next.js 16（App Router）
  - Server Components + Server Actions を基本とする
  - Client Components は状態を持つ UI のみに限定
- **Styling**: Tailwind CSS
- **UI Architecture**: SSR を基本とし、インタラクティブな部分のみ CSR

## Backend / Data

- **Database**: SQLite（`better-sqlite3`）
  - 同期 API でトランザクションを単純に扱える
  - ファイルベースでインフラ依存なし
- **ORM**: Drizzle ORM（`drizzle-orm` + `drizzle-kit`）
  - スキーマが TypeScript で型安全
  - マイグレーション付き
- **Schema Validation**: zod
  - YAML テンプレートの起動時バリデーション
  - Server Actions の入力バリデーション

## Process Templates

- **Format**: YAML（`js-yaml` でパース）
- **Validation**: zod スキーマで起動時に検証（不正なら起動を止める）

## Testing

- **Unit Tests**: Vitest
  - `src/**/*.test.ts` のパターンで検出
  - `src/domain/` は 100% カバレッジを目指す
- **E2E Tests**: Playwright
  - `e2e/*.spec.ts` のパターンで検出
  - 主要ユーザーフローを網羅

## Linting / Code Quality

- **ESLint**: ルールで `src/domain/` の純粋性を強制
  - `no-restricted-imports` で `next*`・`drizzle-orm*`・`better-sqlite3`・`@/db/*`・`@/services/*` の import を禁止
- **TypeScript**: `strict: true`（全型チェックを有効化）

## Build System

### Development Commands

```bash
# 開発サーバー起動
npm run dev

# ビルド
npm run build

# 本番起動
npm run start

# Lint
npm run lint

# ユニットテスト
npm run test

# E2E テスト
npm run test:e2e
```

### Database Commands

```bash
# Drizzle スキーマからマイグレーション生成
npm run db:generate

# マイグレーション適用
npm run db:migrate

# Drizzle Studio（DB ブラウザ）
npm run db:studio
```

## Key Dependencies

| パッケージ | バージョン | 用途 |
|-----------|-----------|------|
| next | 16.x | フレームワーク |
| react | 19.x | UI ライブラリ |
| better-sqlite3 | 最新 | SQLite ドライバー（同期 API）|
| drizzle-orm | 最新 | ORM |
| drizzle-kit | 最新 | マイグレーション CLI |
| zod | 4.x | スキーマバリデーション |
| js-yaml | 5.x | YAML パーサー |
| tailwindcss | 4.x | CSS ユーティリティ |
| vitest | 最新 | ユニットテストランナー |
| @playwright/test | 最新 | E2E テストフレームワーク |

## TypeScript Configuration

- **Target**: ES2020
- **Module**: ESNext
- **Strict mode**: 有効（`strict: true`）
- **Path aliases**: `@/*` → `./src/*`
- **Decorators**: 不使用

## 不採用技術とその理由

| 技術 | 不採用理由 |
|------|-----------|
| PostgreSQL | シンプル構成の MVP には過剰。SQLite で十分 |
| Prisma | バイナリ依存が重い。Drizzle の方が軽量 |
| pnpm / yarn | チームの npm 統一で混乱を避ける |
| tRPC | Server Actions で十分。追加の抽象層不要 |
| Zustand / Redux | Server Components 優先。Client 状態は最小限 |
| Docker | ローカル開発・MVP では不要 |
