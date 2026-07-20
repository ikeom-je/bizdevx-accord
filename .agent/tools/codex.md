# Codex(OpenAI)利用ガイド

Codex を implementer(既定)/ orchestrator として使う際のベストプラクティス(出典: https://developers.openai.com/api/docs/guides/latest-model)。

## 呼び出し方

- **CLI**: `codex exec -C <worktree> "<委譲プロンプト>"`
- **MCP**: `codex` ツール(cwd=worktree、sandbox=workspace-write)
- 既知の制約: worktree 内から親リポジトリの `.git` へ書き込めずコミットに失敗することがある。その場合は実装・テストまでで止め、コミット以降は orchestrator が引き継ぐ

## プロンプトの型(GPT-5.x 系)

- **成果優先(outcome-first)で書く**: 細かな手順の列挙(step-by-step)を減らし、期待する最終結果・成功基準・許容されるサイドエフェクトを明示する
- **推論努力(reasoning.effort)はむやみに上げない**: 曖昧・競合する指示のまま `high` にすると過剰推論や誤探索を招く。まず指示を明確化し、効果を確認できた場合のみ上げる
- 応答の冗長さは `text.verbosity` で調整(low で簡潔)
- モデル移行時は旧プロンプトを引き継がず、最小限の指示から再チューニングする
- 現在日付をプロンプトにハードコードしない(モデルは UTC の現在日付を認識している)

## コスト・API 最適化(API 直接利用時)

- 多ターン・ツール呼び出しは Responses API を使う
- プロンプトは静的部分(役割・規約)を先頭、動的部分(今回のタスク)を末尾に置き、キャッシュ効率を上げる
- 構造化データが欲しい場合は Structured Outputs を使い、プロンプト内スキーマ記述を避ける

## 本プロジェクトでの運用

- 委譲契約(.agent/orchestrator.md)に従う: AGENTS.md 遵守・TDD・push/PR 禁止・報告フォーマット
- 仕様の曖昧さを発見したら独自判断せず、疑問点をコメントで残して orchestrator に返す
