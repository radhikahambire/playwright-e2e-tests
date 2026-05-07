import fs from "fs";
import path from "path";
import {
  Project,
  SyntaxKind,
  CallExpression,
  Node,
  ObjectLiteralExpression,
  PropertyAssignment,
} from "ts-morph";

interface LocatorFix {
  file: string;

  locatorType:
    | "getByRole"
    | "getByText"
    | "getByLabel"
    | "getByTestId"
    | "locator";

  oldValue: string;

  newValue: string;

  role?: string;

  property?: "name" | "text" | "testId";

  reason: string;

  confidence: number;
}

interface LLMResponse {
  summary: string;

  confidence: number;

  fixes: LocatorFix[];
}

const ALLOWED_ROOTS = [
  "tests/",
  "pages/",
];

const FORBIDDEN_PATTERNS = [
  "waitForTimeout",
  "querySelector",
  "nth-child",
  "test.skip",
  "retries",
];

function isSafeFix(
  fix: LocatorFix
): boolean {
  if (fix.confidence < 0.55) {
    console.log(
      `Rejected low confidence fix: ${fix.confidence}`
    );

    return false;
  }

  const normalized =
    fix.file.replace(/\\/g, "/");

  const allowed =
    ALLOWED_ROOTS.some((root) =>
      normalized.startsWith(root)
    );

  if (!allowed) {
    console.log(
      `Rejected invalid file path: ${fix.file}`
    );

    return false;
  }

  for (const pattern of FORBIDDEN_PATTERNS) {
    if (
      fix.newValue.includes(pattern)
    ) {
      console.log(
        `Rejected forbidden pattern: ${pattern}`
      );

      return false;
    }
  }

  return true;
}

function backupFile(
  filePath: string
) {
  const backupPath = `${filePath}.bak`;

  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(
      filePath,
      backupPath
    );
  }
}

