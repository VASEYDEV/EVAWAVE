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
import drumMachines from "./instruments/drum-machines.json";
import gmPercussion from "./instruments/gm-percussion.json";
import gmPrograms from "./instruments/gm-programs.json";
import world from "./instruments/world.json";
import curatedInstruments from "./instruments.json";
import modes from "./modes.json";
import rhythms from "./rhythms.json";
import synthRoles from "./synth-roles.json";
import techniques from "./techniques.json";

/**
 * The instrument bank: the curated records first, then the records generated from the seed
 * (docs/evawave/instrument-bank-seed-v0.1.md) by scripts/build-instrument-bank.mjs, which
 * merges any seed item the curated set already covers.
 */
const instruments = [...curatedInstruments, ...gmPrograms, ...gmPercussion, ...drumMachines, ...world];

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
