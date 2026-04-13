import { loadPostalCodesByCountry, normalizeCountryCode } from "../runtime/store.js";
import { normalizePlaceName } from "../runtime/text.js";

function scorePostalCodeMatch(record, normalizedPlaceName, normalizedAdmin1Name, normalizedAdmin2Name) {
  let score = 0;
  const placeName = normalizePlaceName(record.placeName);
  const admin1Name = normalizePlaceName(record.admin1Name);
  const admin2Name = normalizePlaceName(record.admin2Name);

  if (!placeName || placeName !== normalizedPlaceName) {
    return -1;
  }

  score += 100;

  if (normalizedAdmin1Name && admin1Name) {
    if (admin1Name === normalizedAdmin1Name) {
      score += 20;
    } else {
      score -= 10;
    }
  }

  if (normalizedAdmin2Name && admin2Name) {
    if (admin2Name === normalizedAdmin2Name) {
      score += 10;
    } else {
      score -= 5;
    }
  }

  if (Number.isInteger(record.accuracy)) {
    score += Number(record.accuracy);
  }

  return score;
}

export async function listPostalCodes(countryCode) {
  return [...await loadPostalCodesByCountry(countryCode)];
}

export async function findPostalCodesByPlaceName(countryCode, placeName, options = {}) {
  const normalizedCountryCode = normalizeCountryCode(countryCode);
  const normalizedPlaceName = normalizePlaceName(placeName);

  if (!normalizedCountryCode || !normalizedPlaceName) {
    return [];
  }

  const normalizedAdmin1Name = normalizePlaceName(options.admin1Name);
  const normalizedAdmin2Name = normalizePlaceName(options.admin2Name);

  return (await listPostalCodes(normalizedCountryCode))
    .map((record) => ({
      record,
      score: scorePostalCodeMatch(record, normalizedPlaceName, normalizedAdmin1Name, normalizedAdmin2Name),
    }))
    .filter((entry) => entry.score >= 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return String(left.record.postalCode).localeCompare(String(right.record.postalCode));
    })
    .map((entry) => entry.record);
}

export async function findPostalCodeByPlaceName(countryCode, placeName, options = {}) {
  return (await findPostalCodesByPlaceName(countryCode, placeName, options))[0] ?? null;
}
