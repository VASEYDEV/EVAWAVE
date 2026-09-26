/**
 * The metronome (docs/SPEC.md §1.8): a Web Audio lookahead scheduler. A 25 ms timer asks the
 * pure `scheduleClicks` for the clicks due in the next 100 ms and schedules them on the
 * audio clock, so timing stays sample-accurate even when the main thread is busy.
 */
import { METRONOME_LOOKAHEAD_SEC, METRONOME_TICK_MS, scheduleClicks, startCursor, type Click, type MetronomeCursor, type MetronomeSettings } from "@/core/musicspec/tempo";

const PITCH: Record<Click["accent"], number> = { bar: 1600, beat: 1000, sub: 700 };
const LEVEL: Record<Click["accent"], number> = { bar: 1, beat: 0.6, sub: 0.3 };

export class Metronome {
  private context: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private starting: Promise<void> | null = null;
  private cursor: MetronomeCursor = startCursor(0);

  constructor(
    private settings: MetronomeSettings,
    private volume = 0.5,
  ) {}

  get running(): boolean {
    return this.timer !== null;
  }

  update(settings: MetronomeSettings, volume: number): void {
    this.settings = settings;
    this.volume = volume;
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
    this.cursor = startCursor(context.currentTime + 0.05);
    this.timer = setInterval(() => this.tick(), METRONOME_TICK_MS);
    this.tick();
  }

  async stop(): Promise<void> {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    const context = this.context;
    this.context = null;
    await context?.close();
  }

  private tick(): void {
    const context = this.context;
    if (!context) return;
    const { clicks, cursor } = scheduleClicks(this.cursor, context.currentTime + METRONOME_LOOKAHEAD_SEC, this.settings, context.currentTime);
    this.cursor = cursor;
    for (const click of clicks) this.play(context, click);
  }

  private play(context: AudioContext, click: Click): void {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.frequency.value = PITCH[click.accent];
    const peak = Math.max(0.0001, this.volume * LEVEL[click.accent]);
    gain.gain.setValueAtTime(peak, click.time);
    gain.gain.exponentialRampToValueAtTime(0.0001, click.time + 0.03);
    osc.connect(gain).connect(context.destination);
    osc.start(click.time);
    osc.stop(click.time + 0.04);
  }
}
