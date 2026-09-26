/**
 * The metronome (docs/SPEC.md §1.8): a Web Audio lookahead scheduler. A 25 ms timer asks the
 * pure `scheduleClicks` for the clicks due in the next 100 ms and schedules them on the
 * audio clock, so timing stays sample-accurate even when the main thread is busy.
 */
import {
  cursorAfter,
  METRONOME_LOOKAHEAD_SEC,
  METRONOME_TICK_MS,
  scheduleClicks,
  startCursor,
  type Click,
  type MetronomeCursor,
  type MetronomeSettings,
} from "@/core/musicspec/tempo";

const PITCH: Record<Click["accent"], number> = { bar: 1600, beat: 1000, sub: 700 };
const LEVEL: Record<Click["accent"], number> = { bar: 1, beat: 0.6, sub: 0.3 };

/** A click on the audio graph, kept until it has sounded so a settings change can drop it. */
interface Queued {
  click: Click;
  /** Disconnecting it silences the click. */
  gain: GainNode;
}

const sameSettings = (a: MetronomeSettings, b: MetronomeSettings) =>
  a.bpm === b.bpm && a.beatsPerBar === b.beatsPerBar && a.halfTimeAccent === b.halfTimeAccent && a.subdivision === b.subdivision;

export class Metronome {
  private context: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private starting: Promise<void> | null = null;
  private cursor: MetronomeCursor = startCursor(0);
  /** Where this run's clicks started, for a re-time before any has sounded. */
  private origin: MetronomeCursor = startCursor(0);
  /** Clicks not yet sounded, after the last one that has. */
  private queued: Queued[] = [];

  constructor(
    private settings: MetronomeSettings,
    private volume = 0.5,
  ) {}

  get running(): boolean {
    return this.timer !== null;
  }

  /**
   * Takes new settings. Clicks already queued for up to the lookahead ahead were built on the
   * old ones, so a change drops those not yet sounding and schedules again from the last click
   * that has: a new tempo is heard from the next beat, not once the queue drains (§1.8).
   */
  update(settings: MetronomeSettings, volume: number): void {
    const changed = volume !== this.volume || !sameSettings(settings, this.settings);
    this.settings = settings;
    this.volume = volume;
    if (changed) this.retime();
  }

  private retime(): void {
    const context = this.context;
    if (!context || this.timer === null) return;
    const now = context.currentTime;
    const sounded = this.queued.filter((q) => q.click.time <= now);
    for (const q of this.queued) {
      if (q.click.time > now) q.gain.disconnect();
    }
    const last = sounded.at(-1);
    this.queued = last ? [last] : [];
    this.cursor = last ? cursorAfter(last.click) : this.origin;
    this.tick();
  }

  /**
   * Starts the clicks. A second call while the first awaits `resume()` joins it, so a double
   * tap never makes two contexts and two schedulers.
   */
  async start(): Promise<void> {
    if (this.running) return;
    this.starting ??= this.begin().finally(() => {
      this.starting = null;
    });
    return this.starting;
  }

  private async begin(): Promise<void> {
    const context = new AudioContext();
    this.context = context;
    try {
      await context.resume();
    } catch (error) {
      // Audio output blocked or unavailable: release this context so a retry starts clean.
      if (this.context === context) this.context = null;
      await context.close().catch(() => undefined);
      throw error;
    }
    // Stopped while resuming: stop() already closed this context.
    if (this.context !== context) return;
    this.origin = startCursor(context.currentTime + 0.05);
    this.cursor = this.origin;
    this.queued = [];
    this.timer = setInterval(() => this.tick(), METRONOME_TICK_MS);
    this.tick();
  }

  async stop(): Promise<void> {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.queued = [];
    const context = this.context;
    this.context = null;
    await context?.close();
  }

  private tick(): void {
    const context = this.context;
    if (!context) return;
    const now = context.currentTime;
    // Forget the clicks that have sounded, except the last, which a re-time restarts from.
    const sounded = this.queued.filter((q) => q.click.time <= now);
    this.queued = [...sounded.slice(-1), ...this.queued.filter((q) => q.click.time > now)];
    const { clicks, cursor } = scheduleClicks(this.cursor, now + METRONOME_LOOKAHEAD_SEC, this.settings, now);
    this.cursor = cursor;
    for (const click of clicks) this.queued.push({ click, gain: this.play(context, click) });
  }

  private play(context: AudioContext, click: Click): GainNode {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.frequency.value = PITCH[click.accent];
    const peak = Math.max(0.0001, this.volume * LEVEL[click.accent]);
    gain.gain.setValueAtTime(peak, click.time);
    gain.gain.exponentialRampToValueAtTime(0.0001, click.time + 0.03);
    osc.connect(gain).connect(context.destination);
    osc.start(click.time);
    osc.stop(click.time + 0.04);
    return gain;
  }
}
