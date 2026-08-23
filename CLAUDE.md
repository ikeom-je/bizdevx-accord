# BizDevX Accord

ビジネス企画（Working Backwards 型構想）から AI 駆動開発ライフサイクル（AI-DLC）までの変革に伴走する**プロセスナビゲーター Web アプリ**。企画と開発のロール分業・断絶を **Mobbing（複数ロール同席の意思決定）** で埋めることが中核的な差別化要素（詳細は @.claude/steering/product.md）。

本ファイルは AI 開発エージェント（特に Claude Code）がセッション開始時に毎回読み込む軽量な指針。詳細仕様・実装パターンは下記の参照先を必要に応じて開く。

## AI ツールの役割分担

役割定義の正本は **AGENTS.md（全エージェント共通憲章）と `.agent/` 配下**にある。本プロジェクトは役割名（orchestrator / implementer / researcher）で運用し、既定では **Claude（本エージェント）= orchestrator（調停者）**、Claude Sonnet 5（headless）= implementer、Antigravity(agy) = researcher を担う。orchestrator は Codex・agy にも交代可能であり（ベンダーロックイン回避）、誰が担う場合も手順は @.agent/orchestrator.md に従う。

- **orchestrator（既定: Claude）**: サービス構想・企画（Working Backwards / PRFAQ / KGI・KPI）、spec・ユーザーストーリー・実装計画の作成とレビュー、設計判断（アーキテクチャ・データモデル・ADR）、steering/spec/plan ドキュメントの保守、および**進行管理一式**（issue 作成・完了条件の検証・close、worktree/PR のレビュー、マージ可否の判断材料の提示 — 実行はユーザー指示待ち、plan の見直し）。**実装コード・テストコードは書かない**（明示的にユーザーから依頼された調査・最小限の設定変更を除く）。
- **implementer（既定: Claude Sonnet 5、headless `claude -p`）**: 実装計画に基づくコード実装・テスト作成・実行（AGENTS.md 参照）。Codex はバックエンド過負荷で断続的に失敗するため代替に降格した(復旧後に見直す)。
- **researcher（既定: agy）**: 実装・検証に伴う調査と絞り込み。モデルは Gemini 3.7 Flash High(`gemini-3.7-flash-high`)優先 → Gemini Pro → Claude Sonnet。成果は orchestrator が検証してから採用する。

実装・テストに及びそうな作業は implementer へ、調査の下作業は researcher へ委譲する（委譲の汎用規約: @.agent/orchestrator.md）。各ツールのベストプラクティスは @.agent/tools/、スキル導入は @.agent/skills-policy.md（安全性スキャン必須）に従う。

## 詳細情報の参照先

必要時に Claude Code が自動取り込みできるよう `@` プレフィックス付きで列挙する。

- @.agent/orchestrator.md 調停者プレイブック（ツール中立の進行管理手順・委譲規約）
- @.agent/skills-policy.md スキル導入セキュリティフレーム（カタログ参照+スキャン必須）
- @.agent/tools/ 各 AI ツール（Claude Code / Codex / agy）の利用ベストプラクティス
- @.claude/specs/bizdevx-accord-design.md 設計 spec（アーキテクチャ・エンティティ・画面仕様）
- @.claude/specs/bizdevx-accord-user-stories.md ユーザーストーリー20本（受入基準付き）
- @.claude/plans/bizdevx-accord-mvp-plan.md MVP 実装計画（タスク・技術選定 ADR）
- @.claude/knowledge/bizdevx-process-flow.md bizdevx プロセスの設計思想・実践知見
- @.claude/knowledge/bizdevx-prompt-patterns.md ステージ別プロンプト骨格パターン（テンプレート YAML の元ネタ）
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
- 記述分担4原則: **コードには How、テストコードには What、コミットログには Why、コードコメントには Why not**（詳細は @.claude/steering/development.md。PR レビュー時もこの分担で検証する）
- パッケージマネージャー: npm（pnpm・yarn 不使用）
- 一時ファイル・中間データ: `./working/` 配下にのみ配置（Git 管理外）
- Git 管理外: `.claude/settings.local.json`, `.mcp.json`, `.env.local`, `working/`, credentials 系, `*.db`（`.claude/steering/` `.claude/specs/` `.claude/plans/` はコミット対象）
- ブランチ運用: `main` への直接コミット禁止。`feature → dev → main` の PR フロー
  - `dev` ブランチが staging 環境、`main` ブランチが production 環境
  - 必ず issue 番号付き作業ブランチ（例: `issue/21/add-gate-logic`）を `dev` から切る
- 並行作業時は git worktree (`.worktrees/<branch-name>/`) を活用
- issue close 前: 本文「完了条件」のチェックボックスを 1 件ずつ検証し `[x]` に更新してから close
- **`src/domain/` の純粋性**: Next.js・Drizzle・better-sqlite3 を import してはならない（ESLint で強制）
- `.env.local` の取り扱い: 秘匿情報のため Read ツール直接使用禁止。Bash 経由で `source .env.local` または `sed` で必要な値のみ取得

## 仕様駆動開発

実装の前後で次を必ず行う。

1. 着手前: 対象機能の @.claude/specs/bizdevx-accord-design.md の受入基準と @.claude/plans/bizdevx-accord-mvp-plan.md のタスクを確認
2. 実装中: 関連 steering ファイルの規約に従う
3. 完了時: @.claude/plans/bizdevx-accord-mvp-plan.md の該当チェックボックスを `[x]` に更新し、関連ドキュメント（specs / steering / @.env.local.example）を同時更新

## 環境変数 `.env.local`

- SQLite DB パス・プロセステンプレートディレクトリ・Next.js 公開変数などを格納
- テンプレ: @.env.local.example
- 利用手順: テンプレをコピー → 値を記入 → `source .env.local` で環境変数化してから開発
- エラー時はまず `.env.local` の値を確認

## 主要コマンド

```bash
source .env.local          # 環境変数を適用（作業前に必ず実行）
npm run dev                # 開発サーバー起動（http://localhost:3000）
npm run build              # TypeScript ビルド + Next.js プロダクションビルド
npm run test               # Vitest ユニットテスト
npm run test:e2e           # Playwright E2E テスト
npm run lint               # ESLint（domain 純粋性チェック含む）
npm run db:generate        # Drizzle スキーマからマイグレーション生成
npm run db:migrate         # マイグレーション適用
```
