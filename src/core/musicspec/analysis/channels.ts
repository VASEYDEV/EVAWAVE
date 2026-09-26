/**
 * How many channels a recording declares, read from its container header without decoding it
 * (docs/SPEC.md §1.7). Web Audio decodes every channel of a file at once, so an import bounds
 * duration × channels before it decodes. Reads stay small: a header window, chunk, box and
 * element headers, and an MP4 movie box or a Matroska track list up to BODY_MAX_BYTES.
 *
 * Undefined means the header does not say, or says something this reader does not know (an
 * unknown container or codec, or AAC whose layout lives in a program config element); the
 * caller then assumes a large layout. Every walk is bounded, and malformed input returns
 * undefined rather than throwing.
 */

/** Returns up to `length` bytes starting at `offset`: fewer at the end of the file. */
export type ByteReader = (offset: number, length: number) => Promise<Uint8Array>;

const HEAD_BYTES = 64 * 1024;
/** The largest MP4 movie box or Matroska track list read whole; a real one is far smaller. */
const BODY_MAX_BYTES = 16 * 1024 * 1024;
/** Chunks, boxes or elements visited per level, and ID3 tags skipped. */
const MAX_STEPS = 256;
const MAX_ID3_TAGS = 4;

/** ISO/IEC 14496-3 channelConfiguration → channels; 0 and the reserved values say nothing. */
const AAC_CHANNELS: readonly (number | undefined)[] = [undefined, 1, 2, 3, 4, 5, 6, 8, undefined, undefined, undefined, 7, 8, 24, 8];

/** QuickTime and ISO sample entries for uncompressed PCM, whose channelcount is the count. */
const PCM_ENTRIES = new Set(["lpcm", "sowt", "twos", "in24", "in32", "fl32", "fl64", "raw ", "ipcm", "fpcm"]);

const MKV = { EBML: 0x1a45dfa3, SEGMENT: 0x18538067, TRACKS: 0x1654ae6b, TRACK_ENTRY: 0xae, TRACK_TYPE: 0x83, AUDIO: 0xe1, CHANNELS: 0x9f };

const positive = (n: number | undefined) => (n !== undefined && n > 0 ? n : undefined);

function u8(b: Uint8Array, at: number): number | undefined {
  return at >= 0 && at < b.length ? b[at] : undefined;
}

function u16(b: Uint8Array, at: number, little: boolean): number | undefined {
  const lo = u8(b, little ? at : at + 1), hi = u8(b, little ? at + 1 : at);
  return lo === undefined || hi === undefined ? undefined : hi * 0x100 + lo;
}

function u32(b: Uint8Array, at: number, little: boolean): number | undefined {
  const lo = u16(b, little ? at : at + 2, little), hi = u16(b, little ? at + 2 : at, little);
  return lo === undefined || hi === undefined ? undefined : hi * 0x10000 + lo;
}

function u64be(b: Uint8Array, at: number): number | undefined {
  const hi = u32(b, at, false), lo = u32(b, at + 4, false);
  return hi === undefined || lo === undefined ? undefined : hi * 2 ** 32 + lo;
}

function ascii(b: Uint8Array, at: number, n: number): string {
  if (at < 0 || at + n > b.length) return "";
  return String.fromCharCode(...b.subarray(at, at + n));
}

/**
 * The channel count `read` declares for a file of `size` bytes, or undefined when its header
 * does not say.
 */
export async function channelCount(read: ByteReader, size: number): Promise<number | undefined> {
  let start = 0;
  let head = await read(0, HEAD_BYTES);
  // ID3v2 tags (MP3, sometimes FLAC and ADTS) come first; skip them.
  for (let i = 0; i < MAX_ID3_TAGS && ascii(head, 0, 3) === "ID3" && head.length >= 10; i++) {
    const tagSize = (((head[6] as number) & 0x7f) << 21) | (((head[7] as number) & 0x7f) << 14) | (((head[8] as number) & 0x7f) << 7) | ((head[9] as number) & 0x7f);
    start += 10 + tagSize + ((head[5] as number) & 0x10 ? 10 : 0);
    if (start >= size) return undefined;
    head = await read(start, HEAD_BYTES);
  }
  const tag = ascii(head, 0, 4);
  if ((tag === "RIFF" || tag === "RF64" || tag === "BW64") && ascii(head, 8, 4) === "WAVE") {
    return chunkChannels(read, size, start + 12, true, "fmt ", (b) => u16(b, 2, true));
  }
  if (tag === "FORM" && (ascii(head, 8, 4) === "AIFF" || ascii(head, 8, 4) === "AIFC")) {
    return chunkChannels(read, size, start + 12, false, "COMM", (b) => u16(b, 0, false));
  }
  if (tag === "fLaC") return flacChannels(head, 4);
  if (tag === "OggS") return oggChannels(head);
  if (tag === "caff") return cafChannels(read, start + 8);
  if (u32(head, 0, false) === MKV.EBML) return matroskaChannels(read, size, start);
  if (["ftyp", "moov", "mdat", "free", "skip", "wide"].includes(ascii(head, 4, 4))) return mp4Channels(read, size, start);
  return mpegChannels(head);
}

