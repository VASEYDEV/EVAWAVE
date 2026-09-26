import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Catalog, MusicSpec } from "@/core/musicspec/ir/types";
import { LibraryError } from "@/lib/library/repository";
import type { Database, SongRow, VariantRow } from "@/lib/library/schema";
import { variantCoverage } from "@/core/musicspec/variants";
import { hasUnsavedWork, openedCopy, workingHash } from "@/lib/composer/storage";
import { clampText, coverageScores, createSong, deleteSong, deleteTake, describeChange, freezeVariant, listSongs, loadSong, logTake, renderLink, saveSong, shortValue, songAttachment, songTitle, toSong, wordsBlamed, type TakeInput, type WorkingCopy } from "@/lib/library/songs";
import { catalog } from "@/data/taxonomy";

/**
 * The songs repository against a recorded PostgREST (docs/SPEC.md §3 S6): what each call
 * sends, and how it reads the answers RLS and the revision check give. Names seeded for
 * LN-1 are invented, never real.
 */
const fixture = (name: string) => JSON.parse(readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)), "utf8")) as MusicSpec;
const v11 = fixture("jinn-v1.1.spec.json");
const v12 = fixture("jinn-v1.2.spec.json");

interface Sent {
  method: string;
  path: string;
  query: URLSearchParams;
  body: unknown;
}

/**
 * A client whose PostgREST answers each request with `answer(request)`, recording them all.
 * An array answer to a limited request is served as PostgREST serves a table (rows given in
 * key order): `key=gt.value` cursors applied, cut at the limit and at `maxRows`, with the
 * rows matched in `content-range` unless `count` is off.
 */
function recording(answer: (sent: Sent) => unknown, { maxRows = 1000, count = true }: { maxRows?: number; count?: boolean } = {}) {
  const sent: Sent[] = [];
  const client = createClient<Database>("https://project.supabase.test", "anon-key-for-tests", {
    global: {
      fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input));
        const request: Sent = { method: init?.method ?? "GET", path: url.pathname, query: url.searchParams, body: init?.body ? JSON.parse(String(init.body)) : undefined };
        sent.push(request);
        let body = answer(request);
        const headers: Record<string, string> = { "content-type": "application/json" };
        if (Array.isArray(body) && url.searchParams.has("limit")) {
          let matched = body as Record<string, unknown>[];
          for (const [field, filter] of url.searchParams) {
            if (!filter.startsWith("gt.")) continue;
            const bound = filter.slice(3);
            matched = matched.filter((row) => (typeof row[field] === "number" ? Number(row[field]) > Number(bound) : String(row[field]) > bound));
          }
          const rows = matched.slice(0, Math.min(Number(url.searchParams.get("limit")), maxRows));
          if (count) headers["content-range"] = `${rows.length ? `0-${rows.length - 1}` : "*"}/${matched.length}`;
          body = rows;
        }
        return new Response(JSON.stringify(body), { status: 200, headers });
      }) as typeof fetch,
    },
    auth: { persistSession: false },
  });
  return { client, sent };
}

const copy = (over: Partial<WorkingCopy> = {}): WorkingCopy => ({ songId: "song-1", revision: 3, spec: v12, baseVariantId: null, ...over });

describe("songTitle", () => {
  it("takes the spec's title, cut to 200 code points, or Untitled", () => {
    const titled = (title: string) => ({ ...v12, D10: { ...v12.D10, title } });
    expect(songTitle(titled("  Jinn  "))).toBe("Jinn");
    expect(songTitle(titled("   "))).toBe("Untitled");
    const long = songTitle(titled("🎵".repeat(250)));
    expect(Array.from(long)).toHaveLength(200);
    expect(long.isWellFormed()).toBe(true);
  });
});

