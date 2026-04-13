import { loadCustomsMetadata, normalizeCountryCode } from "../runtime/store.js";

export async function getCustomsMetadata(countryCode) {
  const normalizedCountryCode = normalizeCountryCode(countryCode);
  if (!normalizedCountryCode) {
    return null;
  }

  return loadCustomsMetadata(normalizedCountryCode);
}
