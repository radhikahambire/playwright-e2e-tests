import fs from "fs";

interface LocatorFix {
  file: string;
  find: string;
  replace: string;
  reason: string;
  confidence: number;
}

interface LLMResponse {
  summary: string;
  confidence: number;
  fixes: LocatorFix[];
}

function isSafeFix(
  fix: LocatorFix
): boolean {
  const forbidden = [
    "waitForTimeout",
    "querySelector",
    "nth-child",
    "test.skip",
    "retries",
  ];

  if (fix.confidence < 0.75) {
    return false;
  }

  if (
    !fix.file.startsWith("tests/") &&
    !fix.file.startsWith("pages/")
  ) {
    return false;
  }

  for (const item of forbidden) {
    if (
      fix.replace.includes(item)
    ) {
      return false;
    }
  }

  return true;
}

function escapeRegex(
  value: string
): string {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

function applyLocatorReplacement(
  content: string,
  oldLocator: string,
  newLocator: string
): string {
  const patterns = [
    new RegExp(
      `getByTestId\\(["'\`]${escapeRegex(
        oldLocator
      )}["'\`]\\)`,
      "g"
    ),

    new RegExp(
      `getByRole\\(["'\`]${escapeRegex(
        oldLocator
      )}["'\`]\\)`,
      "g"
    ),

    new RegExp(
      `getByText\\(["'\`]${escapeRegex(
        oldLocator
      )}["'\`]\\)`,
      "g"
    ),

    new RegExp(
      `locator\\(["'\`]${escapeRegex(
        oldLocator
      )}["'\`]\\)`,
      "g"
    ),
  ];

  let updated = content;

  for (const pattern of patterns) {
    updated = updated.replace(
      pattern,
      (match) => {
        return match.replace(
          oldLocator,
          newLocator
        );
      }
    );
  }

  return updated;
}

function applyFix(
  fix: LocatorFix
) {
  console.log(
    `Applying fix to ${fix.file}`
  );

  if (!isSafeFix(fix)) {
    console.log(
      "Rejected unsafe fix"
    );

    return;
  }

  if (!fs.existsSync(fix.file)) {
    console.log(
      `Missing file ${fix.file}`
    );

    return;
  }

  const original =
    fs.readFileSync(
      fix.file,
      "utf-8"
    );

  const updated =
    applyLocatorReplacement(
      original,
      fix.find,
      fix.replace
    );

  if (updated === original) {
    console.log(
      `Locator not found: ${fix.find}`
    );

    return;
  }

  fs.copyFileSync(
    fix.file,
    `${fix.file}.bak`
  );

  fs.writeFileSync(
    fix.file,
    updated,
    "utf-8"
  );

  console.log(
    `Successfully updated ${fix.file}`
  );
}

async function main() {
  try {
    if (
      !fs.existsSync(
        "llm-output.json"
      )
    ) {
      throw new Error(
        "llm-output.json missing"
      );
    }

    const raw =
      fs.readFileSync(
        "llm-output.json",
        "utf-8"
      );

    const output: LLMResponse =
      JSON.parse(raw);

    if (
      !output.fixes ||
      output.fixes.length === 0
    ) {
      console.log(
        "No fixes found"
      );

      process.exit(0);
    }

    for (const fix of output.fixes) {
      applyFix(fix);
    }

    console.log(
      "Patch application completed"
    );
  } catch (error) {
    console.error(error);

    process.exit(1);
  }
}

main();