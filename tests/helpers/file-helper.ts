import fs from "fs";
import { log } from "./logger.js";
import { parse } from "csv-parse/sync";

/**
 * Reads file and returns string. For JSON, parse it before using
 */
function readFile(filePath: string): any {
  if (!fs.existsSync(filePath)) {
    throw new Error(`No file exists with given name:${filePath}`);
  }
  log("info", `Reading file: ${filePath}...`);
  let data = fs.readFileSync(filePath, "utf8");
  return data;
}
/**
 * Writes to target file. If target is json, stringify data
 * @param filePath fullpath incl extn of file
 * @param data
 */
function writeFile(filePath: string, data: string) {
  try {
    fs.writeFileSync(filePath, data);
    log("info", `Writing file: ${filePath}...`);
  } catch (err) {
    new Error(`Error writing to: ${filePath}, ${err}`);
  }
}

/**
 * Reads the CSV file
 * @param filepath 
 * @returns Array of objects
 */
function readCSV(filepath: string): any[] {
  // Read a file
  const csvDataStr = fs.readFileSync(filepath, { encoding: "utf-8" });

  // Parse the csv data -> Array of data (install csv-parse)
  const csvDataArr = parse(csvDataStr, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  return csvDataArr;
}

export default { readFile, writeFile, readCSV };
