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
  /waitForTimeout/,
  /page\.waitFor/,
  /setTimeout\s*\(/,
  /retries\s*\(/,
  /assert.*removed/i,
];

const BRITTLE_PATTERNS = [/nth-child\s*\(/, /nth-of-type\s*\(/, /querySelector\s*\(/];

function isSafe(patch: string, file: string) {
  const warnings: string[] = [];
  for (const p of FORBIDDEN_PATTERNS) if (p.test(patch)) return { safe: false, warnings: [`FORBIDDEN: ${p}`] };
  for (const p of BRITTLE_PATTERNS) if (p.test(patch)) warnings.push(`BRITTLE: ${p}`);
  if (!file.startsWith("tests/") && !file.startsWith("pages/")) return { safe: false, warnings: ["File outside tests/ or pages/"] };
  return { safe: true, warnings };
}

function main() {
  try {
    if (!fs.existsSync("llm-output.json")) throw new Error("llm-output.json not found");

    const data: LLMResponse = JSON.parse(fs.readFileSync("llm-output.json", "utf-8"));
    console.log(`AI Confidence: ${(data.confidence * 100).toFixed(1)}%`);
    if (data.confidence < 0.75) {
      console.log("⚠️ Low confidence; skipping auto-fix");
      process.exit(0);
    }

    let applied = 0;
    for (const fix of data.fixes) {
      const { safe, warnings } = isSafe(fix.patch, fix.file);
      console.log(`\n🧩 File: ${fix.file}`);
      if (fix.reason) console.log(`   Reason: ${fix.reason}`);
      if (!safe) {
        console.log("   ❌ Unsafe fix rejected", warnings);
        continue;
      }
      warnings.forEach((w) => console.log(`   ⚠️ ${w}`));
      fs.writeFileSync("temp.patch", fix.patch);
      try {
        execSync("git apply temp.patch", { stdio: "pipe" });
        console.log("   ✅ Patch applied");
        applied++;
      } catch {
        console.log("   ❌ Patch failed to apply");
      }
    }
    fs.rmSync("temp.patch", { force: true });
    console.log(`\nSummary: Applied ${applied}/${data.fixes.length} patches`);
  } catch (e) {
    console.error("❌ Error applying patches:", e);
    process.exit(1);
  }
}

main();