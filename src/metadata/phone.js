import { getCountryOperationalMetadata } from "../addressing/shipping-rules.js";

export async function getPhoneMetadata(countryCode) {
  const metadata = await getCountryOperationalMetadata(countryCode);
  if (!metadata) {
    return null;
  }

  return {
    countryCode: metadata.countryCode,
    phonePrefix: metadata.phonePrefix ?? null,
  };
}
