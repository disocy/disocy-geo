import {
  loadCitiesManifest,
  loadCityShard,
  normalizeCountryCode,
} from "./store.js";
import { resolveSubdivisionKey } from "./subdivisions.js";

export async function listCityShards(countryCode) {
  const manifest = await loadCitiesManifest();
  const normalizedCountryCode = normalizeCountryCode(countryCode);

  if (normalizedCountryCode) {
    return Object.values(manifest.countries[normalizedCountryCode] ?? {});
  }

  return Object.values(manifest.countries).flatMap((entries) => Object.values(entries));
}

export async function listCitiesBySubdivision(countryCode, subdivisionKeyOrCode) {
  const normalizedCountryCode = normalizeCountryCode(countryCode);
  const subdivisionKey = await resolveSubdivisionKey(normalizedCountryCode, subdivisionKeyOrCode);

  if (!normalizedCountryCode || !subdivisionKey) {
    return [];
  }

  return [...await loadCityShard(normalizedCountryCode, subdivisionKey)];
}

export async function listCitiesByCountry(countryCode) {
  const normalizedCountryCode = normalizeCountryCode(countryCode);
  if (!normalizedCountryCode) {
    return [];
  }

  const shards = await listCityShards(normalizedCountryCode);
  const cityLists = await Promise.all(
    shards.map((shard) => loadCityShard(normalizedCountryCode, shard.subdivisionKey)),
  );
  return cityLists.flatMap((entries) => entries);
}

export async function findCityByGeonameId(geonameId, options = {}) {
  const numericId = Number(geonameId);
  if (!Number.isInteger(numericId)) {
    return null;
  }

  const countries = options.countryCode
    ? [normalizeCountryCode(options.countryCode)]
    : Object.keys((await loadCitiesManifest()).countries);

  for (const countryCode of countries) {
    const city = (await listCitiesByCountry(countryCode)).find((entry) => entry.geonameId === numericId);
    if (city) {
      return city;
    }
  }

  return null;
}
