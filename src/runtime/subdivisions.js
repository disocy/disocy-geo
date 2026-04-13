import {
  getSubdivisionKeyFromCode,
  loadSubdivisionsByCountry,
  normalizeCountryCode,
  normalizeSubdivisionCode,
} from "./store.js";

export function listSubdivisions(countryCode) {
  const normalizedCountryCode = normalizeCountryCode(countryCode);
  if (!normalizedCountryCode) {
    return [];
  }

  return [...loadSubdivisionsByCountry(normalizedCountryCode)];
}

export function getSubdivision(code) {
  const normalizedCode = normalizeSubdivisionCode(code);
  if (!normalizedCode.includes("-")) {
    return null;
  }

  const [countryCode] = normalizedCode.split("-");
  const subdivisions = listSubdivisions(countryCode);
  return subdivisions.find((subdivision) => subdivision.code === normalizedCode) ?? null;
}

export function hasSubdivision(code) {
  return getSubdivision(code) !== null;
}

export function resolveSubdivisionKey(countryCode, subdivisionKeyOrCode) {
  const normalizedCountryCode = normalizeCountryCode(countryCode);
  const normalizedValue = normalizeSubdivisionCode(subdivisionKeyOrCode);

  if (!normalizedCountryCode || !normalizedValue) {
    return "";
  }

  if (normalizedValue.includes("-")) {
    const subdivision = getSubdivision(normalizedValue);
    if (!subdivision || subdivision.countryCode !== normalizedCountryCode) {
      return "";
    }

    return getSubdivisionKeyFromCode(subdivision.code);
  }

  return normalizedValue;
}
