/**
 * LN-1: an artist or producer name in the spec's prose, passthrough lyrics, a patch value, a
 * target override or a compiled payload. Serializers scrub names from every field, so a hit
 * on passthrough lyrics is how the user learns their text was changed.
 */
import { findNames } from "../../lineage";
import { payloadTexts, proseEntries, result, type LintRule } from "../context";

/** Every string inside a patch op value, with its JSON pointer. */
function valueStrings(value: unknown, path: string, out: [string, string][] = []): [string, string][] {
  if (typeof value === "string") out.push([path, value]);
  else if (Array.isArray(value)) value.forEach((item, i) => valueStrings(item, `${path}/${i}`, out));
  else if (typeof value === "object" && value !== null) Object.entries(value).forEach(([key, item]) => valueStrings(item, `${path}/${key}`, out));
  return out;
}

export const LN1: LintRule = {
  id: "LN-1",
  check(ctx) {
    const names = ctx.catalog.lineageNames;
    const specHits = proseEntries(ctx).flatMap((entry) =>
      findNames(entry.text, names).map(() => result("LN-1", "block", entry.path, "names an artist or producer; describe the sound instead")),
    );
    const patchHits = ctx.spec.patches.flatMap((patch, i) =>
      patch.ops.flatMap((op, j) =>
        valueStrings(op.value, `/patches/${i}/ops/${j}/value`).flatMap(([path, text]) =>
          findNames(text, names).map(() => result("LN-1", "block", path, "patch value names an artist or producer")),
        ),
      ),
    );
    const lyrics = ctx.spec.D8.lyricsPassthrough ?? "";
    const lyricHits = findNames(lyrics, names).map(() => result("LN-1", "block", "/D8/lyricsPassthrough", "lyrics name an artist or producer; the compile removes the name"));
    const overrideHits = (ctx.overrides ?? []).flatMap((override, i) =>
      findNames(override.text, names).map(() => result("LN-1", "block", `overrides/${i}`, "override names an artist or producer", { engine: override.engine })),
    );
    const payloadHits = payloadTexts(ctx.payload).flatMap(([field, text]) =>
      findNames(text, names).map(() => result("LN-1", "block", `${ctx.profile.id}.${field}`, "compiled payload names an artist or producer", { engine: ctx.profile.id })),
    );
    return [...specHits, ...lyricHits, ...patchHits, ...overrideHits, ...payloadHits];
  },
};
