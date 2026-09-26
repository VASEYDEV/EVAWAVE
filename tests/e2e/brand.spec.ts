import { expect, test } from "@playwright/test";

/**
 * The brand system as rendered (ADR 0005): the three typefaces load and take their roles,
 * and the VASEY/AI signature appears exactly once per page, whatever is open.
 */
async function openEveryModule(page: import("@playwright/test").Page) {
  for (const details of await page.locator("section[data-module] > details").all()) {
    if (!(await details.evaluate((el) => (el as HTMLDetailsElement).open))) await details.locator("> summary").click();
  }
}

test("the interface is set in the brand's three typefaces, and they load", async ({ page }) => {
  await page.goto("/");
  const faces = await page.evaluate(async () => {
    await document.fonts.ready;
    // The bundler names each family after its next/font/local export, so resolve every role's
    // family through the page's own @font-face rules to the file it actually loads.
    const declared = new Map<string, { src: string; features: string }>();
    for (const sheet of document.styleSheets) {
      for (const rule of sheet.cssRules) {
        if (rule instanceof CSSFontFaceRule) {
          const family = rule.style.getPropertyValue("font-family").replace(/^["']|["']$/g, "");
          declared.set(family, { src: rule.style.getPropertyValue("src"), features: rule.style.getPropertyValue("font-feature-settings") });
        }
      }
    }
    const role = (el: Element | null) => {
      const stack = el ? getComputedStyle(el).fontFamily : "";
      const family = stack.split(",")[0]!.trim().replace(/^["']|["']$/g, "");
      return { family, loaded: document.fonts.check(`16px "${family}"`), ...(declared.get(family) ?? { src: "", features: "" }) };
    };
    return { body: role(document.body), wordmark: role(document.querySelector("h1")), readout: role(document.querySelector(".readout")) };
  });
  expect(faces.body.src).toMatch(/RedditSans.*\.woff2/);
  expect(faces.wordmark.src).toMatch(/BebasNeue.*\.woff2/);
  expect(faces.readout.src).toMatch(/JetBrainsMono.*\.woff2/);
  expect([faces.body.loaded, faces.wordmark.loaded, faces.readout.loaded]).toEqual([true, true, true]);
  expect(new Set([faces.body.family, faces.wordmark.family, faces.readout.family]).size).toBe(3);
  // Ligatures off for the technical face (guide §06), carried in the face itself.
  expect(faces.readout.features).toMatch(/["']liga["'] 0/);
});

test("BEAM appears exactly once per page: the kicker's slash", async ({ page }) => {
  await page.goto("/");
  await openEveryModule(page);
  const count = () =>
    page.evaluate(() => {
      const probe = document.createElement("span");
      probe.style.color = "var(--vm-beam)";
      document.body.append(probe);
      const beam = getComputedStyle(probe).color;
      probe.remove();
      let n = 0;
      for (const el of document.querySelectorAll("body *")) {
        const s = getComputedStyle(el);
        const inks = [s.color, s.backgroundColor, s.borderTopColor, s.borderRightColor, s.borderBottomColor, s.borderLeftColor];
        if (inks.includes(beam) || s.boxShadow.includes(beam) || s.filter.includes(beam) || s.backgroundImage.includes(beam)) n++;
      }
      return n;
    });
  expect(await count()).toBe(1);
  await expect(page.locator(".kicker .beam")).toHaveText("/");
  await expect(page.locator(".kicker")).toHaveText("VASEY/AI");
  // The same holds on the other pages.
  for (const path of ["/import", "/library", "/login"]) {
    await page.goto(path);
    expect(await count(), path).toBe(1);
  }
});
