import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_DIST_DIR = path.resolve(__dirname, "../../dist");
const cache = new Map();

function resolveDistDir() {
  const cwd = process.cwd();
  const candidates = [
    DEFAULT_DIST_DIR,
    path.resolve(cwd, "lib", "@disocy", "geo", "dist"),
    path.resolve(cwd, "..", "lib", "@disocy", "geo", "dist"),
  ];

  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, "core", "countries.json"))) {
      return candidate;
    }
  }

  return DEFAULT_DIST_DIR;
}

const DIST_DIR = resolveDistDir();

function normalizeCode(value) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function readJson(relativePath) {
  const target = path.join(DIST_DIR, relativePath);
  const cacheKey = target;

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  if (!existsSync(target)) {
    throw new Error(`@disocy/geo dist artifact not found: ${relativePath}`);
  }

  const parsed = JSON.parse(readFileSync(target, "utf8"));
  cache.set(cacheKey, parsed);
  return parsed;
}

function readJsonOptional(relativePath, fallbackValue) {
  const target = path.join(DIST_DIR, relativePath);
  if (!existsSync(target)) {
    return fallbackValue;
  }

  return readJson(relativePath);
}

export function loadCountries() {
  return readJson(path.join("core", "countries.json"));
}

export function loadSubdivisionsByCountry(countryCode) {
  const normalizedCountryCode = normalizeCode(countryCode);
  if (!normalizedCountryCode) {
    return [];
  }

  return readJsonOptional(path.join("core", "subdivisions-by-country", `${normalizedCountryCode}.json`), []);
}

export function loadCitiesManifest() {
  return readJson(path.join("core", "localities", "manifest.json"));
}

export function loadCountryOperationalMetadata(countryCode) {
  const normalizedCountryCode = normalizeCode(countryCode);
  if (!normalizedCountryCode) {
    return null;
  }

  return readJsonOptional(path.join("addressing", "country-operational", `${normalizedCountryCode}.json`), null);
}

export function loadAdministrativeDivisionMetadata(countryCode) {
  const normalizedCountryCode = normalizeCode(countryCode);
  if (!normalizedCountryCode) {
    return null;
  }

  return readJsonOptional(path.join("addressing", "administrative-divisions", `${normalizedCountryCode}.json`), null);
}

export function loadPostalCodesByCountry(countryCode) {
  const normalizedCountryCode = normalizeCode(countryCode);
  if (!normalizedCountryCode) {
    return [];
  }

  return readJsonOptional(path.join("addressing", "postal-codes", `${normalizedCountryCode}.json`), []);
}

export function loadCustomsMetadata(countryCode) {
  const normalizedCountryCode = normalizeCode(countryCode);
  if (!normalizedCountryCode) {
    return null;
  }

  return readJsonOptional(path.join("compliance", "customs", `${normalizedCountryCode}.json`), null);
}

export function loadTradeRegionMetadata(countryCode) {
  const normalizedCountryCode = normalizeCode(countryCode);
  if (!normalizedCountryCode) {
    return null;
  }

  return readJsonOptional(path.join("compliance", "trade-regions", `${normalizedCountryCode}.json`), null);
}

export function loadCountryMetadata(countryCode) {
  const normalizedCountryCode = normalizeCode(countryCode);
  if (!normalizedCountryCode) {
    return null;
  }

  return readJsonOptional(path.join("metadata", "countries", `${normalizedCountryCode}.json`), null);
}

export function listCountryShardCodes(relativeDir) {
  const targetDir = path.join(DIST_DIR, relativeDir);
  if (!existsSync(targetDir)) {
    return [];
  }

  return readdirSync(targetDir)
    .filter((entry) => entry.endsWith(".json"))
    .map((entry) => entry.replace(/\.json$/i, ""))
    .sort();
}

export function loadCityShard(countryCode, subdivisionKey) {
  const normalizedCountryCode = normalizeCode(countryCode);
  const normalizedSubdivisionKey = normalizeCode(subdivisionKey);
  return readJson(
    path.join("core", "localities", "by-country-state", normalizedCountryCode, `${normalizedSubdivisionKey}.json`),
  );
}

export function getSubdivisionKeyFromCode(subdivisionCode) {
  const normalized = normalizeCode(subdivisionCode);
  const [, suffix = normalized] = normalized.split("-");
  return suffix;
}

export function normalizeCountryCode(countryCode) {
  return normalizeCode(countryCode);
}

export function normalizeSubdivisionCode(subdivisionCode) {
  return normalizeCode(subdivisionCode);
}
