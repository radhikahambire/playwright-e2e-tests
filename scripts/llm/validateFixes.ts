import fs from "fs";

function main() {
  if (!fs.existsSync("results.json")) {
    throw new Error("results.json missing");
  }

  const raw = fs.readFileSync("results.json", "utf-8");

  if (raw.includes('"status":"failed"')) {
    console.error("Validation failed");
    process.exit(1);
  }

  console.log("All validation runs passed");
}

main();