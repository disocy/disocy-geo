/**
 * @disocy/geo
 *
 * Disocy geographic intelligence library.
 *
 * Provides normalized access to:
 * - Countries (UN M49 + ISO 3166-style fields)
 * - Subdivisions (ISO 3166-2-style records)
 * - City shards (GeoNames-style records)
 *
 * The runtime reads generated JSON artifacts from `dist/`, while
 * the build pipeline compiles those artifacts from source snapshots
 * under `src/sources/*`.
 *
 * @author Aaron Retamero <aaron@disocy.com>
 * @copyright 2026 Disocy. All rights reserved.
 * @license Proprietary
 * @version 0.1.0
 */

export {
  GEO_DATASET_VERSION,
  OFFICIAL_SOURCE_NAMES,
} from "./runtime/constants.js";

export {
  listCountries,
  getCountry,
  hasCountry,
} from "./runtime/countries.js";

export {
  listSubdivisions,
  getSubdivision,
  hasSubdivision,
} from "./runtime/subdivisions.js";

export {
  listCityShards,
  listCitiesBySubdivision,
  listCitiesByCountry,
  findCityByGeonameId,
} from "./runtime/cities.js";

export {
  enrichGeoRecord,
  getShippingProfile,
} from "./runtime/enrich.js";

export {
  normalizePlaceName,
} from "./runtime/text.js";

export {
  searchCities,
  findCityByName,
  getCityDetails,
} from "./runtime/queries.js";

export {
  getCountryOperationalMetadata,
} from "./addressing/shipping-rules.js";
export {
  getAdministrativeDivisionMetadata,
} from "./addressing/administrative-divisions.js";

export {
  listPostalCodes,
  findPostalCodesByPlaceName,
  findPostalCodeByPlaceName,
} from "./addressing/postal-codes.js";

export {
  getCustomsMetadata,
  getTradeRegionMetadata,
} from "./compliance/index.js";

export {
  getPhoneMetadata,
  listCountryMetadata,
  getCountryMetadata,
} from "./metadata/index.js";
