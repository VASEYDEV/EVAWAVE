import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * The library and sign-in pages before a Supabase project is configured (CI and local runs
 * have no project). They must say so plainly, keep the composer reachable, and pass the
 * WCAG 2.2 AA scan. The data paths are proven by tests/integration/library-rls.test.ts.
 */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

test("the library explains that Supabase is not configured and links to the composer", async ({ page }) => {
  await page.goto("/library");
  await expect(page.getByRole("heading", { name: "Library", level: 2 })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Supabase, which is not configured");
  await page.getByRole("status").getByRole("link", { name: "composer" }).click();
  await expect(page).toHaveURL("/");
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});

test("sign-in explains that it is unavailable without Supabase", async ({ page }) => {
  await page.goto("/login?next=//evil.example");
  await expect(page.getByRole("status")).toContainText("Sign-in is not available yet");
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});

test("the auth callback never redirects off-site", async ({ request }) => {
  const response = await request.get("/auth/confirm?token_hash=x&type=email&next=//evil.example", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(new URL(response.headers().location ?? "", "http://127.0.0.1").pathname).toBe("/login");
});

test("site navigation reaches both pages", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Site" }).getByRole("link", { name: "Library" }).click();
  await expect(page).toHaveURL("/library");
});
