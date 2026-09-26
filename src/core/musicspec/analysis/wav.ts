/**
 * WAV (RIFF) PCM decoding and encoding, in pure TypeScript. The browser decodes imports with
 * Web Audio; this parser covers environments without it and gives tests exact inputs.
 */

export interface PcmAudio {
  sampleRate: number;
  /** Mono mix, one float per frame in −1…1. */
  samples: Float32Array;
  channels: number;
  /** Each decoded channel, which loudness sums per BS.1770. A mono file's is the mix itself. */
  channelData: Float32Array[];
}

export class WavError extends Error {
  override name = "WavError";
}

function text(view: DataView, offset: number, length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) out += String.fromCharCode(view.getUint8(offset + i));
  return out;
}

/** Decodes 8/16/24/32-bit integer or 32/64-bit float PCM WAV, mixing channels to mono. */
export function decodeWav(buffer: ArrayBuffer): PcmAudio {
  const view = new DataView(buffer);
  if (view.byteLength < 12 || text(view, 0, 4) !== "RIFF" || text(view, 8, 4) !== "WAVE") throw new WavError("not a RIFF/WAVE file");
  let format = 0, channels = 0, sampleRate = 0, bits = 0;
  let dataOffset = -1, dataLength = 0;
  for (let offset = 12; offset + 8 <= view.byteLength; ) {
    const id = text(view, offset, 4);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === "fmt ") {
      format = view.getUint16(body, true);
      channels = view.getUint16(body + 2, true);
      sampleRate = view.getUint32(body + 4, true);
      bits = view.getUint16(body + 14, true);
      // WAVE_FORMAT_EXTENSIBLE: the real format is the first two bytes of the subformat GUID.
      if (format === 0xfffe && size >= 26) format = view.getUint16(body + 24, true);
    } else if (id === "data") {
      dataOffset = body;
      dataLength = Math.min(size, view.byteLength - body);
      break;
    }
    offset = body + size + (size % 2);
  }
  if (!channels || !sampleRate || dataOffset < 0) throw new WavError("missing fmt or data chunk");
  if (format !== 1 && format !== 3) throw new WavError(`unsupported WAV format ${format}`);
  const bytes = bits / 8;
  const frames = Math.floor(dataLength / (bytes * channels));
  const samples = new Float32Array(frames);
  const channelData = channels === 1 ? [samples] : Array.from({ length: channels }, () => new Float32Array(frames));
  const read = (at: number): number => {
    if (format === 3) return bits === 64 ? view.getFloat64(at, true) : view.getFloat32(at, true);
    switch (bits) {
      case 8:
        return (view.getUint8(at) - 128) / 128;
      case 16:
        return view.getInt16(at, true) / 32768;
      case 24: {
        const v = view.getUint8(at) | (view.getUint8(at + 1) << 8) | (view.getInt8(at + 2) << 16);
        return v / 8388608;
      }
      case 32:
        return view.getInt32(at, true) / 2147483648;
      default:
        throw new WavError(`unsupported bit depth ${bits}`);
    }
  };
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) {
      const value = read(dataOffset + (f * channels + c) * bytes);
      (channelData[c] as Float32Array)[f] = value;
      sum += value;
    }
    samples[f] = sum / channels;
  }
  return { sampleRate, samples, channels, channelData };
}

/** Encodes mono samples as 16-bit PCM WAV. */
export function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const write = (offset: number, s: string) => [...s].forEach((ch, i) => view.setUint8(offset + i, ch.charCodeAt(0)));
  write(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) => view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 32767, true));
  return buffer;
}
