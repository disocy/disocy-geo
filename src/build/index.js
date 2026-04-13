import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, "../..");
const SOURCES_DIR = path.join(PACKAGE_ROOT, "src", "sources");
const DIST_DIR = path.join(PACKAGE_ROOT, "dist");
const CORE_DIST_DIR = path.join(DIST_DIR, "core");
const CORE_SUBDIVISIONS_DIR = path.join(CORE_DIST_DIR, "subdivisions-by-country");
const CORE_LOCALITIES_DIR = path.join(CORE_DIST_DIR, "localities");
const CORE_CITY_SHARDS_DIR = path.join(CORE_LOCALITIES_DIR, "by-country-state");
const ADDRESSING_DIST_DIR = path.join(DIST_DIR, "addressing");
const ADDRESSING_COUNTRY_OPERATIONAL_DIR = path.join(ADDRESSING_DIST_DIR, "country-operational");
const ADDRESSING_ADMINISTRATIVE_DIVISIONS_DIR = path.join(ADDRESSING_DIST_DIR, "administrative-divisions");
const ADDRESSING_POSTAL_CODES_DIR = path.join(ADDRESSING_DIST_DIR, "postal-codes");
const COMPLIANCE_DIST_DIR = path.join(DIST_DIR, "compliance");
const COMPLIANCE_CUSTOMS_DIR = path.join(COMPLIANCE_DIST_DIR, "customs");
const COMPLIANCE_TRADE_REGIONS_DIR = path.join(COMPLIANCE_DIST_DIR, "trade-regions");
const METADATA_DIST_DIR = path.join(DIST_DIR, "metadata");
const METADATA_COUNTRIES_DIR = path.join(METADATA_DIST_DIR, "countries");
const GEO_DATASET_VERSION = "2026.04.13";
const CONTINENT_NAMES_BY_CODE = {
  AF: "Africa",
  AN: "Antarctica",
  AS: "Asia",
  EU: "Europe",
  NA: "North America",
  OC: "Oceania",
  SA: "South America",
};

const languageDisplayNameCache = new Map();
const regionDisplayNameCache = new Map();

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(SOURCES_DIR, relativePath), "utf8"));
}

function readJsonOptional(relativePath, fallbackValue) {
  const target = path.join(SOURCES_DIR, relativePath);
  if (!existsSync(target)) {
    return fallbackValue;
  }

  return JSON.parse(readFileSync(target, "utf8"));
}

function readShardStoreFromSources(relativeDir, kind) {
  const targetDir = path.join(SOURCES_DIR, relativeDir);
  if (!existsSync(targetDir)) {
    return null;
  }

  return {
    kind,
    dir: targetDir,
  };
}

function ensureDir(target) {
  mkdirSync(target, { recursive: true });
}

