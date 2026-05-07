import fs from "fs";
import path from "path";

interface Failure {
  testName: string;
  file: string;
  error: string;
  locator?: string;
  availableLocators: string[];
  testCode: string;
  pageObjectCode: Record<string, string>;
}

interface LocatorFix {
  file: string;
  find: string;
  replace: string;
  reason: string;
  confidence: number;
}

interface LLMResponse {
  summary: string;
  confidence: number;
  fixes: LocatorFix[];
}

function safeReadFile(
  filePath: string
): string {
  try {
    if (!fs.existsSync(filePath)) {
      return "";
    }

    return fs.readFileSync(
      filePath,
      "utf-8"
    );
  } catch {
    return "";
  }
}

function extractLocator(
  errorMessage: string
): string | undefined {
  const patterns = [
    /getByTestId\(['"`](.*?)['"`]\)/,
    /getByRole\(['"`](.*?)['"`]\)/,
    /getByText\(['"`](.*?)['"`]\)/,
    /locator\(['"`](.*?)['"`]\)/,
  ];

  for (const pattern of patterns) {
    const match =
      errorMessage.match(pattern);

    if (match?.[1]) {
      return match[1];
    }
  }

  return undefined;
}

function loadDOMSnapshot(): string {
  const resultsDir =
    "test-results";

  if (!fs.existsSync(resultsDir)) {
    return "";
  }

  const files =
    fs.readdirSync(resultsDir);

  const domFile = files.find(
    (file) =>
      file.endsWith("-dom.html")
  );

  if (!domFile) {
    return "";
  }

  return safeReadFile(
    path.join(resultsDir, domFile)
  );
}

function extractDOMLocators(
  dom: string
): string[] {
  const selectors =
    new Set<string>();

  const regexes = [
    /data-testid=["']([^"']+)["']/g,
    /aria-label=["']([^"']+)["']/g,
    /role=["']([^"']+)["']/g,
  ];

  for (const regex of regexes) {
    let match;

    while (
      (match = regex.exec(dom)) !==
      null
    ) {
      if (match[1]) {
        selectors.add(match[1]);
      }
    }
  }

  return [...selectors];
}

function findPageObjectFiles(
  testCode: string
): string[] {
  const matches =
    testCode.match(
      /from\s+["'](.*pages.*)["']/g
    ) || [];

  const pageFiles: string[] = [];

  for (const match of matches) {
    const extracted =
      match.match(/["'](.*)["']/)?.[1];

    if (extracted) {
      pageFiles.push(extracted);
    }
  }

  return pageFiles;
}

function extractFailures(
  results: any
): Failure[] {
  const failures: Failure[] = [];

  const walkSuites = (
    suites: any[]
  ) => {
    for (const suite of suites || []) {
      for (const spec of suite.specs || []) {
        for (const test of spec.tests || []) {
          for (const result of test.results || []) {
            if (
              result.status ===
              "failed"
            ) {
              const filePath =
                test.location?.file ||
                "";

              const testCode =
                safeReadFile(
                  filePath
                );

              const pageObjectFiles =
                findPageObjectFiles(
                  testCode
                );

              const pageObjectCode: Record<
                string,
                string
              > = {};

              for (const poFile of pageObjectFiles) {
                let resolvedPath =
                  poFile;

                if (
                  !resolvedPath.endsWith(
                    ".ts"
                  )
                ) {
                  resolvedPath +=
                    ".ts";
                }

                const absolutePath =
                  path.resolve(
                    path.dirname(
                      filePath
                    ),
                    resolvedPath
                  );

                pageObjectCode[
                  absolutePath
                ] =
                  safeReadFile(
                    absolutePath
                  );
              }

              const locator =
                extractLocator(
                  result.error
                    ?.message ||
                    ""
                );

              const domSnapshot =
                loadDOMSnapshot();

              const availableLocators =
                extractDOMLocators(
                  domSnapshot
                );

              failures.push({
                testName:
                  test.title,
                file: filePath,
                error:
                  result.error
                    ?.message ||
                  "Unknown error",
                locator,
                availableLocators,
                testCode,
                pageObjectCode,
              });
            }
          }
        }
      }

      if (suite.suites?.length) {
        walkSuites(
          suite.suites
        );
      }
    }
  };

  walkSuites(results.suites || []);

  return failures;
}

function buildPrompt(
  failures: Failure[]
): string {
  return `
You are a Playwright locator healing engine.

Fix broken Playwright locators.

IMPORTANT:
- Return ONLY locator replacements
- Do NOT rewrite full files
- Prefer page object fixes
- Prefer getByTestId

STRICT RULES:
- Only modify tests/ or pages/
- Never use:
  - nth-child
  - querySelector
  - waitForTimeout
  - retries
  - test.skip

Return ONLY valid JSON:

{
  "summary": "",
  "confidence": 0.0,
  "fixes": [
    {
      "file": "",
      "find": "",
      "replace": "",
      "reason": "",
      "confidence": 0.0
    }
  ]
}

Failures:
${JSON.stringify(
  failures,
  null,
  2
)}
`;
}

async function callOpenAI(
  prompt: string
): Promise<LLMResponse> {
  const apiKey =
    process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY missing"
    );
  }

  const response = await fetch(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
        Authorization: `Bearer ${apiKey}`,
      },

      body: JSON.stringify({
        model: "gpt-4.1",

        temperature: 0.05,

        response_format: {
          type: "json_object",
        },

        messages: [
          {
            role: "system",
            content:
              "You are a deterministic Playwright locator healing engine.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    const text =
      await response.text();

    throw new Error(
      `OpenAI API failed: ${response.status} ${text}`
    );
  }

  const data =
    await response.json();

  const content =
    data.choices?.[0]?.message
      ?.content;

  if (!content) {
    throw new Error(
      "No content returned from OpenAI"
    );
  }

  return JSON.parse(content);
}

async function main() {
  try {
    if (
      !fs.existsSync("results.json")
    ) {
      throw new Error(
        "results.json missing"
      );
    }

    const raw =
      fs.readFileSync(
        "results.json",
        "utf-8"
      );

    const results =
      JSON.parse(raw);

    const failures =
      extractFailures(results);

    if (failures.length === 0) {
      console.log(
        "No failures detected"
      );

      process.exit(0);
    }

    const prompt =
      buildPrompt(failures);

    fs.writeFileSync(
      "llm-prompt.txt",
      prompt
    );

    const response =
      await callOpenAI(prompt);

    fs.writeFileSync(
      "llm-output.json",
      JSON.stringify(
        response,
        null,
        2
      )
    );

    console.log(
      "LLM analysis completed"
    );
  } catch (error) {
    console.error(error);

    process.exit(1);
  }
}

main();