import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

dotenv.config({
  path: path.resolve(__dirname, ".env"),
});

console.log("✅ Playwright config loaded");

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./tests",

  globalTimeout: 3 * 60 * 60 * 1000,

  timeout: 60 * 1000,

  expect: {
    timeout: 10_000,
  },

  forbidOnly: isCI,

  retries: isCI ? 1 : 0,

  fullyParallel: false,

  workers: isCI ? 1 : undefined,

  globalSetup: require.resolve("./tests/helpers/global-setup.ts"),
  globalTeardown: require.resolve("./tests/helpers/global-teardown.ts"),

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

  use: {
    headless: true,

    ignoreHTTPSErrors: true,

    navigationTimeout: 30_000,

    actionTimeout: 15_000,

    trace: "retain-on-failure",

    screenshot: "only-on-failure",

    video: "retain-on-failure",

    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",

    viewport: {
      width: 1440,
      height: 900,
    },

    testIdAttribute: "data-testid",
  },

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

  outputDir: "test-results/",
});