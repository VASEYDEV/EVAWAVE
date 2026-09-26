import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * WCAG 2.2 AA (CLAUDE.md §4) on the mobile viewport: every module open, one section with a
 * cue and every transition block present, so the scan sees each kind of control.
 */
test("the composer has no WCAG 2.2 A or AA violations", async ({ page }) => {
  await page.goto("/");
  for (const details of await page.locator("section[data-module] > details").all()) {
    if (!(await details.evaluate((el) => (el as HTMLDetailsElement).open))) await details.locator("> summary").click();
  }
  await page.getByLabel("New section label").fill("Hook B");
  await page.getByRole("button", { name: "Add section" }).click();
  await page.getByRole("button", { name: "Add cue to section 1" }).click();
  await page.getByLabel("Pickup bar before this section").check();
  await page.getByLabel("Contrast phrase in this section").check();
  await page.getByLabel("Silence drop").check();
  await page.getByLabel("State a block transition rule").check();

  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.length} node(s) — ${v.help}`)).toEqual([]);
});
