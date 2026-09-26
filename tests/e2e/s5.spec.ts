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

test("imports a WAV into a reviewed audio-analysis style profile, sending no audio", async ({ page }) => {
  const sent: { url: string; bytes: number; riff: boolean }[] = [];
  page.on("request", (request) => {
    const body = request.postDataBuffer();
    sent.push({ url: request.url(), bytes: body?.length ?? 0, riff: body?.includes("RIFF") ?? false });
  });
  const wav = Buffer.from(encodeWav(mix(clickTrack(140, 12, 22050), triad(62, true, 12, 22050)), 22050));

  await page.goto("/import");
  await page.getByLabel("Choose an audio file, or drop one here").setInputFiles({ name: "desert-loop.wav", mimeType: "audio/wav", buffer: wav });
  const review = page.getByRole("list", { name: /^Proposed fields/ });
  await expect(review).toBeVisible({ timeout: 30_000 });
  const tempoItem = review.getByRole("listitem").filter({ has: page.getByText("/D6/tempo", { exact: true }) });
  await expect(tempoItem).toContainText("bpm: 140");
  await expect(page.getByLabel("Accept /D6/tempo")).toBeChecked();
  await expect(page.getByLabel("Accept /D6/key")).toBeChecked();

  await page.getByRole("button", { name: "Create style profile" }).click();
  await expect(page.getByTestId("provenance")).toHaveText("audio-analysis");
  await expect(page.getByTestId("profile-tempo")).toHaveText("140 BPM (analysis)");

  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
  const [scroll, viewport] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(scroll).toBeLessThanOrEqual(viewport);
  expect(sent.filter((r) => r.riff || r.bytes > 10_000)).toEqual([]);
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
