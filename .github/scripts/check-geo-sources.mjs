import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const CACHE_DIR = path.resolve(".cache/geo");
const CACHE_FILE = path.join(CACHE_DIR, "source-head.json");

const SOURCES = {
  unM49: "https://unstats.un.org/unsd/methodology/m49/overview/?hl=en",
  isoCountries: "https://download.geonames.org/export/dump/countryInfo.txt",
  isoSubdivisions: "https://download.geonames.org/export/dump/admin1CodesASCII.txt",
  admin2Subdivisions: "https://download.geonames.org/export/dump/admin2Codes.txt",
  geonamesCities: "https://download.geonames.org/export/dump/allCountries.zip",
  geonamesPostalCodes: "https://download.geonames.org/export/zip/allCountries.zip",
  geonamesAlternateNamesIndex: "https://download.geonames.org/export/dump/alternatenames/",
};

async function getHead(url) {
  const response = await fetch(url, { method: "HEAD" });
  return {
    etag: response.headers.get("etag"),
    lastModified: response.headers.get("last-modified"),
    contentLength: response.headers.get("content-length"),
  };
}

const previous = existsSync(CACHE_FILE)
  ? JSON.parse(readFileSync(CACHE_FILE, "utf8"))
  : {};

const current = {};
let changed = false;

for (const [key, url] of Object.entries(SOURCES)) {
  const head = await getHead(url);
  current[key] = head;

  const before = JSON.stringify(previous[key] ?? {});
  const after = JSON.stringify(head ?? {});
  if (before !== after) {
    changed = true;
  }
}

mkdirSync(CACHE_DIR, { recursive: true });
writeFileSync(CACHE_FILE, JSON.stringify(current, null, 2));

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
} else {
  process.stdout.write(`changed=${changed}\n`);
}