describe("toSong", () => {
  it("reads the active target from the spec and keeps the revision beside the record", () => {
    const row: SongRow = { id: "s", owner_id: "o", title: "Jinn", brand: "VASEY.AUDIO", spec: v12, overrides: [], base_variant_id: null, revision: 4, created_at: "c", updated_at: "u" };
    const stored = toSong(row);
    expect(stored.revision).toBe(4);
    expect(stored.song).toMatchObject({ activeTarget: v12.D10.activeTarget, brand: "VASEY.AUDIO", styleProfileIds: [], tags: [] });
    expect("baseVariantId" in stored.song).toBe(false);
  });
});

describe("createSong and saveSong", () => {
  it("creates with a title from the spec and no owner, which the database fills in", async () => {
    const row = { id: "song-1", owner_id: "o", title: "x", brand: "VASEY.AUDIO", spec: v12, overrides: [], base_variant_id: null, revision: 0, created_at: "c", updated_at: "u" };
    const { client, sent } = recording(() => row);
    await createSong(client, v12);
    expect(sent[0]).toMatchObject({ method: "POST", path: "/rest/v1/songs" });
    expect(sent[0]?.body).toEqual({ title: songTitle(v12), spec: v12 });
  });

  it("saves only at the revision it read, and reads zero rows as a stale or deleted song", async () => {
    const { client, sent } = recording(() => [{ revision: 4 }]);
    await expect(saveSong(client, copy({ baseVariantId: "v-2" }))).resolves.toBe(4);
    expect(sent[0]?.method).toBe("PATCH");
    expect(sent[0]?.query.get("id")).toBe("eq.song-1");
    expect(sent[0]?.query.get("revision")).toBe("eq.3");
    // The spec, its title and its base: never the overrides, which the client may not write.
    expect(sent[0]?.body).toEqual({ title: songTitle(v12), spec: v12, base_variant_id: "v-2" });

    const stale = recording(() => []);
    await expect(saveSong(stale.client, copy())).rejects.toBeInstanceOf(LibraryError);
    await expect(saveSong(stale.client, copy())).rejects.toThrow("changed elsewhere or was deleted");
  });
});

describe("freezeVariant", () => {
  const frozen = { variant_id: "v-new", variant_label: "v1.1", song_revision: 4, owner: "o" };

  it("sends only the spec, its title and a first variant's parent as null: nothing derived, no overrides", async () => {
    const { client, sent } = recording(() => frozen);
    await expect(freezeVariant(client, copy(), catalog)).resolves.toEqual({ variantId: "v-new", label: "v1.1", revision: 4, ownerId: "o" });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.path).toBe("/rest/v1/rpc/freeze_variant");
    expect(sent[0]?.body).toEqual({ p_song_id: "song-1", p_expected_revision: 3, p_title: songTitle(v12), p_spec: v12, p_parent_variant_id: null });
  });

  it("sends the base variant as the parent, in one request", async () => {
    const { client, sent } = recording(() => frozen);
    await freezeVariant(client, copy({ baseVariantId: "v-base" }), catalog);
    expect(sent.map((s) => s.path)).toEqual(["/rest/v1/rpc/freeze_variant"]);
    expect(sent[0]?.body).toHaveProperty("p_parent_variant_id", "v-base");
  });

  it("refuses to freeze an invented producer name, and sends nothing", async () => {
    const INVENTED = "Quillon Vantreese";
    const withName: Catalog = { ...catalog, lineageNames: [...catalog.lineageNames, INVENTED] };
    const named = { ...v12, D1: { ...v12.D1, formPhrase: `${v12.D1.formPhrase} after ${INVENTED}` } };
    const { client, sent } = recording(() => frozen);
    await expect(freezeVariant(client, copy({ spec: named }), withName)).rejects.toThrow(/LN-1 at \/D1\/formPhrase/);
    expect(sent).toEqual([]);
  });
});

