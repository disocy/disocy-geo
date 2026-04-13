import { listCountries } from "../runtime/countries.js";
import { loadCountryMetadata, normalizeCountryCode } from "../runtime/store.js";

export async function listCountryMetadata() {
  const countries = await listCountries();
  const metadata = await Promise.all(countries.map((country) => loadCountryMetadata(country.code)));
  return metadata.filter(Boolean);
}

export async function getCountryMetadata(countryCode) {
  const normalizedCountryCode = normalizeCountryCode(countryCode);
  if (!normalizedCountryCode) {
    return null;
  }

  return loadCountryMetadata(normalizedCountryCode);
}
