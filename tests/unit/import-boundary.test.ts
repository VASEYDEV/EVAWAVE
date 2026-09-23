import { fileURLToPath } from "node:url";

import { ESLint } from "eslint";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * Proves the src/core import boundary (BUILD-BRIEF §2) is live under the real
 * eslint.config.mjs: ESLint is invoked directly (Next.js 16 has no `next lint`), and a
 * deliberate violation must produce a no-restricted-imports error.
 */
const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const CORE_PROBE = "src/core/musicspec/serialize/__boundary-probe__.ts";
const APP_PROBE = "src/app/__boundary-probe__.tsx";

let eslint: ESLint;

beforeAll(() => {
  eslint = new ESLint({ cwd: repoRoot });
});

async function boundaryErrors(code: string, filePath: string) {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).filter((m) => m.ruleId === "no-restricted-imports");
}

describe("src/core import boundary", () => {
  it.each([
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
  ])("rejects an import of %s", async (specifier) => {
    const errors = await boundaryErrors(`import x from "${specifier}";\nexport const probe = x;\n`, CORE_PROBE);
    expect(errors).toHaveLength(1);
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

  it.each(["zod", "./palette", "../ir/types", "@/core/musicspec/ir/types"])(
    "allows a pure import of %s",
    async (specifier) => {
      const errors = await boundaryErrors(`import x from "${specifier}";\nexport const probe = x;\n`, CORE_PROBE);
      expect(errors).toHaveLength(0);
    },
    30_000,
  );

  it("does not restrict the same imports outside src/core", async () => {
    const code = 'import { NextResponse } from "next/server";\nexport const probe = NextResponse;\n';
    expect(await boundaryErrors(code, APP_PROBE)).toHaveLength(0);
  }, 30_000);
});
