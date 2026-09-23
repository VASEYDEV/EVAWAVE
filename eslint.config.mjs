import { fileURLToPath } from "node:url";

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

import { createCoreBoundaryRule } from "./eslint-rules/core-boundary.mjs";

const repoRoot = fileURLToPath(new URL(".", import.meta.url));

/**
 * Import boundary for the pure musicspec core (BUILD-BRIEF §2), in two layers:
 * - no-restricted-imports, the rule the brief names, matches specifier spellings. Patterns
 *   use gitignore semantics, so a bare name also covers its subpaths (`react-dom/client`,
 *   `next/server`), and the `**` entries catch relative paths around the aliases.
 * - evawave/core-boundary normalizes every specifier to the module it targets, so dot
 *   segments, doubled slashes, dynamic import(), import("…") type queries and
 *   import-equals cannot route around the spelling patterns.
 * tests/unit/import-boundary.test.ts asserts both.
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
    plugins: {
      evawave: { rules: { "core-boundary": createCoreBoundaryRule(repoRoot) } },
    },
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
      "evawave/core-boundary": "error",
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
