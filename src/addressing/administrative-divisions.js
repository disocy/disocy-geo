import { loadAdministrativeDivisionMetadata, normalizeCountryCode } from "../runtime/store.js";

export async function getAdministrativeDivisionMetadata(countryCode) {
  const normalizedCountryCode = normalizeCountryCode(countryCode);
  if (!normalizedCountryCode) {
    return null;
  }

  const metadata = await loadAdministrativeDivisionMetadata(normalizedCountryCode);
  return metadata
    ? {
        countryCode: normalizedCountryCode,
        ...metadata,
      }
    : null;
}
