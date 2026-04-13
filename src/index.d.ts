/**
 * Disocy Geo - Type Declarations
 *
 * TypeScript type definitions for @disocy/geo
 */

export type CountryCode = string;
export type SubdivisionCode = string;
export type GeonameId = number;

export interface CountryRecord {
    code: CountryCode;
    name: string;
    iso3?: string;
    m49?: string;
    continentCode?: string;
    continent: string;
    regionCode?: string;
    region: string;
    capital?: string;
    tld?: string;
    currencyCode?: string;
    currencyName?: string;
    languages?: string[];
    primaryLanguage?: string | null;
    nativeName?: string | null;
    subregion?: string;
}

export interface SubdivisionRecord {
    code: SubdivisionCode;
    countryCode: CountryCode;
    name: string;
    nativeName?: string;
    displayName?: string;
    searchKeywords?: string[];
    type?: string;
}

export interface CityRecord {
    geonameId: GeonameId;
    name: string;
    asciiName?: string;
    countryCode: CountryCode;
    subdivisionCode?: SubdivisionCode;
    admin1Code?: string;
    admin2Code?: string;
    population?: number;
    lat: number;
    lng: number;
    timezone?: string;
    featureClass?: string;
    featureCode?: string;
    localityType?: "city" | "town" | "village" | "other";
}

export interface ShippingProfile {
    customsRegion?: string;
    locodeCountryCode?: string;
    phonePrefix?: string;
    postalCodeFormat?: string;
    postalCodeRegex?: string;
    requiresSubdivisionForShipping?: boolean;
}

export interface PostalCodeRecord {
    postalCode: string;
    placeName: string;
    admin1Name?: string | null;
    admin1Code?: string | null;
    admin2Name?: string | null;
    admin2Code?: string | null;
    admin3Name?: string | null;
    admin3Code?: string | null;
    lat?: number | null;
    lng?: number | null;
    accuracy?: number | null;
}

export interface CountryOperationalMetadata extends ShippingProfile {
    countryCode: CountryCode;
}

export interface AdministrativeDivisionMetadata {
    countryCode: CountryCode;
    preferredSubdivisionLevel: "admin1" | "admin2";
    primarySubdivisionType: string;
}

export interface CustomsMetadata {
    countryCode: CountryCode;
    customsRegion?: string | null;
    locodeCountryCode?: string | null;
    requiresSubdivisionForShipping: boolean;
}

export interface TradeRegionMetadata {
    countryCode: CountryCode;
    customsRegion?: string | null;
}

export interface PhoneMetadata {
    countryCode: CountryCode;
    phonePrefix?: string | null;
}

export interface CountryMetadata {
    countryCode: CountryCode;
    capital?: string | null;
    continentCode?: string | null;
    continent?: string | null;
    tld?: string | null;
    currencyCode?: string | null;
    currencyName?: string | null;
    languages: string[];
    languageDetails: Array<{
        code: string;
        tag: string;
        name: string;
        nativeName: string;
    }>;
    primaryLanguage?: string | null;
    nativeName?: string | null;
    timezones: string[];
}

export interface CityShardRecord {
    countryCode: CountryCode;
    subdivisionKey: string;
    subdivisionCode?: SubdivisionCode;
    file: string;
    count: number;
}

export interface CitiesManifest {
    version: string;
    generatedAt: string;
    countries: Record<CountryCode, Record<string, CityShardRecord>>;
}

export interface FindCityOptions {
    countryCode?: CountryCode;
}

export interface GeoEnrichmentInput {
    countryCode?: CountryCode;
    subdivisionCode?: SubdivisionCode;
    geonameId?: GeonameId;
}

export interface GeoEnrichmentResult {
    country: CountryRecord | null;
    subdivision: SubdivisionRecord | null;
    city: CityRecord | null;
    shipping: ShippingProfile | null;
    continent: string | null;
    region: string | null;
    subregion: string | null;
}

export interface SearchCitiesOptions {
    countryCode?: CountryCode;
    subdivisionCode?: SubdivisionCode;
    exact?: boolean;
    limit?: number;
}

export interface GeoCityDetailsResult extends GeoEnrichmentResult {}

export interface CitySearchResult extends GeoCityDetailsResult {
    city: CityRecord;
    matchScore: number;
    matchedQuery: string;
}

export interface GetCityDetailsInput {
    name?: string;
    geonameId?: GeonameId;
    countryCode?: CountryCode;
    subdivisionCode?: SubdivisionCode;
    exact?: boolean;
}

export const GEO_DATASET_VERSION: string;
export const OFFICIAL_SOURCE_NAMES: readonly string[];

export function listCountries(): CountryRecord[];
export function getCountry(code: CountryCode): CountryRecord | null;
export function hasCountry(code: CountryCode): boolean;

export function listSubdivisions(countryCode: CountryCode): SubdivisionRecord[];
export function getSubdivision(code: SubdivisionCode): SubdivisionRecord | null;
export function hasSubdivision(code: SubdivisionCode): boolean;

export function listCityShards(countryCode?: CountryCode): CityShardRecord[];
export function listCitiesBySubdivision(countryCode: CountryCode, subdivisionKeyOrCode: string): CityRecord[];
export function listCitiesByCountry(countryCode: CountryCode): CityRecord[];
export function findCityByGeonameId(geonameId: GeonameId, options?: FindCityOptions): CityRecord | null;
export function normalizePlaceName(value: string): string;
export function searchCities(query: string, options?: SearchCitiesOptions): CitySearchResult[];
export function findCityByName(name: string, options?: SearchCitiesOptions): CitySearchResult | null;
export function getCityDetails(input: GetCityDetailsInput): GeoCityDetailsResult | null;

export function enrichGeoRecord(input: GeoEnrichmentInput): GeoEnrichmentResult;
export function getShippingProfile(countryCode: CountryCode): ShippingProfile | null;
export function getCountryOperationalMetadata(countryCode: CountryCode): CountryOperationalMetadata | null;
export function getAdministrativeDivisionMetadata(countryCode: CountryCode): AdministrativeDivisionMetadata | null;
export function listPostalCodes(countryCode: CountryCode): PostalCodeRecord[];
export function findPostalCodesByPlaceName(countryCode: CountryCode, placeName: string, options?: {
    admin1Name?: string;
    admin2Name?: string;
}): PostalCodeRecord[];
export function findPostalCodeByPlaceName(countryCode: CountryCode, placeName: string, options?: {
    admin1Name?: string;
    admin2Name?: string;
}): PostalCodeRecord | null;
export function getCustomsMetadata(countryCode: CountryCode): CustomsMetadata | null;
export function getTradeRegionMetadata(countryCode: CountryCode): TradeRegionMetadata | null;
export function getPhoneMetadata(countryCode: CountryCode): PhoneMetadata | null;
export function listCountryMetadata(): CountryMetadata[];
export function getCountryMetadata(countryCode: CountryCode): CountryMetadata | null;
