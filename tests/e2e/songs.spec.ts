import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * S6 on the phone viewport before a Supabase project is configured (CI and local runs have
 * none): the composer's Song panel and a song page say so plainly and keep the composer in
 * reach. The data paths are proven by tests/integration/songs-rls.test.ts and the songs
 * repository tests. The tool is VASEY/AI; the output brand label on song data is never shown.
 */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const SONG = "/songs/11111111-1111-4111-8111-111111111111";

test("the composer's Song panel says songs need Supabase, and the composer still works", async ({ page }) => {
  await page.goto("/");
  const panel = page.getByRole("region", { name: "Song" });
  await expect(panel).toContainText("Songs need Supabase, which is not configured for this deployment.");
  await expect(panel.getByRole("button")).toHaveCount(0);
  await page.getByLabel("Tempo (BPM)").fill("141");
  await expect(page.getByLabel("Tempo (BPM)")).toHaveValue("141");
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});

test("a song page explains that Supabase is not configured and links to the composer", async ({ page }) => {
  await page.goto(SONG);
  await expect(page.getByRole("heading", { name: "Song", level: 2 })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Songs need Supabase, which is not configured");
  await page.getByRole("status").getByRole("link", { name: "composer" }).click();
  await expect(page).toHaveURL("/");
  const back = await page.goto(SONG);
  expect(back?.status()).toBe(200);
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});

test("no page shows the output brand's name: the app is a VASEY/AI tool", async ({ page }) => {
  for (const path of ["/", "/import", "/library", "/login", SONG]) {
    await page.goto(path);
    expect(await page.locator("body").innerText(), path).not.toContain("VASEY.AUDIO");
  }
});
