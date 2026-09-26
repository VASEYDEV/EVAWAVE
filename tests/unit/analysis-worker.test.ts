import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { ANALYSIS_WORKER_URL } from "@/lib/audio/browser";

const root = fileURLToPath(new URL("../..", import.meta.url));

describe("the analysis worker bundle", () => {
  it("matches its source (the generator's --check passes)", () => {
    const out = execFileSync(process.execPath, ["scripts/build-analysis-worker.mjs", "--check"], { cwd: root, encoding: "utf8" });
    expect(out).toContain("matches its source");
  });

  it("is self-contained and served where the import screen starts it", () => {
    const code = readFileSync(`${root}public${ANALYSIS_WORKER_URL}`, "utf8");
    expect(code).not.toMatch(/^\s*import\s/m);
    expect(code).toContain("self.onmessage");
    expect(code).toContain("function analyseAudio(");
  });
});
