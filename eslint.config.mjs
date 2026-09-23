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

/**
 * no-restricted-imports only sees static import/export declarations, so `import("next")`
 * and `import("next").X` type queries need their own selectors. This regex matches the
 * same set as the patterns above. esquery selector regexes cannot contain "/" or "\", so
 * SEP (any character that cannot appear inside a specifier segment) stands in for "/".
 */
const SEP = "[^a-zA-Z0-9._~@-]";
const CORE_FORBIDDEN_SPECIFIER = [
  `^(react|react-dom|next)(${SEP}|$)`,
  `^@supabase${SEP}`,
  `(^|${SEP})(app|components)(${SEP}|$)`,
  `(^|${SEP})lib${SEP}supabase(${SEP}|$)`,
].join("|");
const CORE_BOUNDARY_MESSAGE =
  "src/core is pure TypeScript: no React, Next, Supabase or app-layer imports (BUILD-BRIEF §2, .claude/rules/musicspec-core.md).";

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
              message: CORE_BOUNDARY_MESSAGE,
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: `ImportExpression[source.type='Literal'][source.value=/${CORE_FORBIDDEN_SPECIFIER}/]`,
          message: CORE_BOUNDARY_MESSAGE,
        },
        {
          // A computed or template specifier cannot be checked against the boundary.
          selector: "ImportExpression[source.type!='Literal']",
          message: "Dynamic import() in src/core must use a string-literal specifier so the import boundary can check it.",
        },
        {
          selector: `TSImportType[argument.literal.value=/${CORE_FORBIDDEN_SPECIFIER}/]`,
          message: CORE_BOUNDARY_MESSAGE,
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
