# Git Workflow and Commit Standards

## Commit Message Format

### Structure

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat**: 新機能の追加
- **fix**: バグ修正
- **docs**: ドキュメントのみの変更
- **style**: コードの意味に影響しない変更（空白、フォーマット、セミコロンなど）
- **refactor**: バグ修正や機能追加を伴わないコード変更
- **perf**: パフォーマンス改善
- **test**: テストの追加や修正
- **chore**: ビルドプロセスやツールの変更

### Subject Rules

- 50文字以内に収める
- 命令形を使用（"add" not "added" or "adds"）
- 文末にピリオドを付けない
- 何を変更したかを明確に記述

### Body Rules

- 72文字で改行
- **なぜ**変更したかを説明（**何を**変更したかは diff で分かる）
- 変更の動機と以前の実装との違いを記述
- 記述分担4原則の「コミットログには Why」に従う（How はコード、What はテストコードと diff が語る。development.md 参照）

### Footer

- Breaking changes: `BREAKING CHANGE:` で始める
- Issue 参照: `Closes #123`, `Fixes #456`

### Examples

```
feat(gate): add approval validation with reflection questions

承認時に理解確認3項目と変革ふりかえりへの回答を必須とする。
チェックリスト未完了の場合に承認をブロックする。

Closes #12
```

```
fix(domain): handle null version in optimistic lock

version カラムが NULL の場合（初回）を OR 条件で吸収する。
楽観ロックで初回更新が失敗するバグの修正。

Fixes #34
```

## Branch Strategy

### Branch Naming Convention

CLAUDE.md の運用ルールにより、**すべての作業ブランチは `issue/[番号]/[内容]` 形式で `dev` から切る**。`feature/`・`fix/` など issue 番号を伴わない独立ブランチは作成しない。`[内容]` 部分に変更の性質を表す語を含めると分かりやすい:

- 新機能: `issue/23/add-traceability-board`
- バグ修正: `issue/24/fix-gate-approval-validation`
- リファクタリング: `issue/25/refactor-domain-stage-transitions`
- ドキュメント: `issue/26/docs-update-steering-architecture`
- テスト追加: `issue/27/test-add-e2e-gate-flow`

### Main Branches

- **main**: 本番環境にデプロイ可能な状態を常に維持。直接コミット禁止
- **dev**: 開発用のマージブランチ。機能ブランチはここからブランチを切り、ここにマージする

### Workflow

1. `dev` ブランチから新しい機能ブランチを作成（例: `issue/21/add-checklist-domain`）
2. 機能ブランチ上で小さく頻繁にコミット
3. 機能の実装が完了したら、Vitest ユニットテスト + ESLint が PASS することを確認
4. 重要な機能は Playwright E2E テストも実施してから PR を作成
5. **マージはユーザーの明示的な指示がある場合のみ実行する**（勝手にマージしない）
6. マージ後は速やかに機能ブランチを削除
7. リリース時に `dev` → `main` へマージ

### 開発の進め方

- **テストなしでのマージは禁止**: ユニットテスト PASS を確認してからマージ提案する
- **マージはユーザー判断**: 実装・テスト完了後は PR を作成し、ユーザーがマージを指示するまで待つ
- **issue 駆動**: 実装は issue に基づいて行い、対応内容とコミットハッシュを issue コメントに記録する
- **コードレビュー**: 実装完了後はレビュープラグインで動作・セキュリティを検証し、指摘を修正してから PR 作成する

### コミットタイミング

- **機能単位でコミット**: 1つの完結した変更ごとにコミット（例: domain 変更、service 変更、UI 変更をそれぞれ別コミット）
- **テスト通過後にコミット**: `npm run test` または `npm run build` が通ったことを確認してからコミット
- **issue コメント**: コミット後、対応する GitHub issue にコミットハッシュと変更内容をコメントする

## Commit Hash の記述ルール

### GitHub Issue / PR コメントでの記述

コミットハッシュは **バッククォートで囲まない**（bare hash）。GitHub が自動でコミットリンクに変換する。

```markdown
# ✅ 正しい記述（自動リンクされる）
**コミット**: dd6c705

# ❌ 誤った記述（リンクにならない）
**コミット**: `dd6c705`
```

## Pull Request Guidelines

### PR Title Format

コミットメッセージと同じ形式を使用:
```
feat(traceability): add orphan detection logic
```

### PR Description Template

```markdown
## 変更内容
<!-- 何を変更したか -->

## 変更理由
<!-- なぜこの変更が必要か -->

## 影響範囲
<!-- どのコンポーネント/機能に影響するか -->

## テスト方法
<!-- どのようにテストしたか -->

## スクリーンショット（該当する場合）
<!-- UI 変更の場合は画像を添付 -->

## チェックリスト
- [ ] ユニットテストが追加/更新されている
- [ ] `npm run lint` が通っている
- [ ] `npm run build` が通っている
- [ ] ドキュメントが更新されている
- [ ] Breaking change がある場合は明記されている
```

### Review Guidelines

- PR は500行以内を目安に小さく保つ
- 1つの PR で1つの目的に集中
- レビュー依頼前にセルフレビューを実施
- CI が全てパスしていることを確認

## Git Ignore Patterns

### 必ず除外するもの

- **認証情報**: `.env.local`, `*.pem`, `*.key`
- **DB ファイル**: `data/*.db`, `*.db-journal`, `*.db-wal`, `*.db-shm`
- **ビルド成果物**: `.next/`, `dist/`, `build/`
- **依存関係**: `node_modules/`
- **AI ツール設定（個人ローカル分のみ）**: `.claude/settings.local.json`, `.mcp.json`（`.claude/steering/` `.claude/specs/` `.claude/plans/` は下記の通りコミット対象）
- **一時作業**: `working/`
- **IDE 設定**: `.vscode/settings.json`（`.vscode/extensions.json` は除く）
- **OS 固有**: `.DS_Store`, `Thumbs.db`

### 含めるべきもの

- **ロックファイル**: `package-lock.json`
- **CI/CD 設定**: `.github/workflows/`
- **Steering 設定**: `.claude/steering/`, `.claude/specs/`, `.claude/plans/`
- **テンプレート**: `templates/*.yaml`
- **Drizzle マイグレーション**: `drizzle/`
- **環境変数テンプレ**: `.env.local.example`
