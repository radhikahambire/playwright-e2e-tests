# 1. Instructions and Notes

## 1.1. In this session... 

__Running the E2E Test Sucessfully__
1. Get the API key and update `.env` file
2. Add the following setting in `playwright.config.ts`
```ts
// Use object
userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",

// Project object
args: ["--disable-blink-features=AutomationControlled", "--disable-features=IsolateOrigins,site-per-process", "--allow-no-sandbox-job"],
```
1. Re-run the test
2. Test ✅ 
---