/** Walks RIFF or IFF chunks from `from` to the `want` chunk and parses its first bytes. */
async function chunkChannels(
  read: ByteReader,
  size: number,
  from: number,
  little: boolean,
  want: string,
  parse: (body: Uint8Array) => number | undefined,
): Promise<number | undefined> {
  let pos = from;
  for (let step = 0; step < MAX_STEPS && pos + 8 <= size; step++) {
    const header = await read(pos, 8);
    const length = u32(header, 4, little);
    if (length === undefined) return undefined;
    if (ascii(header, 0, 4) === want) return positive(parse(await read(pos + 8, 16)));
    pos += 8 + length + (length % 2);
  }
  return undefined;
}

/** STREAMINFO, the first FLAC metadata block, whose header starts at `header`. */
function flacChannels(b: Uint8Array, header: number): number | undefined {
  const type = u8(b, header);
  const packed = u8(b, header + 4 + 12);
  if (type === undefined || (type & 0x7f) !== 0 || packed === undefined) return undefined;
  return ((packed >> 1) & 0x07) + 1;
}

/** The first packet of the first Ogg page: an Opus, Vorbis or FLAC identification header. */
function oggChannels(b: Uint8Array): number | undefined {
  const segments = u8(b, 26);
  if (segments === undefined) return undefined;
  const p = 27 + segments;
  if (ascii(b, p, 8) === "OpusHead") return positive(u8(b, p + 9));
  if (u8(b, p) === 1 && ascii(b, p + 1, 6) === "vorbis") return positive(u8(b, p + 11));
  if (u8(b, p) === 0x7f && ascii(b, p + 1, 4) === "FLAC" && ascii(b, p + 9, 4) === "fLaC") return flacChannels(b, p + 13);
  return undefined;
}

/** CAF's desc chunk, which the format puts first: mChannelsPerFrame is at byte 24. */
async function cafChannels(read: ByteReader, from: number): Promise<number | undefined> {
  const b = await read(from, 12 + 28);
  return ascii(b, 0, 4) === "desc" ? positive(u32(b, 12 + 24, false)) : undefined;
}

/**
 * An MPEG audio frame (MP3 and its layers carry at most two channels) or an ADTS AAC header
 * at the start of the stream.
 */
function mpegChannels(b: Uint8Array): number | undefined {
  const b1 = u8(b, 1), b2 = u8(b, 2), b3 = u8(b, 3);
  if (u8(b, 0) !== 0xff || b1 === undefined || b2 === undefined || b3 === undefined || (b1 & 0xe0) !== 0xe0) return undefined;
  const layer = (b1 >> 1) & 0x03;
  if (layer !== 0) return b3 >> 6 === 3 ? 1 : 2;
  if ((b1 & 0xf0) !== 0xf0) return undefined;
  return AAC_CHANNELS[((b2 & 0x01) << 2) | (b3 >> 6)];
}

interface Span {
  type: string;
  start: number;
  end: number;
}

/** An ISO BMFF box header at `at`, with `available` bytes left in its parent. */
function boxHeader(b: Uint8Array, at: number, available: number): { type: string; size: number; header: number } | undefined {
  let size = u32(b, at, false);
  const type = ascii(b, at + 4, 4);
  let header = 8;
  if (size === undefined || !type) return undefined;
  if (size === 1) {
    size = u64be(b, at + 8);
    header = 16;
  } else if (size === 0) {
    size = available;
  }
  if (size === undefined || size < header || size > available) return undefined;
  return { type, size, header };
}

/** The boxes in `b` from `from` to `to`. */
function boxes(b: Uint8Array, from: number, to: number): Span[] {
  const out: Span[] = [];
  let pos = from;
  for (let step = 0; step < MAX_STEPS && pos + 8 <= to; step++) {
    const box = boxHeader(b, pos, to - pos);
    if (!box) break;
    out.push({ type: box.type, start: pos + box.header, end: pos + box.size });
    pos += box.size;
  }
  return out;
}

