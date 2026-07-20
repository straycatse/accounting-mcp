// Two guards on the message catalogs:
//  1. every locale has exactly the same key set as English — TypeScript only
//     checks call sites against en.json (see global.d.ts), so a missing Swedish
//     key would otherwise surface only as a runtime fallback;
//  2. every message is valid ICU — a malformed plural (and the plural rules
//     differ per language, so these are hand-written per catalog) throws at
//     render time, on the one page that happens to use it.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { IntlMessageFormat } from "intl-messageformat";

const dir = fileURLToPath(new URL("../messages/", import.meta.url));
const LOCALES = ["sv", "en"];
const REFERENCE = "en";

function flatten(value, prefix = "") {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    flatten(child, prefix ? `${prefix}.${key}` : key),
  );
}

function entries(value, prefix = "") {
  if (typeof value !== "object" || value === null) return [[prefix, value]];
  return Object.entries(value).flatMap(([key, child]) =>
    entries(child, prefix ? `${prefix}.${key}` : key),
  );
}

const catalogs = Object.fromEntries(
  LOCALES.map((locale) => [locale, JSON.parse(readFileSync(`${dir}${locale}.json`, "utf8"))]),
);
const keys = Object.fromEntries(
  LOCALES.map((locale) => [locale, new Set(flatten(catalogs[locale]))]),
);

let failed = false;

for (const locale of LOCALES) {
  for (const [key, message] of entries(catalogs[locale])) {
    try {
      new IntlMessageFormat(message, locale);
    } catch (error) {
      console.error(`${locale}.json: invalid ICU in "${key}" — ${error.message}`);
      failed = true;
    }
  }
}

for (const locale of LOCALES.filter((l) => l !== REFERENCE)) {
  const missing = [...keys[REFERENCE]].filter((k) => !keys[locale].has(k));
  const extra = [...keys[locale]].filter((k) => !keys[REFERENCE].has(k));
  for (const key of missing) {
    console.error(`${locale}.json: missing key "${key}"`);
    failed = true;
  }
  for (const key of extra) {
    console.error(`${locale}.json: unknown key "${key}" (not in ${REFERENCE}.json)`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log(`All ${LOCALES.length} message catalogs are in sync (${keys[REFERENCE].size} keys).`);
