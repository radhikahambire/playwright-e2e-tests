import fs from "fs";
import path from "path";

interface Failure {
  testName: string;
  file: string;
  line?: number;
  column?: number;
  error: string;
  stack?: string;
  locator?: string;
  screenshot?: string;
  trace?: string;
  pageObjectFiles: string[];
  testCode: string;
  pageObjectCode: Record<string, string>;
}

interface Fix {
  file: string;
  patch: string;
  reason: string;
  confidence: number;
}

interface LLMResponse {
  summary: string;
  confidence: number;
  fixes: Fix[];
}

function safeReadFile(filePath: string): string {
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      return "";
    }

    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return "";
  }
}

function findPageObjectFiles(testCode: string): string[] {
  const matches =
    testCode.match(/from\s+["'](.*pages.*)["']/g) || [];

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

function extractLocator(errorMessage: string): string | undefined {
  const patterns = [
    /getByTestId\(['"`](.*?)['"`]\)/,
    /getByRole\(['"`](.*?)['"`]\)/,
    /locator\(['"`](.*?)['"`]\)/,
    /waiting for (.*?)$/m,
  ];

  for (const pattern of patterns) {
    const match = errorMessage.match(pattern);

    if (match?.[1]) {
      return match[1];
    }
  }

  return undefined;
}

function extractAttachments(result: any) {
  let screenshot = "";
  let trace = "";

  for (const attachment of result.attachments || []) {
    if (attachment.name?.includes("screenshot")) {
      screenshot = attachment.path || "";
    }

    if (attachment.name?.includes("trace")) {
      trace = attachment.path || "";
    }
  }

  return { screenshot, trace };
}

function extractFailures(results: any): Failure[] {
  const failures: Failure[] = [];

  const walkSuites = (suites: any[]) => {
    for (const suite of suites || []) {
      for (const spec of suite.specs || []) {
        for (const test of spec.tests || []) {
          for (const result of test.results || []) {
            if (result.status === "failed") {
              const filePath =
                test.location?.file || "";

              const testCode =
                safeReadFile(filePath);

              const pageObjectFiles =
                findPageObjectFiles(testCode);

              const pageObjectCode: Record<
                string,
                string
              > = {};

              for (const poFile of pageObjectFiles) {
                let resolvedPath = poFile;

                if (!resolvedPath.endsWith(".ts")) {
                  resolvedPath += ".ts";
                }

                const absolutePath = path.resolve(
                  path.dirname(filePath),
                  resolvedPath
                );

                pageObjectCode[absolutePath] =
                  safeReadFile(absolutePath);
              }

              const locator = extractLocator(
                result.error?.message || ""
              );

              const { screenshot, trace } =
                extractAttachments(result);

              failures.push({
                testName: test.title,
                file: filePath,
                line: test.location?.line,
                column: test.location?.column,
                error:
                  result.error?.message ||
                  "Unknown error",
                stack: result.error?.stack,
                locator,
                screenshot,
                trace,
                pageObjectFiles,
                testCode,
                pageObjectCode,
              });
            }
          }
        }
      }

      if (suite.suites?.length) {
        walkSuites(suite.suites);
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
You are a senior Playwright self-healing automation architect.

Your task:
Analyze failed Playwright tests and generate SAFE fixes.

STRICT RULES:
- Only modify:
  - tests/
  - pages/

- NEVER:
  - use test.skip
  - use waitForTimeout
  - remove assertions
  - use nth-child
  - use querySelector
  - add retries
  - add sleeps

HEALING STRATEGY:
1. Prefer page object fixes
2. Prefer getByTestId()
3. Fix broken selectors
4. Fix DOM locator drift
5. Keep patch minimal
6. Keep Playwright best practices

PATCH RULES:
- Return unified git diff patches
- Patch must be directly applicable
- Do NOT explain outside JSON

Return ONLY valid JSON:

{
  "summary": "",
  "confidence": 0.0,
  "fixes": [
    {
      "file": "",
      "patch": "",
      "reason": "",
      "confidence": 0.0
    }
  ]
}

Failure Context:
${JSON.stringify(failures, null, 2)}
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
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },

      body: JSON.stringify({
        model: "gpt-4.1",

        temperature: 0.1,

        response_format: {
          type: "json_object",
        },

        messages: [
          {
            role: "system",
            content:
              "You are a strict Playwright self-healing engine. Return only valid JSON.",
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
    const text = await response.text();

    throw new Error(
      `OpenAI API failed: ${response.status} ${text}`
    );
  }

  const data = await response.json();

  const content =
    data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error(
      "No content returned from OpenAI"
    );
  }

  return JSON.parse(content);
}

function validateFixes(
  response: LLMResponse
): LLMResponse {
  const forbiddenPatterns = [
    "test.skip",
    "waitForTimeout",
    "nth-child",
    "querySelector",
    "retries",
    "setTimeout",
  ];

  response.fixes = response.fixes.filter(
    (fix) => {
      if (
        fix.confidence < 0.75
      ) {
        return false;
      }

      for (const pattern of forbiddenPatterns) {
        if (
          fix.patch.includes(pattern)
        ) {
          return false;
        }
      }

      if (
        !fix.file.startsWith("tests/") &&
        !fix.file.startsWith("pages/")
      ) {
        return false;
      }

      return true;
    }
  );

  return response;
}

async function main() {
  try {
    console.log(
      "======================================="
    );
    console.log(
      "Analyzing Playwright failures..."
    );
    console.log(
      "======================================="
    );

    if (
      !fs.existsSync("results.json")
    ) {
      throw new Error(
        "results.json not found"
      );
    }

    const raw =
      fs.readFileSync(
        "results.json",
        "utf-8"
      );

    const results = JSON.parse(raw);

    const failures =
      extractFailures(results);

    if (failures.length === 0) {
      console.log(
        "No failures detected"
      );

      process.exit(0);
    }

    console.log(
      `Detected ${failures.length} failed tests`
    );

    const prompt =
      buildPrompt(failures);

    fs.writeFileSync(
      "llm-prompt.txt",
      prompt
    );

    console.log(
      "Calling OpenAI..."
    );

    const llmResponse =
      await callOpenAI(prompt);

    const validatedResponse =
      validateFixes(llmResponse);

    fs.writeFileSync(
      "llm-output.json",
      JSON.stringify(
        validatedResponse,
        null,
        2
      )
    );

    console.log(
      "======================================="
    );
    console.log(
      "LLM analysis completed"
    );
    console.log(
      `Generated ${validatedResponse.fixes.length} safe fixes`
    );
    console.log(
      "======================================="
    );
  } catch (error) {
    console.error(
      "AI analysis failed:"
    );

    console.error(error);

    process.exit(1);
  }
}

main();