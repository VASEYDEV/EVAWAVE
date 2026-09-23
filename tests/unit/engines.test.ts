import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import semver from "semver";
import { describe, expect, it } from "vitest";

/**
 * `engines.node` must advertise exactly the Node versions the lockfile can install. With
 * `engine-strict` (.npmrc), `npm ci` refuses any version outside a non-optional
 * dependency's own `engines` range. So a version the root range admits but a dependency
 * rejects is a broken promise (Vitest 5 rejects 23 and 25), and the reverse is an
 * understated range.
 */
function readJson<T>(relative: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), "utf8")) as T;
}

interface LockPackage {
  optional?: boolean;
  engines?: { node?: string } | string[];
}

const pkg = readJson<{ engines: { node: string } }>("package.json");
const lock = readJson<{ packages: Record<string, LockPackage> }>("package-lock.json");

const dependencyRanges = Object.entries(lock.packages)
  .filter(([path, meta]) => path !== "" && !meta.optional)
  .flatMap(([path, meta]) => {
    const range = !Array.isArray(meta.engines) ? meta.engines?.node : undefined;
    return typeof range === "string" ? [{ path, range }] : [];
  });

const SAMPLES = Array.from({ length: 13 }, (_, i) => 18 + i).flatMap((major) =>
  [0, 12, 13, 20].map((minor) => `${major}.${minor}.0`),
);

describe("package.json engines.node", () => {
  it("has non-optional dependency ranges to compare against", () => {
    expect(dependencyRanges.length).toBeGreaterThan(10);
  });

  it.each(SAMPLES)("admits %s exactly when every non-optional dependency does", (version) => {
    const rejectedBy = dependencyRanges.filter(({ range }) => !semver.satisfies(version, range));
    const installable = rejectedBy.length === 0;
    expect({ version, advertised: semver.satisfies(version, pkg.engines.node) }).toEqual({
      version,
      advertised: installable,
    });
  });
});
