# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: functional/make.aptmnt.spec.ts >> Make Appointment >> Should make an appointment with non-default values
- Location: tests/functional/make.aptmnt.spec.ts:33:9

# Error details

```
TimeoutError: locator.click: Timeout 15000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Logan' })

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - link "" [ref=e2] [cursor=pointer]:
    - /url: "#"
    - generic [ref=e3]: 
  - navigation [ref=e4]:
    - list [ref=e5]:
      - link "" [ref=e6] [cursor=pointer]:
        - /url: "#"
        - generic [ref=e7]: 
      - listitem [ref=e8]:
        - link "CURA Healthcare" [ref=e9] [cursor=pointer]:
          - /url: ./
      - listitem [ref=e10]:
        - link "Home" [ref=e11] [cursor=pointer]:
          - /url: ./
      - listitem [ref=e12]:
        - link "Login" [ref=e13] [cursor=pointer]:
          - /url: profile.php#login
  - banner [ref=e14]:
    - generic [ref=e15]:
      - heading "CURA Healthcare Service" [level=1] [ref=e16]
      - heading "We Care About Your Health" [level=3] [ref=e17]
      - link "Make Appointment" [ref=e18] [cursor=pointer]:
        - /url: ./profile.php#login
  - generic [ref=e21]:
    - generic [ref=e22]:
      - heading "Login" [level=2] [ref=e23]
      - paragraph [ref=e24]: Please login to make appointment.
    - generic [ref=e26]:
      - generic [ref=e27]:
        - generic [ref=e28]:
          - generic [ref=e29]: Demo account
          - generic [ref=e31]:
            - generic [ref=e33]: 
            - textbox "Username" [ref=e34]: John Doe
        - generic [ref=e37]:
          - generic [ref=e39]: 
          - textbox "Password" [ref=e40]: ThisIsNotAPassword
      - generic [ref=e41]:
        - generic [ref=e42]: Username
        - textbox "Username" [ref=e44]: John Doe
      - generic [ref=e45]:
        - generic [ref=e46]: Password
        - textbox "Password" [active] [ref=e48]: ThisIsNotAPassword
      - button "Login" [ref=e51] [cursor=pointer]
  - contentinfo [ref=e52]:
    - generic [ref=e55]:
      - heading "CURA Healthcare Service" [level=4] [ref=e56]:
        - strong [ref=e57]: CURA Healthcare Service
      - paragraph [ref=e58]:
        - text: Atlanta 550 Pharr Road NE Suite 525
        - text: Atlanta, GA 30305
      - list [ref=e59]:
        - listitem [ref=e60]:
          - generic [ref=e61]: 
          - text: (678) 813-1KMS
        - listitem [ref=e62]:
          - generic [ref=e63]: 
          - link "info@katalon.com" [ref=e64] [cursor=pointer]:
            - /url: mailto:info@katalon.com
      - list [ref=e65]:
        - listitem [ref=e66]:
          - link "" [ref=e67] [cursor=pointer]:
            - /url: "#"
            - generic [ref=e68]: 
        - listitem [ref=e69]:
          - link "" [ref=e70] [cursor=pointer]:
            - /url: "#"
            - generic [ref=e71]: 
        - listitem [ref=e72]:
          - link "" [ref=e73] [cursor=pointer]:
            - /url: "#"
            - generic [ref=e74]: 
      - separator [ref=e75]
      - paragraph [ref=e76]: Copyright © CURA Healthcare Service 2026
    - link "" [ref=e77] [cursor=pointer]:
      - /url: "#top"
      - generic [ref=e78]: 
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | import { log } from "../helpers/logger.js";
  3  | 
  4  | test.describe("Make Appointment", () => {
  5  |     test.beforeEach("Login with valid creds", async ({ page }, testInfo) => {
  6  |         // 1. Launch URL and assert title and header
  7  | 
  8  |         // Get the URL from config file
  9  |         const envConfig = testInfo.project.use as any;
  10 | 
  11 |         // Custom logs
  12 |         await log("info", `Launching the web app in ${envConfig.envName}`)
  13 | 
  14 |         await page.goto(envConfig.appURL);
  15 |         await expect(page).toHaveTitle("CURA Healthcare Service");
  16 |         await expect(page.locator("//h1")).toHaveText("CURA Healthcare Service");
  17 | 
  18 |         // 2. Click on the Make Appointment
  19 |         await page.getByRole("link", { name: "Make Appointment" }).click();
  20 |         await expect(page.getByText("Please login to make")).toBeVisible();
  21 | 
  22 |         // Successful login
  23 |         await page.getByLabel("Username").fill(process.env.TEST_USER_NAME);
  24 |         await page.getByLabel("Password").fill(process.env.TEST_PASSWORD);
> 25 |         await page.getByRole("button", { name: "Logan" }).click();
     |                                                           ^ TimeoutError: locator.click: Timeout 15000ms exceeded.
  26 | 
  27 |         // Assert a text
  28 |         await expect(page.locator("h2")).toContainText("Make Appointment");
  29 |         await log("info", "The login is successful...")
  30 |     });
  31 | 
  32 | 
  33 |     test("Should make an appointment with non-default values", async ({ page }, testInfo) => {
  34 |         
  35 |         // console.log(`>> Current config \n: ${JSON.stringify(testInfo.config)}`);
  36 |         
  37 |         // Dropdown
  38 |         await page.getByLabel("Facility").selectOption("Hongkong CURA Healthcare Center");
  39 | 
  40 |         // Checkbox
  41 |         await page.getByText("Apply for hospital readmission").click();
  42 | 
  43 |         // Radio button
  44 |         await page.getByText("Medicaid").click();
  45 | 
  46 |         // Date input box
  47 |         await page.getByRole("textbox", { name: "Visit Date (Required)" }).click();
  48 |         await page.getByRole("textbox", { name: "Visit Date (Required)" }).fill("05/10/2027");
  49 |         await page.getByRole("textbox", { name: "Visit Date (Required)" }).press("Enter");
  50 | 
  51 |         // Multi-line comments input box
  52 |         await page.getByRole("textbox", { name: "Comment" }).click();
  53 |         await page.getByRole("textbox", { name: "Comment" }).fill("This is a multi-line comments\ncaptured by Playwright codegen!");
  54 | 
  55 |         // Button
  56 |         await page.getByRole("button", { name: "Book Appointment" }).click();
  57 | 
  58 |         // Assertion
  59 |         await expect(page.locator("h2")).toContainText("Appointment Confirmation");
  60 |         await expect(page.getByRole("link", { name: "Go to Homepage" })).toBeVisible();
  61 |     });
  62 | 
  63 |     // More tests go here ...
  64 | });
  65 | 
```