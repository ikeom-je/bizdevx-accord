# スキル導入ポリシー(セキュリティフレーム)

AI エージェントのスキル(SKILL.md 形式などの再利用可能な手順・ツール群)を本プロジェクトの各ツール(Claude Code / Codex / Antigravity)に導入する際の必須フレーム。**スキルはサプライチェーン攻撃の経路になり得る**(プロンプトインジェクション・データ持ち出し・悪性コードの混入)ため、無審査導入を禁止する。

## 参照カタログ

スキルを探す際の第一参照先:

- **antigravity-awesome-skills (AAS)**: https://github.com/sickn33/antigravity-awesome-skills
  - 形式: `skills/<skill-name>/SKILL.md`(1スキル=1ディレクトリのMarkdown)。約1,900+スキル
  - 対応ツール: Claude Code / Codex CLI / Gemini CLI / Antigravity / Cursor ほか
  - 公式インストーラ: `npx agentic-awesome-skills`(`--codex` / `--gemini` / `--antigravity` 等のツール別フラグあり)

**注意**: 公式インストーラによる一括導入は本ポリシーの「スキャン前配置禁止」と衝突するため使用しない。必要なスキルを個別に選定し、下記の検疫フローを通す。カタログ外のスキルを導入する場合も手順(特にスキャン)は同一に適用する。

## 安全性スキャナ(必須)

導入前スキャンには **Cisco AI Defense Skill Scanner** を使用する:

- リポジトリ: https://github.com/cisco-ai-defense/skill-scanner
- 検出対象: プロンプトインジェクション・データ持ち出し・悪性コードパターン(静的解析 YAML+YARA / .pyc 整合性 / シェルコマンドの taint 解析 / AST データフロー / LLM 意味解析 / VirusTotal ハッシュ照合)

```bash
# インストール(Python 3.10+)
pip install cisco-ai-skill-scanner

# 単一スキルのスキャン
skill-scanner scan <path/to/skill>

# 挙動解析を含める場合
skill-scanner scan <path/to/skill> --use-behavioral

# ディレクトリ配下の全スキルを再帰スキャン
skill-scanner scan-all <path/to/skills> --recursive

# 非標準形式(Claude Code の commands/*.md やフラットな Markdown 等)を含める場合
skill-scanner scan <path> --lenient
```

**原則: 「検出なし」は安全の証明ではない**(ベストエフォート型スキャナ)。スキャン通過は必要条件であって十分条件ではなく、手順4の人間確認と内容精査を省略する理由にならない。CI への組み込みは SARIF 出力・pre-commit フックに対応している。

## 導入手順

1. **選定**: カタログから候補スキルを選ぶ。用途・必要権限(ファイル書込・ネットワーク・シェル実行)を確認する
2. **取得**: `working/skills-inbox/`(Git 管理外)に一時取得する。**この時点では各ツールのスキルディレクトリに置かない**
3. **スキャン**: `skill-scanner scan` を実行。**Critical / High の検出が 1 件でもあれば導入中止**。Medium 以下は内容を精査し、orchestrator が採否を判断する
4. **人間への確認**: スキャン結果の要約(検出件数・判断理由)を添えて導入可否を人間に確認する(外部コードの導入は不可逆に近い操作として扱う)
5. **配置**: 承認後、対象ツールのスキルディレクトリへ配置する
   - Claude Code: `.claude/skills/<skill-name>/`
   - Antigravity: `.agent/skills/<skill-name>/`
   - Codex: プロンプト内参照(`@.agent/skills/...`)で共有利用
6. **記録**: コミットログ(Why)に「導入目的・取得元・スキャン結果(ツール/バージョン/検出件数)」を記載する

## 継続運用

- スキルの**更新時は再スキャン必須**(バージョンが変われば別物として扱う)
- 四半期ごと、または skill-scanner のルール更新時に `skill-scanner scan-all` で全スキルを再スキャンする
- 不要になったスキルは削除する(攻撃面の最小化)
