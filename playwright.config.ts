import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

dotenv.config({
  path: path.resolve(__dirname, ".env"),
});

console.log("✅ Playwright base config loaded");

const isCI = !!process.env.CI;

export default defineConfig({
  /*
   * Test Directory
   */
  testDir: "./tests",

  /*
   * Global Timeout
   */
  globalTimeout: 3 * 60 * 60 * 1000,

  /*
   * Individual Test Timeout
   */
  timeout: 60 * 1000,

  /*
   * Expect Timeout
   */
  expect: {
    timeout: 10_000,
  },

  /*
   * Parallel Settings
   */
  fullyParallel: false,

  /*
   * CI Safety
   */
  forbidOnly: isCI,

  /*
   * Retries
   */
  retries: isCI ? 1 : 0,

  /*
   * Workers
   */
  workers: isCI ? 1 : undefined,

  /*
   * Global Hooks
   */
  globalSetup: require.resolve("./tests/helpers/global-setup.ts"),

  globalTeardown: require.resolve("./tests/helpers/global-teardown.ts"),

  /*
   * Reporters
   */
  reporter: [
    ["line"],

    [
      "json",
      {
        outputFile: "results.json",
      },
    ],

    [
      "html",
      {
        outputFolder: "playwright-report",
        open: "never",
      },
    ],

    [
      "allure-playwright",
      {
        outputFolder: "allure-results",

        detail: true,

        suiteTitle: true,

        environmentInfo: {
          environment: process.env.ENV || "TEST",
          appName: "CURA",
          release: "Release 1.1",
          node_version: process.version,
          os: process.platform,
          ci: String(isCI),
        },
      },
    ],
  ],

  /*
   * Shared Settings
   */
  use: {
    /*
     * Headless Mode
     */
    headless: true,

    /*
     * HTTPS
     */
    ignoreHTTPSErrors: true,

    /*
     * Timeouts
     */
    navigationTimeout: 30_000,

    actionTimeout: 15_000,

    /*
     * Artifacts
     */
    trace: "retain-on-failure",

    screenshot: "only-on-failure",

    video: "retain-on-failure",

    /*
     * Browser Identity
     */
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",

    /*
     * Stable Viewport
     */
    viewport: {
      width: 1440,
      height: 900,
    },

    /*
     * Stable Selectors
     */
    testIdAttribute: "data-testid",
  },

  /*
   * Browser Projects
   */
  projects: [
    {
      name: "chromium",

      use: {
        ...devices["Desktop Chrome"],

        launchOptions: {
          headless: true,

          args: [
            "--disable-blink-features=AutomationControlled",
            "--disable-features=IsolateOrigins,site-per-process",
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--disable-setuid-sandbox",
            "--disable-gpu",
            "--window-size=1440,900",
          ],
        },
      },
    },
  ],

  /*
   * Test Output
   */
  outputDir: "test-results",
});