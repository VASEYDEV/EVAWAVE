/**
 * The curated taxonomy banks and lineage names, built into one checked `Catalog`
 * (docs/SPEC.md §2.2). `buildCatalog` throws at import time if ids clash, a reference does
 * not resolve, a rhythm lacks `fourFourSafe`, or a record names an artist or producer.
 */
import { buildCatalog, type CatalogBanks } from "@/core/musicspec/catalog";

import lineageNames from "../lineage/names.json";
import bundles from "./bundles.json";
import drumPatterns from "./drum-patterns.json";
import genres from "./genres.json";
import instruments from "./instruments.json";
import modes from "./modes.json";
import rhythms from "./rhythms.json";
import synthRoles from "./synth-roles.json";
import techniques from "./techniques.json";

/**
 * JSON imports widen string unions to `string`, so the banks are asserted to their record
 * types here. tests/unit/taxonomy.test.ts checks every enum-valued field against the IR types.
 */
export const banks = {
  genres,
  instruments,
  techniques,
  rhythms,
  modes,
  bundles,
  drumPatterns,
  synthRoles,
  lineageNames,
} as unknown as CatalogBanks;

export const catalog = buildCatalog(banks);
