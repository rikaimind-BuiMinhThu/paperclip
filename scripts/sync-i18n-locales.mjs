#!/usr/bin/env node
/**
 * Align every locale file under ui/src/i18n/locales with en.json.
 *
 * Missing keys are filled with the English value. Extra keys are removed.
 * Existing string translations are kept when the English node is also a string.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const localesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../ui/src/i18n/locales",
);

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function syncNode(english, candidate, stats) {
  if (typeof english === "string") {
    if (typeof candidate === "string") {
      if (candidate !== english) stats.preserved += 1;
      else stats.unchanged += 1;
      return candidate;
    }
    stats.filled += 1;
    return english;
  }

  if (!isPlainObject(english)) {
    stats.filled += 1;
    return english;
  }

  const source = isPlainObject(candidate) ? candidate : {};
  if (!isPlainObject(candidate)) stats.replaced += 1;

  for (const key of Object.keys(source)) {
    if (!(key in english)) stats.removed += 1;
  }

  const result = {};
  for (const key of Object.keys(english)) {
    result[key] = syncNode(english[key], source[key], stats);
  }
  return result;
}

function countLeaves(value) {
  if (typeof value === "string") return 1;
  if (!isPlainObject(value)) return 0;
  return Object.values(value).reduce((sum, child) => sum + countLeaves(child), 0);
}

const enPath = path.join(localesDir, "en.json");
const english = JSON.parse(fs.readFileSync(enPath, "utf8"));
const files = fs
  .readdirSync(localesDir)
  .filter((name) => name.endsWith(".json") && name !== "en.json")
  .sort();

const summary = [];

for (const file of files) {
  const filePath = path.join(localesDir, file);
  const current = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const stats = { filled: 0, preserved: 0, unchanged: 0, removed: 0, replaced: 0 };
  const next = syncNode(english, current, stats);
  fs.writeFileSync(filePath, `${JSON.stringify(next, null, 2)}\n`);
  summary.push({ file, ...stats });
  console.log(
    `${file}: filled ${stats.filled}, preserved ${stats.preserved}, removed ${stats.removed}`,
  );
}

console.log(
  `Synced ${summary.length} locale files to en.json (${countLeaves(english)} keys).`,
);
