import { getCountryOperationalMetadata } from "../addressing/shipping-rules.js";

export function getPhoneMetadata(countryCode) {
  const metadata = getCountryOperationalMetadata(countryCode);
  if (!metadata) {
    return null;
  }

  return {
    countryCode: metadata.countryCode,
    phonePrefix: metadata.phonePrefix ?? null,
  };
}