function writeJson(target, value) {
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function compareByCode(left, right) {
  return String(left.code).localeCompare(String(right.code));
}

function compareCities(left, right) {
  const populationDelta = (right.population ?? 0) - (left.population ?? 0);
  if (populationDelta !== 0) {
    return populationDelta;
  }

  return String(left.name).localeCompare(String(right.name));
}

function normalizeLanguageTag(value) {
  return String(value ?? "").trim().replace(/_/g, "-");
}

function normalizeLanguageBase(value) {
  return normalizeLanguageTag(value).split("-")[0]?.toLowerCase() ?? "";
}

function getContinentNameFromCode(continentCode) {
  return CONTINENT_NAMES_BY_CODE[String(continentCode ?? "").toUpperCase()] ?? "";
}

function getLanguageDisplayName(locale, languageCode) {
  const normalizedLocale = normalizeLanguageTag(locale) || "en";
  const normalizedLanguageCode = String(languageCode ?? "").trim().toLowerCase();
  if (!normalizedLanguageCode) {
    return "";
  }

  const cacheKey = `${normalizedLocale}:${normalizedLanguageCode}`;
  if (languageDisplayNameCache.has(cacheKey)) {
    return languageDisplayNameCache.get(cacheKey);
  }

  try {
    const displayName = new Intl.DisplayNames([normalizedLocale], { type: "language" }).of(normalizedLanguageCode) ?? "";
    languageDisplayNameCache.set(cacheKey, displayName);
    return displayName;
  } catch {
    languageDisplayNameCache.set(cacheKey, "");
    return "";
  }
}

function getRegionDisplayName(locale, countryCode) {
  const normalizedLocale = normalizeLanguageTag(locale) || "en";
  const normalizedCountryCode = String(countryCode ?? "").trim().toUpperCase();
  if (!normalizedCountryCode) {
    return "";
  }

  const cacheKey = `${normalizedLocale}:${normalizedCountryCode}`;
  if (regionDisplayNameCache.has(cacheKey)) {
    return regionDisplayNameCache.get(cacheKey);
  }

  try {
    const displayName = new Intl.DisplayNames([normalizedLocale], { type: "region" }).of(normalizedCountryCode) ?? "";
    regionDisplayNameCache.set(cacheKey, displayName);
    return displayName;
  } catch {
    regionDisplayNameCache.set(cacheKey, "");
    return "";
  }
}

function normalizeLookupLabel(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\b(province|provincia|province of|provincia de|provincia d'|state of|estado de|region of|comunidad|community of|autonomous community of)\b/gi, " ")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function buildSearchKeywords(...values) {
  return [...new Set(
    values
      .flat()
      .filter((value) => typeof value === "string" && value.trim().length > 0)
      .map((value) => String(value).trim()),
  )];
}

function buildLanguageDetails(languageTags) {
  return languageTags.map((tag) => {
    const normalizedTag = normalizeLanguageTag(tag);
    const baseCode = normalizedTag.split("-")[0]?.toLowerCase() ?? "";
    const englishName = getLanguageDisplayName("en", baseCode);
    const nativeName =
      getLanguageDisplayName(normalizedTag, baseCode) ||
      getLanguageDisplayName(baseCode, baseCode) ||
      englishName;

    return {
      code: baseCode,
      tag: normalizedTag,
      name: englishName || nativeName || normalizedTag,
      nativeName: nativeName || englishName || normalizedTag,
    };
  });
}

function buildCountryLanguageMetadata(record) {
  const languageTags = Array.isArray(record.languages)
    ? record.languages.map((entry) => normalizeLanguageTag(entry)).filter(Boolean)
    : [];
  const languageDetails = buildLanguageDetails(languageTags);
  const primaryLanguage = languageTags[0] ?? null;
  const nativeName = primaryLanguage
    ? getRegionDisplayName(primaryLanguage, record.code) || getRegionDisplayName(primaryLanguage.split("-")[0], record.code)
    : "";

  return {
    languages: languageTags,
    languageDetails,
    primaryLanguage,
    nativeName: nativeName || null,
  };
}

function loadAdmin1OfficialNames(input) {
  const payload = input?.admin1OfficialNames;
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload;
  }

  return readJsonOptional(path.join("geonames", "admin1-official-names.json"), {});
}

function loadSubdivisionAlternateNames(input) {
  const payload = input?.subdivisionAlternateNames;
  if (Array.isArray(payload)) {
    return payload;
  }

  return readJsonOptional(path.join("geonames", "subdivision-alternate-names.json"), []);
}

function buildCountryLanguagesByCode(input = {}) {
  const isoCountries = input.isoCountries ?? readJson(path.join("iso-3166", "countries.json"));
  return new Map(
    isoCountries.map((record) => {
      const languages = Array.isArray(record.languages)
        ? record.languages.map((entry) => normalizeLanguageTag(entry)).filter(Boolean)
        : [];
      return [record.code, languages];
    }),
  );
}

function normalizeNameComparisonKey(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function buildSubdivisionAlternateNamesByGeonameId(input = {}) {
  const records = loadSubdivisionAlternateNames(input);
  const recordsByGeonameId = new Map();

  for (const record of records) {
    if (!Number.isInteger(record?.geonameId) || !record?.name) {
      continue;
    }

    const bucket = recordsByGeonameId.get(record.geonameId) ?? [];
    bucket.push({
      ...record,
      languageBase: normalizeLanguageBase(record.language),
    });
    recordsByGeonameId.set(record.geonameId, bucket);
  }

  return recordsByGeonameId;
}

function chooseBestAlternateName(records, preferredLanguageBases, excludedNames = new Set()) {
  const preferredBases = preferredLanguageBases
    .map((value) => normalizeLanguageBase(value))
    .filter(Boolean);
  const blocked = new Set(
    [...excludedNames]
      .map((value) => normalizeNameComparisonKey(value))
      .filter(Boolean),
  );

  const candidates = records
    .filter((record) => {
      if (!record?.name) {
        return false;
      }

      if (preferredBases.length > 0 && !preferredBases.includes(record.languageBase)) {
        return false;
      }

      const key = normalizeNameComparisonKey(record.name);
      return key && !blocked.has(key);
    })
    .sort((left, right) => {
      const shortDelta = Number(right.isShortName === true) - Number(left.isShortName === true);
      if (shortDelta !== 0) {
        return shortDelta;
      }

      const preferredDelta = Number(right.isPreferredName === true) - Number(left.isPreferredName === true);
      if (preferredDelta !== 0) {
        return preferredDelta;
      }

      return left.name.length - right.name.length || left.name.localeCompare(right.name);
    });

  return candidates[0]?.name;
}

function resolveSubdivisionLabels(record, options) {
  const {
    countryLanguages,
    admin1OfficialName,
    alternateNames,
  } = options;

  const baseName = record.name;
  const englishName = chooseBestAlternateName(alternateNames, ["en"]) || baseName;
  const languageBases = countryLanguages.map((value) => normalizeLanguageBase(value)).filter(Boolean);
  const primaryLanguageBase = languageBases[0] ?? "";
  const displayName =
    chooseBestAlternateName(alternateNames, primaryLanguageBase ? [primaryLanguageBase] : [], [englishName]) ||
    (admin1OfficialName && normalizeNameComparisonKey(admin1OfficialName) !== normalizeNameComparisonKey(englishName)
      ? admin1OfficialName
      : undefined) ||
    englishName;

  const alternateNativeFromOfficial =
    admin1OfficialName &&
    ![
      normalizeNameComparisonKey(englishName),
      normalizeNameComparisonKey(displayName),
    ].includes(normalizeNameComparisonKey(admin1OfficialName))
      ? admin1OfficialName
      : undefined;

  const nativeName =
    alternateNativeFromOfficial ||
    (normalizeNameComparisonKey(displayName) !== normalizeNameComparisonKey(englishName) ? displayName : undefined);

  return {
    name: englishName,
    displayName,
    nativeName,
  };
}

function inferAdministrativeDivisionType(subdivisions) {
  const normalizedSubdivisionLabels = subdivisions.map((record) => (
    [record.name, record.nativeName, record.displayName, ...(record.searchKeywords ?? [])]
      .filter((value) => typeof value === "string" && value.trim().length > 0)
      .map((value) => normalizeLookupLabel(value))
  ));

  const scores = new Map();
  const registerMatch = (label, pattern) => {
    const score = normalizedSubdivisionLabels.reduce(
      (count, labels) => count + (labels.some((value) => pattern.test(value)) ? 1 : 0),
      0,
    );
    if (score > 0) {
      scores.set(label, score);
    }
  };

  registerMatch("prefecture", /\b(prefecture|ken|to|fu|do)\b/);
  registerMatch("province", /\b(province|provincia|província)\b/);
  registerMatch("state", /\b(state|estado)\b/);
  registerMatch("region", /\b(region|regio|region de|región|région)\b/);
  registerMatch("county", /\b(county|comte|comtat|kreis)\b/);
  registerMatch("department", /\b(department|departamento|departement|département)\b/);
  registerMatch("emirate", /\b(emirate|emirato)\b/);
  registerMatch("parish", /\b(parish|parroquia)\b/);
  registerMatch("canton", /\b(canton|canto|cantó|kanton)\b/);
  registerMatch("district", /\b(district|distrito|districte|bezirk)\b/);
  registerMatch("voivodeship", /\b(voivodeship|wojewodztwo|województwo)\b/);
  registerMatch("oblast", /\b(oblast)\b/);

  const winner = [...scores.entries()].sort((left, right) => right[1] - left[1])[0];
  if (winner && winner[1] >= 2) {
    return winner[0];
  }

  return "subdivision";
}

function buildPostalSubdivisionNativeHints(postalCodesByCountry) {
  const hintsByCountry = {};

  for (const [countryCode, records] of Object.entries(postalCodesByCountry)) {
    const admin1ByCode = new Map();
    const admin2ByCode = new Map();
    const admin1ByAdmin2Code = new Map();

    for (const record of records) {
      if (record.admin1Code && record.admin1Name) {
        admin1ByCode.set(record.admin1Code, record.admin1Name);
      }

      if (record.admin2Code && record.admin2Name) {
        admin2ByCode.set(record.admin2Code, record.admin2Name);
      }

      if (record.admin2Code && record.admin1Name) {
        admin1ByAdmin2Code.set(record.admin2Code, record.admin1Name);
      }
    }

    hintsByCountry[countryCode] = {
      admin1ByCode,
      admin2ByCode,
      admin1ByAdmin2Code,
    };
  }

  return hintsByCountry;
}

function inferSubdivisionNativeName(record, countryRecords, postalHints) {
  const existingName = record.name ?? "";
  const recordSuffix = String(record.code).split("-").slice(1);

  if (record.type === "admin2") {
    const admin2Code = recordSuffix[recordSuffix.length - 1];
    const directMatch = postalHints?.admin2ByCode?.get(admin2Code);
    return directMatch && normalizeLookupLabel(directMatch) !== normalizeLookupLabel(existingName)
      ? directMatch
      : undefined;
  }

  if (record.type === "admin1") {
    const childAdmin2Codes = countryRecords
      .filter((entry) => entry.type === "admin2" && entry.code.startsWith(`${record.code}-`))
      .map((entry) => String(entry.code).split("-").pop())
      .filter(Boolean);

    const admin1Matches = new Map();
    for (const admin2Code of childAdmin2Codes) {
      const nativeAdmin1Name = postalHints?.admin1ByAdmin2Code?.get(admin2Code);
      if (!nativeAdmin1Name) {
        continue;
      }

      const score = admin1Matches.get(nativeAdmin1Name) ?? 0;
      admin1Matches.set(nativeAdmin1Name, score + 1);
    }

    const bestMatch = [...admin1Matches.entries()].sort((left, right) => right[1] - left[1])[0]?.[0];
    if (bestMatch && normalizeLookupLabel(bestMatch) !== normalizeLookupLabel(existingName)) {
      return bestMatch;
    }
  }

  return undefined;
}

function buildCountries(input = {}) {
  const unCountries = input.unM49 ?? readJson(path.join("un-m49", "countries.json"));
  const isoCountries = input.isoCountries ?? readJson(path.join("iso-3166", "countries.json"));
  const countriesByCode = new Map();

  for (const record of unCountries) {
    countriesByCode.set(record.countryCode, {
      code: record.countryCode,
      name: record.name,
      iso3: undefined,
      m49: record.m49,
      continentCode: undefined,
      continent: record.continent,
      regionCode: undefined,
      region: record.region,
      capital: undefined,
      currencyCode: undefined,
      currencyName: undefined,
      tld: undefined,
      languages: [],
      primaryLanguage: undefined,
      nativeName: undefined,
      subregion: record.subregion,
    });
  }

  for (const record of isoCountries) {
    const languageMetadata = buildCountryLanguageMetadata(record);
    const current = countriesByCode.get(record.code) ?? {
      code: record.code,
      name: record.name,
      continent: "Unknown",
      region: "Unknown",
    };
    const resolvedContinent = getContinentNameFromCode(record.continentCode) || current.continent;

    countriesByCode.set(record.code, {
      ...current,
      name: record.name,
      iso3: record.iso3,
      m49: current.m49 ?? record.numeric,
      continentCode: record.continentCode ?? current.continentCode,
      continent: resolvedContinent || current.continent,
      capital: record.capital ?? current.capital,
      currencyCode: record.currencyCode ?? current.currencyCode,
      currencyName: record.currencyName ?? current.currencyName,
      tld: record.tld ?? current.tld,
      languages: languageMetadata.languages.length > 0 ? languageMetadata.languages : current.languages,
      primaryLanguage: languageMetadata.primaryLanguage ?? current.primaryLanguage,
      nativeName: languageMetadata.nativeName ?? current.nativeName,
    });
  }

  return [...countriesByCode.values()].sort(compareByCode);
}

function buildSubdivisions(input = {}) {
  const rawSubdivisions = input.isoSubdivisions ?? readJson(path.join("iso-3166-2", "subdivisions.json"));
  const postalCodesByCountry = buildPostalCodes(input);
  const postalHintsByCountry = buildPostalSubdivisionNativeHints(postalCodesByCountry);
  const admin1OfficialByCode = loadAdmin1OfficialNames(input ?? {});
  const countryLanguagesByCode = buildCountryLanguagesByCode(input);
  const alternateNamesByGeonameId = buildSubdivisionAlternateNamesByGeonameId(input);
  const subdivisionsByCountry = {};

  for (const record of rawSubdivisions) {
    const bucket = subdivisionsByCountry[record.countryCode] ?? [];
    bucket.push({
      code: record.code,
      countryCode: record.countryCode,
      name: record.name,
      geonameId: record.geonameId,
      type: record.type,
    });
    subdivisionsByCountry[record.countryCode] = bucket;
  }

  for (const countryCode of Object.keys(subdivisionsByCountry)) {
    const countryRecords = subdivisionsByCountry[countryCode];
    const postalHints = postalHintsByCountry[countryCode];
    const countryLanguages = countryLanguagesByCode.get(countryCode) ?? [];

    for (const record of countryRecords) {
      let nativeName;
      let displayName;
      let baseName = record.name;

      const subdivisionNames = resolveSubdivisionLabels(record, {
        countryLanguages,
        admin1OfficialName: record.type === "admin1" ? admin1OfficialByCode[record.code] : undefined,
        alternateNames: Number.isInteger(record.geonameId)
          ? alternateNamesByGeonameId.get(record.geonameId) ?? []
          : [],
      });

      baseName = subdivisionNames.name;
      nativeName = subdivisionNames.nativeName;
      displayName = subdivisionNames.displayName;

      if (nativeName === undefined) {
        nativeName = inferSubdivisionNativeName(record, countryRecords, postalHints);
      }

      record.name = baseName;
      record.nativeName = nativeName;
      record.displayName = displayName || nativeName || record.name;
      record.searchKeywords = buildSearchKeywords(
        record.name,
        nativeName,
        record.displayName,
        record.code,
      );
      delete record.geonameId;
    }

    countryRecords.sort(compareByCode);
  }

  return subdivisionsByCountry;
}

function writeSubdivisionsByCountry(subdivisionsByCountry) {
  ensureDir(CORE_SUBDIVISIONS_DIR);

  for (const [countryCode, subdivisions] of Object.entries(subdivisionsByCountry)) {
    writeJson(path.join(CORE_SUBDIVISIONS_DIR, `${countryCode}.json`), subdivisions);
  }
}

function isCityShardStore(value) {
  return Boolean(value && typeof value === "object" && value.kind === "city-shard-store" && value.dir);
}

function isPostalShardStore(value) {
  return Boolean(value && typeof value === "object" && value.kind === "postal-shard-store" && value.dir);
}

function listCityShardStoreFiles(store) {
  return readdirSync(store.dir)
    .filter((entry) => entry.endsWith(".ndjson"))
    .sort();
}

function readCityShardStoreFile(store, fileName) {
  const content = readFileSync(path.join(store.dir, fileName), "utf8");
  return content
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function readShardStoreFile(store, fileName) {
  const content = readFileSync(path.join(store.dir, fileName), "utf8");
  return content
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function buildCities(input = {}) {
  const rawCities =
    input.geonamesCities ??
    readShardStoreFromSources(path.join("geonames", "city-shards"), "city-shard-store") ??
    readJson(path.join("geonames", "cities.json"));
  const manifest = {
    version: GEO_DATASET_VERSION,
    generatedAt: new Date().toISOString(),
    countries: {},
  };

  let currentShard = null;

  function flushShard() {
    if (!currentShard) {
      return;
    }

    currentShard.cities.sort(compareCities);
    const countryDir = path.join(CORE_CITY_SHARDS_DIR, currentShard.countryCode);
    ensureDir(countryDir);
    writeJson(path.join(countryDir, `${currentShard.subdivisionKey}.json`), currentShard.cities);

    manifest.countries[currentShard.countryCode] = manifest.countries[currentShard.countryCode] ?? {};
    manifest.countries[currentShard.countryCode][currentShard.subdivisionKey] = {
      countryCode: currentShard.countryCode,
      subdivisionKey: currentShard.subdivisionKey,
      subdivisionCode: currentShard.subdivisionCode,
      file: currentShard.file,
      count: currentShard.cities.length,
    };
    currentShard = null;
  }

  const consumeRecord = (record) => {
    const subdivisionCode = record.subdivisionCode ?? `${record.countryCode}-${record.admin1Code}`;
    const subdivisionKey = subdivisionCode.includes("-")
      ? subdivisionCode.split("-")[1]
      : record.admin1Code;
    const shardMapKey = `${record.countryCode}:${subdivisionKey}`;

    if (!currentShard || currentShard.shardMapKey !== shardMapKey) {
      flushShard();
      currentShard = {
        shardMapKey,
        countryCode: record.countryCode,
        subdivisionKey,
        subdivisionCode,
        file: `core/localities/by-country-state/${record.countryCode}/${subdivisionKey}.json`,
        cities: [],
      };
    }

    currentShard.cities.push({
      geonameId: record.geonameId,
      name: record.name,
      asciiName: record.asciiName,
      countryCode: record.countryCode,
      subdivisionCode,
      admin1Code: record.admin1Code,
      admin2Code: record.admin2Code,
      population: record.population,
      lat: record.lat,
      lng: record.lng,
      timezone: record.timezone,
      featureClass: record.featureClass,
      featureCode: record.featureCode,
      localityType: record.localityType,
    });
  };

  if (isCityShardStore(rawCities)) {
    for (const fileName of listCityShardStoreFiles(rawCities)) {
      const records = readCityShardStoreFile(rawCities, fileName);
      records.sort(compareCities);
      for (const record of records) {
        consumeRecord(record);
      }
    }
  } else {
    for (const record of rawCities) {
      consumeRecord(record);
    }
  }

  flushShard();

  return manifest;
}

function buildShippingProfiles(input = {}) {
  return input.shippingProfiles ?? readJson(path.join("disocy", "shipping.json"));
}

function buildPostalCodes(input = {}) {
  const rawPostalCodes =
    input.geonamesPostalCodes ??
    readShardStoreFromSources(path.join("geonames", "postal-code-shards"), "postal-shard-store") ??
    readJsonOptional(path.join("geonames", "postal-codes.json"), []);
  const postalCodesByCountry = {};

  const registerRecord = (record) => {
    const countryCode = record.countryCode;
    if (!countryCode) {
      return;
    }

    const bucket = postalCodesByCountry[countryCode] ?? [];
    bucket.push({
      postalCode: record.postalCode,
      placeName: record.placeName,
      admin1Name: record.admin1Name ?? "",
      admin1Code: record.admin1Code ?? "",
      admin2Name: record.admin2Name ?? "",
      admin2Code: record.admin2Code ?? "",
      admin3Name: record.admin3Name ?? "",
      admin3Code: record.admin3Code ?? "",
      lat: typeof record.lat === "number" ? record.lat : null,
      lng: typeof record.lng === "number" ? record.lng : null,
      accuracy: Number.isInteger(record.accuracy) ? record.accuracy : null,
    });
    postalCodesByCountry[countryCode] = bucket;
  };

  if (isPostalShardStore(rawPostalCodes)) {
    for (const fileName of listCityShardStoreFiles(rawPostalCodes)) {
      const records = readShardStoreFile(rawPostalCodes, fileName);
      for (const record of records) {
        registerRecord(record);
      }
    }
  } else {
    for (const record of rawPostalCodes) {
      registerRecord(record);
    }
  }

  for (const countryCode of Object.keys(postalCodesByCountry)) {
    postalCodesByCountry[countryCode].sort((left, right) => {
      const postalDelta = String(left.postalCode).localeCompare(String(right.postalCode));
      if (postalDelta !== 0) {
        return postalDelta;
      }

      return String(left.placeName).localeCompare(String(right.placeName));
    });
  }

  return postalCodesByCountry;
}

function buildCountryMetadata(input = {}) {
  const isoCountries = input.isoCountries ?? readJson(path.join("iso-3166", "countries.json"));
  const geonamesCities =
    input.geonamesCities ??
    readShardStoreFromSources(path.join("geonames", "city-shards"), "city-shard-store") ??
    readJson(path.join("geonames", "cities.json"));
  const metadataByCountry = {};

  for (const record of isoCountries) {
    const languageMetadata = buildCountryLanguageMetadata(record);
    metadataByCountry[record.code] = {
      countryCode: record.code,
      capital: record.capital ?? null,
      continentCode: record.continentCode ?? null,
      continent: getContinentNameFromCode(record.continentCode) || null,
      tld: record.tld ?? null,
      currencyCode: record.currencyCode ?? null,
      currencyName: record.currencyName ?? null,
      languages: languageMetadata.languages,
      languageDetails: languageMetadata.languageDetails,
      primaryLanguage: languageMetadata.primaryLanguage,
      nativeName: languageMetadata.nativeName,
      timezones: [],
    };
  }

  const timezonesByCountry = new Map();
  const registerTimezone = (city) => {
    if (!city.countryCode || !city.timezone) {
      return;
    }

    const bucket = timezonesByCountry.get(city.countryCode) ?? new Set();
    bucket.add(city.timezone);
    timezonesByCountry.set(city.countryCode, bucket);
  };

  if (isCityShardStore(geonamesCities)) {
    for (const fileName of listCityShardStoreFiles(geonamesCities)) {
      const records = readCityShardStoreFile(geonamesCities, fileName);
      for (const city of records) {
        registerTimezone(city);
      }
    }
  } else {
    for (const city of geonamesCities) {
      registerTimezone(city);
    }
  }

  for (const [countryCode, timezones] of timezonesByCountry.entries()) {
    const current = metadataByCountry[countryCode] ?? {
      countryCode,
      capital: null,
      continentCode: null,
      continent: null,
      tld: null,
      currencyCode: null,
      currencyName: null,
      languages: [],
      languageDetails: [],
      primaryLanguage: null,
      nativeName: null,
      timezones: [],
    };

    current.timezones = [...timezones].sort();
    metadataByCountry[countryCode] = current;
  }

  return metadataByCountry;
}

function buildCountryOperationalMetadata(input = {}) {
  const shippingProfiles = buildShippingProfiles(input);
  return Object.fromEntries(
    Object.entries(shippingProfiles).map(([countryCode, profile]) => [
      countryCode,
      {
        countryCode,
        customsRegion: profile.customsRegion ?? "",
        locodeCountryCode: profile.locodeCountryCode ?? countryCode,
        phonePrefix: profile.phonePrefix ?? "",
        postalCodeFormat: profile.postalCodeFormat ?? "",
        postalCodeRegex: profile.postalCodeRegex ?? "",
        requiresSubdivisionForShipping: profile.requiresSubdivisionForShipping === true,
      },
    ]),
  );
}

function buildAdministrativeDivisionMetadata(input = {}) {
  const subdivisionsByCountry = buildSubdivisions(input);
  return Object.fromEntries(
    Object.entries(subdivisionsByCountry).map(([countryCode, subdivisions]) => {
      const admin1 = subdivisions.filter((record) => record.type === "admin1");
      const admin2 = subdivisions.filter((record) => record.type === "admin2");
      const preferredSubdivisionLevel = admin1.length > 0 ? "admin1" : "admin2";
      const primarySubdivisions = preferredSubdivisionLevel === "admin1" ? admin1 : admin2;

      return [
      countryCode,
      {
        countryCode,
        preferredSubdivisionLevel,
        primarySubdivisionType: inferAdministrativeDivisionType(primarySubdivisions),
      },
    ];
    }),
  );
}

function writeCountryRecordMap(baseDir, recordsByCountry) {
  ensureDir(baseDir);

  for (const [countryCode, record] of Object.entries(recordsByCountry)) {
    writeJson(path.join(baseDir, `${countryCode}.json`), record);
  }
}

function buildCustomsMetadata(input = {}) {
  const operationalMetadata = buildCountryOperationalMetadata(input);
  return Object.fromEntries(
    Object.entries(operationalMetadata).map(([countryCode, metadata]) => [
      countryCode,
      {
        countryCode,
        customsRegion: metadata.customsRegion ?? null,
        locodeCountryCode: metadata.locodeCountryCode ?? null,
        requiresSubdivisionForShipping: metadata.requiresSubdivisionForShipping === true,
      },
    ]),
  );
}

function buildTradeRegionMetadata(input = {}) {
  const operationalMetadata = buildCountryOperationalMetadata(input);
  return Object.fromEntries(
    Object.entries(operationalMetadata).map(([countryCode, metadata]) => [
      countryCode,
      {
        countryCode,
        customsRegion: metadata.customsRegion ?? null,
      },
    ]),
  );
}

export function buildGeoDataset(input = null) {
  rmSync(DIST_DIR, { recursive: true, force: true });
  ensureDir(CORE_CITY_SHARDS_DIR);
  ensureDir(CORE_SUBDIVISIONS_DIR);
  ensureDir(ADDRESSING_COUNTRY_OPERATIONAL_DIR);
  ensureDir(ADDRESSING_ADMINISTRATIVE_DIVISIONS_DIR);
  ensureDir(ADDRESSING_POSTAL_CODES_DIR);
  ensureDir(COMPLIANCE_CUSTOMS_DIR);
  ensureDir(COMPLIANCE_TRADE_REGIONS_DIR);
  ensureDir(METADATA_COUNTRIES_DIR);

  const countries = buildCountries(input ?? {});
  const subdivisionsByCountry = buildSubdivisions(input ?? {});
  const citiesManifest = buildCities(input ?? {});
  const shippingProfiles = buildShippingProfiles(input ?? {});
  const countryMetadata = buildCountryMetadata(input ?? {});
  const countryOperationalMetadata = buildCountryOperationalMetadata(input ?? {});
  const administrativeDivisionMetadata = buildAdministrativeDivisionMetadata(input ?? {});
  const postalCodes = buildPostalCodes(input ?? {});
  const customsMetadata = buildCustomsMetadata(input ?? {});
  const tradeRegionMetadata = buildTradeRegionMetadata(input ?? {});

  writeJson(path.join(CORE_DIST_DIR, "countries.json"), countries);
  writeJson(path.join(CORE_LOCALITIES_DIR, "manifest.json"), citiesManifest);
  writeSubdivisionsByCountry(subdivisionsByCountry);
  writeCountryRecordMap(ADDRESSING_COUNTRY_OPERATIONAL_DIR, countryOperationalMetadata);
  writeCountryRecordMap(ADDRESSING_ADMINISTRATIVE_DIVISIONS_DIR, administrativeDivisionMetadata);
  writeCountryRecordMap(ADDRESSING_POSTAL_CODES_DIR, postalCodes);
  writeCountryRecordMap(COMPLIANCE_CUSTOMS_DIR, customsMetadata);
  writeCountryRecordMap(COMPLIANCE_TRADE_REGIONS_DIR, tradeRegionMetadata);
  writeCountryRecordMap(METADATA_COUNTRIES_DIR, countryMetadata);

  return {
    version: GEO_DATASET_VERSION,
    countries: countries.length,
    subdivisionCountries: Object.keys(subdivisionsByCountry).length,
    cityCountries: Object.keys(citiesManifest.countries).length,
  };
}
