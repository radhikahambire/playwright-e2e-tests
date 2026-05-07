import fs from "fs";

interface Failure {
  file: string;
  error: string;
  code: string;
}

interface Fix {
  file: string;
  patch: string;
  reason?: string;
}

interface LLMResponse {
  summary: string;
  fixes: Fix[];
  confidence: number;
}

function extractFailures(results: any): Failure[] {
  const failures: Failure[] = [];
  for (const suite of results.suites || []) {
    for (const spec of suite.specs || []) {
      for (const test of spec.tests || []) {
        const failed = test.results?.find((r: any) => r.status === "failed");
        if (failed) {
          const filePath = test.location.file;
          failures.push({
            file: filePath,
            error: failed.error?.message || "",
            code: fs.readFileSync(filePath, "utf-8")
          });
        }
      }
    }
  }
  return failures;
}

async function callLLM(prompt: string): Promise<LLMResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const res = await fetch("[api.openai.com](https://api.openai.com/v1/chat/completions)", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-4-turbo",
      temperature: 0.3,
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!res.ok) {
    throw new Error(`OpenAI API error: ${res.status} - ${await res.text()}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Invalid OpenAI response");

  try {
    return JSON.parse(content);
  } catch {
    throw new Error("OpenAI response not valid JSON");
  }
}

async function main() {
  try {
    console.log("🔍 Running AI Failure Analysis...");
    if (!fs.existsSync("results.json")) throw new Error("results.json missing");

    const results = JSON.parse(fs.readFileSync("results.json", "utf-8"));
    const failures = extractFailures(results);

    if (failures.length === 0) {
      console.log("✅ No failed tests found.");
      return;
    }

    console.log(`📊 ${failures.length} failures detected`);
    const prompt = `
You are a senior Playwright QA engineer.
Analyze these test failures:
${JSON.stringify(failures.slice(0, 10), null, 2)}

Rules:
- Only fix selectors / locators.
- Prefer page objects over test files.
- No test.skip(), retries(), waitForTimeout, or hard wait.
- Output JSON: { summary, fixes:[{file, patch, reason}], confidence }`;

    const response = await callLLM(prompt);
    fs.writeFileSync("llm-output.json", JSON.stringify(response, null, 2));
    console.log("✅ LLM output saved to llm-output.json");
  } catch (e) {
    console.error("❌ Analysis failed:", e);
    process.exit(1);
  }
}

main();
