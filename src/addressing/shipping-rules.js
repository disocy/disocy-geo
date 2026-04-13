import { getShippingProfile } from "../runtime/enrich.js";
import { loadCountryOperationalMetadata, normalizeCountryCode } from "../runtime/store.js";

export { getShippingProfile } from "../runtime/enrich.js";

export function getCountryOperationalMetadata(countryCode) {
  const normalizedCountryCode = normalizeCountryCode(countryCode);
  if (!normalizedCountryCode) {
    return null;
  }

  const metadata = loadCountryOperationalMetadata(normalizedCountryCode) ?? getShippingProfile(normalizedCountryCode);
  return metadata
    ? {
        countryCode: normalizedCountryCode,
        ...metadata,
      }
    : null;
}
