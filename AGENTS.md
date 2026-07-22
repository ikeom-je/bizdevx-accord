# BizDevX Accord

ビジネス企画（Working Backwards 型構想）から AI 駆動開発ライフサイクル（AI-DLC）までの変革に伴走する**プロセスナビゲーター Web アプリ**。

本ファイルは AI 開発エージェント（特に Codex）がセッション開始時に毎回読み込む軽量な指針。詳細仕様・実装パターンは下記の参照先を必要に応じて開く。

## AI ツールの役割分担

このプロジェクトは **Claude・Codex・Antigravity(agy)を役割で使い分ける**。

- **Claude**: サービス構想・企画、spec・ユーザーストーリー・実装計画の作成とレビュー、設計判断（アーキテクチャ・データモデル・ADR）を担当する。加えて、GitHub issue の作成・完了条件の検証・close、本エージェント（Codex）が実装した worktree/PR のレビューとマージ可否判断の提示、plan の見直しなど**実装そのもの以外の進行管理**を一手に担う（CLAUDE.md 参照）。
- **Codex（本エージェント）**: 実装計画（@.claude/plans/bizdevx-accord-mvp-plan.md）に基づく**コード実装・テスト作成・実行**を担当する。仕様判断や設計変更、issue 起票・PR マージ判断などの進行管理は行わず、独自に決めず spec・plan に立ち返るか、コメントで疑問点を明示する（勝手に仕様を拡張・変更しない）。
- **Antigravity（agy/Gemini）**: 実装・検証に伴う調査と絞り込み（技術調査・一次レビュー・大量読み込みの要約）を担当する補助エージェント。成果は Claude が検証する。

## 詳細情報の参照先

- @.claude/specs/bizdevx-accord-design.md 設計 spec（アーキテクチャ・エンティティ・画面仕様）
- @.claude/specs/bizdevx-accord-user-stories.md ユーザーストーリー20本（受入基準付き）
- @.claude/plans/bizdevx-accord-mvp-plan.md MVP 実装計画（タスク・技術選定 ADR）
- @.claude/steering/product.md プロダクト概要・BPR 思想
- @.claude/steering/architecture.md アーキテクチャ全体・ドメインピュア設計・ハイブリッド型
- @.claude/steering/development.md 開発ガイド・SQLite/Next.js パターン・`.env.local` 変数一覧
- @.claude/steering/git.md Git ワークフロー・Conventional Commits・PR ガイドライン
- @.claude/steering/structure.md ディレクトリ構成・命名規則
- @.claude/steering/tech.md 技術スタック・バージョン
- @.claude/steering/testing.md テスト戦略（Vitest ユニット / Playwright E2E）
- @.claude/steering/security.md セキュリティ・入力バリデーション・秘匿情報の取り扱い
- @.claude/steering/deployment.md デプロイ戦略・GitHub Actions・環境分離

## 必ず守るルール

- 言語: ドキュメント・コメント・ユーザー応答はすべて日本語（コード識別子は英語）
- パッケージマネージャー: npm（pnpm・yarn 不使用）
- 一時ファイル・中間データ: `./working/` 配下にのみ配置（Git 管理外）
- Git 管理外: `.claude/settings.local.json`, `.mcp.json`, `.env.local`, `working/`, credentials 系, `*.db`（`.claude/steering/` `.claude/specs/` `.claude/plans/` はコミット対象）
- ブランチ運用: `main` への直接コミット禁止。`feature → dev → main` の PR フロー
  - 必ず issue 番号付き作業ブランチ（例: `issue/21/add-gate-logic`）を `dev` から切る
- 複数 AI が並行する前提のため、必ず issue 番号付き作業ブランチを切る
- 並行作業時は git worktree (`.worktrees/<branch-name>/`) を活用
  - 既知の制約: `codex exec -C .worktrees/<branch>` はサンドボックスの書き込み許可範囲外（worktree の `.git` 実体は親リポジトリの `.git/worktrees/<branch>/` にある）のため `git add`/`commit` が `index.lock: Operation not permitted` で失敗することがある。発生時はコード実装・テストのみ完了させ、コミット以降は呼び出し元（Claude）に引き継ぐ
- **`src/domain/` の純粋性**: Next.js・Drizzle・better-sqlite3 を import してはならない
- `.env.local` の取り扱い: 秘匿情報のため直接読み込み禁止。`source .env.local` または `sed` で必要な値のみ取得

## 仕様駆動開発

実装の前後で次を必ず行う。

1. 着手前: 対象機能の @.claude/specs/bizdevx-accord-design.md の受入基準と @.claude/plans/bizdevx-accord-mvp-plan.md のタスクを確認
2. 実装中: 関連 steering ファイルの規約に従う
3. 完了時: @.claude/plans/bizdevx-accord-mvp-plan.md の該当チェックボックスを `[x]` に更新し、関連ドキュメントを同時更新

## 環境変数 `.env.local`

- テンプレ: @.env.local.example
- 利用手順: テンプレをコピー → 値を記入 → `source .env.local` で環境変数化してから開発

## 主要コマンド

```bash
source .env.local          # 環境変数を適用（作業前に必ず実行）
npm run dev                # 開発サーバー起動（http://localhost:3000）
npm run build              # プロダクションビルド
npm run test               # Vitest ユニットテスト
npm run test:e2e           # Playwright E2E テスト
npm run lint               # ESLint（domain 純粋性チェック含む）
npm run db:generate        # Drizzle マイグレーション生成
npm run db:migrate         # マイグレーション適用
```
