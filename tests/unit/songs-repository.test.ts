import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Catalog, MusicSpec } from "@/core/musicspec/ir/types";
import { LibraryError } from "@/lib/library/repository";
import type { Database, SongRow } from "@/lib/library/schema";
import { specHash } from "@/core/musicspec/variants";
import { clampText, coverageScores, createSong, deleteSong, deleteTake, describeChange, freezeVariant, loadSong, logTake, renderLink, saveSong, shortValue, songAttachment, songTitle, toSong, wordsBlamed, type TakeInput, type WorkingCopy } from "@/lib/library/songs";
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

/** A client whose PostgREST answers each request with `answer(request)`, recording them all. */
function recording(answer: (sent: Sent) => unknown) {
  const sent: Sent[] = [];
  const client = createClient<Database>("https://project.supabase.test", "anon-key-for-tests", {
    global: {
      fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input));
        const request: Sent = { method: init?.method ?? "GET", path: url.pathname, query: url.searchParams, body: init?.body ? JSON.parse(String(init.body)) : undefined };
        sent.push(request);
        return new Response(JSON.stringify(answer(request)), { status: 200, headers: { "content-type": "application/json" } });
      }) as typeof fetch,
    },
    auth: { persistSession: false },
  });
  return { client, sent };
}

const copy = (over: Partial<WorkingCopy> = {}): WorkingCopy => ({ songId: "song-1", revision: 3, spec: v12, overrides: [], baseVariantId: null, ...over });

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
    expect(sent[0]?.body).toEqual({ title: songTitle(v12), spec: v12, overrides: [] });
  });

  it("keeps the working copy's overrides on save and freeze, never dropping them", async () => {
    const override = { engine: "suno" as const, fieldId: "style", text: "hand-tuned style", basedOnCompiledHash: "h", createdAt: "c" };
    const saved = recording(() => [{ revision: 4 }]);
    await saveSong(saved.client, copy({ overrides: [override] }));
    expect(saved.sent[0]?.body).toMatchObject({ overrides: [override] });
    const frozen = recording(() => ({ variant_id: "v", variant_label: "v1.0", song_revision: 4, owner: "o" }));
    await freezeVariant(frozen.client, copy({ overrides: [override] }), catalog);
    expect(frozen.sent[0]?.body).toMatchObject({ p_overrides: [override] });
  });

  it("saves only at the revision it read, and reads zero rows as a stale or deleted song", async () => {
    const { client, sent } = recording(() => [{ revision: 4 }]);
    await expect(saveSong(client, copy({ baseVariantId: "v-2" }))).resolves.toBe(4);
    expect(sent[0]?.method).toBe("PATCH");
    expect(sent[0]?.query.get("id")).toBe("eq.song-1");
    expect(sent[0]?.query.get("revision")).toBe("eq.3");
    expect(sent[0]?.body).toMatchObject({ title: songTitle(v12), base_variant_id: "v-2" });

    const stale = recording(() => []);
    await expect(saveSong(stale.client, copy())).rejects.toBeInstanceOf(LibraryError);
    await expect(saveSong(stale.client, copy())).rejects.toThrow("changed elsewhere or was deleted");
  });
});

