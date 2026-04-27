# 1.1 Set up Playwright

## Commands

1. To Install Playwright
   - `npm init playwright@latest`
2. Check if installed
   - `npx playwright --help`
3. To run the playwright tests in headed mode
   - `npx playwright test --headed`
4. To show the HTML report - `npx playwright show-report`
   Naming Convention - Best Practice:

# 2. File & Code Naming Conventions

| Item                    | Convention                         | Example                                               |
| ----------------------- | ---------------------------------- | ----------------------------------------------------- |
| **Folders / Files**     | kebab-case                         | `page-objects/`, `file-helper.ts`                     |
| **Page and Spec files** | dot-separated                      | `nopcommerce.home.page.ts`, `nopcommerce.e2e.spec.ts` |
| **Class Names**         | PascalCase (each word capitalized) | `LoginPage`, `DashboardActions`                       |
| **Variables**           | camelCase                          | `loginButton`, `userNameInput`                        |
| **Constants**           | UPPER_SNAKE_CASE                   | `BASE_URL`, `API_TIMEOUT_MS`                          |

---

🎯 **Consistent naming improves readability and reduces confusion across teams.**

# 3. Folder Structure Setup

Let's create the following folder structure:

```sh
PLAYWRIGHT-E2E-TESTS/
├── .github/                    # CI Config folder
├── .vscode/                    # Editor-specific settings
│   └── mcp.json                # MCP server config for VS Code
├── config/                     # Environment-specific config files
├── data/                       # Static data and constants
│   └── constants.json          # Common constants used in tests
├── debug/                      # Optional: Debug-related outputs/logs
├── logs/                       # Application/test logs
├── node_modules/               # Auto-generated dependencies
├── playwright-report/          # Playwright HTML test report output
├── resources/                  # Misc test resources (e.g. images, files)
├── tests/                      # All organized test files
│   ├── api/                    # API test specs
│   ├── demo/                   # Demo-related test specs
│   ├── devices/                # Device related scenarios
│   ├── e2e/                    # End-to-end test specs
│   ├── functional/             # Functional test cases
│   ├── helpers/                # Utility functions for tests
│   ├── page-objects/           # Page Object Model files
├── tests-examples/             # Auto-generated sample test scenarios
├── .env.example                # Template for environment files
├── .env                        # Template for environment files
├── .gitignore                  # Git ignored files and folders
├── package-lock.json           # Dependency lock file
├── package.json                # Project metadata and scripts
├── playwright.config.ts        # Playwright configuration file
├── README.md                   # Project overview and instructions
```

# Git Installation Guide for macOS

Follow these steps to install Git on macOS:

## Steps

1. **Install Git via Xcode Command Line Tools (Recommended & Easiest):**

Open your terminal and run:

```sh
git --version
```

If Git is not installed, this command will prompt you to install the Xcode Command Line Tools. Follow the on-screen instructions.

Once installed, run the command again to confirm:

```sh
git --version
```

You should see the installed Git version.

2. **(Alternative) Install Git using Homebrew:**

First, check if you have Homebrew installed:

```sh
brew --version
```

If you see a version number, Homebrew is installed. If not, install it with:

```sh
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Then install Git:

```sh
brew install git
```

Verify the installation:

```sh
git --version
```

You should see the installed Git version.

---
