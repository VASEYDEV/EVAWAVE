import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests on a mobile viewport (docs/SPEC.md §3, S3). The web server is the
 * production build, so `npm run build` runs first (the gate does this).
 *
 * PLAYWRIGHT_CHROMIUM_EXECUTABLE points at a pre-installed Chromium when the matching
 * Playwright browser is not installed (sandboxed environments). CI installs the browser.
 */
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const port = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], ...(executablePath ? { launchOptions: { executablePath } } : {}) },
    },
  ],
  webServer: {
    command: `npm run start -- -p ${port} -H 127.0.0.1`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
