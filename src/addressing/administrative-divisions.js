import { loadAdministrativeDivisionMetadata, normalizeCountryCode } from "../runtime/store.js";

export function getAdministrativeDivisionMetadata(countryCode) {
  const normalizedCountryCode = normalizeCountryCode(countryCode);
  if (!normalizedCountryCode) {
    return null;
  }

  const metadata = loadAdministrativeDivisionMetadata(normalizedCountryCode);
  return metadata
    ? {
        countryCode: normalizedCountryCode,
        ...metadata,
      }
    : null;
}
