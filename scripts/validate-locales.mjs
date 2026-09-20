import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve("packages/shared/src/language.ts"), "utf8");

function block(start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  if (from < 0 || to < 0) throw new Error(`Locale block not found: ${start}`);
  return source.slice(from, to);
}

function entries(text) {
  const rows = [...text.matchAll(/^\s+"([^"]+)":\s*"((?:[^"\\]|\\.)*)",?$/gm)];
  return rows.map((match) => ({ key: match[1], value: match[2] }));
}

function duplicates(rows) {
  const seen = new Set();
  return rows
    .filter(({ key }) => (seen.has(key) ? true : !seen.add(key)))
    .map(({ key }) => key);
}

function placeholders(value) {
  return [...value.matchAll(/\{\{([a-zA-Z0-9_]+)\}\}/g)]
    .map((match) => match[1])
    .sort();
}

const english = entries(block("  en: {", "  hi: {"));
const hindi = entries(block("  hi: {", "} as const;"));
const en = new Map(english.map(({ key, value }) => [key, value]));
const hi = new Map(hindi.map(({ key, value }) => [key, value]));
const missing = [...en.keys()].filter((key) => !hi.has(key));
const extra = [...hi.keys()].filter((key) => !en.has(key));
const duplicateKeys = [...duplicates(english), ...duplicates(hindi)];
const placeholderMismatches = [...en.keys()].filter(
  (key) =>
    JSON.stringify(placeholders(en.get(key) ?? "")) !==
    JSON.stringify(placeholders(hi.get(key) ?? "")),
);
const registryCodes = [
  ...source.matchAll(/(?:code:\s*"|future\(")([a-z]{2})"/g),
].map((match) => match[1]);
const invalidLanguageCodes = registryCodes.filter(
  (code) => !/^[a-z]{2}$/.test(code),
);

const result = {
  englishKeys: en.size,
  hindiKeys: hi.size,
  missing,
  extra,
  duplicateKeys,
  placeholderMismatches,
  invalidLanguageCodes,
};
console.log(JSON.stringify(result, null, 2));
if (
  missing.length ||
  extra.length ||
  duplicateKeys.length ||
  placeholderMismatches.length ||
  invalidLanguageCodes.length
)
  process.exit(1);
