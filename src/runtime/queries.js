import { listCitiesByCountry, listCitiesBySubdivision, findCityByGeonameId } from "./cities.js";
import { getCountry } from "./countries.js";
import { enrichGeoRecord } from "./enrich.js";
import { getSubdivision, resolveSubdivisionKey } from "./subdivisions.js";
import { normalizeCountryCode, normalizeSubdivisionCode } from "./store.js";
import { normalizePlaceName, tokenizePlaceName } from "./text.js";

function scoreCityNameMatch(city, normalizedQuery, queryTokens, exact) {
  const candidates = [
    city.name,
    city.asciiName,
  ]
    .filter(Boolean)
    .map((value) => normalizePlaceName(value));

  let bestScore = -1;

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    if (candidate === normalizedQuery) {
      bestScore = Math.max(bestScore, 1000);
      continue;
    }

    if (exact) {
      continue;
    }

    if (candidate.startsWith(normalizedQuery)) {
      bestScore = Math.max(bestScore, 800);
      continue;
    }

    if (candidate.includes(normalizedQuery)) {
      bestScore = Math.max(bestScore, 600);
    }

    const candidateTokens = candidate.split(" ").filter(Boolean);
    const tokenMatches = queryTokens.filter((token) => candidateTokens.includes(token)).length;
    if (tokenMatches > 0) {
      bestScore = Math.max(bestScore, 400 + tokenMatches * 20);
    }
  }

  if (bestScore < 0) {
    return -1;
  }

  const populationBonus = Math.min(Number(city.population ?? 0) / 100000, 50);
  return bestScore + populationBonus;
}

function sortMatches(left, right) {
  if (right.matchScore !== left.matchScore) {
    return right.matchScore - left.matchScore;
  }

  return (right.city.population ?? 0) - (left.city.population ?? 0);
}

function resolveCandidateCities(options = {}) {
  const normalizedCountryCode = normalizeCountryCode(options.countryCode);
  const normalizedSubdivisionCode = normalizeSubdivisionCode(options.subdivisionCode);

  if (normalizedCountryCode && normalizedSubdivisionCode) {
    const subdivisionKey = resolveSubdivisionKey(normalizedCountryCode, normalizedSubdivisionCode);
    if (!subdivisionKey) {
      return [];
    }

    return listCitiesBySubdivision(normalizedCountryCode, subdivisionKey);
  }

  if (normalizedCountryCode) {
    return listCitiesByCountry(normalizedCountryCode);
  }

  return [];
}

function buildCityDetails(city) {
  const enriched = enrichGeoRecord({
    countryCode: city.countryCode,
    subdivisionCode: city.subdivisionCode,
    geonameId: city.geonameId,
  });

  return {
    city,
    country: enriched.country,
    subdivision: enriched.subdivision,
    shipping: enriched.shipping,
    continent: enriched.continent,
    region: enriched.region,
    subregion: enriched.subregion,
  };
}

export function searchCities(query, options = {}) {
  const normalizedQuery = normalizePlaceName(query);
  if (!normalizedQuery) {
    return [];
  }

  const queryTokens = tokenizePlaceName(query);
  const exact = options.exact === true;
  const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 10;
  const candidates = resolveCandidateCities(options);
  const matches = [];

  for (const city of candidates) {
    const matchScore = scoreCityNameMatch(city, normalizedQuery, queryTokens, exact);
    if (matchScore < 0) {
      continue;
    }

    matches.push({
      ...buildCityDetails(city),
      matchScore,
      matchedQuery: normalizedQuery,
    });
  }

  matches.sort(sortMatches);
  return matches.slice(0, limit);
}

export function findCityByName(name, options = {}) {
  return searchCities(name, {
    ...options,
    exact: options.exact ?? false,
    limit: 1,
  })[0] ?? null;
}

export function getCityDetails(input = {}) {
  if (Number.isInteger(Number(input.geonameId))) {
    const city = findCityByGeonameId(input.geonameId, {
      countryCode: input.countryCode,
    });

    return city ? buildCityDetails(city) : null;
  }

  if (typeof input.name === "string" && input.name.trim()) {
    const result = findCityByName(input.name, {
      countryCode: input.countryCode,
      subdivisionCode: input.subdivisionCode,
      exact: input.exact,
      limit: 1,
    });

    if (!result) {
      return null;
    }

    const { matchScore, matchedQuery, ...details } = result;
    void matchScore;
    void matchedQuery;
    return details;
  }

  if (input.countryCode || input.subdivisionCode) {
    const country = input.countryCode ? getCountry(input.countryCode) : null;
    const subdivision = input.subdivisionCode ? getSubdivision(input.subdivisionCode) : null;
    const enriched = enrichGeoRecord({
      countryCode: input.countryCode,
      subdivisionCode: input.subdivisionCode,
    });

    return {
      city: null,
      country: country ?? enriched.country,
      subdivision: subdivision ?? enriched.subdivision,
      shipping: enriched.shipping,
      continent: enriched.continent,
      region: enriched.region,
      subregion: enriched.subregion,
    };
  }

  return null;
}
