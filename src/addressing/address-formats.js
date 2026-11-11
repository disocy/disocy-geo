/**
 * Postal address rules per country, from Google libaddressinput (the chromium-i18n address metadata
 * behind Chrome and Android autofill, built on CLDR and each country's postal guidelines).
 *
 * A record answers three questions for the subdivision line of a postal address:
 * - does the address carry it at all (`%S` in `fmt`);
 * - is it required (`S` in `require`);
 * - what the country calls it (`state_name_type`).
 *
 * Fields missing from a country record take the `ZZ` defaults: `require` "AC", `state_name_type` "province".
 */

export const ADDRESS_FORMATS_SOURCE_URL = "https://chromium-i18n.appspot.com/ssl-address/data";

export const POSTAL_SUBDIVISION_TYPES = Object.freeze([
  "area",
  "county",
  "department",
  "district",
  "do_si",
  "emirate",
  "island",
  "oblast",
  "parish",
  "prefecture",
  "province",
  "state",
]);

const DEFAULT_REQUIRE = "AC";
const DEFAULT_SUBDIVISION_TYPE = "province";

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function splitList(value) {
  return cleanString(value)
    .split("~")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/** Reduces one libaddressinput country record to the subdivision facts the dataset needs. */
export function normalizeAddressFormatRecord(record) {
  const countryCode = cleanString(record?.key).toUpperCase();
  if (!/^[A-Z]{2}$/.test(countryCode) || countryCode === "ZZ") {
    return null;
  }

  const format = cleanString(record.fmt);
  const require = cleanString(record.require) || DEFAULT_REQUIRE;
  const usesSubdivision = format.includes("%S");
  const declaredType = cleanString(record.state_name_type);
  const subdivisionType = POSTAL_SUBDIVISION_TYPES.includes(declaredType) ? declaredType : DEFAULT_SUBDIVISION_TYPE;
  const isoIds = splitList(record.sub_isoids);

  return {
    countryCode,
    usesSubdivision,
    requiresSubdivision: usesSubdivision && require.includes("S"),
    subdivisionType,
    subdivisionCount: splitList(record.sub_keys).length,
    subdivisionIds: isoIds.length > 0 ? isoIds : splitList(record.sub_keys),
  };
}

/** Accepts a `{ countryCode: record }` map or a list of records and returns normalized records by country. */
export function normalizeAddressFormatsPayload(payload) {
  const records = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object"
      ? Object.values(payload)
      : [];

  return records.reduce((accumulator, record) => {
    const normalized = normalizeAddressFormatRecord(record);
    if (normalized) {
      accumulator[normalized.countryCode] = normalized;
    }

    return accumulator;
  }, {});
}

function lastCodeSegment(code) {
  const segments = cleanString(code).toUpperCase().split("-");
  return segments[segments.length - 1] ?? "";
}

/**
 * Chooses the administrative level whose units are the ones a postal address names: Spain's
 * provinces are admin2 under the autonomous communities, the US states are admin1.
 * It prefers the level whose code suffixes match the ISO 3166-2 ids libaddressinput lists, then the
 * level whose unit count is closest to that list, then admin1.
 */
export function pickPostalSubdivisionLevel(subdivisions, addressFormat) {
  const admin1 = subdivisions.filter((record) => record.type === "admin1");
  const admin2 = subdivisions.filter((record) => record.type === "admin2");

  if (admin1.length === 0) {
    return admin2.length > 0 ? "admin2" : "admin1";
  }

  if (admin2.length === 0) {
    return "admin1";
  }

  const ids = (addressFormat?.subdivisionIds ?? []).map((id) => lastCodeSegment(id));
  const expectedCount = addressFormat?.subdivisionCount || ids.length;
  if (!addressFormat?.usesSubdivision || expectedCount === 0) {
    return "admin1";
  }

  const score = (records) => {
    const suffixes = new Set(records.map((record) => lastCodeSegment(record.code)));
    return {
      matches: ids.filter((id) => suffixes.has(id)).length,
      distance: Math.abs(records.length - expectedCount),
    };
  };

  const first = score(admin1);
  const second = score(admin2);

  if (first.matches !== second.matches) {
    return second.matches > first.matches ? "admin2" : "admin1";
  }

  return second.distance < first.distance ? "admin2" : "admin1";
}

/** Builds the `addressing/administrative-divisions/{COUNTRY}.json` record. */
export function buildAdministrativeDivisionRecord(countryCode, subdivisions, addressFormat) {
  const usesSubdivision = addressFormat?.usesSubdivision === true;

  return {
    countryCode,
    preferredSubdivisionLevel: pickPostalSubdivisionLevel(subdivisions ?? [], addressFormat),
    primarySubdivisionType: addressFormat?.subdivisionType ?? DEFAULT_SUBDIVISION_TYPE,
    usesSubdivision,
    requiresSubdivision: usesSubdivision && addressFormat?.requiresSubdivision === true,
  };
}
