import { fileURLToPath } from "node:url";

import { ESLint, type Linter } from "eslint";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * Proves the src/core import boundary (BUILD-BRIEF §2) is live under the real
 * eslint.config.mjs: ESLint is invoked directly (Next.js 16 has no `next lint`), and a
 * deliberate violation must be reported whichever import form or spelling it uses.
 */
const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const CORE_PROBE = "src/core/musicspec/serialize/__boundary-probe__.ts";
const APP_PROBE = "src/app/__boundary-probe__.tsx";
const TARGET_RULE = "evawave/core-boundary";
const SPELLING_RULE = "no-restricted-imports";
const RUNTIME_RULES = ["no-restricted-globals", "no-restricted-properties", "no-eval", "no-implied-eval", "no-new-func"];
const BOUNDARY_RULES = new Set([TARGET_RULE, SPELLING_RULE, "@typescript-eslint/no-require-imports", ...RUNTIME_RULES]);

/** The brief's list and its relative forms; no-restricted-imports must catch these as spelled. */
const BRIEF_FORBIDDEN = [
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

/** Spellings that normalize to a forbidden target (the probe sits in src/core/musicspec/serialize/). */
const RESPELLED_FORBIDDEN = [
  "@/lib/./supabase/client",
  "@/lib//supabase/client",
  "@//lib/../lib/supabase/client",
  "@///app/page",
  "@/core/../lib/supabase/server",
  "../../musicspec/../../app/page",
  "./../../../components/composer/LintPanel",
  "@/App/page",
  "../../../../node_modules/next/server",
  "next/../next/server",
];

const FORBIDDEN = [...BRIEF_FORBIDDEN, ...RESPELLED_FORBIDDEN];

const ALLOWED = [
  "zod",
  "./palette",
  "../ir/types",
  "@/core/musicspec/ir/types",
  "../../musicspec/./ir/types",
  "@/lib/supabase-types",
];

let eslint: ESLint;

beforeAll(() => {
  eslint = new ESLint({ cwd: repoRoot });
});

async function boundaryMessages(code: string, filePath = CORE_PROBE): Promise<Linter.LintMessage[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).filter((m) => m.ruleId !== null && BOUNDARY_RULES.has(m.ruleId));
}

async function rulesFor(code: string, filePath = CORE_PROBE) {
  return (await boundaryMessages(code, filePath)).map((m) => m.ruleId);
}