describe("loadSong", () => {
  const song: SongRow = { id: "s", owner_id: "o", title: "Jinn", brand: "VASEY.AUDIO", spec: v12, overrides: [], base_variant_id: "v-1", revision: 2, created_at: "c", updated_at: "u" };
  const row = (id: string, seq: number, parent: string | null, spec: MusicSpec): VariantRow => ({ id, owner_id: "o", song_id: "s", seq, label: `v1.${seq - 1}`, parent_variant_id: parent, spec_snapshot: spec, overrides: [], created_at: "c" });

  it("derives each diff from the parent's snapshot: the Jinn fork v1.0 → v1.1 shows BPM 142 → 140", async () => {
    const rows = [row("v-0", 1, null, v11), row("v-1", 2, "v-0", v12), row("v-2", 3, "v-0", v11)];
    const { client } = recording((r) => (r.path === "/rest/v1/songs" ? song : r.path === "/rest/v1/variants" ? rows : []));
    const { variants } = await loadSong(client, "s", catalog);
    expect(variants[0]?.diff).toEqual([]);
    expect(variants[1]?.diff).toContainEqual({ path: "/D6/tempo/bpm", before: 142, after: 140 });
    // A second fork from v1.0 is diffed against v1.0, not against the variant before it.
    expect(variants[2]?.diff).toEqual([]);
    expect(variants.map((v) => v.parentVariantId)).toEqual([undefined, "v-0", "v-0"]);
  });

  it("reads every variant past the server's row limit, so a base variant on a later page is found", async () => {
    const rows = Array.from({ length: 5 }, (_, i) => row(`v-${i}`, i + 1, i ? `v-${i - 1}` : null, i % 2 ? v12 : v11));
    const last = { ...song, base_variant_id: "v-4" };
    for (const count of [true, false]) {
      const { client, sent } = recording((r) => (r.path === "/rest/v1/songs" ? last : r.path === "/rest/v1/variants" ? rows : []), { maxRows: 2, count });
      const loaded = await loadSong(client, "s", catalog);
      expect(loaded.variants.map((v) => v.label)).toEqual(["v1.0", "v1.1", "v1.2", "v1.3", "v1.4"]);
      // Each page after the last key read; with the count it stops at the last row, without
      // it at the first empty page.
      const cursors = sent.filter((r) => r.path === "/rest/v1/variants").map((r) => r.query.get("seq"));
      expect(cursors).toEqual(count ? [null, "gt.2", "gt.4"] : [null, "gt.2", "gt.4", "gt.5"]);
      const base = loaded.variants.find((v) => v.id === loaded.song.baseVariantId) ?? null;
      expect(songAttachment(loaded, loaded.variants, base)).toMatchObject({ baseVariantId: "v-4", baseLabel: "v1.4" });
    }
  });

  it("reads takes for 100 variants per request, every page, newest first", async () => {
    const rows = Array.from({ length: 150 }, (_, i) => row(`v-${String(i).padStart(3, "0")}`, i + 1, null, v12));
    const takes = rows.map((v, i) => ({ id: `t-${String(i).padStart(3, "0")}`, owner_id: "o", variant_id: v.id, engine: "suno", engine_version: "v6", render_ref: null, verdict: "keep", drifted: [], words_blamed: [], notes: "", created_at: new Date(Date.UTC(2026, 8, 26, 0, i)).toISOString() }));
    const { client, sent } = recording(
      (r) => {
        if (r.path === "/rest/v1/songs") return { ...song, base_variant_id: "v-149" };
        if (r.path === "/rest/v1/variants") return rows;
        const ids = (r.query.get("variant_id") ?? "").replace(/^in\.\(|\)$/g, "").split(",");
        return takes.filter((t) => ids.includes(t.variant_id));
      },
      { maxRows: 40 },
    );
    const loaded = await loadSong(client, "s", catalog);
    const requests = sent.filter((r) => r.path === "/rest/v1/takes");
    const idsPerBatch = [...new Set(requests.map((r) => r.query.get("variant_id")))].map((list) => (list ?? "").split(",").length);
    expect(idsPerBatch).toEqual([100, 50]);
    expect(loaded.takes).toHaveLength(150);
    expect(loaded.takes[0]?.id).toBe("t-149");
    expect(loaded.takes.at(-1)?.id).toBe("t-000");
  });

  it("reads the song before its variants, and refuses a base the variants it read do not hold", async () => {
    const rows = [row("v-0", 1, null, v11)];
    const { client, sent } = recording((r) => (r.path === "/rest/v1/songs" ? song : r.path === "/rest/v1/variants" ? rows : []));
    // The song names v-1, frozen after the variants were read: never a copy with no base.
    await expect(loadSong(client, "s", catalog)).rejects.toThrow("the song changed while it loaded; reload it");
    expect(sent.map((r) => r.path)).toEqual(["/rest/v1/songs", "/rest/v1/variants"]);
  });

  it("derives each variant's coverage from its own snapshot", async () => {
    const rows = [row("v-0", 1, null, v11), row("v-1", 2, "v-0", v12)];
    const { client } = recording((r) => (r.path === "/rest/v1/songs" ? song : r.path === "/rest/v1/variants" ? rows : []));
    const { variants } = await loadSong(client, "s", catalog);
    expect(variants[0]?.coverage).toEqual(variantCoverage(v11, catalog));
    expect(variants[1]?.coverage).toEqual(variantCoverage(v12, catalog));
    expect(Object.keys(variants[1]?.coverage ?? {}).sort()).toEqual(["eleven", "flow", "suno"]);
  });
});

