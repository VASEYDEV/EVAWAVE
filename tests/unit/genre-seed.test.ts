import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/** The curated genres reach Supabase through a generated migration that must match genres.json. */
describe("genre seed migration", () => {
  it("matches src/data/taxonomy/genres.json", () => {
    const root = fileURLToPath(new URL("../..", import.meta.url));
    const out = execFileSync(process.execPath, ["scripts/build-genre-seed.mjs", "--check"], { cwd: root, encoding: "utf8" });
    expect(out).toContain("genre seed matches genres.json");
  });
});
