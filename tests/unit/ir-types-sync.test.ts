import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * docs/SPEC.md §2.2 is the IR v1 source of truth (ADR 0004). The TypeScript module the code
 * imports is generated from it, and this test fails when the two drift.
 */
describe("IR v1 types", () => {
  it("match the docs/SPEC.md type block", () => {
    const root = fileURLToPath(new URL("../..", import.meta.url));
    const output = execFileSync(process.execPath, ["scripts/sync-ir-types.mjs", "--check"], { cwd: root, encoding: "utf8" });
    expect(output).toContain("matches docs/SPEC.md");
  });
});