describe("listSongs", () => {
  it("lists every song past the server's row limit, most recently saved first, with every variant counted", async () => {
    const songs = ["a", "b", "c"].map((id, i) => ({ id, owner_id: "o", title: id.toUpperCase(), revision: 0, updated_at: `2026-09-26T1${i}:00:00+00:00` }));
    const variants = ["a", "c", "c", "c", "a"].map((song_id, i) => ({ id: `v-${i}`, song_id }));
    const { client, sent } = recording((r) => (r.path === "/rest/v1/songs" ? songs : variants), { maxRows: 2 });
    const listed = await listSongs(client);
    // Every song page is read before any variant, so a count never predates its revision.
    const paths = sent.map((r) => r.path);
    expect(paths.lastIndexOf("/rest/v1/songs")).toBeLessThan(paths.indexOf("/rest/v1/variants"));
    expect(listed.map((s) => [s.id, s.variantCount])).toEqual([
      ["c", 3],
      ["b", 0],
      ["a", 2],
    ]);
  });
});

describe("paging by key", () => {
  const summary = (id: string) => ({ id, owner_id: "o", title: id, revision: 0, updated_at: "2026-09-26T10:00:00+00:00" });

  it("neither repeats nor skips a song when another tab deletes or adds one between pages", async () => {
    // After the first page (s1, s2): s1 is deleted, which would shift an offset past s3; or
    // s0 is added, which would shift one back onto s2.
    for (const change of [(ids: string[]) => ids.filter((id) => id !== "s1"), (ids: string[]) => ["s0", ...ids]]) {
      let ids = ["s1", "s2", "s3", "s4", "s5"];
      let songPages = 0;
      const { client } = recording(
        (r) => {
          if (r.path !== "/rest/v1/songs") return [];
          const now = ids.map(summary);
          if (++songPages === 1) ids = change(ids);
          return now;
        },
        { maxRows: 2 },
      );
      const listed = (await listSongs(client)).map((s) => s.id);
      expect(new Set(listed).size).toBe(listed.length);
      expect(listed).toEqual(expect.arrayContaining(["s2", "s3", "s4", "s5"]));
    }
  });
});

describe("deleteSong and coverageScores", () => {
  it("deletes only at the listed revision, and rejects a delete that removed no row", async () => {
    const { client, sent } = recording(() => [{ id: "s" }]);
    await expect(deleteSong(client, "s", 4)).resolves.toBeUndefined();
    expect(sent[0]?.method).toBe("DELETE");
    expect(sent[0]?.query.get("id")).toBe("eq.s");
    expect(sent[0]?.query.get("revision")).toBe("eq.4");
    // Saved or frozen since the list loaded, or gone: nothing removed, and it says so.
    await expect(deleteSong(recording(() => []).client, "s", 4)).rejects.toThrow("changed since the list loaded");
  });

  it("lists scores in build order whatever order the reports come in", () => {
    const report = (score: number) => ({ engine: "suno" as const, items: [], score });
    expect(coverageScores({ coverage: { flow: report(0.5), suno: report(0.9), eleven: report(0.7) } })).toEqual([
      { engine: "suno", score: 0.9 },
      { engine: "eleven", score: 0.7 },
      { engine: "flow", score: 0.5 },
    ]);
  });
});

