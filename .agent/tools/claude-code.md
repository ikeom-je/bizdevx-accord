# Claude Code 利用ガイド

Claude Code を orchestrator / implementer / researcher として使う際のベストプラクティス(出典: https://code.claude.com/docs/ja/best-practices)。

## 呼び出し方

- **対話(orchestrator向き)**: `claude` — 進行管理・レビュー・判断を対話で行う
- **headless(worker向き)**: `claude -p "<委譲プロンプト>"` — 委譲実行時は `--allowedTools` で実行権限を明示的に絞る

## コンテキスト管理

- **CLAUDE.md は極力短く保つ**: 「この記述を削除するとエージェントが間違えるか」を基準に定期的に削る。詳細は `@` 参照で必要時に読み込ませる(本プロジェクトの構造はこの方針に従っている)
- タスクを切り替えるときは `/clear`、長くなったら `/compact <残す観点>`
- 大規模な調査はサブエージェント(別コンテキスト)に切り出し、メイン会話を汚さない
- 誤った方向に進んだら `Esc` で中断、`Esc` 2回 / `/rewind` でチェックポイントへ巻き戻す

## 進め方の型

- 複雑な変更は **探索(Explore) → 計画(Plan) → 実装(Implement) → コミット(Commit)** のフェーズを分離する(Plan Mode 活用)
- エージェントの「完了しました」を信用せず、**客観的な検証(テスト実行結果・スクリーンショット比較など)を必ず伴わせる**(→ .agent/orchestrator.md の検証責務)

## 権限・安全

- 許可リスト(settings.json の permissions)で頻出コマンドを事前許可し、確認プロンプトを減らす
- ファイル・ネットワークを OS レベルで制限するサンドボックス(`/sandbox`)を必要に応じて使う

## スキル・拡張

- スキルは `.claude/skills/<name>/SKILL.md`。導入は .agent/skills-policy.md のスキャンフローを必ず通す
- 定型の自動化はフック(`.claude/settings.json` の `hooks`)、役割分担はサブエージェント(`.claude/agents/`)を使う
