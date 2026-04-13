import { loadCountries, normalizeCountryCode } from "./store.js";

export function listCountries() {
  return [...loadCountries()];
}

export function getCountry(code) {
  const normalizedCode = normalizeCountryCode(code);
  if (!normalizedCode) {
    return null;
  }

  return loadCountries().find((country) => country.code === normalizedCode) ?? null;
}

export function hasCountry(code) {
  return getCountry(code) !== null;
}
