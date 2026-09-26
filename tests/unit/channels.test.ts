import { describe, expect, it } from "vitest";

import { channelCount, type ByteReader } from "@/core/musicspec/analysis/channels";
import { encodeWav } from "@/core/musicspec/analysis/wav";

import { sine } from "../support/signals";

/** A reader over `bytes` that records every range it serves. */
function readerOver(bytes: Uint8Array) {
  const reads: [number, number][] = [];
  const read: ByteReader = async (offset, length) => {
    reads.push([offset, length]);
    return bytes.slice(offset, offset + length);
  };
  return { read, reads, count: () => channelCount(read, bytes.length) };
}

const count = (bytes: Uint8Array) => readerOver(bytes).count();

const cat = (...parts: (Uint8Array | number[] | string)[]) => {
  const arrays = parts.map((p) => (typeof p === "string" ? new TextEncoder().encode(p) : Uint8Array.from(p)));
  const out = new Uint8Array(arrays.reduce((n, a) => n + a.length, 0));
  let at = 0;
  for (const a of arrays) {
    out.set(a, at);
    at += a.length;
  }
  return out;
};
const le16 = (n: number) => [n & 0xff, n >> 8];
const le32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];
const be16 = (n: number) => [n >> 8, n & 0xff];
const be32 = (n: number) => [(n >>> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
const zeros = (n: number) => new Uint8Array(n);

/** A RIFF or RF64 WAVE header with `channels`, after `before` (id, body) chunks. */
function wave(channels: number, before: [string, Uint8Array][] = [], magic = "RIFF") {
  const fmt = cat(le16(1), le16(channels), le32(48000), le32(48000 * channels * 2), le16(channels * 2), le16(16));
  const chunks = before.map(([id, body]) => cat(id, le32(body.length), body, body.length % 2 ? [0] : []));
  return cat(magic, le32(0), "WAVE", ...chunks, "fmt ", le32(fmt.length), fmt, "data", le32(4), zeros(4));
}

/** A FLAC STREAMINFO block (header and body) declaring `channels`. */
const streamInfo = (channels: number) => {
  const body = zeros(34);
  body[12] = ((channels - 1) & 0x07) << 1;
  return cat([0x80], [0, 0, 34], body);
};

const box = (type: string, ...body: (Uint8Array | number[] | string)[]) => {
  const inner = cat(...body);
  return cat(be32(inner.length + 8), type, inner);
};

/** An ISO AudioSampleEntry of `type` whose channelcount field says `field`, then `children`. */
const sampleEntry = (type: string, field: number, ...children: Uint8Array[]) =>
  box(type, zeros(6), be16(1), zeros(8), be16(field), be16(16), zeros(4), be32(48000 << 16), ...children);

/** An esds carrying an AAC AudioSpecificConfig: AAC LC, 48 kHz, `configuration`. */
const esds = (configuration: number) => {
  const asc = [(2 << 3) | (3 >> 1), ((3 & 1) << 7) | (configuration << 3)];
  const specific = cat([0x05, asc.length], asc);
  const decoderConfig = cat([0x04, 13 + specific.length, 0x40, 0x15], zeros(11), specific);
  const es = cat([0x03, 3 + decoderConfig.length], [0, 1, 0], decoderConfig);
  return box("esds", zeros(4), es);
};

const soundTrack = (entry: Uint8Array, stsdVersion = 0) =>
  box(
    "trak",
    box("tkhd", zeros(84)),
    box(
      "mdia",
      box("hdlr", zeros(8), "soun", zeros(12)),
      box("minf", box("stbl", box("stsd", [stsdVersion, 0, 0, 0], be32(1), entry))),
    ),
  );
const videoTrack = () => box("trak", box("mdia", box("hdlr", zeros(8), "vide", zeros(12)), box("minf", box("stbl", box("stsd", zeros(4), be32(0))))));

/** An MP4 with `media` bytes of media data before its movie box, as a non-faststart file has. */
const mp4 = (media: number, ...tracks: Uint8Array[]) => cat(box("ftyp", "M4A ", zeros(4)), box("mdat", zeros(media)), box("moov", ...tracks));

/** A minimal EBML element: 1-byte size, `id` given as bytes. */
const ebml = (id: number[], ...body: (Uint8Array | number[])[]) => {
  const inner = cat(...body);
  if (inner.length > 126) throw new Error("test element too large for a 1-byte size");
  return cat(id, [0x80 | inner.length], inner);
};
const audioEntry = (channels?: number) =>
  ebml([0xae], ebml([0x83], [2]), ebml([0xe1], ...(channels === undefined ? [] : [ebml([0x9f], [channels])])));
const videoEntry = () => ebml([0xae], ebml([0x83], [1]));
const webm = (...entries: Uint8Array[]) =>
  cat(ebml([0x1a, 0x45, 0xdf, 0xa3], ebml([0x42, 0x82], [...new TextEncoder().encode("webm")])), [0x18, 0x53, 0x80, 0x67, 0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff], ebml([0x15, 0x49, 0xa9, 0x66], zeros(4)), ebml([0x16, 0x54, 0xae, 0x6b], ...entries));

const id3 = (size: number) => cat("ID3", [4, 0, 0], [(size >> 21) & 0x7f, (size >> 14) & 0x7f, (size >> 7) & 0x7f, size & 0x7f], zeros(size));

describe("channelCount", () => {
  it("reads WAV, RF64 and BW64 fmt chunks, skipping chunks before them", async () => {
    expect(await count(new Uint8Array(encodeWav(sine(440, -6, 0.1, 22050), 22050)))).toBe(1);
    expect(await count(wave(6, [["JUNK", zeros(27)], ["bext", zeros(602)]]))).toBe(6);
    expect(await count(wave(8, [["ds64", zeros(28)]], "RF64"))).toBe(8);
    expect(await count(wave(2, [], "BW64"))).toBe(2);
  });

  it("reads AIFF and AIFF-C COMM chunks", async () => {
    const aiff = (form: string, channels: number) => cat("FORM", be32(0), form, "FVER", be32(4), zeros(4), "COMM", be32(18), be16(channels), zeros(16));
    expect(await count(aiff("AIFF", 2))).toBe(2);
    expect(await count(aiff("AIFC", 6))).toBe(6);
  });

  it("reads FLAC STREAMINFO, after an ID3 tag too", async () => {
    expect(await count(cat("fLaC", streamInfo(6)))).toBe(6);
    expect(await count(cat(id3(300), "fLaC", streamInfo(2)))).toBe(2);
  });

  it("reads the Ogg identification header for Opus, Vorbis and FLAC", async () => {
    const page = (packet: Uint8Array) => cat("OggS", zeros(22), [1], [packet.length], packet);
    expect(await count(page(cat("OpusHead", [1, 8], zeros(9))))).toBe(8);
    expect(await count(page(cat([1], "vorbis", zeros(4), [2], zeros(19))))).toBe(2);
    expect(await count(page(cat([0x7f], "FLAC", [1, 0, 0, 1], "fLaC", streamInfo(3))))).toBe(3);
    expect(await count(page(cat("Speex   ", zeros(72))))).toBeUndefined();
  });

  it("reads MPEG audio and ADTS frame headers, after an ID3 tag", async () => {
    expect(await count(cat(id3(1000), [0xff, 0xfb, 0x90, 0x44], zeros(400)))).toBe(2);
    expect(await count(cat([0xff, 0xfb, 0x90, 0xc4], zeros(400)))).toBe(1);
    const adts = (configuration: number) => cat([0xff, 0xf1, 0x4c | (configuration >> 2), (configuration & 3) << 6], zeros(400));
    expect(await count(adts(2))).toBe(2);
    expect(await count(adts(6))).toBe(6);
    expect(await count(adts(7))).toBe(8);
    expect(await count(adts(0))).toBeUndefined();
  });

  it("reads the CAF desc chunk", async () => {
    expect(await count(cat("caff", be16(1), be16(0), "desc", zeros(4), be32(32), zeros(24), be32(6), zeros(4)))).toBe(6);
  });

  it("reads AAC's layout from esds, not the sample entry's channelcount, past the media data", async () => {
    // Encoders commonly write channelcount 2 for any AAC; the AudioSpecificConfig says 5.1.
    const file = mp4(200_000, videoTrack(), soundTrack(sampleEntry("mp4a", 2, esds(6))));
    const { count: run, reads } = readerOver(file);
    expect(await run()).toBe(6);
    // The media data is skipped by its header, never read.
    expect(reads.every(([, length]) => length < 200_000)).toBe(true);
    expect(await count(mp4(16, soundTrack(sampleEntry("mp4a", 2, esds(7)))))).toBe(8);
    expect(await count(mp4(16, soundTrack(sampleEntry("mp4a", 2, esds(2)))))).toBe(2);
    // A program config element (configuration 0) or a missing esds says nothing.
    expect(await count(mp4(16, soundTrack(sampleEntry("mp4a", 2, esds(0)))))).toBeUndefined();
    expect(await count(mp4(16, soundTrack(sampleEntry("mp4a", 2))))).toBeUndefined();
  });

  it("reads ALAC, Opus, FLAC and PCM sample entries, and the most channels across sound tracks", async () => {
    const alac = box("alac", zeros(4), zeros(9), [6], zeros(14));
    expect(await count(mp4(16, soundTrack(sampleEntry("alac", 2, alac))))).toBe(6);
    expect(await count(mp4(16, soundTrack(sampleEntry("Opus", 2, box("dOps", [0, 4], zeros(9))))))).toBe(4);
    expect(await count(mp4(16, soundTrack(sampleEntry("fLaC", 2, box("dfLa", zeros(4), streamInfo(5))))))).toBe(5);
    expect(await count(mp4(16, soundTrack(sampleEntry("sowt", 2)), soundTrack(sampleEntry("sowt", 8))))).toBe(8);
    expect(await count(mp4(16, soundTrack(sampleEntry("ac-3", 2))))).toBeUndefined();
    expect(await count(mp4(16, videoTrack()))).toBeUndefined();
  });

  it("reads a QuickTime v1 sound description, whose esds sits in a wave box", async () => {
    const v1 = box("mp4a", zeros(6), be16(1), be16(1), zeros(6), be16(2), be16(16), zeros(4), be32(48000 << 16), zeros(16), box("wave", box("frma", "mp4a"), esds(6)));
    expect(await count(mp4(16, soundTrack(v1)))).toBe(6);
  });

  it("follows a 64-bit box size", async () => {
    const large = cat(be32(1), "mdat", be32(0), be32(16 + 32), zeros(32));
    expect(await count(cat(box("ftyp", "isom", zeros(4)), large, box("moov", soundTrack(sampleEntry("mp4a", 2, esds(6))))))).toBe(6);
  });

  it("reads the most channels among Matroska and WebM audio tracks, defaulting to one", async () => {
    expect(await count(webm(videoEntry(), audioEntry(6)))).toBe(6);
    expect(await count(webm(audioEntry(2), audioEntry(8)))).toBe(8);
    expect(await count(webm(audioEntry()))).toBe(1);
    expect(await count(webm(videoEntry()))).toBeUndefined();
  });

  it("says nothing about unknown or truncated input, and never throws", async () => {
    expect(await count(new Uint8Array(0))).toBeUndefined();
    expect(await count(cat("hello, not audio at all"))).toBeUndefined();
    expect(await count(wave(6).subarray(0, 20))).toBeUndefined();
    expect(await count(mp4(16, soundTrack(sampleEntry("mp4a", 2, esds(6)))).subarray(0, 60))).toBeUndefined();
    let state = 11;
    const next = () => (state = (state * 1664525 + 1013904223) >>> 0) & 0xff;
    const prefixes = ["RIFF", "FORM", "fLaC", "OggS", "caff", "ID3", "\u001aEß£", "\u0000\u0000\u0000 ftyp"];
    for (const prefix of prefixes) {
      for (let i = 0; i < 50; i++) {
        const noise = Uint8Array.from({ length: 64 + (i % 7) * 40 }, next);
        const head = Uint8Array.from(prefix, (c) => c.charCodeAt(0));
        const bytes = cat(head, noise);
        if (prefix === "RIFF" || prefix === "FORM") bytes.set(new TextEncoder().encode(prefix === "RIFF" ? "WAVE" : "AIFF"), 8);
        const { count: run, reads } = readerOver(bytes);
        const n = await run();
        expect(n === undefined || (Number.isInteger(n) && n > 0)).toBe(true);
        expect(reads.length).toBeLessThanOrEqual(260);
      }
    }
  });
});
