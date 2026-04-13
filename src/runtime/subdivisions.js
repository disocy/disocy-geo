import {
  getSubdivisionKeyFromCode,
  loadSubdivisionsByCountry,
  normalizeCountryCode,
  normalizeSubdivisionCode,
} from "./store.js";

export async function listSubdivisions(countryCode) {
  const normalizedCountryCode = normalizeCountryCode(countryCode);
  if (!normalizedCountryCode) {
    return [];
  }

  return [...await loadSubdivisionsByCountry(normalizedCountryCode)];
}

export async function getSubdivision(code) {
  const normalizedCode = normalizeSubdivisionCode(code);
  if (!normalizedCode.includes("-")) {
    return null;
  }

  const [countryCode] = normalizedCode.split("-");
  const subdivisions = await listSubdivisions(countryCode);
  return subdivisions.find((subdivision) => subdivision.code === normalizedCode) ?? null;
}

export async function hasSubdivision(code) {
  return (await getSubdivision(code)) !== null;
}

export async function resolveSubdivisionKey(countryCode, subdivisionKeyOrCode) {
  const normalizedCountryCode = normalizeCountryCode(countryCode);
  const normalizedValue = normalizeSubdivisionCode(subdivisionKeyOrCode);

  if (!normalizedCountryCode || !normalizedValue) {
    return "";
  }

  if (normalizedValue.includes("-")) {
    const subdivision = await getSubdivision(normalizedValue);
    if (!subdivision || subdivision.countryCode !== normalizedCountryCode) {
      return "";
    }

    return getSubdivisionKeyFromCode(subdivision.code);
  }

  return normalizedValue;
}
