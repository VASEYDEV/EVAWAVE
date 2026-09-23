import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Import boundary for the pure musicspec core (BUILD-BRIEF §2). Patterns use gitignore
 * semantics, so a bare name also covers its subpaths (`react-dom/client`, `next/server`).
 * The `**` entries close the relative-path route around the aliases
 * (`../../app/page` from inside src/core).
 * tests/unit/import-boundary.test.ts asserts each of these is enforced.
 */
const CORE_FORBIDDEN_IMPORTS = [
  "react",
  "react-dom",
  "next",
  "@supabase/*",
  "@/components",
  "@/components/*",
  "@/app",
  "@/app/*",
  "@/lib/supabase",
  "@/lib/supabase/*",
  "**/components",
  "**/components/**",
  "**/app",
  "**/app/**",
  "**/lib/supabase",
  "**/lib/supabase/**",
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/core/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: CORE_FORBIDDEN_IMPORTS,
              message:
                "src/core is pure TypeScript: no React, Next, Supabase or app-layer imports (BUILD-BRIEF §2, .claude/rules/musicspec-core.md).",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
