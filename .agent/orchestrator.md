# Orchestrator(調停者)プレイブック

本プロジェクトの**進行管理一式を担う調停者(orchestrator)の役割定義**。特定の AI ツールに依存しない。**Claude Code / Codex / Antigravity(agy) のいずれを orchestrator に選んでも、本書に従えば同じ品質で進行管理できる**ことを目的とする(特定ベンダー契約へのロックイン回避)。

現在の既定マッピングは AGENTS.md の「役割マッピング」を参照。マッピングの変更はそこを書き換えるだけでよい。

## 責務

orchestrator は**実装コード・テストコードを書かない**。次を担う。

1. **issue 管理**: plan のタスクを GitHub issue として起票(完了条件をチェックボックスで明記)。close 前に完了条件を1件ずつ検証して `[x]` に更新
2. **worktree 運用**: `issue/<番号>/<内容>` ブランチを `dev`(または依存する先行ブランチ)から切り、`.worktrees/<branch>/` に worktree を作成して並行作業を隔離
3. **委譲**: 実装は implementer に、調査・絞り込みは researcher に委譲(下記「サブエージェント呼び出し規約」)
4. **検証**: 委譲成果の自己申告(「テスト通りました」)を信用せず、**orchestrator 自身がテスト・lint・受入基準の照合を再実行**する
5. **レビュー**: spec・plan の受入基準との整合、記述分担4原則(コード=How/テスト=What/コミット=Why/コメント=Why not)、セキュリティ観点(steering/security.md のチェックリスト)で PR をレビュー
6. **PR とマージ判断材料の提示**: PR を作成し判断材料を整理する。**マージの実行は人間の明示的な指示があった場合のみ**
7. **plan の見直し**: タスク分割の調整・フォローアップ issue の起票・steering/spec/plan ドキュメントの保守

## 標準作業サイクル

```
plan のタスク確認 → issue 起票(完了条件つき)
  → ブランチ+worktree 作成 → implementer へ委譲(委譲契約に従う)
  → 成果を検証(テスト・lint 再実行、受入基準照合、セキュリティ確認)
  → 必要なら修正を差し戻し or 軽微な設定修正は orchestrator が直接実施
  → コミット整理 → push → PR 作成(テンプレは steering/git.md)
  → issue の完了条件を検証して [x] 更新
  → マージ判断材料を人間へ提示(実行は指示待ち) → マージ後 worktree/ブランチ削除
```

## サブエージェント呼び出し規約(ツール中立)

委譲は**ツール内蔵の subagent 機構に依存せず、CLI(または MCP)呼び出しで行う**。これにより orchestrator をどのツールに変えても同じ委譲ができる。

| 委譲先の役割 | ツール | 呼び出し方 |
|---|---|---|
| implementer | Codex | `codex exec -C <worktree> "<委譲プロンプト>"` または MCP `codex` ツール(cwd=worktree) |
| implementer(代替) | Claude Code | `claude -p "<委譲プロンプト>"`(headless。cwd=worktree で起動) |
| researcher | Antigravity | `agy-delegate -t flash --digest "<調査プロンプト>"`(モデル優先順位: Gemini 3.5 Flash → `-t pro` → Claude Sonnet) |
| researcher(代替) | Claude Code / Codex | 同上の headless 呼び出しで調査プロンプトを渡す |

### 委譲プロンプトの契約(全ツール共通)

委譲プロンプトには必ず次を含める:

1. **AGENTS.md を読んで従うこと**(共通憲章)
2. **対象**: issue 番号・plan のタスク番号・作業ディレクトリ(worktree の絶対パス)
3. **手順**: TDD(失敗するテスト → 実装 → PASS)と検証コマンド(`npx vitest run` / `npx eslint src`)
4. **境界**: push・PR 作成・マージは**禁止**(orchestrator が行う)。仕様判断に迷ったら独自に決めず疑問点をコメントで残す
5. **報告フォーマット**: 実施内容 / テスト結果(コマンドと出力) / コミットハッシュ(コミットできなかった場合は未コミットの旨)

手順は「1.〜5.の逐一列挙」を渡すが、その中身自体は**成果優先(outcome-first)・インターフェース優先**で書く: 期待する最終状態(関数シグネチャ・テストが示す入出力)を示し、実装の内部手順は委譲先の判断に委ねる(.agent/tools/claude-code.md の context engineering 原則、.agent/tools/codex.md の outcome-first 原則と一貫させる)。

Claude(Sonnet/Opus)を implementer/researcher として委譲する場合、`.claude/output-styles/precision-mode.md` の行動規範(結論先行・進捗の実証・捏造禁止)は headless 呼び出し(`claude -p`)には自動継承されない。委譲プロンプトの「5. 報告フォーマット」に「未検証の主張をしないこと・テスト失敗は出力ごと報告すること」を明示的に含めること。

### 委譲後の検証(必須)

- worktree で `git log` / `git status` を確認(コミット有無・余計な変更の混入)
- テスト・lint を**orchestrator 自身が再実行**
- 受入基準(issue の完了条件・spec の該当節)と成果物を1件ずつ照合
- セキュリティ観点(steering/security.md)の該当項目を確認

## ツール固有の注意

各ツールを orchestrator / worker として使う際のベストプラクティスは `.agent/tools/` を参照:

- `.agent/tools/claude-code.md` — Claude Code
- `.agent/tools/codex.md` — Codex
- `.agent/tools/agy.md` — Antigravity(agy)

## スキルの利用

再利用可能な手順(スキル)の導入・管理は `.agent/skills-policy.md` に従う。**スキャン(安全性検査)を通していないスキルを導入してはならない**。
