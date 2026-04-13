import { getCountry } from "./countries.js";
import { findCityByGeonameId } from "./cities.js";
import { getSubdivision } from "./subdivisions.js";
import { loadCountryOperationalMetadata, normalizeCountryCode } from "./store.js";

export function getShippingProfile(countryCode) {
  const normalizedCountryCode = normalizeCountryCode(countryCode);
  return normalizedCountryCode ? loadCountryOperationalMetadata(normalizedCountryCode) : null;
}

export function enrichGeoRecord(input) {
  const city = input.geonameId ? findCityByGeonameId(input.geonameId, {
    countryCode: input.countryCode,
  }) : null;

  const countryCode = city?.countryCode ?? input.countryCode ?? null;
  const subdivisionCode = city?.subdivisionCode ?? input.subdivisionCode ?? null;

  const country = countryCode ? getCountry(countryCode) : null;
  const subdivision = subdivisionCode ? getSubdivision(subdivisionCode) : null;
  const shipping = countryCode ? getShippingProfile(countryCode) : null;

  return {
    country,
    subdivision,
    city,
    shipping,
    continent: country?.continent ?? null,
    region: country?.region ?? null,
    subregion: country?.subregion ?? null,
  };
}