const child = (b: Uint8Array, parent: Span | undefined, type: string) => (parent ? boxes(b, parent.start, parent.end).find((c) => c.type === type) : undefined);

/** Walks the top-level boxes to the movie box, which can follow the media data. */
async function mp4Channels(read: ByteReader, size: number, from: number): Promise<number | undefined> {
  let pos = from;
  for (let step = 0; step < MAX_STEPS && pos + 8 <= size; step++) {
    const box = boxHeader(await read(pos, 16), 0, size - pos);
    if (!box) return undefined;
    if (box.type === "moov") {
      if (box.size - box.header > BODY_MAX_BYTES) return undefined;
      const moov = await read(pos + box.header, box.size - box.header);
      return moovChannels(moov);
    }
    pos += box.size;
  }
  return undefined;
}

/** The most channels any sound track declares; undefined if any sound track cannot say. */
function moovChannels(m: Uint8Array): number | undefined {
  let most: number | undefined;
  for (const trak of boxes(m, 0, m.length)) {
    if (trak.type !== "trak") continue;
    const mdia = child(m, trak, "mdia");
    const hdlr = child(m, mdia, "hdlr");
    if (!hdlr || ascii(m, hdlr.start + 8, 4) !== "soun") continue;
    const stsd = child(m, child(m, child(m, mdia, "minf"), "stbl"), "stsd");
    if (!stsd) return undefined;
    const iso = u8(m, stsd.start) === 1;
    const entries = boxes(m, stsd.start + 8, stsd.end);
    if (!entries.length) return undefined;
    for (const entry of entries) {
      const n = sampleEntryChannels(m, entry, iso);
      if (n === undefined) return undefined;
      most = Math.max(most ?? 0, n);
    }
  }
  return most;
}

/**
 * An audio sample entry. Its channelcount is not always the count (encoders commonly write 2
 * for AAC), so AAC, ALAC, Opus and FLAC read their codec configuration; PCM trusts the field.
 */
function sampleEntryChannels(m: Uint8Array, entry: Span, iso: boolean): number | undefined {
  const version = u16(m, entry.start + 8, false);
  if (version === undefined) return undefined;
  // QuickTime sound descriptions v1 and v2 extend the v0 fields; ISO entries never do.
  const quicktime = iso ? 0 : version;
  const fields = { start: entry.start + (quicktime === 1 ? 44 : quicktime === 2 ? 64 : 28), end: entry.end, type: entry.type };
  const count = quicktime === 2 ? u32(m, entry.start + 40, false) : u16(m, entry.start + 16, false);
  switch (entry.type) {
    case "mp4a": {
      const esds = child(m, fields, "esds") ?? child(m, child(m, fields, "wave"), "esds");
      return esds ? esdsChannels(m, esds) : undefined;
    }
    case "alac": {
      const config = child(m, fields, "alac") ?? child(m, child(m, fields, "wave"), "alac");
      return positive(config ? u8(m, config.start + 4 + 9) : count);
    }
    case "Opus": {
      const dops = child(m, fields, "dOps");
      return dops ? positive(u8(m, dops.start + 1)) : undefined;
    }
    case "fLaC": {
      const dfla = child(m, fields, "dfLa");
      return dfla ? flacChannels(m, dfla.start + 4) : undefined;
    }
    default:
      return PCM_ENTRIES.has(entry.type) ? positive(count) : undefined;
  }
}

/** An MPEG-4 descriptor at `at`: a tag, a length of up to four 7-bit bytes, then the body. */
function descriptor(b: Uint8Array, at: number, end: number): { tag: number; start: number; end: number } | undefined {
  const tag = u8(b, at);
  if (tag === undefined) return undefined;
  let length = 0;
  let pos = at + 1;
  for (let i = 0; i < 4; i++) {
    const v = u8(b, pos++);
    if (v === undefined) return undefined;
    length = length * 128 + (v & 0x7f);
    if (!(v & 0x80)) break;
  }
  return pos + length <= end ? { tag, start: pos, end: pos + length } : undefined;
}

