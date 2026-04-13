import { listCountries } from "../runtime/countries.js";
import { loadCountryMetadata, normalizeCountryCode } from "../runtime/store.js";

export function listCountryMetadata() {
  return listCountries()
    .map((country) => loadCountryMetadata(country.code))
    .filter(Boolean);
}

export function getCountryMetadata(countryCode) {
  const normalizedCountryCode = normalizeCountryCode(countryCode);
  if (!normalizedCountryCode) {
    return null;
  }

  return loadCountryMetadata(normalizedCountryCode);
}
