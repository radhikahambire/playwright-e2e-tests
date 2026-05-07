import fs from "fs";

interface LocatorFix {
  file: string;
  oldLocator: string;
  newLocator: string;
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
      fix.newLocator.includes(item)
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

function replaceLocatorValue(
  content: string,
  oldLocator: string,
  newLocator: string
): string {
  const regexes = [
    new RegExp(
      `(getByTestId\\(["'\`])${escapeRegex(
        oldLocator
      )}(["'\`]\\))`,
      "g"
    ),

    new RegExp(
      `(getByRole\\(["'\`])${escapeRegex(
        oldLocator
      )}(["'\`]\\))`,
      "g"
    ),

    new RegExp(
      `(getByText\\(["'\`])${escapeRegex(
        oldLocator
      )}(["'\`]\\))`,
      "g"
    ),

    new RegExp(
      `(getByLabel\\(["'\`])${escapeRegex(
        oldLocator
      )}(["'\`]\\))`,
      "g"
    ),

    new RegExp(
      `(locator\\(["'\`])${escapeRegex(
        oldLocator
      )}(["'\`]\\))`,
      "g"
    ),
  ];

  let updated = content;

  for (const regex of regexes) {
    updated = updated.replace(
      regex,
      `$1${newLocator}$2`
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

  const pageFiles = fs.existsSync(
    "pages"
  )
    ? fs
        .readdirSync("pages", {
          recursive: true,
        })
        .filter((f) =>
          f.toString().endsWith(".ts")
        )
        .map((f) => `pages/${f}`)
    : [];

  const testFiles = fs.existsSync(
    "tests"
  )
    ? fs
        .readdirSync("tests", {
          recursive: true,
        })
        .filter((f) =>
          f.toString().endsWith(".ts")
        )
        .map((f) => `tests/${f}`)
    : [];

  const candidateFiles = [
    fix.file,
    ...pageFiles,
    ...testFiles,
  ];

  let applied = false;

  for (const candidate of candidateFiles) {
    if (!fs.existsSync(candidate)) {
      continue;
    }

    const original =
      fs.readFileSync(
        candidate,
        "utf-8"
      );

    const updated =
      replaceLocatorValue(
        original,
        fix.oldLocator,
        fix.newLocator
      );

    if (updated !== original) {
      fs.copyFileSync(
        candidate,
        `${candidate}.bak`
      );

      fs.writeFileSync(
        candidate,
        updated,
        "utf-8"
      );

      console.log(
        `Successfully updated ${candidate}`
      );

      applied = true;

      break;
    }
  }

  if (!applied) {
    console.log(
      `Locator not found anywhere: ${fix.oldLocator}`
    );
  }
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