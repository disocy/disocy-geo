import { appendFileSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildGeoDataset } from "../build/index.js";
import {
  deriveShippingProfiles,
  normalizeIsoCountriesPayload,
  normalizeIsoSubdivisionsPayload,
  normalizePostalCodeRecord,
  normalizePostalCodesPayload,
  normalizeShippingProfilesPayload,
  normalizeSubdivisionAlternateNameRecord,
  normalizeUnM49Payload,
  normalizeCityRecord,
  normalizeCitiesPayload,
} from "./normalize.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, "../..");
const SOURCES_DIR = path.join(PACKAGE_ROOT, "src", "sources");

const DEFAULT_SOURCE_URLS = Object.freeze({
  unM49: process.env.DISOCY_GEO_UN_M49_URL ?? "https://unstats.un.org/unsd/methodology/m49/overview/?hl=en",
  isoCountries: process.env.DISOCY_GEO_ISO_COUNTRIES_URL ?? "https://download.geonames.org/export/dump/countryInfo.txt",
  // GeoNames documents this file as English labels only; UTF-8 native admin1 names come from allCountries ADM1 rows (see extractAndNormalizeCitiesFromZip).
  isoSubdivisions: process.env.DISOCY_GEO_ISO_SUBDIVISIONS_URL ?? "https://download.geonames.org/export/dump/admin1CodesASCII.txt",
  admin2Subdivisions: process.env.DISOCY_GEO_ADMIN2_SUBDIVISIONS_URL ?? "https://download.geonames.org/export/dump/admin2Codes.txt",
  geonamesCities: process.env.DISOCY_GEO_GEONAMES_CITIES_URL ?? "https://download.geonames.org/export/dump/allCountries.zip",
  geonamesPostalCodes: process.env.DISOCY_GEO_GEONAMES_POSTAL_CODES_URL ?? "https://download.geonames.org/export/zip/allCountries.zip",
  geonamesAlternateNamesBaseUrl:
    process.env.DISOCY_GEO_GEONAMES_ALTERNATE_NAMES_BASE_URL ?? "https://download.geonames.org/export/dump/alternatenames",
  shippingProfiles: process.env.DISOCY_GEO_SHIPPING_URL ?? "",
});

