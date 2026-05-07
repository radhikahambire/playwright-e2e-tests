import fs from "fs";
import { execSync } from "child_process";

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

const FORBIDDEN_PATTERNS = [
  /test\.skip/i,
  /waitForTimeout/i,
  /setTimeout/i,
  /nth-child/i,
  /querySelector/i,
  /retries\(/i,
  /page\.waitForTimeout/i,
];

function validatePatch(fix: Fix): boolean {
  if (
    !fix.file.startsWith("tests/") &&
    !fix.file.startsWith("pages/")
  ) {
    console.log(`Rejected: invalid target ${fix.file}`);
    return false;
  }

  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(fix.patch)) {
      console.log(`Rejected forbidden pattern: ${pattern}`);
      return false;
    }
  }

  if (fix.confidence < 0.75) {
    console.log(`Rejected low confidence fix: ${fix.file}`);
    return false;
  }

  if (!fix.patch.includes("diff --git")) {
    console.log("Rejected malformed git diff");
    return false;
  }

  return true;
}

function applyPatch(patch: string): boolean {
  fs.writeFileSync("temp.patch", patch);

  try {
    execSync("git apply --check temp.patch", {
      stdio: "pipe",
    });

    execSync("git apply temp.patch", {
      stdio: "inherit",
    });

    return true;
  } catch (error) {
    console.error("Patch apply failed:", error);
    return false;
  } finally {
    fs.rmSync("temp.patch", {
      force: true,
    });
  }
}

async function main() {
  try {
    if (!fs.existsSync("llm-output.json")) {
      throw new Error("llm-output.json not found");
    }

    const raw = fs.readFileSync("llm-output.json", "utf-8");

    const response: LLMResponse = JSON.parse(raw);

    console.log(`Overall confidence: ${response.confidence}`);

    if (response.confidence < 0.75) {
      console.log("Skipping low-confidence batch");
      process.exit(0);
    }

    let applied = 0;

    for (const fix of response.fixes) {
      console.log(`Processing ${fix.file}`);

      if (!validatePatch(fix)) {
        continue;
      }

      const success = applyPatch(fix.patch);

      if (success) {
        applied++;
        console.log(`Applied patch for ${fix.file}`);
      }
    }

    console.log(`Applied ${applied}/${response.fixes.length} patches`);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main();