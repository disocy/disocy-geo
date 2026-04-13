const DATASET_BASE_URL = "https://disocy.github.io/disocy-geo";
const cache = new Map();

function normalizeCode(value) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function buildDatasetUrl(relativePath) {
  return `${DATASET_BASE_URL.replace(/\/+$/, "")}/${relativePath.replace(/^\/+/, "")}`;
}

async function readJson(relativePath) {
  const cacheKey = relativePath;

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const promise = (async () => {
    try {
      const response = await fetch(buildDatasetUrl(relativePath), {
        headers: {
          "user-agent": "@disocy/geo runtime",
          accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`@disocy/geo dist artifact not found: ${relativePath}`);
      }

      return await response.json();
    } catch (error) {
      cache.delete(cacheKey);
      throw error;
    }
  })();

  cache.set(cacheKey, promise);
  return promise;
}

async function readJsonOptional(relativePath, fallbackValue) {
  try {
    return await readJson(relativePath);
  } catch {
    return fallbackValue;
  }
}

export function getDatasetBaseUrl() {
  return DATASET_BASE_URL;
}

export async function loadCountries() {
  return readJson("core/countries.json");
}

export async function loadSubdivisionsByCountry(countryCode) {
  const normalizedCountryCode = normalizeCode(countryCode);
  if (!normalizedCountryCode) {
    return [];
  }

  return readJsonOptional(`core/subdivisions-by-country/${normalizedCountryCode}.json`, []);
}

export async function loadCitiesManifest() {
  return readJson("core/localities/manifest.json");
}

export async function loadCountryOperationalMetadata(countryCode) {
  const normalizedCountryCode = normalizeCode(countryCode);
  if (!normalizedCountryCode) {
    return null;
  }

  return readJsonOptional(`addressing/country-operational/${normalizedCountryCode}.json`, null);
}

export async function loadAdministrativeDivisionMetadata(countryCode) {
  const normalizedCountryCode = normalizeCode(countryCode);
  if (!normalizedCountryCode) {
    return null;
  }

  return readJsonOptional(`addressing/administrative-divisions/${normalizedCountryCode}.json`, null);
}

export async function loadPostalCodesByCountry(countryCode) {
  const normalizedCountryCode = normalizeCode(countryCode);
  if (!normalizedCountryCode) {
    return [];
  }

  return readJsonOptional(`addressing/postal-codes/${normalizedCountryCode}.json`, []);
}

export async function loadCustomsMetadata(countryCode) {
  const normalizedCountryCode = normalizeCode(countryCode);
  if (!normalizedCountryCode) {
    return null;
  }

  return readJsonOptional(`compliance/customs/${normalizedCountryCode}.json`, null);
}

export async function loadTradeRegionMetadata(countryCode) {
  const normalizedCountryCode = normalizeCode(countryCode);
  if (!normalizedCountryCode) {
    return null;
  }

  return readJsonOptional(`compliance/trade-regions/${normalizedCountryCode}.json`, null);
}

export async function loadCountryMetadata(countryCode) {
  const normalizedCountryCode = normalizeCode(countryCode);
  if (!normalizedCountryCode) {
    return null;
  }

  return readJsonOptional(`metadata/countries/${normalizedCountryCode}.json`, null);
}

export async function loadCityShard(countryCode, subdivisionKey) {
  const normalizedCountryCode = normalizeCode(countryCode);
  const normalizedSubdivisionKey = normalizeCode(subdivisionKey);
  return readJson(
    `core/localities/by-country-state/${normalizedCountryCode}/${normalizedSubdivisionKey}.json`,
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
