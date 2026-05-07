import { test as base } from "@playwright/test";
import fs from "fs";
import path from "path";

export type EnvConfig = {
  envName: string;
  appURL: string;
  dbConfig: {};
  nopCommerceWeb: string;
  apiURL: string;
};

export const test = base.extend<EnvConfig>({
  envName: ["test", { option: true }],

  appURL: ["<provideURL>", { option: true }],

  dbConfig: [{}, { option: true }],

  nopCommerceWeb: [
    "provideURL",
    { option: true },
  ],

  apiURL: [
    "<provideURL>",
    { option: true },
  ],
});

test.afterEach(
  async ({ page }, testInfo) => {
    if (
      testInfo.status !==
      testInfo.expectedStatus
    ) {
      try {
        const html =
          await page.content();

        fs.mkdirSync(
          "test-results",
          {
            recursive: true,
          }
        );

        const safeTitle =
          testInfo.title.replace(
            /\W+/g,
            "-"
          );

        const filePath =
          path.join(
            "test-results",
            `${safeTitle}-dom.html`
          );

        fs.writeFileSync(
          filePath,
          html
        );

        console.log(
          `DOM snapshot saved: ${filePath}`
        );
      } catch (error) {
        console.error(
          "DOM capture failed"
        );

        console.error(error);
      }
    }
  }
);