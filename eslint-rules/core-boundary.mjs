import path from "node:path";

/**
 * Local ESLint rule enforcing the src/core import boundary (BUILD-BRIEF §2) on the module
 * an import *targets*, not on how its specifier is spelled. no-restricted-imports matches
 * raw spellings, so `@/lib/./supabase/client`, `@/lib//supabase/client` or a dynamic
 * `import()` can reach a forbidden module unseen. This rule normalizes every specifier
 * first, covering static imports, re-exports, `import()`, `import("…")` type queries and
 * `import x = require("…")`.
 */

const FORBIDDEN_PACKAGES = new Set(["react", "react-dom", "next"]);
const FORBIDDEN_SCOPES = ["@supabase/"];
/** Repo-relative directories the pure core must not reach, compared case-insensitively. */
const FORBIDDEN_DIRS = ["src/app", "src/components", "src/lib/supabase"];
/** tsconfig `paths`: "@/*" maps to "./src/*". */
const ALIAS_PREFIX = "@/";
const ALIAS_TARGET = "src/";

function packageName(specifier) {
  const segments = specifier.split("/");
  return specifier.startsWith("@") ? segments.slice(0, 2).join("/") : segments[0];
}

function isForbiddenPackage(specifier) {
  const name = packageName(specifier);
  return FORBIDDEN_PACKAGES.has(name) || FORBIDDEN_SCOPES.some((scope) => name.startsWith(scope));
}

function isForbiddenRepoPath(repoPath) {
  const lower = repoPath.toLowerCase();
  if (lower.startsWith("node_modules/")) {
    return isForbiddenPackage(repoPath.slice("node_modules/".length));
  }
  return FORBIDDEN_DIRS.some((dir) => lower === dir || lower.startsWith(`${dir}/`));
}

/**
 * Returns true when `specifier`, imported from `filename`, targets a forbidden module.
 * Local specifiers (alias, relative, absolute) are normalized to a repo-relative path;
 * anything else is a package.
 */
export function targetsForbiddenModule(specifier, filename, repoRoot) {
  let absolute = null;
  if (specifier.startsWith(ALIAS_PREFIX)) {
    absolute = path.resolve(repoRoot, ALIAS_TARGET, specifier.slice(ALIAS_PREFIX.length));
  } else if (specifier.startsWith(".") || specifier.startsWith("/")) {
    absolute = path.resolve(path.dirname(filename), specifier);
  }
  if (absolute === null) {
    return isForbiddenPackage(path.posix.normalize(specifier));
  }
  const repoPath = path.relative(repoRoot, absolute).split(path.sep).join("/");
  return isForbiddenRepoPath(repoPath);
}

/** Builds the rule for a repo rooted at `repoRoot` (the directory holding tsconfig.json). */
export function createCoreBoundaryRule(repoRoot) {
  return {
    meta: {
      type: "problem",
      docs: { description: "Keep src/core pure: no React, Next.js, Supabase or app-layer targets." },
      schema: [],
      messages: {
        forbidden:
          "src/core is pure TypeScript: '{{specifier}}' reaches React, Next, Supabase or the app layer (BUILD-BRIEF §2, .claude/rules/musicspec-core.md).",
        computed: "Dynamic import() in src/core must use a string-literal specifier so the import boundary can check it.",
      },
    },
    create(context) {
      const filename = context.filename;

      function check(node, specifier) {
        if (targetsForbiddenModule(specifier, filename, repoRoot)) {
          context.report({ node, messageId: "forbidden", data: { specifier } });
        }
      }

      function checkSource(node, source) {
        if (source && source.type === "Literal" && typeof source.value === "string") {
          check(node, source.value);
        }
      }

      return {
        ImportDeclaration: (node) => checkSource(node, node.source),
        ExportNamedDeclaration: (node) => checkSource(node, node.source),
        ExportAllDeclaration: (node) => checkSource(node, node.source),
        ImportExpression(node) {
          const { source } = node;
          // `cooked` is null for a template with an invalid escape; treat it as uncheckable.
          const cooked =
            source.type === "TemplateLiteral" && source.expressions.length === 0 ? source.quasis[0]?.value.cooked : null;
          if (source.type === "Literal" && typeof source.value === "string") {
            check(node, source.value);
          } else if (typeof cooked === "string") {
            check(node, cooked);
          } else {
            context.report({ node, messageId: "computed" });
          }
        },
        TSImportType(node) {
          const literal = node.argument?.literal;
          if (literal && typeof literal.value === "string") {
            check(node, literal.value);
          }
        },
        TSExternalModuleReference: (node) => checkSource(node, node.expression),
      };
    },
  };
}
