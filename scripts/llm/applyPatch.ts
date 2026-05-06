import fs from "fs";
import { execSync } from "child_process";

interface Fix {
  file: string;
  patch: string;
}

interface LLMResponse {
  summary: string;
  fixes: Fix[];
  confidence: number;
}

function isSafe(patch: string, file: string): boolean {
  if (patch.includes("test.skip")) return false;
  if (patch.includes("waitForTimeout")) return false;
  if (patch.includes("timeout")) return false;
  if (patch.includes("= null")) return false;
  if (patch.includes("nth-child")) return false;
  if (patch.includes("querySelector")) return false;
  if (patch.includes("retries(")) return false;

  if (file.startsWith("tests/") && !patch.includes("expect(")) return false;

  return true;
}

function main() {
  const data: LLMResponse = JSON.parse(
    fs.readFileSync("llm-output.json", "utf-8")
  );

  if (data.confidence < 0.75) {
    console.log("Low confidence, skipping");
    process.exit(0);
  }

  let applied = false;

  for (const fix of data.fixes) {
    if (!fix.file.startsWith("tests/") && !fix.file.startsWith("pages/")) {
      continue;
    }

    if (!isSafe(fix.patch, fix.file)) {
      continue;
    }

    fs.writeFileSync("temp.patch", fix.patch);

    try {
      execSync("git apply temp.patch", { stdio: "inherit" });
      applied = true;
    } catch {}
  }

  if (!applied) {
    console.log("No valid patches applied");
    process.exit(0);
  }
}

main();