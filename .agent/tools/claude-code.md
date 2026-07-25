# Claude Code 利用ガイド

Claude Code を orchestrator / implementer / researcher として使う際のベストプラクティス(出典: https://code.claude.com/docs/ja/best-practices)。

## Claude 5 世代モデル向け context engineering 原則

出典: https://claude.com/blog/the-new-rules-of-context-engineering-for-claude-5-generation-models — Anthropic の報告では、Claude Opus 5 / Fable 5 はシステムプロンプトの 80% 以上を削除してもコード評価に測定可能な低下がなかった。**新モデルは過度な制約を必要としない**。過去の「細かく指示を書き込む」プラクティスから以下へ転換する:

| 旧プラクティス | 新アプローチ | 本プロジェクトでの適用 |
|---|---|---|
| 明示的なルール指示を細かく与える | モデルの判断能力に依存させる | CLAUDE.md/AGENTS.mdの「必ず守るルール」は**契約的なガバナンス**(ブランチ運用・domain純粋性等)に限定する。自明な一般論・繰り返し指示は書かない |
| ツール使用法に具体例を積む | ツール設計自体を表現力豊かにする | 委譲プロンプト(orchestrator.md)は手順の逐一列挙より、期待する成果・インターフェース(入出力の型)を明示する方を優先する |
| 全情報を事前に提示 | 段階的情報開示(progressive disclosure) | 詳細は `@` 参照で必要時のみ読み込ませる構造(本プロジェクトのCLAUDE.md構成)を維持・徹底する |
| 指示の繰り返し | シンプルなツール説明で十分 | 同じ指示をCLAUDE.md/AGENTS.md/steeringの複数箇所に重複して書かない |
| CLAUDE.mdに記憶を手動保存 | 自動メモリー機能を活用 | セッション間で引き継ぐべき事実は極力メモリー機能に委ね、CLAUDE.mdは「今回変わらない構造的事実」に絞る |
| シンプルな仕様書 | コード/テスト/HTML等の豊富なリファレンス | spec/plan だけでなく、実装済みのテストコード(`*.test.ts`)自体を「何が満たされるべきか」のリファレンスとして参照させる(記述分担4原則の「テストコード=What」と一致) |

**注意**: この原則は「冗長な一般論・自明な指示を削る」ことを推奨するものであり、本プロジェクト固有の強制ルール(ブランチ運用・`src/domain/`純粋性・issue駆動のガバナンス等)を削除してよいという意味ではない。これらはモデルの判断能力では代替できない**プロジェクト契約**であり、削除対象ではない。

CLAUDE.mdを保守する際は「この記述は既知の落とし穴(このプロジェクト特有の非自明な制約)を防いでいるか、それとも一般的なコーディング常識の繰り返しか」を基準に判断する。後者は削る。

## Output Style による行動規範(Sonnet/Opus 専用)

出典: https://qiita.com/TakanobuSano/items/68e136b22294e1575d55 、https://note.com/hataraiku/n/n70ca8c2e217a 。**Codex・agy には適用しない**(Claude Code 固有の機能のため)。

- `.claude/output-styles/precision-mode.md` に、結論先行・即行動・進捗の実証・スコープ規律・ターン終了規律・境界の6原則を定義している。有効化は `/output-style precision-mode`(または settings.json で既定指定)
- **`keep-coding-instructions: true` を必ず維持する**: これを外すと Claude Code 本来のコーディング規律(スコープ・コメント方針・検証手順)が丸ごと消える
- **サブエージェント・headless 呼び出し(`claude -p`)には継承されない**(`context: fork` の場合を除く)。orchestrator が implementer/researcher へ委譲するプロンプトには、必要な規範(特に「進捗の実証」「捏造禁止」)を委譲プロンプト自体に凝縮して含めること(.agent/orchestrator.md の委譲プロンプト契約を参照)
- **effort レベル**: 低いと「言われたことだけをやる」方向に縮む。気づき・見落とし検出が価値を持つ作業(コードレビュー・セキュリティ確認・spec整合確認・障害調査)では effort を高めに保つ。単純な定型変更では標準で構わない
- 上記の「Claude 5 世代 context engineering 原則」と矛盾する場合はそちらを優先する。この行動規範は報告・実行の質(断定的か、検証済みか、スコープを守るか)の調整であり、システムプロンプトへ冗長な指示を積み増すものではない

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
