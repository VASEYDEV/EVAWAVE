/**
 * The lineage pass (.claude/rules/musicspec-core.md, rule 4). Artist and producer names never
 * appear in an emitted string. Matching is case-insensitive and whole-word against the
 * curated `Catalog.lineageNames`, so detection is deterministic and auditable.
 */
import { termPattern } from "./text";

/** The names from `names` that occur in `text`, in list order, each at most once. */
export function findNames(text: string, names: readonly string[]): string[] {
  return names.filter((name) => name.trim() !== "" && termPattern(name).test(text));
}

/**
 * Removes every listed name from `text` and tidies the separators left behind, so
 * "saw lead, <name>-style, dark" becomes "saw lead, -style, dark" → "saw lead, dark".
 */
export function scrubNames(text: string, names: readonly string[]): string {
  let out = text;
  for (const name of findNames(text, names)) {
    const pattern = new RegExp(`${termPattern(name).source}(?:[-'’]\\p{L}+)*`, "giu");
    out = out.replace(pattern, "");
  }
  if (out === text) return text;
  return out
    .replace(/[ \t]+([,.;:\]])/g, "$1")
    .replace(/([,;:])(?:\s*[,;:])+/g, "$1")
    .replace(/^[\s,;:]+/gm, "")
    .replace(/([[–])[ \t]*[,;:]+/g, "$1")
    .replace(/\[[ \t]+/g, "[")
    .replace(/[ \t]*–\]/g, "]")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+$/gm, "")
    .replace(/[,;:]+(\s*[\].])/g, "$1");
}