/** The esds box: ES_Descriptor → DecoderConfigDescriptor → AudioSpecificConfig. */
function esdsChannels(m: Uint8Array, esds: Span): number | undefined {
  const es = descriptor(m, esds.start + 4, esds.end);
  if (!es || es.tag !== 0x03) return undefined;
  const flags = u8(m, es.start + 2);
  if (flags === undefined) return undefined;
  let pos = es.start + 3;
  if (flags & 0x80) pos += 2;
  if (flags & 0x40) pos += 1 + (u8(m, pos) ?? 0);
  if (flags & 0x20) pos += 2;
  const config = descriptor(m, pos, es.end);
  if (!config || config.tag !== 0x04) return undefined;
  const objectType = u8(m, config.start);
  // MPEG-1 and MPEG-2 audio (MP3) in an MP4 carry at most two channels.
  if (objectType === 0x69 || objectType === 0x6b) return 2;
  if (objectType !== 0x40 && objectType !== 0x66 && objectType !== 0x67 && objectType !== 0x68) return undefined;
  const specific = descriptor(m, config.start + 13, config.end);
  if (!specific || specific.tag !== 0x05) return undefined;
  return audioSpecificConfigChannels(m, specific.start, specific.end);
}

function audioSpecificConfigChannels(b: Uint8Array, start: number, end: number): number | undefined {
  let bit = start * 8;
  const bits = (n: number): number | undefined => {
    if (bit + n > end * 8) return undefined;
    let v = 0;
    for (let i = 0; i < n; i++, bit++) v = v * 2 + (((b[bit >> 3] as number) >> (7 - (bit & 7))) & 1);
    return v;
  };
  const objectType = bits(5);
  if (objectType === 31 && bits(6) === undefined) return undefined;
  const frequencyIndex = bits(4);
  if (frequencyIndex === 15 && bits(24) === undefined) return undefined;
  const configuration = bits(4);
  return objectType === undefined || frequencyIndex === undefined || configuration === undefined ? undefined : AAC_CHANNELS[configuration];
}

/** An EBML variable-length integer: an element ID keeps its marker bit, a size drops it. */
function vint(b: Uint8Array, at: number, id: boolean): { value: number; length: number; unknown: boolean } | undefined {
  const first = u8(b, at);
  if (!first) return undefined;
  const length = Math.clz32(first) - 23;
  if (length > 8 || at + length > b.length) return undefined;
  const mask = 0xff >> length;
  let value = id ? first : first & mask;
  let unknown = !id && (first & mask) === mask;
  for (let i = 1; i < length; i++) {
    const v = b[at + i] as number;
    value = value * 256 + v;
    if (v !== 0xff) unknown = false;
  }
  return { value, length, unknown };
}

/** The EBML elements in `b` from `from` to `to`; an unknown size ends the walk. */
function elements(b: Uint8Array, from: number, to: number): { id: number; start: number; end: number }[] {
  const out: { id: number; start: number; end: number }[] = [];
  let pos = from;
  for (let step = 0; step < MAX_STEPS && pos < to; step++) {
    const id = vint(b, pos, true);
    const size = id && vint(b, pos + id.length, false);
    if (!id || !size || size.unknown) break;
    const start = pos + id.length + size.length;
    if (start + size.value > to) break;
    out.push({ id: id.value, start, end: start + size.value });
    pos = start + size.value;
  }
  return out;
}

function uint(b: Uint8Array, start: number, end: number): number {
  let v = 0;
  for (let i = start; i < end; i++) v = v * 256 + (b[i] as number);
  return v;
}

/** Matroska and WebM: the Segment's Tracks element, which a muxer writes before the clusters. */
async function matroskaChannels(read: ByteReader, size: number, from: number): Promise<number | undefined> {
  let pos = from;
  let end = size;
  for (let step = 0; step < MAX_STEPS && pos < end; step++) {
    const h = await read(pos, 16);
    const id = vint(h, 0, true);
    const length = id && vint(h, id.length, false);
    if (!id || !length) return undefined;
    const body = pos + id.length + length.length;
    if (id.value === MKV.SEGMENT) {
      end = length.unknown ? size : Math.min(size, body + length.value);
      pos = body;
      continue;
    }
    if (length.unknown) return undefined;
    if (id.value === MKV.TRACKS) return length.value > BODY_MAX_BYTES ? undefined : tracksChannels(await read(body, length.value));
    pos = body + length.value;
  }
  return undefined;
}

/** The most channels any audio track declares; Channels defaults to 1. */
function tracksChannels(b: Uint8Array): number | undefined {
  let most: number | undefined;
  for (const entry of elements(b, 0, b.length)) {
    if (entry.id !== MKV.TRACK_ENTRY) continue;
    let type: number | undefined;
    let channels = 1;
    for (const e of elements(b, entry.start, entry.end)) {
      if (e.id === MKV.TRACK_TYPE) type = uint(b, e.start, e.end);
      if (e.id === MKV.AUDIO) for (const a of elements(b, e.start, e.end)) if (a.id === MKV.CHANNELS) channels = uint(b, a.start, a.end);
    }
    if (type === 2) most = Math.max(most ?? 0, channels);
  }
  return positive(most);
}
