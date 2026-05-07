import fs from "fs";
import path from "path";

interface Fix {
  file: string;
  patch: string;
  reason: string;
  confidence: number;
}

interface LLMOutput {
  summary: string;
  confidence: number;
  fixes: Fix[];
}

function validatePatch(patch: string): boolean {
  const forbiddenPatterns = [
    "test.skip",
    "waitForTimeout",
    "nth-child",
    "querySelector",
    "setTimeout",
    "retries",
  ];

  for (const pattern of forbiddenPatterns) {
    if (patch.includes(pattern)) {
      console.log(
        `Rejected unsafe patch: ${pattern}`
      );

      return false;
    }
  }

  return true;
}

function extractPatchedContent(
  patch: string
): string | null {
  const lines = patch.split("\n");

  const output: string[] = [];

  for (const line of lines) {
    if (
      line.startsWith("---") ||
      line.startsWith("+++") ||
      line.startsWith("@@")
    ) {
      continue;
    }

    if (line.startsWith("+")) {
      output.push(line.slice(1));
      continue;
    }

    if (line.startsWith(" ")) {
      output.push(line.slice(1));
      continue;
    }
  }

  if (output.length === 0) {
    return null;
  }

  return output.join("\n");
}

function backupFile(filePath: string) {
  const backupPath = `${filePath}.bak`;

  fs.copyFileSync(filePath, backupPath);

  console.log(
    `Backup created: ${backupPath}`
  );
}

function applyFix(fix: Fix) {
  try {
    console.log(
      "======================================="
    );

    console.log(
      `Applying fix to ${fix.file}`
    );

    console.log(
      "======================================="
    );

    if (
      fix.confidence < 0.75
    ) {
      console.log(
        `Skipped low confidence fix: ${fix.confidence}`
      );

      return;
    }

    if (
      !fix.file.startsWith("tests/") &&
      !fix.file.startsWith("pages/")
    ) {
      console.log(
        `Skipped unauthorized file: ${fix.file}`
      );

      return;
    }

    if (
      !validatePatch(fix.patch)
    ) {
      console.log(
        "Patch validation failed"
      );

      return;
    }

    if (
      !fs.existsSync(fix.file)
    ) {
      console.log(
        `Target file missing: ${fix.file}`
      );

      return;
    }

    const originalContent =
      fs.readFileSync(
        fix.file,
        "utf-8"
      );

    const patchedContent =
      extractPatchedContent(
        fix.patch
      );

    if (!patchedContent) {
      console.log(
        "Unable to extract patched content"
      );

      return;
    }

    if (
      patchedContent.trim() ===
      originalContent.trim()
    ) {
      console.log(
        "Patch produced no changes"
      );

      return;
    }

    backupFile(fix.file);

    fs.writeFileSync(
      fix.file,
      patchedContent,
      "utf-8"
    );

    console.log(
      `Successfully updated ${fix.file}`
    );
  } catch (error) {
    console.error(
      `Failed applying fix to ${fix.file}`
    );

    console.error(error);
  }
}

async function main() {
  try {
    console.log(
      "======================================="
    );

    console.log(
      "Applying AI-generated patches..."
    );

    console.log(
      "======================================="
    );

    if (
      !fs.existsSync("llm-output.json")
    ) {
      throw new Error(
        "llm-output.json not found"
      );
    }

    const raw =
      fs.readFileSync(
        "llm-output.json",
        "utf-8"
      );

    const output: LLMOutput =
      JSON.parse(raw);

    if (
      !output.fixes ||
      output.fixes.length === 0
    ) {
      console.log(
        "No valid fixes found"
      );

      process.exit(0);
    }

    console.log(
      `Found ${output.fixes.length} fixes`
    );

    for (const fix of output.fixes) {
      applyFix(fix);
    }

    console.log(
      "======================================="
    );

    console.log(
      "Patch application completed"
    );

    console.log(
      "======================================="
    );
  } catch (error) {
    console.error(
      "Patch application failed:"
    );

    console.error(error);

    process.exit(1);
  }
}

main();