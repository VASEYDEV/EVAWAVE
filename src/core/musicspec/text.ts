/**
 * Small, deterministic text helpers shared by the serializers and the linter.
 */

/** Upper-cases the first character only. */
export function capitalize(text: string): string {
  return text.length === 0 ? text : text.charAt(0).toUpperCase() + text.slice(1);
}

/** "a", "a and b", "a, b and c". */
export function joinAnd(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** Stable sort of weighted entries: higher weight first, ties keep their original order. */
export function byWeight<T extends { weight: number }>(items: readonly T[]): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => b.item.weight - a.item.weight || a.index - b.index)
    .map(({ item }) => item);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * A case-insensitive matcher for `term` as a whole word or phrase: it never matches inside a
 * longer word, so "swing" does not match "swingy" and "808" does not match "8080".
 */
export function termPattern(term: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(term)}(?![\\p{L}\\p{N}])`, "iu");
}

/** True when `text` contains `term` as a whole word or phrase, ignoring case. */
export function containsTerm(text: string, term: string): boolean {
  return termPattern(term).test(text);
}

/**
 * cyrb53: a fast, deterministic 53-bit string hash, returned as 14 hex digits. Used for
 * `CompiledPayload.hash`, where the core may not import Node built-ins.
 */
export function hash53(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const value = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return value.toString(16).padStart(14, "0");
}