function ensureDir(target) {
  mkdirSync(target, { recursive: true });
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function persistShardStore(store, targetDir) {
  if (!store?.dir || !existsSync(store.dir)) {
    return;
  }

  rmSync(targetDir, { recursive: true, force: true });
  ensureDir(targetDir);

  for (const fileName of readdirSync(store.dir).filter((entry) => entry.endsWith(".ndjson")).sort()) {
    copyFileSync(path.join(store.dir, fileName), path.join(targetDir, fileName));
  }
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "@disocy/geo populate pipeline",
      "accept": "application/json,text/plain,text/csv,text/tab-separated-values,*/*",
      "accept-language": "en,en-US;q=0.9",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

async function fetchBinary(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "@disocy/geo populate pipeline",
      "accept": "*/*",
      "accept-language": "en,en-US;q=0.9",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

function looksLikeZipUrl(url) {
  return typeof url === "string" && url.toLowerCase().includes(".zip");
}

function getCityShardKey(record) {
  const subdivisionCode = record.subdivisionCode ?? `${record.countryCode}-${record.admin1Code}`;
  const subdivisionKey = subdivisionCode.includes("-")
    ? subdivisionCode.split("-")[1]
    : record.admin1Code;

  return {
    subdivisionCode,
    subdivisionKey,
    shardKey: `${record.countryCode}:${subdivisionKey}`,
  };
}

async function extractAndNormalizeCitiesFromZip(buffer) {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "disocy-geo-zip-"));
  const zipPath = path.join(tempDir, "payload.zip");
  const shardDir = path.join(tempDir, "city-shards");

  try {
    writeFileSync(zipPath, buffer);
    ensureDir(shardDir);
    const { default: yauzl } = await import("yauzl");

    const zipFile = await new Promise((resolve, reject) => {
      yauzl.open(zipPath, { lazyEntries: true }, (error, handle) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(handle);
      });
    });

    const entry = await new Promise((resolve, reject) => {
      zipFile.readEntry();
      zipFile.once("entry", resolve);
      zipFile.once("error", reject);
      zipFile.once("end", () => reject(new Error("ZIP archive does not contain entries")));
    });

    const stream = await new Promise((resolve, reject) => {
      zipFile.openReadStream(entry, (error, handle) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(handle);
      });
    });

    let recordCount = 0;
    /** @type {Map<string, string>} */
    const admin1OfficialByCode = new Map();
    const lines = createInterface({ input: stream, crlfDelay: Infinity });

    for await (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        continue;
      }

      const columns = line.split("\t");
      if (columns.length >= 12) {
        const featureClass = String(columns[6] ?? "").trim();
        const featureCode = String(columns[7] ?? "").trim();
        if (featureClass === "A" && featureCode === "ADM1") {
          const countryCode = String(columns[8] ?? "").trim().toUpperCase();
          const admin1Code = String(columns[10] ?? "").trim().toUpperCase();
          const officialName = String(columns[1] ?? "").trim();
          if (countryCode && admin1Code && officialName) {
            admin1OfficialByCode.set(`${countryCode}-${admin1Code}`, officialName);
          }
        }
      }

      const normalized = normalizeCityRecord({
        geonameId: columns[0],
        name: columns[1],
        asciiName: columns[2],
        lat: columns[4],
        lng: columns[5],
        featureClass: columns[6],
        featureCode: columns[7],
        countryCode: columns[8],
        admin1Code: columns[10],
        admin2Code: columns[11],
        population: columns[14],
        timezone: columns[17],
      });

      if (normalized) {
        const { shardKey } = getCityShardKey(normalized);
        appendFileSync(
          path.join(shardDir, `${shardKey}.ndjson`),
          `${JSON.stringify(normalized)}\n`,
          "utf8",
        );
        recordCount += 1;
      }
    }

    zipFile.close();
    const admin1OfficialNames = Object.fromEntries(
      [...admin1OfficialByCode.entries()].sort((left, right) => String(left[0]).localeCompare(String(right[0]))),
    );

    return {
      kind: "city-shard-store",
      dir: shardDir,
      recordCount,
      admin1OfficialNames,
      cleanupDir: tempDir,
    };
  } finally {
    if (!existsSync(shardDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

async function extractAndNormalizePostalCodesFromZip(buffer) {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "disocy-geo-postal-zip-"));
  const zipPath = path.join(tempDir, "payload.zip");
  const shardDir = path.join(tempDir, "postal-shards");

  try {
    writeFileSync(zipPath, buffer);
    ensureDir(shardDir);
    const { default: yauzl } = await import("yauzl");

    const zipFile = await new Promise((resolve, reject) => {
      yauzl.open(zipPath, { lazyEntries: true }, (error, handle) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(handle);
      });
    });

    const entry = await new Promise((resolve, reject) => {
      zipFile.readEntry();
      zipFile.once("entry", resolve);
      zipFile.once("error", reject);
      zipFile.once("end", () => reject(new Error("ZIP archive does not contain entries")));
    });

    const stream = await new Promise((resolve, reject) => {
      zipFile.openReadStream(entry, (error, handle) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(handle);
      });
    });

    let recordCount = 0;
    const lines = createInterface({ input: stream, crlfDelay: Infinity });

    for await (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        continue;
      }

      const columns = line.split("\t");
      const normalized = normalizePostalCodeRecord({
        countryCode: columns[0],
        postalCode: columns[1],
        placeName: columns[2],
        admin1Name: columns[3],
        admin1Code: columns[4],
        admin2Name: columns[5],
        admin2Code: columns[6],
        admin3Name: columns[7],
        admin3Code: columns[8],
        lat: columns[9],
        lng: columns[10],
        accuracy: columns[11],
      });

      if (normalized) {
        appendFileSync(
          path.join(shardDir, `${normalized.countryCode}.ndjson`),
          `${JSON.stringify(normalized)}\n`,
          "utf8",
        );
        recordCount += 1;
      }
    }

    zipFile.close();
    return {
      kind: "postal-shard-store",
      dir: shardDir,
      recordCount,
      cleanupDir: tempDir,
    };
  } finally {
    if (!existsSync(shardDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

async function extractAndNormalizeSubdivisionAlternateNamesFromZip(buffer, subdivisionGeonameIds) {
  const targetGeonameIds = new Set(
    [...(subdivisionGeonameIds ?? [])]
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0),
  );

  if (targetGeonameIds.size === 0) {
    return [];
  }

  const tempDir = mkdtempSync(path.join(os.tmpdir(), "disocy-geo-alt-names-"));
  const zipPath = path.join(tempDir, "payload.zip");

  try {
    writeFileSync(zipPath, buffer);
    const { default: yauzl } = await import("yauzl");

    const zipFile = await new Promise((resolve, reject) => {
      yauzl.open(zipPath, { lazyEntries: true }, (error, handle) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(handle);
      });
    });

    const entry = await new Promise((resolve, reject) => {
      const handleEntry = (candidate) => {
        const fileName = String(candidate?.fileName ?? "").toLowerCase();
        if (fileName.endsWith(".txt") && !fileName.includes("readme")) {
          cleanup();
          resolve(candidate);
          return;
        }

        zipFile.readEntry();
      };

      const handleEnd = () => {
        cleanup();
        reject(new Error("ZIP archive does not contain a subdivision alternate names payload"));
      };

      const handleError = (error) => {
        cleanup();
        reject(error);
      };

      const cleanup = () => {
        zipFile.off("entry", handleEntry);
        zipFile.off("end", handleEnd);
        zipFile.off("error", handleError);
      };

      zipFile.on("entry", handleEntry);
      zipFile.once("end", handleEnd);
      zipFile.once("error", handleError);
      zipFile.readEntry();
    });

    const stream = await new Promise((resolve, reject) => {
      zipFile.openReadStream(entry, (error, handle) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(handle);
      });
    });

    const lines = createInterface({ input: stream, crlfDelay: Infinity });
    const records = [];

    for await (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        continue;
      }

      const columns = line.split("\t");
      const geonameId = Number(columns[1]);
      if (!targetGeonameIds.has(geonameId)) {
        continue;
      }

      const normalized = normalizeSubdivisionAlternateNameRecord({
        geonameId: columns[1],
        language: columns[2],
        name: columns[3],
        isPreferredName: columns[4],
        isShortName: columns[5],
      });

      if (normalized) {
        records.push(normalized);
      }
    }

    zipFile.close();
    records.sort((left, right) => {
      const geonameDelta = left.geonameId - right.geonameId;
      if (geonameDelta !== 0) {
        return geonameDelta;
      }

      const languageDelta = left.language.localeCompare(right.language);
      if (languageDelta !== 0) {
        return languageDelta;
      }

      return left.name.localeCompare(right.name);
    });

    return records;
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function resolveShippingProfilesPayload(url) {
  if (url) {
    return fetchText(url);
  }

  return Promise.resolve("{}");
}

function resolveCitiesPayload(url) {
  if (looksLikeZipUrl(url)) {
    return fetchBinary(url).then(extractAndNormalizeCitiesFromZip);
  }

  return fetchText(url);
}

function resolvePostalCodesPayload(url) {
  if (looksLikeZipUrl(url)) {
    return fetchBinary(url).then(extractAndNormalizePostalCodesFromZip);
  }

  return fetchText(url);
}

async function resolveSubdivisionAlternateNamesPayload(baseUrl, subdivisions) {
  const subdivisionsWithGeonameId = subdivisions.filter((record) => Number.isInteger(record.geonameId));
  if (subdivisionsWithGeonameId.length === 0) {
    return [];
  }

  const geonameIdsByCountry = subdivisionsWithGeonameId.reduce((accumulator, record) => {
    const bucket = accumulator.get(record.countryCode) ?? new Set();
    bucket.add(record.geonameId);
    accumulator.set(record.countryCode, bucket);
    return accumulator;
  }, new Map());

  const records = [];
  const countryCodes = [...geonameIdsByCountry.keys()].sort();

  for (const countryCode of countryCodes) {
    const buffer = await fetchBinary(`${String(baseUrl).replace(/\/+$/, "")}/${countryCode}.zip`);
    const countryRecords = await extractAndNormalizeSubdivisionAlternateNamesFromZip(
      buffer,
      geonameIdsByCountry.get(countryCode),
    );
    records.push(...countryRecords);
  }

  return records;
}

function resolveSourceUrls(sourceUrls = {}) {
  return {
    ...DEFAULT_SOURCE_URLS,
    ...sourceUrls,
  };
}

function createManifestEntry(url, records) {
  return {
    url,
    recordCount: Array.isArray(records)
      ? records.length
      : records && typeof records === "object" && Number.isInteger(records.recordCount)
        ? records.recordCount
        : Object.keys(records).length,
  };
}

function reportProgress(onProgress, event) {
  if (typeof onProgress === "function") {
    onProgress(event);
  }
}

async function loadSource(config, onProgress) {
  const { key, label, fetcher } = config;

  reportProgress(onProgress, {
    type: "step-start",
    key,
    label,
  });

  try {
    const payload = await fetcher();
    const size = Buffer.isBuffer(payload)
      ? payload.byteLength
      : Array.isArray(payload)
        ? payload.length
        : payload && typeof payload === "object" && Number.isInteger(payload.recordCount)
          ? payload.recordCount
        : Buffer.byteLength(String(payload), "utf8");

    reportProgress(onProgress, {
      type: "step-complete",
      key,
      label,
      mode: "remote",
      size,
    });

    return payload;
  } catch (error) {
    reportProgress(onProgress, {
      type: "step-error",
      key,
      label,
      error: String(error),
    });
    throw error;
  }
}

function groupSubdivisionsByCountry(records) {
  return records.reduce((accumulator, record) => {
    const countryCode = record?.countryCode;
    if (!countryCode) {
      return accumulator;
    }

    const bucket = accumulator[countryCode] ?? [];
    bucket.push(record);
    accumulator[countryCode] = bucket;
    return accumulator;
  }, {});
}

export async function populateGeoSources(options = {}) {
  const sourceUrls = resolveSourceUrls(options.sourceUrls);
  const dryRun = options.dryRun === true;
  const onProgress = options.onProgress;
  let geonamesCitiesPayload = null;
  let geonamesPostalCodesPayload = null;

  reportProgress(onProgress, {
    type: "pipeline-start",
    dryRun,
  });

  try {
    const unM49Payload = await loadSource({
      key: "unM49",
      label: "UN M49 countries",
      fetcher: () => fetchText(sourceUrls.unM49),
    }, onProgress);

    const isoCountriesPayload = await loadSource({
      key: "isoCountries",
      label: "ISO country codes",
      fetcher: () => fetchText(sourceUrls.isoCountries),
    }, onProgress);

    const isoSubdivisionsPayload = await loadSource({
      key: "isoSubdivisions",
      label: "ISO subdivisions",
      fetcher: () => fetchText(sourceUrls.isoSubdivisions),
    }, onProgress);

    const admin2SubdivisionsPayload = await loadSource({
      key: "admin2Subdivisions",
      label: "GeoNames admin2 subdivisions",
      fetcher: () => fetchText(sourceUrls.admin2Subdivisions),
    }, onProgress);

    geonamesCitiesPayload = await loadSource({
      key: "geonamesCities",
      label: "GeoNames cities",
      fetcher: () => resolveCitiesPayload(sourceUrls.geonamesCities),
    }, onProgress);

    geonamesPostalCodesPayload = await loadSource({
      key: "geonamesPostalCodes",
      label: "GeoNames postal codes",
      fetcher: () => resolvePostalCodesPayload(sourceUrls.geonamesPostalCodes),
    }, onProgress);

    const shippingProfilesPayload = await loadSource({
      key: "shippingProfiles",
      label: "Shipping profiles",
      fetcher: () => resolveShippingProfilesPayload(sourceUrls.shippingProfiles),
    }, onProgress);

    reportProgress(onProgress, {
      type: "normalize-start",
    });
    const normalizedIsoCountries = normalizeIsoCountriesPayload(isoCountriesPayload);
    const normalizedIsoSubdivisions = normalizeIsoSubdivisionsPayload(isoSubdivisionsPayload);
    const normalizedAdmin2Subdivisions = normalizeIsoSubdivisionsPayload(admin2SubdivisionsPayload);
    const normalizedSubdivisions = [...normalizedIsoSubdivisions, ...normalizedAdmin2Subdivisions]
      .sort((left, right) => String(left.code).localeCompare(String(right.code)));
    const subdivisionAlternateNames = await loadSource({
      key: "geonamesSubdivisionAlternateNames",
      label: "GeoNames subdivision alternate names",
      fetcher: () => resolveSubdivisionAlternateNamesPayload(sourceUrls.geonamesAlternateNamesBaseUrl, normalizedSubdivisions),
    }, onProgress);
    const subdivisionsByCountry = groupSubdivisionsByCountry(normalizedSubdivisions);
    const explicitShippingProfiles = normalizeShippingProfilesPayload(shippingProfilesPayload);
    const derivedShippingProfiles = deriveShippingProfiles(normalizedIsoCountries, subdivisionsByCountry);
    const normalizedGeonamesCities = Array.isArray(geonamesCitiesPayload)
      ? geonamesCitiesPayload
      : geonamesCitiesPayload?.kind === "city-shard-store"
        ? geonamesCitiesPayload
        : normalizeCitiesPayload(geonamesCitiesPayload);
    const normalizedGeonamesPostalCodes = Array.isArray(geonamesPostalCodesPayload)
      ? geonamesPostalCodesPayload
      : geonamesPostalCodesPayload?.kind === "postal-shard-store"
        ? geonamesPostalCodesPayload
        : normalizePostalCodesPayload(geonamesPostalCodesPayload);
    const admin1OfficialNames =
      geonamesCitiesPayload?.kind === "city-shard-store" && geonamesCitiesPayload.admin1OfficialNames
        ? geonamesCitiesPayload.admin1OfficialNames
        : {};

    const normalized = {
      unM49: normalizeUnM49Payload(unM49Payload),
      isoCountries: normalizedIsoCountries,
      isoSubdivisions: normalizedSubdivisions,
      geonamesCities: normalizedGeonamesCities,
      geonamesPostalCodes: normalizedGeonamesPostalCodes,
      subdivisionAlternateNames,
      shippingProfiles: Object.keys(explicitShippingProfiles).length > 0 ? explicitShippingProfiles : derivedShippingProfiles,
      admin1OfficialNames,
    };
    reportProgress(onProgress, {
      type: "normalize-complete",
      counts: {
        unM49: normalized.unM49.length,
        isoCountries: normalized.isoCountries.length,
        isoSubdivisions: normalized.isoSubdivisions.length,
        geonamesCities: Array.isArray(normalized.geonamesCities)
          ? normalized.geonamesCities.length
          : normalized.geonamesCities.recordCount,
        geonamesPostalCodes: Array.isArray(normalized.geonamesPostalCodes)
          ? normalized.geonamesPostalCodes.length
          : normalized.geonamesPostalCodes.recordCount,
        subdivisionAlternateNames: normalized.subdivisionAlternateNames.length,
        shippingProfiles: Object.keys(normalized.shippingProfiles).length,
      },
    });

    const manifest = {
      populatedAt: new Date().toISOString(),
      dryRun,
      sources: {
        unM49: createManifestEntry(sourceUrls.unM49, normalized.unM49),
        isoCountries: createManifestEntry(sourceUrls.isoCountries, normalized.isoCountries),
        isoSubdivisions: createManifestEntry(
          `${sourceUrls.isoSubdivisions},${sourceUrls.admin2Subdivisions}`,
          normalized.isoSubdivisions,
        ),
        geonamesCities: createManifestEntry(sourceUrls.geonamesCities, normalized.geonamesCities),
        geonamesPostalCodes: createManifestEntry(sourceUrls.geonamesPostalCodes, normalized.geonamesPostalCodes),
        geonamesSubdivisionAlternateNames: createManifestEntry(
          sourceUrls.geonamesAlternateNamesBaseUrl,
          normalized.subdivisionAlternateNames,
        ),
        shippingProfiles: createManifestEntry(
          sourceUrls.shippingProfiles || `${sourceUrls.isoCountries} (derived)`,
          normalized.shippingProfiles,
        ),
      },
    };

    if (!dryRun) {
      reportProgress(onProgress, {
        type: "write-start",
      });
      ensureDir(path.join(SOURCES_DIR, "un-m49"));
      ensureDir(path.join(SOURCES_DIR, "iso-3166"));
      ensureDir(path.join(SOURCES_DIR, "iso-3166-2"));
      ensureDir(path.join(SOURCES_DIR, "geonames"));
      ensureDir(path.join(SOURCES_DIR, "disocy"));

      writeJson(path.join(SOURCES_DIR, "geonames", "admin1-official-names.json"), normalized.admin1OfficialNames);
      writeJson(
        path.join(SOURCES_DIR, "geonames", "subdivision-alternate-names.json"),
        normalized.subdivisionAlternateNames,
      );
      if (normalized.geonamesCities?.kind === "city-shard-store") {
        persistShardStore(normalized.geonamesCities, path.join(SOURCES_DIR, "geonames", "city-shards"));
      }
      if (normalized.geonamesPostalCodes?.kind === "postal-shard-store") {
        persistShardStore(normalized.geonamesPostalCodes, path.join(SOURCES_DIR, "geonames", "postal-code-shards"));
      }

      writeJson(path.join(SOURCES_DIR, "un-m49", "countries.json"), normalized.unM49);
      writeJson(path.join(SOURCES_DIR, "iso-3166", "countries.json"), normalized.isoCountries);
      writeJson(path.join(SOURCES_DIR, "iso-3166-2", "subdivisions.json"), normalized.isoSubdivisions);
      writeJson(path.join(SOURCES_DIR, "disocy", "shipping.json"), normalized.shippingProfiles);
      writeJson(path.join(SOURCES_DIR, "source-manifest.json"), manifest);

      reportProgress(onProgress, {
        type: "build-start",
      });
      const buildSummary = buildGeoDataset(normalized);
      reportProgress(onProgress, {
        type: "build-complete",
        summary: buildSummary,
      });
    } else {
      reportProgress(onProgress, {
        type: "write-skipped",
      });
    }

    reportProgress(onProgress, {
      type: "pipeline-complete",
      manifest,
    });

    return {
      manifest,
      normalized,
    };
  } finally {
    if (geonamesCitiesPayload?.kind === "city-shard-store" && geonamesCitiesPayload.cleanupDir) {
      rmSync(geonamesCitiesPayload.cleanupDir, { recursive: true, force: true });
    }
    if (geonamesPostalCodesPayload?.kind === "postal-shard-store" && geonamesPostalCodesPayload.cleanupDir) {
      rmSync(geonamesPostalCodesPayload.cleanupDir, { recursive: true, force: true });
    }
  }
}