describe("describeChange and shortValue", () => {
  it("says added, removed or before → after", () => {
    expect(describeChange({ path: "/D6/tempo/bpm", before: 142, after: 140 })).toBe("142 → 140");
    expect(describeChange({ path: "/D2/moods/2", after: "dread" })).toBe('added "dread"');
    expect(describeChange({ path: "/D1/stack/3", before: { weight: 1 } })).toBe('removed {"weight":1}');
    expect(describeChange({ path: "/D10/title", before: null, after: "Jinn" })).toBe('null → "Jinn"');
  });

  it("cuts long values by code points and never splits a surrogate pair", () => {
    const cut = shortValue("🎵".repeat(200), 10);
    expect(Array.from(cut)).toHaveLength(10);
    expect(cut.endsWith("…")).toBe(true);
    expect(cut.isWellFormed()).toBe(true);
    expect(shortValue(undefined)).toBe("undefined");
  });
});

describe("songAttachment", () => {
  const stored = toSong({ id: "s", owner_id: "o", title: "Jinn", brand: "VASEY.AUDIO", spec: v12, overrides: [], base_variant_id: "v-1", revision: 5, created_at: "c", updated_at: "u" });
  const variant = (id: string, label: string, spec: MusicSpec) => ({ id, songId: "s", label, specSnapshot: spec, diff: [], overrides: [], coverage: {}, createdAt: "c" });
  const variants = [variant("v-0", "v1.0", v11), variant("v-1", "v1.1", v12)];

  it("opens a variant as the base of the next freeze, with the song's revision and saved state", () => {
    const opened = songAttachment(stored, variants, variants[0] ?? null);
    expect(opened).toEqual({ songId: "s", ownerId: "o", title: "Jinn", revision: 5, savedHash: workingHash(v12, "v-1"), baseVariantId: "v-0", baseLabel: "v1.0", variantLabels: ["v1.0", "v1.1"] });
  });

  it("opens a song with no variants as a copy with no base", () => {
    expect(songAttachment(stored, [], null)).toMatchObject({ baseVariantId: null, baseLabel: null, variantLabels: [] });
  });

  it("opens the song's own copy as saved, and a variant equal to its spec but not its base as unsaved", () => {
    expect(hasUnsavedWork(openedCopy(v12, songAttachment(stored, variants, variants[1] ?? null)))).toBe(false);
    // Same spec, another parent for the next freeze: replacing it would lose the fork.
    const twin = variant("v-2", "v1.2", v12);
    expect(hasUnsavedWork(openedCopy(v12, songAttachment(stored, [...variants, twin], twin)))).toBe(true);
  });
});

