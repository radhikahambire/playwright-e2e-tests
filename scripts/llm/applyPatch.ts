import fs from "fs";
import { execSync } from "child_process";

interface Fix {
  file: string;
  patch: string;
  reason?: string;
  confidence?: number;
}

interface LLMResponse {
  summary: string;
  fixes: Fix[];
  confidence: number;
}

const FORBIDDEN_PATTERNS = [
  /test\.skip\s*\(/,
  /\.skip\s*\(/,
  /test\.todo\s*\(/,
  /waitForTimeout/,
  /setTimeout\s*\(/,
  /page\.waitFor/,
  /hardWait/,
  /retries\s*\(/,
];

const BRITTLE_PATTERNS = [
  /nth-child\s*\(/,
  /nth-of-type\s*\(/,
  /querySelector/,
];

function isSafe(patch: string, file: string): { safe: boolean; warnings: string[] } {
  const warnings: string[] = [];

  // Check forbidden patterns
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(patch)) {
      return { safe: false, warnings: [`FORBIDDEN: ${pattern.source}`] };
    }
  }

  // Warn about brittle selectors
  for (const pattern of BRITTLE_PATTERNS) {
    if (pattern.test(patch)) {
      warnings.push(`BRITTLE: ${pattern.source}`);
    }
  }

  // File restrictions
  if (!file.startsWith("tests/") && !file.startsWith("page-objects/")) {
    return { safe: false, warnings: [`File outside tests/ or page-objects/`] };
  }

  return { safe: true, warnings };
}

function main() {
  try {
    console.log("🔧 Validating and applying fixes...\n");
    
    if (!fs.existsSync("llm-output.json")) {
      console.error("❌ llm-output.json not found");
      process.exit(1);
    }

    const data: LLMResponse = JSON.parse(
      fs.readFileSync("llm-output.json", "utf-8")
    );

    console.log(`📊 Analyzing ${data.fixes.length} fixes`);
    console.log(`📈 Confidence: ${(data.confidence * 100).toFixed(1)}%\n`);

    if (data.confidence < 0.75) {
      console.log("⚠️  Low confidence (< 0.75), skipping");
      process.exit(0);
    }

    let applied = 0;
    let rejected = 0;

    for (const fix of data.fixes) {
      const { safe, warnings } = isSafe(fix.patch, fix.file);

      console.log(`\n📝 ${fix.file}`);
      if (fix.reason) console.log(`   ${fix.reason}`);

      if (!safe) {
        console.log(`   ❌ REJECTED`);
        warnings.forEach((w) => console.log(`      ${w}`));
        rejected++;
        continue;
      }

      if (warnings.length > 0) {
        warnings.forEach((w) => console.log(`      ⚠️  ${w}`));
      }

      fs.writeFileSync("temp.patch", fix.patch);

      try {
        execSync("git apply temp.patch", { stdio: "pipe" });
        console.log(`   ✓ APPLIED`);
        applied++;
      } catch {
        console.log(`   ❌ Apply failed`);
        rejected++;
      }
    }

    fs.unlinkSync("temp.patch");

    console.log(`\n${"=".repeat(50)}`);
    console.log(`✓ Applied: ${applied}/${data.fixes.length}`);
    console.log(`❌ Rejected: ${rejected}/${data.fixes.length}`);

    if (applied === 0) {
      console.log("\n⚠️  No patches applied");
      process.exit(0);
    }

    console.log("\n✓ Fixes applied successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();