import { defineConfig, devices } from "@playwright/test";

/**
 * Browser E2E for the critical journeys (AD17). Expects the local stack running:
 * docker services, the API on :8010 and the web app on :3000. The global setup reseeds demo data.
 */
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  // The local stack (PHP built-in server on Windows, Postgres in Docker) answers in 0.5–3 s per request;
  // 15 s for visible-state checks avoids false failures without hiding real ones (a broken step never appears).
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  // channel "chromium": full Chromium in new-headless mode. E2E_CHROME (optional, local only) points at an
  // already-installed Chromium executable when the matching Playwright build hasn't been downloaded yet.
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chromium",
        launchOptions: process.env.E2E_CHROME ? { executablePath: process.env.E2E_CHROME } : {},
      },
    },
  ],
});
