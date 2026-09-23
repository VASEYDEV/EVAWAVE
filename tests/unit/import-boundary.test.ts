import { fileURLToPath } from "node:url";

import { ESLint } from "eslint";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * Proves the src/core import boundary (BUILD-BRIEF §2) is live under the real
 * eslint.config.mjs: ESLint is invoked directly (Next.js 16 has no `next lint`), and a
 * deliberate violation must produce a boundary error, whichever import form it uses.
 */
const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const CORE_PROBE = "src/core/musicspec/serialize/__boundary-probe__.ts";
const APP_PROBE = "src/app/__boundary-probe__.tsx";
const BOUNDARY_RULES = new Set([
  "no-restricted-imports",
  "no-restricted-syntax",
  "@typescript-eslint/no-require-imports",
]);

const FORBIDDEN = [
  "react",
  "react/jsx-runtime",
  "react-dom",
  "react-dom/client",
  "next",
  "next/server",
  "next/headers",
  "@supabase/ssr",
  "@supabase/supabase-js",
  "@/components",
  "@/components/composer/LintPanel",
  "@/app",
  "@/app/compose/page",
  "@/lib/supabase",
  "@/lib/supabase/server",
  "../../../app/compose/page",
  "../../../components/composer/LintPanel",
  "../../../lib/supabase/client",
];
const ALLOWED = ["zod", "./palette", "../ir/types", "@/core/musicspec/ir/types"];

let eslint: ESLint;

beforeAll(() => {
  eslint = new ESLint({ cwd: repoRoot });
});

async function boundaryErrors(code: string, filePath: string) {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).filter((m) => m.ruleId !== null && BOUNDARY_RULES.has(m.ruleId));
}

describe("src/core import boundary", () => {
  it.each(FORBIDDEN)("rejects a static import of %s", async (specifier) => {
    const errors = await boundaryErrors(`import x from "${specifier}";\nexport const probe = x;\n`, CORE_PROBE);
    expect(errors).toHaveLength(1);
  }, 30_000);

  it.each(FORBIDDEN)("rejects a dynamic import() of %s", async (specifier) => {
    const errors = await boundaryErrors(`export const load = () => import("${specifier}");\n`, CORE_PROBE);
    expect(errors).toHaveLength(1);
  }, 30_000);

  it.each(["next/server", "@supabase/ssr", "@/lib/supabase/server", "../../../app/compose/page"])(
    "rejects an import() type query of %s",
    async (specifier) => {
      const errors = await boundaryErrors(`export type Probe = import("${specifier}").Probe;\n`, CORE_PROBE);
      expect(errors).toHaveLength(1);
    },
    30_000,
  );

  it("rejects dynamic import() with a computed or template specifier", async () => {
    const code = [
      'const specifier = "react";',
      "export const computed = () => import(specifier);",
      "export const template = () => import(`next/server`);",
      "",
    ].join("\n");
    expect(await boundaryErrors(code, CORE_PROBE)).toHaveLength(2);
  }, 30_000);

  it("rejects require() and import-equals forms", async () => {
    const code = ['import a = require("next");', 'export const b = require("react");', "export { a };", ""].join("\n");
    const rules = (await boundaryErrors(code, CORE_PROBE)).map((m) => m.ruleId);
    expect(rules).toContain("no-restricted-imports");
    expect(rules.filter((r) => r === "@typescript-eslint/no-require-imports")).toHaveLength(2);
  }, 30_000);

  it("rejects type-only imports and re-exports too", async () => {
    const code = [
      'import type { NextRequest } from "next/server";',
      'export * from "react";',
      "export type Probe = NextRequest;",
      "",
    ].join("\n");
    expect(await boundaryErrors(code, CORE_PROBE)).toHaveLength(2);
  }, 30_000);

  it.each(ALLOWED)("allows pure static, dynamic and type-query imports of %s", async (specifier) => {
    const code = [
      `import x from "${specifier}";`,
      "export const probe = x;",
      `export const load = () => import("${specifier}");`,
      `export type Probe = import("${specifier}").Probe;`,
      "",
    ].join("\n");
    expect(await boundaryErrors(code, CORE_PROBE)).toHaveLength(0);
  }, 30_000);

  it("does not restrict the same imports outside src/core", async () => {
    const code = [
      'import { NextResponse } from "next/server";',
      "export const probe = NextResponse;",
      'export const load = () => import("next/headers");',
      "",
    ].join("\n");
    expect(await boundaryErrors(code, APP_PROBE)).toHaveLength(0);
  }, 30_000);
});