describe("src/core import boundary", () => {
  it.each(FORBIDDEN)("rejects a static import of %s", async (specifier) => {
    const rules = await rulesFor(`import x from "${specifier}";\nexport const probe = x;\n`);
    expect(rules).toContain(TARGET_RULE);
  }, 30_000);

  it.each(FORBIDDEN)("rejects a dynamic import() of %s", async (specifier) => {
    const rules = await rulesFor(`export const load = () => import("${specifier}");\n`);
    expect(rules).toEqual([TARGET_RULE]);
  }, 30_000);

  it.each(FORBIDDEN)("rejects an import() type query of %s", async (specifier) => {
    const rules = await rulesFor(`export type Probe = import("${specifier}").Probe;\n`);
    expect(rules).toEqual([TARGET_RULE]);
  }, 30_000);

  it.each(BRIEF_FORBIDDEN)("keeps the brief's no-restricted-imports rule live for %s", async (specifier) => {
    const rules = await rulesFor(`import x from "${specifier}";\nexport const probe = x;\n`);
    expect(rules).toContain(SPELLING_RULE);
  }, 30_000);

  it("rejects template and computed import() specifiers", async () => {
    const code = [
      "export const template = () => import(`@/lib/./supabase/client`);",
      'const specifier = "react";',
      "export const computed = () => import(specifier);",
      "export const interpolated = () => import(`${specifier}/jsx-runtime`);",
      "",
    ].join("\n");
    const messages = await boundaryMessages(code);
    expect(messages.map((m) => m.ruleId)).toEqual([TARGET_RULE, TARGET_RULE, TARGET_RULE]);
    expect(messages.map((m) => m.messageId)).toEqual(["forbidden", "computed", "computed"]);
  }, 30_000);

  it("rejects re-exports, type-only imports, import-equals and require()", async () => {
    const code = [
      'export * from "@/lib/./supabase/server";',
      'export { NextResponse } from "next/server";',
      'import type { SupabaseClient } from "@supabase/supabase-js";',
      'import eq = require("next");',
      'export const req = require("react");',
      "export type Probe = SupabaseClient;",
      "export { eq };",
      "",
    ].join("\n");
    const rules = await rulesFor(code);
    expect(rules.filter((r) => r === TARGET_RULE)).toHaveLength(4);
    expect(rules.filter((r) => r === "@typescript-eslint/no-require-imports")).toHaveLength(2);
  }, 30_000);

  it.each(ALLOWED)("allows pure static, dynamic and type-query imports of %s", async (specifier) => {
    const code = [
      `import x from "${specifier}";`,
      "export const probe = x;",
      `export const load = () => import("${specifier}");`,
      `export type Probe = import("${specifier}").Probe;`,
      "",
    ].join("\n");
    expect(await rulesFor(code)).toEqual([]);
  }, 30_000);

  describe("implicit dependencies (no import statement)", () => {
    const CORE_TSX_PROBE = "src/core/musicspec/serialize/__boundary-probe__.tsx";

    it.each([
      ["an element", "export const probe = <div><span /></div>;\n"],
      ["a fragment", "export const probe = <><span /></>;\n"],
    ])("rejects JSX as %s, reported once at the outermost node", async (_kind, code) => {
      const messages = await boundaryMessages(code, CORE_TSX_PROBE);
      expect(messages.map((m) => [m.ruleId, m.messageId])).toEqual([[TARGET_RULE, "jsx"]]);
    }, 30_000);

    it.each([
      '/// <reference types="node" />',
      '/// <reference types="next" />',
      '/// <reference types="@supabase/ssr" />',
      '/// <reference types="react-dom/client" />',
      '/// <reference path="../../../app/types.d.ts" />',
      '/// <reference path="../../../lib/./supabase/types.d.ts" />',
    ])("rejects the directive %s", async (directive) => {
      const rules = await rulesFor(`${directive}\nexport const probe = 1;\n`);
      expect(rules).toEqual([TARGET_RULE]);
    }, 30_000);

    it.each(['declare module "next/server" {\n  interface NextRequest { probe: true }\n}', 'declare module "@/app/./layout" {}'])(
      "rejects the module augmentation %s",
      async (augmentation) => {
        const rules = await rulesFor(`${augmentation}\nexport const probe = 1;\n`);
        expect(rules).toEqual([TARGET_RULE]);
      },
      30_000,
    );

    it("allows pure directives, wildcard module declarations, and JSX outside src/core", async () => {
      const pure = [
        '/// <reference lib="es2022" />',
        'declare module "*.svg" {\n  const src: string;\n  export default src;\n}',
        "export const probe = 1;",
        "",
      ].join("\n");
      expect(await rulesFor(pure)).toEqual([]);
      expect(await rulesFor("export const Probe = () => <div />;\n", "src/app/__boundary-probe__.tsx")).toEqual([]);
    }, 30_000);
  });

  describe("runtime module loading and process access", () => {
    it.each(["node:module", "module", "fs", "node:fs/promises", "path"])(
      "rejects the Node built-in %s in every import form",
      async (specifier) => {
        const code = [
          `import x from "${specifier}";`,
          "export const probe = x;",
          `export const load = () => import("${specifier}");`,
          `export type Probe = import("${specifier}").Probe;`,
          "",
        ].join("\n");
        const messages = await boundaryMessages(code);
        expect(messages.filter((m) => m.ruleId === TARGET_RULE).map((m) => m.messageId)).toEqual([
          "builtin",
          "builtin",
          "builtin",
        ]);
      },
      30_000,
    );

    it("rejects the createRequire loader route", async () => {
      const code = [
        'import { createRequire } from "node:module";',
        'export const loaded = createRequire(import.meta.url)("next/server");',
        "",
      ].join("\n");
      const messages = await boundaryMessages(code);
      expect(messages.map((m) => [m.ruleId, m.messageId])).toContainEqual([TARGET_RULE, "builtin"]);
    }, 30_000);

    it.each([
      ["a bare require reference", "export const r = require;", "no-restricted-globals"],
      ["process", "export const env = process.env.PROBE;", "no-restricted-globals"],
      ["module", "export const m = module;", "no-restricted-globals"],
      ["globalThis.require", 'export const g = globalThis.require("next");', "no-restricted-properties"],
      ["globalThis.process", "export const p = globalThis.process;", "no-restricted-properties"],
      ["eval", 'export const e = eval("1");', "no-eval"],
      ["new Function", 'export const f = new Function("return 1");', "no-new-func"],
    ])("rejects %s", async (_case, code, rule) => {
      expect(await rulesFor(`${code}\n`)).toContain(rule);
    }, 30_000);

    it("leaves process and Node built-ins alone outside src/core", async () => {
      const code = [
        'import path from "node:path";',
        "export const probe = [path.sep, process.env.PROBE];",
        "",
      ].join("\n");
      expect(await rulesFor(code, "src/app/__boundary-probe__.tsx")).toEqual([]);
    }, 30_000);
  });

  it("does not restrict the same imports outside src/core", async () => {
    const code = [
      'import { NextResponse } from "next/server";',
      "export const probe = NextResponse;",
      'export const load = () => import("@/lib/./supabase/server");',
      "",
    ].join("\n");
    expect(await rulesFor(code, APP_PROBE)).toEqual([]);
  }, 30_000);
});
