import { loadTradeRegionMetadata, normalizeCountryCode } from "../runtime/store.js";

export async function getTradeRegionMetadata(countryCode) {
  const normalizedCountryCode = normalizeCountryCode(countryCode);
  if (!normalizedCountryCode) {
    return null;
  }

  return loadTradeRegionMetadata(normalizedCountryCode);
}
