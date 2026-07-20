# BizDevX Accord

ビジネス企画（Working Backwards 型構想）から AI 駆動開発ライフサイクル（AI-DLC）までの変革に伴走する**プロセスナビゲーター Web アプリ**。

本ファイルは**全 AI エージェント共通の憲章**。Codex・Antigravity（agy）はセッション開始時に本ファイルを自動で読み込み、Claude Code は CLAUDE.md 経由で参照する。詳細仕様・実装パターンは下記の参照先を必要に応じて開く。

## AI エージェントの役割分担（役割ベース・ツール中立）

本プロジェクトは AI を**ツール名ではなく役割名**で運用する(既定では Claude・Codex・Antigravity(agy)がそれぞれ役割を担う)。役割の定義は `.agent/` 配下が正本であり、どのツールをどの役割に割り当てるかは下表(役割マッピング)の書き換えだけで変更できる(特定ベンダー契約へのロックイン回避)。

| 役割 | 責務 | 既定の担当ツール |
|------|------|----------------|
| **orchestrator（調停者）** | 進行管理一式: issue 管理・worktree 運用・委譲・検証・レビュー・PR 作成・マージ判断材料の提示（実行は人間指示待ち）・plan/steering の保守。**実装コードは書かない**。詳細は @.agent/orchestrator.md | Claude Code |
| **implementer（実装者）** | 実装計画（@.claude/plans/bizdevx-accord-mvp-plan.md）に基づく**コード実装・テスト作成・実行**。仕様判断・設計変更・進行管理（issue 起票・PR マージ判断）は行わず、疑問点は spec・plan に立ち返るか orchestrator へコメントで問い合わせる（勝手に仕様を拡張・変更しない） | Codex |
| **researcher（調査担当）** | 実装・検証に伴う調査と絞り込み（技術調査・Web 検索・大量読み込みの要約・一次レビュー）。モデルは Gemini 3.5 Flash 優先 → Gemini Pro → Claude Sonnet | Antigravity（agy） |

- 役割の兼任・交代は可能。**orchestrator を Codex や agy が担う場合も手順は @.agent/orchestrator.md にそのまま従う**
- サブエージェント呼び出し（委譲）の汎用規約・委譲契約・検証責務は @.agent/orchestrator.md に定義
- 各ツールの利用ベストプラクティスは @.agent/tools/ を参照
- スキルの導入は @.agent/skills-policy.md の安全性スキャンを必須とする
- どの役割の成果も、採否判断と検証は orchestrator が行う（自己申告を信用しない）

## 詳細情報の参照先

- @.agent/orchestrator.md 調停者プレイブック（ツール中立の進行管理手順・委譲規約）
- @.agent/skills-policy.md スキル導入セキュリティフレーム（カタログ参照+スキャン必須）
- @.agent/tools/ 各 AI ツール（Claude Code / Codex / agy）の利用ベストプラクティス
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
- 記述分担4原則: **コードには How、テストコードには What、コミットログには Why、コードコメントには Why not**（詳細は @.claude/steering/development.md）
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
