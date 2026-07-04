# Security Standards and Best Practices

## Security Philosophy

### Core Principles

1. **Defense in Depth**: 多層防御で単一障害点を排除
2. **Least Privilege**: 必要最小限の権限のみ付与
3. **Input Validation First**: 全ての外部入力を境界で検証
4. **Fail Secure**: エラー時は安全側に倒す

## Credential Management

### 絶対に守るべきルール

1. **認証情報をコードに含めない**
2. **認証情報を Git にコミットしない**
3. **認証情報をログに出力しない**

### .env ファイルの分類

```
.env.local.example    # テンプレート（Git にコミット可）
.env.local            # ローカル開発用（Git にコミット禁止）
```

### 秘匿情報の取り扱い

- `.env.local` は Read ツール直接使用禁止。Bash 経由で `source .env.local` または `sed` で必要な値のみ取得する
- DB ファイル（`data/*.db`）は Git 管理外（`.gitignore` で除外）

## Input Validation

全ての外部入力（フォーム・URL パラメータ・YAML ファイル）は境界で zod によるバリデーションをかける。

### Server Actions での入力検証

```typescript
// ✅ Good: zod でバリデーション
import { z } from "zod";
import { revalidatePath } from "next/cache";

const approveGateSchema = z.object({
  gateId: z.string().min(1),
  reflectionAnswers: z.object({
    isHumanMakingArtifacts: z.boolean(),
    understandIntent: z.boolean(),
    understandImpact: z.boolean(),
  }),
  comment: z.string().max(1000).optional(),
});

export async function approveGateAction(input: unknown) {
  const validated = approveGateSchema.parse(input); // バリデーション失敗は例外を throw
  await gateService.approve(validated.gateId, validated.reflectionAnswers);
  revalidatePath(`/projects/${projectId}/stages`);
}

// ❌ Bad: 検証なしで直接使用
export async function approveGateAction(gateId: string, answers: any) {
  await gateService.approve(gateId, answers); // 危険
}
```

### YAML テンプレートの検証

```typescript
// src/domain/template.ts
import { parseTemplate } from "./template"; // zod スキーマで検証

// 起動時に全テンプレートを検証
export function loadAndValidateTemplate(filePath: string) {
  const raw = fs.readFileSync(filePath, "utf-8");
  return parseTemplate(raw); // 不正な YAML は ZodError を throw → アプリ起動を止める
}
```

### URL パラメータの検証

```typescript
// src/app/projects/[id]/page.tsx
import { notFound } from "next/navigation";

export default async function ProjectPage({ params }: { params: { id: string } }) {
  // ID の存在確認（存在しない場合は 404）
  const project = await projectService.findById(params.id);
  if (!project) notFound();
  return <ProjectView project={project} />;
}
```

## XSS 対策

Next.js の JSX は自動的にエスケープするため、基本的に XSS 対策は組み込まれている。ただし以下に注意する。

```tsx
// ✅ Good: JSX の自動エスケープを活用
<div>{userInput}</div>

// ❌ Bad: dangerouslySetInnerHTML は使用しない
<div dangerouslySetInnerHTML={{ __html: userInput }} />
```

YAML テンプレートから読み込んだプロンプト文字列を表示する場合も同様に JSX で表示する。

## SQLite セキュリティ

### パラメータ化クエリ（Drizzle ORM）

Drizzle ORM はデフォルトでパラメータ化クエリを使用するため、SQLite インジェクションは防止される。

```typescript
// ✅ Good: Drizzle のパラメータ化クエリ
const project = await db.select().from(projects).where(eq(projects.id, projectId));

// ❌ Bad: 文字列結合（絶対禁止）
db.run(`SELECT * FROM projects WHERE id = '${projectId}'`);
```

### DB ファイルの保護

- `data/*.db` は Git 管理外（`.gitignore` で除外）
- 本番環境では DB ファイルの読み取り権限を適切に制限する

## YAML テンプレートのセキュリティ

`js-yaml` でロードする際は `FAILSAFE_SCHEMA` または `JSON_SCHEMA` を使用し、任意の JavaScript オブジェクトがインスタンス化されないようにする。

```typescript
// ✅ Good: 安全な YAML ロード
import yaml from "js-yaml";

const parsed = yaml.load(rawYaml, { schema: yaml.JSON_SCHEMA });

// ❌ Bad: DEFAULT_SCHEMA では任意のクラスがインスタンス化される危険がある
const parsed = yaml.load(rawYaml); // 注意
```

## ログセキュリティ

```typescript
// ✅ Good: PII や秘匿情報をログに出さない
console.log("Gate approved", { gateId, projectId });

// ❌ Bad: 秘匿情報をログに出力
console.log("User action", { email, password, token }); // 禁止
```

## セキュリティチェックリスト（PR レビュー前）

- [ ] 外部入力に zod バリデーションをかけている
- [ ] `dangerouslySetInnerHTML` を使用していない
- [ ] DB 操作に Drizzle ORM（パラメータ化クエリ）を使用している
- [ ] YAML ロードに安全なスキーマを使用している
- [ ] 秘匿情報がログ出力されていない
- [ ] `.env.local` の値がコードにハードコードされていない
- [ ] `data/*.db` が `.gitignore` に含まれている

## 定期的なセキュリティレビュー

```bash
# 依存関係の脆弱性スキャン（定期実行）
npm audit
npm audit fix

# CI/CD での自動スキャン
npm audit --audit-level=high
```
