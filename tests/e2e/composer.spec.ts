import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

/**
 * S3 acceptance (docs/SPEC.md §3): on a mobile viewport, build the §2.8 Hook B section
 * through the UI and match its Suno compile; undo every edit back to the empty spec and
 * redo it; an edit after an undo keeps the undone branch reachable. The expected brackets
 * are read from the spec at run time, never copied here.
 */
// Playwright runs from the repo root (playwright.config.ts) and loads specs as CommonJS.
const spec = readFileSync(join(process.cwd(), "docs/SPEC.md"), "utf8");
const afterHeading = spec.slice(spec.indexOf("Suno compile of this section"));
const HOOK_B_BRACKETS = afterHeading.slice(afterHeading.indexOf("```\n") + 4, afterHeading.indexOf("\n```", afterHeading.indexOf("```\n") + 4));

async function openModule(page: Page, number: number) {
  const details = page.locator(`section[data-module="${number}"] > details`);
  if (!(await details.evaluate((el) => (el as HTMLDetailsElement).open))) await details.locator("> summary").click();
}

async function addCue(page: Page, n: number, slot: string, text?: string, ref?: string) {
  await page.getByRole("button", { name: "Add cue to section 1" }).click();
  await page.getByLabel(`Section 1 cue ${n} slot`, { exact: true }).selectOption(slot);
  if (text !== undefined) await page.getByLabel(`Section 1 cue ${n} text`, { exact: true }).fill(text);
  if (ref !== undefined) await page.getByLabel(`Section 1 cue ${n} voices`, { exact: true }).fill(ref);
}

async function pick(page: Page, picker: string, query: string, option: string) {
  await page.getByLabel(`Search ${picker}`, { exact: true }).fill(query);
  await page.getByRole("button", { name: `Add ${option}`, exact: true }).click();
}

async function buildHookB(page: Page) {
  await openModule(page, 9);
  await page.getByLabel("New section kind").selectOption("hook");
  await page.getByLabel("New section label").fill("Hook B");
  await page.getByRole("button", { name: "Add section" }).click();
  await page.getByLabel("Section 1 bars", { exact: true }).fill("8");
  await page.getByLabel("Section 1 dynamics", { exact: true }).selectOption("f");
  await page.getByLabel("Section 1 mode", { exact: true }).selectOption("hijaz");

  await pick(page, "section 1 instruments", "Egyptian tabla", "Egyptian tabla");
  await pick(page, "section 1 instruments", "mizmar", "Mizmar");
  await pick(page, "section 1 instruments", "qanun", "Qanun");
  await pick(page, "section 1 synth roles", "hypersaw", "Ripping crackling hypersaw stab");
  await pick(page, "section 1 rhythms", "sa'idi", "Sa'idi (4/4)");

  await addCue(page, 1, "drums", "harder");
  await addCue(page, 2, "percussion", "Sa'idi tabla", "saidi");
  await addCue(page, 3, "lead", "mizmar lead stabs", "mizmar");
  await addCue(page, 4, "synth", "ripping crackling distorted synth stabs", "stab-hypersaw-crackling");
  await addCue(page, 5, "synth", "hypersaw stabs on 2 and 4", "stab-hypersaw-crackling");
  await addCue(page, 6, "lead", "qanun runs", "qanun");
  await addCue(page, 7, "contrast");

  await openModule(page, 8);
  await page.getByLabel("Pickup bar before this section").check();
  await page.getByLabel("Pickup length").selectOption("2");
  await page.getByLabel("Pickup content").fill("filter sweep closing, two-beat drum-roll pickup");
  await page.getByLabel("Announce the pickup bar").uncheck();
  await page.getByLabel("Contrast phrase in this section").check();
  await page.getByLabel("Contrast style", { exact: true }).selectOption("drill-contrast");
  await page.getByLabel("Contrast bars").fill("4");
  await page.getByLabel("Contrast changes").fill("sliding 808s\ndisplaced snare");
  await page.getByLabel("Contrast return rule").fill("then back to trap grid");
  await page.getByLabel("Contrast style word").fill("drill");
  await page.getByLabel("Silence drop").check();
}

test("builds Hook B through the UI, undoes to empty, redoes, and keeps undone branches", async ({ page }) => {
  expect(HOOK_B_BRACKETS.startsWith("[Filter sweep closing")).toBe(true);
  await page.goto("/");
  const lyrics = page.getByLabel("Suno Lyrics", { exact: true });
  const specJson = page.getByLabel("MusicSpec JSON", { exact: true });
  const undo = page.getByRole("button", { name: "Undo", exact: true });
  const redo = page.getByRole("button", { name: "Redo", exact: true });
  const empty = await specJson.inputValue();

  await buildHookB(page);
  await expect(lyrics).toHaveValue(HOOK_B_BRACKETS);
  const built = await specJson.inputValue();

  while (await undo.isEnabled()) await undo.click();
  await expect(specJson).toHaveValue(empty);
  await expect(lyrics).toHaveValue("");

  while (await redo.isEnabled()) await redo.click();
  await expect(specJson).toHaveValue(built);
  await expect(lyrics).toHaveValue(HOOK_B_BRACKETS);

  // Undo the last edit, then branch with a different one.
  await undo.click();
  await expect(lyrics).not.toHaveValue(HOOK_B_BRACKETS);
  await openModule(page, 9);
  await page.getByLabel("Section 1 dynamics", { exact: true }).selectOption("ff");
  await expect(redo).toBeDisabled();

  const goBack = page.getByRole("button", { name: /^Go to branch at edit \d+$/ });
  await expect(goBack).toHaveCount(1);
  await goBack.click();
  await expect(specJson).toHaveValue(built);
  await expect(lyrics).toHaveValue(HOOK_B_BRACKETS);
});

test("offers Udio only as halted, and switching target leaves the spec unchanged", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("radio", { name: "Udio" })).toBeDisabled();
  const specJson = page.getByLabel("MusicSpec JSON", { exact: true });
  const before = JSON.parse(await specJson.inputValue()) as { D10: { activeTarget: string } };
  await page.getByRole("radio", { name: "Google Flow Music" }).check();
  await expect(page.getByLabel("Google Flow Music Producer chat", { exact: true })).toBeVisible();
  const after = JSON.parse(await specJson.inputValue()) as { D10: { activeTarget: string } };
  expect({ ...after, D10: { ...after.D10, activeTarget: "suno" } }).toEqual(before);
});
