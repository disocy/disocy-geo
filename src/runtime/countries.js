import { loadCountries, normalizeCountryCode } from "./store.js";

export async function listCountries() {
  return [...await loadCountries()];
}

export async function getCountry(code) {
  const normalizedCode = normalizeCountryCode(code);
  if (!normalizedCode) {
    return null;
  }

  const countries = await loadCountries();
  return countries.find((country) => country.code === normalizedCode) ?? null;
}

export async function hasCountry(code) {
  return (await getCountry(code)) !== null;
}