describe("the take log (S7)", () => {
  const input = (over: Partial<TakeInput> = {}): TakeInput => ({
    variantId: "v-1",
    engine: "suno",
    engineVersion: " v6 ",
    renderRef: " https://suno.example/song/abc ",
    verdict: "kill",
    drifted: ["meter", "meter", "tempo"],
    wordsBlamed: ["shuffled 16ths"],
    notes: "  Drifted to 6/8.  ",
    ...over,
  });
  const takeRow = { id: "t-1", owner_id: "o", variant_id: "v-1", engine: "suno", engine_version: "v6", render_ref: null, verdict: "kill", drifted: ["meter"], words_blamed: [], notes: "", created_at: "c" };

  it("logs a take trimmed, with each drift kind once, and no owner", async () => {
    const { client, sent } = recording(() => takeRow);
    const logged = await logTake(client, input());
    expect(sent[0]).toMatchObject({ method: "POST", path: "/rest/v1/takes" });
    expect(sent[0]?.body).toEqual({
      variant_id: "v-1",
      engine: "suno",
      engine_version: "v6",
      render_ref: "https://suno.example/song/abc",
      verdict: "kill",
      drifted: ["meter", "tempo"],
      words_blamed: ["shuffled 16ths"],
      notes: "Drifted to 6/8.",
    });
    expect(logged).toMatchObject({ id: "t-1", variantId: "v-1", engine: "suno", wordsBlamed: [] });
    expect("renderRef" in logged).toBe(false);
  });

  it("sends an empty render reference as null", async () => {
    const { client, sent } = recording(() => takeRow);
    await logTake(client, input({ renderRef: "   " }));
    expect((sent[0]?.body as { render_ref: unknown }).render_ref).toBeNull();
  });

  it("refuses audio, a missing version and too many words before sending anything", async () => {
    const { client, sent } = recording(() => takeRow);
    await expect(logTake(client, input({ renderRef: " data:audio/wav;base64,UklGRg==" }))).rejects.toThrow("never the audio itself");
    await expect(logTake(client, input({ engineVersion: "  " }))).rejects.toThrow("which engine version");
    await expect(logTake(client, input({ wordsBlamed: Array.from({ length: 51 }, (_, i) => `w${i}`) }))).rejects.toThrow("at most 50 words");
    expect(sent).toEqual([]);
  });

  it("rejects a take delete that removed no row", async () => {
    await expect(deleteTake(recording(() => []).client, "t")).rejects.toThrow("no such take");
    await expect(deleteTake(recording(() => [{ id: "t" }]).client, "t")).resolves.toBeUndefined();
  });

  it("loads a song's takes for its variants, and asks for none when it has no variants", async () => {
    const song = { id: "s", owner_id: "o", title: "Jinn", brand: "VASEY.AUDIO", spec: v12, overrides: [], base_variant_id: null, revision: 1, created_at: "c", updated_at: "u" };
    const variant = { id: "v-1", owner_id: "o", song_id: "s", seq: 1, label: "v1.0", parent_variant_id: null, spec_snapshot: v12, overrides: [], created_at: "c" };
    const withVariants = recording((r) => (r.path === "/rest/v1/songs" ? song : r.path === "/rest/v1/variants" ? [variant] : [takeRow]));
    const loaded = await loadSong(withVariants.client, "s", catalog);
    const takesRequest = withVariants.sent.find((r) => r.path === "/rest/v1/takes");
    expect(takesRequest?.query.get("variant_id")).toBe("in.(v-1)");
    expect(loaded.takes.map((t) => t.id)).toEqual(["t-1"]);

    const without = recording((r) => (r.path === "/rest/v1/songs" ? song : []));
    expect((await loadSong(without.client, "s", catalog)).takes).toEqual([]);
    expect(without.sent.some((r) => r.path === "/rest/v1/takes")).toBe(false);
  });
});

describe("take helpers", () => {
  it("splits words blamed on commas, trimmed, each once", () => {
    expect(wordsBlamed(" shuffled 16ths, rubato,, shuffled 16ths ,")).toEqual(["shuffled 16ths", "rubato"]);
    expect(wordsBlamed("")).toEqual([]);
  });

  it("links only https render references", () => {
    expect(renderLink("https://suno.example/song/abc")).toBe("https://suno.example/song/abc");
    for (const ref of ["http://suno.example/x", "javascript:alert(1)", "data:audio/wav;base64,AA", "abc-123", undefined]) expect(renderLink(ref)).toBeNull();
  });

  it("clamps typed text by code points, never splitting a surrogate pair", () => {
    expect(clampText("🎵".repeat(5), 3)).toBe("🎵🎵🎵");
    expect(clampText("short", 10)).toBe("short");
    expect(clampText("🎵".repeat(4000), 4000)).toHaveLength(8000);
  });
});

