import fs from "fs";

interface Failure {
  file: string;
  error: string;
  code: string;
}

interface LLMResponse {
  summary: string;
  fixes: Array<{
    file: string;
    patch: string;
  }>;
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
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4.1",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2
    })
  });

  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}

async function main() {
  const results = JSON.parse(fs.readFileSync("results.json", "utf-8"));
  const failures = extractFailures(results);

  if (failures.length === 0) {
    console.log("No failures");
    return;
  }

  const prompt = `
You are a senior Playwright engineer with MCP browser access.

Failures:
${JSON.stringify(failures.slice(0, 10), null, 2)}

Tasks:
1. Group related failures
2. Use MCP to inspect DOM
3. Prefer fixing page objects (pages/)
4. Use testIds
5. Generate minimal patches

Rules:
- Do NOT weaken assertions
- Do NOT add timeouts
- Do NOT skip tests

Return STRICT JSON:
{
  "summary": "...",
  "fixes": [
    { "file": "...", "patch": "..." }
  ],
  "confidence": 0-1
}
`;

  const result = await callLLM(prompt);
  fs.writeFileSync("llm-output.json", JSON.stringify(result, null, 2));
}

main();