/**
 * Builds and checks the taxonomy `Catalog` that compile and lint read (docs/SPEC.md §2.2).
 * The banks are curated data (.claude/rules/musicspec-core.md, rule 8): ids are kebab-case
 * and unique across banks, every cross-reference resolves, every rhythm carries
 * `fourFourSafe`, and no record names an artist or producer.
 */
import type { Catalog, DrumPattern, Genre, Instrument, Mode, RegionalBundle, Rhythm, SynthRole, Technique } from "./ir/types";
import { findNames } from "./lineage";

export interface CatalogBanks {
  genres: Genre[];
  instruments: Instrument[];
  techniques: Technique[];
  rhythms: Rhythm[];
  modes: Mode[];
  bundles: RegionalBundle[];
  drumPatterns: DrumPattern[];
  synthRoles: SynthRole[];
  lineageNames: string[];
}

/** Thrown with every problem found, one per line. */
export class CatalogError extends Error {
  override name = "CatalogError";
  constructor(readonly problems: string[]) {
    super(`catalog has ${problems.length} problem(s):\n${problems.join("\n")}`);
  }
}

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function index<T extends { id: string }>(records: readonly T[]): Record<string, T> {
  return Object.fromEntries(records.map((record) => [record.id, record]));
}

/** Every string anywhere inside a record, for the lineage check. */
function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => strings(item, out));
  else if (typeof value === "object" && value !== null) Object.values(value).forEach((item) => strings(item, out));
  return out;
}

export function buildCatalog(banks: CatalogBanks): Catalog {
  const problems: string[] = [];
  const bankEntries = Object.entries(banks).filter(([name]) => name !== "lineageNames") as [string, { id: string }[]][];

  const seen = new Map<string, string>();
  for (const [bank, records] of bankEntries) {
    for (const record of records) {
      if (!KEBAB.test(record.id)) problems.push(`${bank}/${record.id}: id is not kebab-case`);
      const previous = seen.get(record.id);
      if (previous) problems.push(`${bank}/${record.id}: id already used in ${previous}`);
      else seen.set(record.id, bank);
    }
  }

  const catalog: Catalog = {
    genres: index(banks.genres),
    instruments: index(banks.instruments),
    techniques: index(banks.techniques),
    rhythms: index(banks.rhythms),
    modes: index(banks.modes),
    bundles: index(banks.bundles),
    drumPatterns: index(banks.drumPatterns),
    synthRoles: index(banks.synthRoles),
    lineageNames: [...banks.lineageNames],
  };

  const expect = (where: string, ids: readonly string[], bank: keyof Omit<Catalog, "lineageNames">) => {
    for (const id of ids) if (!catalog[bank][id]) problems.push(`${where}: ${bank} id '${id}' does not resolve`);
  };

  for (const rhythm of banks.rhythms) {
    if (typeof rhythm.fourFourSafe !== "boolean") problems.push(`rhythms/${rhythm.id}: fourFourSafe must be a boolean`);
  }
  for (const instrument of banks.instruments) {
    expect(`instruments/${instrument.id}`, instrument.bundleIds, "bundles");
    expect(`instruments/${instrument.id}`, instrument.articulationIds, "techniques");
  }
  for (const bundle of banks.bundles) {
    const where = `bundles/${bundle.id}`;
    expect(where, bundle.instrumentIds, "instruments");
    expect(where, bundle.rhythmIds, "rhythms");
    expect(where, bundle.modeIds, "modes");
    expect(where, bundle.techniqueIds, "techniques");
    expect(where, [bundle.anchorInstrumentId], "instruments");
  }
  for (const pattern of banks.drumPatterns) {
    const where = `drumPatterns/${pattern.id}`;
    if (pattern.genreId) expect(where, [pattern.genreId], "genres");
    expect(where, pattern.regional.map((r) => r.rhythmId), "rhythms");
    expect(where, pattern.regional.map((r) => r.instrumentId), "instruments");
  }
  for (const genre of banks.genres) {
    const where = `genres/${genre.id}`;
    if (genre.parentId) expect(where, [genre.parentId], "genres");
    expect(where, genre.criteria.drumPatternIds, "drumPatterns");
    expect(where, genre.criteria.coreInstrumentIds, "instruments");
    expect(where, genre.criteria.theoryDefaults.modeIds, "modes");
  }

  for (const [bank, records] of bankEntries) {
    for (const record of records) {
      const hits = findNames(strings(record).join("\n"), banks.lineageNames);
      if (hits.length) problems.push(`${bank}/${record.id}: names an artist or producer (${hits.length} hit(s))`);
    }
  }

  if (problems.length) throw new CatalogError(problems);
  return catalog;
}