function normalizeQuotes(
  value: string
): string {
  return value.replace(
    /^["'`](.*)["'`]$/,
    "$1"
  );
}

function getPropertyAssignment(
  objectLiteral: ObjectLiteralExpression,
  propertyName: string
): PropertyAssignment | undefined {
  const prop =
    objectLiteral.getProperty(
      propertyName
    );

  if (
    prop &&
    Node.isPropertyAssignment(prop)
  ) {
    return prop;
  }

  return undefined;
}

function patchGetByRole(
  call: CallExpression,
  fix: LocatorFix
): boolean {
  const args = call.getArguments();

  if (args.length < 2) {
    return false;
  }

  const roleArg = args[0];
  const optionsArg = args[1];

  if (
    !Node.isStringLiteral(roleArg)
  ) {
    return false;
  }

  if (
    fix.role &&
    roleArg.getLiteralText() !==
      fix.role
  ) {
    return false;
  }

  if (
    !Node.isObjectLiteralExpression(
      optionsArg
    )
  ) {
    return false;
  }

  const nameProp =
    getPropertyAssignment(
      optionsArg,
      "name"
    );

  if (!nameProp) {
    return false;
  }

  const initializer =
    nameProp.getInitializer();

  if (!initializer) {
    return false;
  }

  //
  // Handle:
  // name: "Submit"
  //
  if (
    Node.isStringLiteral(
      initializer
    )
  ) {
    const current =
      initializer.getLiteralText();

    if (
      current !== fix.oldValue
    ) {
      return false;
    }

    initializer.replaceWithText(
      `"${fix.newValue}"`
    );

    return true;
  }

  //
  // Handle:
  // name: /Submit/i
  //
  if (
    Node.isRegularExpressionLiteral(
      initializer
    )
  ) {
    const text =
      initializer.getText();

    if (
      !text.includes(
        fix.oldValue
      )
    ) {
      return false;
    }

    const updated =
      text.replace(
        fix.oldValue,
        fix.newValue
      );

    initializer.replaceWithText(
      updated
    );

    return true;
  }

  return false;
}

function patchSimpleLocator(
  call: CallExpression,
  fix: LocatorFix
): boolean {
  const args = call.getArguments();

  if (args.length === 0) {
    return false;
  }

  const firstArg = args[0];

  //
  // Handle:
  // getByText("Submit")
  //
  if (
    Node.isStringLiteral(
      firstArg
    )
  ) {
    const current =
      firstArg.getLiteralText();

    if (
      current !== fix.oldValue
    ) {
      return false;
    }

    firstArg.replaceWithText(
      `"${fix.newValue}"`
    );

    return true;
  }

  //
  // Handle:
  // getByText(/Submit/i)
  //
  if (
    Node.isRegularExpressionLiteral(
      firstArg
    )
  ) {
    const current =
      firstArg.getText();

    if (
      !current.includes(
        fix.oldValue
      )
    ) {
      return false;
    }

    const updated =
      current.replace(
        fix.oldValue,
        fix.newValue
      );

    firstArg.replaceWithText(
      updated
    );

    return true;
  }

  return false;
}

function patchLocatorSelector(
  call: CallExpression,
  fix: LocatorFix
): boolean {
  const args = call.getArguments();

  if (args.length === 0) {
    return false;
  }

  const firstArg = args[0];

  if (
    !Node.isStringLiteral(
      firstArg
    )
  ) {
    return false;
  }

  const current =
    firstArg.getLiteralText();

  if (
    !current.includes(
      fix.oldValue
    )
  ) {
    return false;
  }

  const updated =
    current.replace(
      fix.oldValue,
      fix.newValue
    );

  firstArg.replaceWithText(
    `"${updated}"`
  );

  return true;
}

function patchFile(
  filePath: string,
  fix: LocatorFix
): boolean {
  console.log(
    `Patching file: ${filePath}`
  );

  const project = new Project({
    skipAddingFilesFromTsConfig:
      true,
  });

  const sourceFile =
    project.addSourceFileAtPath(
      filePath
    );

  let modified = false;

  const calls =
    sourceFile.getDescendantsOfKind(
      SyntaxKind.CallExpression
    );

  for (const call of calls) {
    const expression =
      call.getExpression();

    if (
      !Node.isPropertyAccessExpression(
        expression
      )
    ) {
      continue;
    }

    const methodName =
      expression.getName();

    if (
      methodName !==
      fix.locatorType
    ) {
      continue;
    }

    console.log(
      `Found ${methodName}()`
    );

    let success = false;

    switch (
      fix.locatorType
    ) {
      case "getByRole":
        success =
          patchGetByRole(
            call,
            fix
          );
        break;

      case "getByText":
      case "getByLabel":
      case "getByTestId":
        success =
          patchSimpleLocator(
            call,
            fix
          );
        break;

      case "locator":
        success =
          patchLocatorSelector(
            call,
            fix
          );
        break;
    }

    if (success) {
      modified = true;

      console.log(
        `Successfully updated locator in ${filePath}`
      );

      break;
    }
  }

  if (modified) {
    backupFile(filePath);

    sourceFile.saveSync();
  }

  return modified;
}

function applyFix(
  fix: LocatorFix
) {
  console.log(
    `\nApplying fix`
  );

  console.log(
    JSON.stringify(
      fix,
      null,
      2
    )
  );

  if (!isSafeFix(fix)) {
    console.log(
      `Unsafe fix rejected`
    );

    return;
  }

  const targetFile =
    path.normalize(fix.file);

  if (
    !fs.existsSync(targetFile)
  ) {
    console.log(
      `File not found: ${targetFile}`
    );

    return;
  }

  const success = patchFile(
    targetFile,
    fix
  );

  if (!success) {
    console.log(
      `No matching locator found`
    );
  }
}

async function main() {
  try {
    const llmFile =
      "llm-output.json";

    if (
      !fs.existsSync(llmFile)
    ) {
      throw new Error(
        "llm-output.json missing"
      );
    }

    const raw =
      fs.readFileSync(
        llmFile,
        "utf-8"
      );

    const output: LLMResponse =
      JSON.parse(raw);

    if (
      !output.fixes ||
      output.fixes.length === 0
    ) {
      console.log(
        "No fixes received"
      );

      process.exit(0);
    }

    console.log(
      `Received ${output.fixes.length} fixes`
    );

    for (const fix of output.fixes) {
      applyFix(fix);
    }

    console.log(
      "\nPatch application completed"
    );
  } catch (error) {
    console.error(
      "Patch failure:"
    );

    console.error(error);

    process.exit(1);
  }
}

main();