
import { readFile } from "node:fs/promises";

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { encodeWav } from "../../src/core/musicspec/analysis/wav";
import { clickTrack, mix, triad } from "../support/signals";

/**
 * S5 acceptance on the mobile viewport (docs/SPEC.md §3): an imported WAV yields an
 * audio-analysis StyleProfile through the review diff, with no audio on the wire; tap tempo
 * assigns 140 BPM from taps 428 ms apart; every module header shows its hue and icon.
 */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

test("refuses a recording longer than the import limit from its metadata, before any analysis", async ({ page }) => {
  const wav = Buffer.from(encodeWav(clickTrack(120, 4, 22050), 22050));
  await page.addInitScript(() => {
    // The media element's metadata says 11 minutes; the file itself is short.
    Object.defineProperty(HTMLMediaElement.prototype, "duration", { get: () => 11 * 60 });
    const Native = window.Worker;
    const started: string[] = [];
    (window as unknown as { workersStarted: string[] }).workersStarted = started;
    window.Worker = class extends Native {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        started.push(String(url));
      }
    };
  });
  await page.goto("/import");
  await page.getByLabel("Choose an audio file, or drop one here").setInputFiles({ name: "long-take.wav", mimeType: "audio/wav", buffer: wav });
  await expect(page.getByRole("status")).toContainText("This recording is 11 minutes long; imports take recordings up to 10 minutes for now.", { timeout: 15_000 });
  expect(await page.evaluate(() => (window as unknown as { workersStarted: string[] }).workersStarted)).toEqual([]);
});

test("imports a WAV into a reviewed audio-analysis style profile, sending no audio", async ({ page }) => {
  const sent: { url: string; bytes: number; riff: boolean }[] = [];
  page.on("request", (request) => {
    const body = request.postDataBuffer();
    sent.push({ url: request.url(), bytes: body?.length ?? 0, riff: body?.includes("RIFF") ?? false });
  });
  const wav = Buffer.from(encodeWav(mix(clickTrack(140, 12, 22050), triad(62, true, 12, 22050)), 22050));

  // Record every worker the page starts: analysis must run in one, off the main thread. Record
  // the rate each decode returns: the 22.05 kHz file decodes at the fixed 48 kHz.
  await page.addInitScript(() => {
    const Native = window.Worker;
    const started: string[] = [];
    (window as unknown as { workersStarted: string[] }).workersStarted = started;
    window.Worker = class extends Native {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        started.push(String(url));
      }
    };
    const decodedAt: number[] = [];
    (window as unknown as { decodedAt: number[] }).decodedAt = decodedAt;
    window.OfflineAudioContext = class extends window.OfflineAudioContext {
      override async decodeAudioData(data: ArrayBuffer): Promise<AudioBuffer> {
        const buffer = await super.decodeAudioData(data);
        decodedAt.push(buffer.sampleRate);
        return buffer;
      }
    };
  });
  await page.goto("/import");
  await page.getByLabel("Choose an audio file, or drop one here").setInputFiles({ name: "desert-loop.wav", mimeType: "audio/wav", buffer: wav });
  const review = page.getByRole("list", { name: /^Proposed fields/ });
  await expect(review).toBeVisible({ timeout: 30_000 });
  expect(await page.evaluate(() => (window as unknown as { workersStarted: string[] }).workersStarted)).toEqual(["/workers/analysis.worker.js"]);
  expect(await page.evaluate(() => (window as unknown as { decodedAt: number[] }).decodedAt)).toEqual([48000]);
  const tempoItem = review.getByRole("listitem").filter({ has: page.getByText("/D6/tempo", { exact: true }) });
  await expect(tempoItem).toContainText("bpm: 140");
  await expect(page.getByLabel("Accept /D6/tempo")).toBeChecked();
  await expect(page.getByLabel("Accept /D6/key")).toBeChecked();

  // The blob is kept in OPFS (under audio/<owner>/<sha256>) only with a library save: not
  // after import, not after Create, and not with a download, which nothing in the app could
  // later remove. So the audio directory stays empty, whatever the layout under it.
  const kept = () =>
    page.evaluate(async () => {
      try {
        const dir = (await (await navigator.storage.getDirectory()).getDirectoryHandle("audio")) as unknown as { keys(): AsyncIterator<string> };
        return !(await dir.keys().next()).done;
      } catch {
        return false;
      }
    });
  expect(await kept()).toBe(false);

  await page.getByRole("button", { name: "Create style profile" }).click();
  await expect(page.getByTestId("provenance")).toHaveText("audio-analysis");
  await expect(page.getByTestId("profile-tempo")).toHaveText("140 BPM (analysis)");
  expect(await kept()).toBe(false);

  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download profile JSON" }).click();
  const first = await downloaded;
  expect(first.suggestedFilename()).toBe("desert-loop-style-profile.json");
  await expect(page.getByRole("status")).toContainText("Only a library save keeps the audio on this device.");
  expect(await kept()).toBe(false);
  const created = JSON.parse(await readFile(await first.path(), "utf8")) as { id: string; spec: { D6?: { tempo?: unknown } } };
  expect(created.spec.D6?.tempo).toEqual({ bpm: 140, source: "analysis" });

  // Edits after Create reach the profile: unticking the tempo and renaming change what a
  // download (or a save) sends, and the profile keeps its id.
  await page.getByLabel("Accept /D6/tempo").uncheck();
  await page.getByLabel("Profile name").fill("Desert loop without tempo");
  await expect(page.getByTestId("profile-tempo")).toHaveText("not set");
  await expect(page.getByRole("heading", { name: "Desert loop without tempo" })).toBeVisible();
  const redownloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download profile JSON" }).click();
  const second = await redownloaded;
  expect(second.suggestedFilename()).toBe("desert-loop-without-tempo-style-profile.json");
  const edited = JSON.parse(await readFile(await second.path(), "utf8")) as { id: string; name: string; spec: { D6?: { tempo?: unknown } } };
  expect(edited).toMatchObject({ id: created.id, name: "Desert loop without tempo" });
  expect(edited.spec.D6?.tempo).toBeUndefined();

  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
  const [scroll, viewport] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(scroll).toBeLessThanOrEqual(viewport);
  expect(sent.filter((r) => r.riff || r.bytes > 10_000)).toEqual([]);
});

