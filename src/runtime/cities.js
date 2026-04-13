import {
  loadCitiesManifest,
  loadCityShard,
  normalizeCountryCode,
} from "./store.js";
import { resolveSubdivisionKey } from "./subdivisions.js";

export function listCityShards(countryCode) {
  const manifest = loadCitiesManifest();
  const normalizedCountryCode = normalizeCountryCode(countryCode);

  if (normalizedCountryCode) {
    return Object.values(manifest.countries[normalizedCountryCode] ?? {});
  }

  return Object.values(manifest.countries).flatMap((entries) => Object.values(entries));
}

export function listCitiesBySubdivision(countryCode, subdivisionKeyOrCode) {
  const normalizedCountryCode = normalizeCountryCode(countryCode);
  const subdivisionKey = resolveSubdivisionKey(normalizedCountryCode, subdivisionKeyOrCode);

  if (!normalizedCountryCode || !subdivisionKey) {
    return [];
  }

  return [...loadCityShard(normalizedCountryCode, subdivisionKey)];
}

export function listCitiesByCountry(countryCode) {
  const normalizedCountryCode = normalizeCountryCode(countryCode);
  if (!normalizedCountryCode) {
    return [];
  }

  return listCityShards(normalizedCountryCode).flatMap((shard) =>
    loadCityShard(normalizedCountryCode, shard.subdivisionKey),
  );
}

export function findCityByGeonameId(geonameId, options = {}) {
  const numericId = Number(geonameId);
  if (!Number.isInteger(numericId)) {
    return null;
  }

  const countries = options.countryCode
    ? [normalizeCountryCode(options.countryCode)]
    : Object.keys(loadCitiesManifest().countries);

  for (const countryCode of countries) {
    const city = listCitiesByCountry(countryCode).find((entry) => entry.geonameId === numericId);
    if (city) {
      return city;
    }
  }

  return null;
}