describe("freezeVariant", () => {
  const frozen = { variant_id: "v-new", variant_label: "v1.1", song_revision: 4, owner: "o" };
  const now = () => new Date("2026-09-26T12:00:00.000Z");

  it("sends a first variant's parent as null, an empty diff, and coverage stamped with the time", async () => {
    const { client, sent } = recording(() => frozen);
    await expect(freezeVariant(client, copy(), catalog, now)).resolves.toEqual({ variantId: "v-new", label: "v1.1", revision: 4, ownerId: "o" });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.path).toBe("/rest/v1/rpc/freeze_variant");
    const body = sent[0]?.body as Record<string, unknown>;
    expect(body).toHaveProperty("p_parent_variant_id", null);
    expect(body).toMatchObject({ p_song_id: "song-1", p_expected_revision: 3, p_title: songTitle(v12), p_diff: [] });
    const coverage = body.p_coverage as Record<string, { compiledAt: string }>;
    expect(Object.keys(coverage).sort()).toEqual(["eleven", "flow", "suno"]);
    for (const report of Object.values(coverage)) expect(report.compiledAt).toBe("2026-09-26T12:00:00.000Z");
  });

  it("diffs against the base variant's snapshot: the Jinn fork carries BPM 142 → 140", async () => {
    const { client, sent } = recording((request) => (request.path === "/rest/v1/variants" ? { spec_snapshot: v11 } : frozen));
    await freezeVariant(client, copy({ baseVariantId: "v-base" }), catalog, now);
    expect(sent.map((s) => s.path)).toEqual(["/rest/v1/variants", "/rest/v1/rpc/freeze_variant"]);
    expect(sent[0]?.query.get("id")).toBe("eq.v-base");
    const body = sent[1]?.body as { p_parent_variant_id: string; p_diff: unknown[] };
    expect(body.p_parent_variant_id).toBe("v-base");
    expect(body.p_diff).toContainEqual({ path: "/D6/tempo/bpm", before: 142, after: 140 });
  });

  it("refuses to freeze an invented producer name, and sends nothing", async () => {
    const INVENTED = "Quillon Vantreese";
    const withName: Catalog = { ...catalog, lineageNames: [...catalog.lineageNames, INVENTED] };
    const named = { ...v12, D1: { ...v12.D1, formPhrase: `${v12.D1.formPhrase} after ${INVENTED}` } };
    const { client, sent } = recording(() => frozen);
    await expect(freezeVariant(client, copy({ spec: named }), withName, now)).rejects.toThrow(/LN-1 at \/D1\/formPhrase/);
    expect(sent).toEqual([]);
  });

  it("refuses to freeze an invented producer name carried in a target override", async () => {
    const INVENTED = "Quillon Vantreese";
    const withName: Catalog = { ...catalog, lineageNames: [...catalog.lineageNames, INVENTED] };
    const named = { engine: "suno" as const, fieldId: "style", text: `desert trap after ${INVENTED}`, basedOnCompiledHash: "h", createdAt: "c" };
    const { client, sent } = recording(() => frozen);
    await expect(freezeVariant(client, copy({ overrides: [named] }), withName, now)).rejects.toThrow(/LN-1 at overrides\/0/);
    expect(sent).toEqual([]);
  });

  it("fails clearly when the base variant is gone", async () => {
    const { client } = recording(() => null);
    await expect(freezeVariant(client, copy({ baseVariantId: "v-gone" }), catalog, now)).rejects.toThrow("the variant this copy came from is gone");
  });
});

describe("deleteSong and coverageScores", () => {
  it("rejects a delete that removed no row", async () => {
    await expect(deleteSong(recording(() => []).client, "s")).rejects.toThrow("no such song");
    await expect(deleteSong(recording(() => [{ id: "s" }]).client, "s")).resolves.toBeUndefined();
  });

  it("lists scores in build order whatever order the database kept", () => {
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

  const override = { engine: "suno" as const, fieldId: "style", text: "hand-tuned style", basedOnCompiledHash: "h", createdAt: "c" };

  it("opens a variant as the base of the next freeze, with the song's revision and saved state", () => {
    const opened = songAttachment(stored, variants, variants[0] ?? null, [override]);
    expect(opened).toEqual({ songId: "s", ownerId: "o", title: "Jinn", revision: 5, savedHash: specHash(v12), baseVariantId: "v-0", baseLabel: "v1.0", variantLabels: ["v1.0", "v1.1"], overrides: [override] });
  });

  it("opens a song with no variants as a copy with no base", () => {
    expect(songAttachment(stored, [], null, [])).toMatchObject({ baseVariantId: null, baseLabel: null, variantLabels: [], overrides: [] });
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
    const variant = { id: "v-1", owner_id: "o", song_id: "s", seq: 1, label: "v1.0", parent_variant_id: null, spec_snapshot: v12, diff: [], overrides: [], coverage: {}, created_at: "c" };
    const withVariants = recording((r) => (r.path === "/rest/v1/songs" ? song : r.path === "/rest/v1/variants" ? [variant] : [takeRow]));
    const loaded = await loadSong(withVariants.client, "s");
    const takesRequest = withVariants.sent.find((r) => r.path === "/rest/v1/takes");
    expect(takesRequest?.query.get("variant_id")).toBe("in.(v-1)");
    expect(loaded.takes.map((t) => t.id)).toEqual(["t-1"]);

    const without = recording((r) => (r.path === "/rest/v1/songs" ? song : []));
    expect((await loadSong(without.client, "s")).takes).toEqual([]);
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

