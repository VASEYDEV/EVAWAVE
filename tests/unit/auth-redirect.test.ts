import { describe, expect, it } from "vitest";

import { safeNextPath } from "@/lib/auth/redirect";

describe("safeNextPath", () => {
  // Percent-encoded bytes stay inside the path; browsers do not decode them into a host.
  it.each(["/library", "/library?tab=tags", "/", "/%0d%0a"])("keeps the same-site path %s", (path) => {
    expect(safeNextPath(path)).toBe(path);
  });

  it.each([null, undefined, "", "library", "https://evil.example", "//evil.example", "/\\evil.example", "/\\/evil", "/a\\b", "/tab\tname"])("falls back for %s", (next) => {
    expect(safeNextPath(next)).toBe("/library");
  });
});
