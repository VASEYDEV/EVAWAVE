import { expect, test } from "@playwright/test";

/** Mobile-first (CLAUDE.md §4): no page scrolls sideways on the phone viewport. */
for (const path of ["/", "/import", "/library", "/login"]) {
  test(`${path} has no horizontal page scroll`, async ({ page }) => {
    await page.goto(path);
    for (const details of await page.locator("section[data-module] > details").all()) {
      if (!(await details.evaluate((el) => (el as HTMLDetailsElement).open))) await details.locator("> summary").click();
    }
    const [scroll, viewport] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    expect(scroll).toBeLessThanOrEqual(viewport);
  });
}
