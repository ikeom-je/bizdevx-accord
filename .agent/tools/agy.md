# Antigravity(agy)利用ガイド

Antigravity CLI を researcher(既定)/ orchestrator として使う際のベストプラクティス(出典: https://antigravity.google/docs/cli/best-practices)。

## 呼び出し方

- **委譲ラッパー(推奨)**: `agy-delegate -m gemini-3.7-flash-high [--digest] "<プロンプト>"`
  - `-t` の内蔵 tier(`flash|flash-lo|pro`)には high 指定がないため、**必ず `-m` で厳密モデル名を指定する**(`agy models` で一覧確認可)
  - モデル優先順位: **`gemini-3.7-flash-high`(Gemini 3.7 Flash High) → `gemini-3.1-pro-high` → Claude Sonnet**。優先モデルが失敗/quota切れの場合のみ次点に切り替える
  - 調査委譲は `--digest` を付け、**要約(ダイジェスト)だけを受け取る** — 生ダンプを orchestrator のコンテキストに取り込まない(最大のコスト要因)
- **対話**: `agy` — 設定は `~/.gemini/antigravity-cli/settings.json`

## 権限・安全

- 権限レベル: `request-review`(既定: 書込・実行前に確認)/ `proceed-in-sandbox`(安全なコマンドはサンドボックス内で自律実行)/ `strict`(全ての非読取操作で承認)
- 委譲実行では用途に応じて選ぶ。誤った方向に進んだら `esc` で即中断
- **自己申告の「GREEN/PASS」を信用しない**: agy が環境側を改変してテストを通す事例が観測されている。検証は orchestrator がクリーンな状態で再実行する

## 進め方の型

- 複雑な課題は **探索(Exploration) → 計画(Planning) → 実行(Execution)** に分割し、計画承認後に変更させる
- コード修正をさせる前に、検証ループ(ユニットテスト・リンター)のスクリプトを先に準備させる
- プロンプトでは `@` によるファイル指定で推論範囲を物理的に絞り、トークン浪費を防ぐ

## 得意領域(委譲の目安)

- 大量ファイル・長文ドキュメントの読み込みと要約(ダイジェスト化)
- Web 検索を伴う技術調査・ファクト収集(結果は必ず orchestrator が裏取り)
- 定型的な大量生成(スキャフォールド・網羅的テスト草案)— ただし採否判断は orchestrator
- 小さく判断の重いタスクには使わない(往復コストが利益を上回る)

## スキル

- agy 用スキルの配置先: `~/.gemini/antigravity-cli/skills/`(プロジェクト共有は `.agent/skills/`)
- 導入は .agent/skills-policy.md のスキャンフローを必ず通す
