# Deployment Strategy

本ドキュメントは BizDevX Accord の環境戦略・ブランチデプロイ対応・CI/CD パイプライン方針を定義する。

## ブランチ ↔ 環境マッピング

| ブランチ | 環境 | 用途 |
|---------|------|------|
| feature ブランチ（`issue/<n>/*`） | ローカル / 検証 | 開発者・AI エージェントの作業ブランチ |
| `dev` | staging | 統合テスト・E2E・受け入れテスト |
| `main` | production | 本番稼働 |

## CI/CD パイプライン方針（GitHub Actions）

### ワークフロー構成

| ファイル | トリガー | 内容 |
|---------|---------|------|
| `.github/workflows/pr-validate.yml` | `pull_request`（opened, synchronize） | `npm ci` + `npm run build` + `npm run test` + `npm run lint` |
| `.github/workflows/deploy-staging.yml` | `push` to `dev` | unit test → lint → build → staging デプロイ → Playwright E2E（staging URL）|
| `.github/workflows/deploy-production.yml` | `push` to `main` | unit test → lint → build → production デプロイ → smoke test |

> **現状メモ**: 上記ワークフローは方針であり、`pr-validate.yml` を先行導入する（issue #30）。staging / production の**デプロイ先（ホスティング）は未決定**（技術的決定の後ろ倒し）。better-sqlite3 のネイティブモジュールと SQLite ファイルの永続化が必要なため、選定時はサーバーレス系ではなく永続ボリュームを持つ実行環境を前提とすること。deploy-staging / deploy-production はデプロイ先決定後に実装する。

### デプロイトリガー（要約）

```
feature ブランチ
    ↓ PR を dev に向けて作成
PR open / sync
    ↓ pr-validate.yml（build + unit test + lint）
PR レビュー & merge to dev
    ↓ deploy-staging.yml（自動）
staging 環境（dev ブランチの内容）
    ↓ 検証・受け入れテスト
dev → main の PR を作成
    ↓ pr-validate.yml + 手動レビュー
PR merge to main
    ↓ deploy-production.yml（自動）
production 環境
```

`main` への直接 push は GitHub branch protection で禁止する（PR 経由のみ）。

## ローカル開発環境

BizDevX Accord MVP はサーバーレス構成ではなく Next.js + SQLite のシンプル構成のため、ローカル開発に特別なインフラセットアップは不要。

```bash
# 初回セットアップ
cp .env.local.example .env.local
mkdir -p data
npm install
npm run db:migrate
npm run dev
```

## 環境変数・シークレットの管理

| 種別 | 保管場所 | 例 |
|------|---------|---|
| アプリ設定 | `.env.local`（ローカル）/ GitHub Variables（CI/CD） | `DATABASE_URL`, `PROCESS_TEMPLATE_DIR` |
| E2E テスト用変数 | `.env.local`（ローカル）/ GitHub Secrets（CI/CD） | `PLAYWRIGHT_BASE_URL` |

ローカルでは `.env.local` を使用。CI/CD では GitHub Variables / Secrets に同等の値を設定する。

## テスト戦略（ローカルと CI/CD の両方で実行）

| テスト | ローカル実行 | CI/CD 実行タイミング |
|-------|------------|-------------------|
| ユニットテスト（`npm run test`） | 開発中常時 | PR 時 + デプロイ前 |
| Lint（`npm run lint`） | コミット前 | PR 時 + デプロイ前 |
| E2E（`npm run test:e2e`） | 開発・デプロイ後 | staging デプロイ後 / production smoke test |

ローカルでも CI/CD と同じテストを必ず実行できるよう、`.github/workflows/*.yml` で使う npm scripts はすべて `package.json` の公開コマンドとして提供する。

## データの扱い

- SQLite DB ファイル（`data/*.db`）は Git 管理外。本番環境ではファイルを永続化ストレージにマウントする
- DB マイグレーション（`drizzle/`）は Git 管理対象。デプロイ時に `npm run db:migrate` を実行する

## Rollback / 復旧

- アプリ層のロールバックは「前回成功した main commit を revert PR → merge」で実施
- DB マイグレーションのロールバックは `drizzle-kit` の down migration を使用
- SQLite ファイルのバックアップは定期的に取得する（本番環境）

## 将来の拡張

- MVP は Next.js の単一サーバー構成。スケーリングが必要な段階で PostgreSQL への移行を検討する
- ロール認証（Cognito 等）は MVP スコープ外。必要時に追加する
