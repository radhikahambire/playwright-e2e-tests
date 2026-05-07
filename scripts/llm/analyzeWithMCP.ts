import fs from "fs";

interface Failure {
  testName: string;
  file: string;
  error: string;
  stack?: string;
  code: string;
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
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return "";
  }
}

function extractFailures(results: any): Failure[] {
  const failures: Failure[] = [];

  const walkSuites = (suites: any[]) => {
    for (const suite of suites || []) {
      for (const spec of suite.specs || []) {
        for (const test of spec.tests || []) {
          for (const result of test.results || []) {
            if (result.status === "failed") {
              const filePath = test.location?.file;

              failures.push({
                testName: test.title,
                file: filePath,
                error: result.error?.message || "Unknown error",
                stack: result.error?.stack,
                code: safeReadFile(filePath),
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

function buildPrompt(failures: Failure[]): string {
  return `
You are a senior QA automation architect.

Analyze ALL failed Playwright tests.

Primary goals:
1. Fix broken selectors
2. Fix DOM changes
3. Prefer page object fixes over test changes
4. Produce MINIMAL git diff patches

STRICT RULES:
- Only modify tests/ or pages/
- Never use:
  - test.skip
  - waitForTimeout
  - hard waits
  - nth-child
  - querySelector
  - retries
- Use Playwright best practices
- Prefer getByTestId()
- Keep assertions intact
- Generate unified diff patches only

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

Failures:
${JSON.stringify(failures, null, 2)}
`;
}

async function callOpenAI(prompt: string): Promise<LLMResponse> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY missing");
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
              "You are a strict Playwright automation fixer that returns only valid JSON.",
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
    throw new Error(`OpenAI API failed: ${response.status} ${text}`);
  }

  const data = await response.json();

  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("No content returned from OpenAI");
  }

  return JSON.parse(content);
}

async function main() {
  try {
    console.log("Analyzing Playwright failures...");

    if (!fs.existsSync("results.json")) {
      throw new Error("results.json not found");
    }

    const raw = fs.readFileSync("results.json", "utf-8");
    const results = JSON.parse(raw);

    const failures = extractFailures(results);

    if (failures.length === 0) {
      console.log("No failures detected");
      process.exit(0);
    }

    console.log(`Detected ${failures.length} failed tests`);

    const prompt = buildPrompt(failures);

    fs.writeFileSync("llm-prompt.txt", prompt);

    const llmResponse = await callOpenAI(prompt);

    fs.writeFileSync(
      "llm-output.json",
      JSON.stringify(llmResponse, null, 2)
    );

    console.log("LLM analysis completed");
  } catch (error) {
    console.error("AI analysis failed:", error);
    process.exit(1);
  }
}

main();