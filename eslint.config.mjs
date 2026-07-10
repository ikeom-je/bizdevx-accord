import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // src/domain/ は純粋なドメインロジック層。フレームワーク・永続化層・
    // サービス層への依存を機械的に禁止し、規律を強制する。
    files: ["src/domain/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["next", "next/*"],
              message:
                "src/domain/ は純粋な関数のみを含むこと。Next.js への依存は禁止です。",
            },
            {
              group: ["drizzle-orm", "drizzle-orm/*"],
              message:
                "src/domain/ は純粋な関数のみを含むこと。drizzle-orm への依存は禁止です。",
            },
            {
              group: ["better-sqlite3"],
              message:
                "src/domain/ は純粋な関数のみを含むこと。better-sqlite3 への依存は禁止です。",
            },
            {
              group: ["@/db/*"],
              message:
                "src/domain/ は純粋な関数のみを含むこと。@/db への依存は禁止です。",
            },
            {
              group: ["@/services/*"],
              message:
                "src/domain/ は純粋な関数のみを含むこと。@/services への依存は禁止です。",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
