import { defineConfig } from "@playwright/test";
import baseConfig from "../playwright.config";
import { EnvConfig } from "../tests/helpers/config-fixtures";
import path from "path";

console.log("✅ LOADING TEST ENV SETTINGS");

export default defineConfig<EnvConfig>({
  /*
   * Inherit base config
   */
  ...baseConfig,

  /*
   * Explicit test directory
   */
  testDir: path.resolve(process.cwd(), "./tests"),

  /*
   * IMPORTANT:
   * Since this config is directly executed using:
   *
   * --config=config/test.playwright.config.ts
   *
   * reporters MUST exist here as well.
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
          environment: "TEST",
          appName: "CURA",
          release: "Release 1.1",
          node_version: process.version,
          os: process.platform,
          ci: String(!!process.env.CI),
        },
      },
    ],
  ],

  /*
   * Runtime Settings
   */
  use: {
    ...baseConfig.use,

    envName: "test",

    appURL: "https://katalon-demo-cura.herokuapp.com/",

    nopCommerceWeb: "https://admin-demo.nopcommerce.com",

    apiURL: "https://reqres.in/api",

    dbConfig: {
      server: "",
      dbname: "",
      connnectionStr: "",
    },

    trace: "retain-on-failure",

    screenshot: "only-on-failure",

    video: "retain-on-failure",

    testIdAttribute: "data-testid",
  },

  /*
   * CI Optimizations
   */
  retries: process.env.CI ? 1 : 0,

  workers: process.env.CI ? 1 : undefined,

  /*
   * Output Directory
   */
  outputDir: "test-results",
});