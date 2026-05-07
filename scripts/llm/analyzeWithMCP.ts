import fs from "fs";

interface Failure {
  file: string;
  error: string;
  code: string;
}

interface LLMResponse {
  summary: string;
  fixes: Array<{ file: string; patch: string }>;
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
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY environment variable not set");
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 2000
    })
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`OpenAI API error: ${res.status} - ${error}`);
  }

  const data = await res.json();
  if (!data.choices?.[0]?.message?.content) {
    throw new Error("Invalid OpenAI response format");
  }

  try {
    return JSON.parse(data.choices[0].message.content);
  } catch {
    throw new Error("Failed to parse OpenAI JSON response");
  }
}

async function main() {
  try {
    console.log("🔍 Analyzing test failures with OpenAI GPT-4...\n");
    
    if (!fs.existsSync("results.json")) {
      console.error("❌ results.json not found");
      process.exit(1);
    }

    const results = JSON.parse(fs.readFileSync("results.json", "utf-8"));
    const failures = extractFailures(results);

    if (failures.length === 0) {
      console.log("✓ No test failures found");
      process.exit(0);
    }

    console.log(`📊 Found ${failures.length} failed tests\n`);

    const prompt = `
You are a senior Playwright QA engineer with MCP browser access.

Analyze these ${failures.length} test failures:

${JSON.stringify(failures.slice(0, 10), null, 2)}

Requirements:
- Prefer page objects over test files
- Use semantic selectors
- Generate minimal patches
- Include reason for each fix

Safety Rules (MANDATORY):
❌ No test.skip()
❌ No waitForTimeout
❌ No assertion removal
✓ Only fix selectors and page objects

Return JSON with fixes`;

    console.log("🤖 Calling OpenAI API...");
    const result = await callLLM(prompt);
    
    fs.writeFileSync("llm-output.json", JSON.stringify(result, null, 2));
    console.log("\n✓ Analysis complete");
    console.log(`📝 Saved to llm-output.json`);
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();