test("leaving the import page stops an analysis in flight", async ({ page }) => {
  // A worker that never answers, so the analysis is still running when the page is left.
  await page.route("**/workers/analysis.worker.js", (route) => route.fulfill({ contentType: "text/javascript", body: "self.onmessage = () => {};" }));
  await page.addInitScript(() => {
    const Native = window.Worker;
    const log = { started: 0, terminated: 0 };
    (window as unknown as { workerLog: typeof log }).workerLog = log;
    window.Worker = class extends Native {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        log.started += 1;
      }
      override terminate() {
        log.terminated += 1;
        super.terminate();
      }
    };
  });
  const workerLog = () => page.evaluate(() => (window as unknown as { workerLog: { started: number; terminated: number } }).workerLog);
  await page.goto("/import");
  await page.getByLabel("Choose an audio file, or drop one here").setInputFiles({ name: "held.wav", mimeType: "audio/wav", buffer: Buffer.from(encodeWav(clickTrack(120, 4, 22050), 22050)) });
  await expect.poll(async () => (await workerLog()).started).toBe(1);
  expect((await workerLog()).terminated).toBe(0);
  await page.getByRole("link", { name: "Composer" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect.poll(async () => (await workerLog()).terminated).toBe(1);
});

test("tap tempo reads 140 BPM from taps 428 ms apart and assigns it", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-09-26T12:00:00Z") });
  await page.goto("/");
  await page.clock.pauseAt(new Date("2026-09-26T12:00:05Z"));
  const tapButton = page.getByRole("button", { name: "Tap", exact: true });
  for (let i = 0; i < 4; i++) {
    if (i) await page.clock.runFor(428);
    await tapButton.click();
  }
  await expect(page.getByTestId("tap-reading")).toContainText("140 BPM · half 70 · double 280");
  await page.getByRole("button", { name: "Assign 140 BPM" }).click();
  const spec = JSON.parse(await page.getByLabel("MusicSpec JSON", { exact: true }).inputValue()) as { D6: { tempo: unknown } };
  expect(spec.D6.tempo).toEqual({ bpm: 140, source: "tap" });
  await expect(page.getByLabel("Bar math")).toContainText("1 bar = 1.714 s");

  // A 2 s gap resets the sequence.
  await page.clock.runFor(2100);
  await expect(page.getByTestId("tap-reading")).toHaveText("Tap four times on the beat.");
});

test("every module header shows its hue and icon", async ({ page }) => {
  await page.goto("/");
  const expected = ["form", "key", "drums", "bundle", "instruments", "technique", "textures", "transitions", "sections", "mood", "output"];
  const modules = page.locator("section[data-module]");
  await expect(modules).toHaveCount(expected.length);
  for (const [i, key] of expected.entries()) {
    const section = page.locator(`section[data-module="${i + 1}"]`);
    await expect(section).toHaveAttribute("data-hue", key);
    await expect(section.locator(`summary svg[data-module-icon="${key}"]`)).toBeVisible();
    const [iconColour, hueColour] = await section.evaluate((el, name) => {
      const probe = document.createElement("span");
      probe.style.color = `var(--mod-${name})`;
      document.body.append(probe);
      const hue = getComputedStyle(probe).color;
      probe.remove();
      return [getComputedStyle(el.querySelector("summary svg") as Element).color, hue];
    }, key);
    expect(iconColour).toBe(hueColour);
  }
});
