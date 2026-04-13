# @disocy/geo

Disocy geographic intelligence library for normalized country, subdivision, locality, addressing, compliance, metadata, and search workflows.

This package is intended to be the geo source of truth for the platform:

- Countries, ISO codes, and UN M49 data
- Subdivisions and locality shards
- Search by normalized place name
- Country operational metadata for addressing and shipping
- Customs and trade-region slices
- Metadata such as capital, currency, languages, TLD, and timezones

## Scope

`@disocy/geo` is split into domain-oriented public entrypoints:

- `@disocy/geo/core`
- `@disocy/geo/addressing`
- `@disocy/geo/compliance`
- `@disocy/geo/metadata`
- `@disocy/geo/search`
- `@disocy/geo/populate`

The default root export re-exports the most useful runtime APIs.

## Package Layout

```text
lib/@disocy/geo/
  src/
    core/
    addressing/
    compliance/
    metadata/
    search/
    runtime/
    populate/
    build/
    scripts/
    sources/
  dist/
    core/
      countries.json
      subdivisions-by-country/
        ES.json
        US.json
      localities/
        manifest.json
        by-country-state/
          ES/51.json
          ES/52.json
          US/CA.json
    addressing/
      country-operational/
        ES.json
        US.json
    compliance/
      customs/
        ES.json
      trade-regions/
        ES.json
    metadata/
      countries/
        ES.json
        AE.json
```

## Dist Design

The generated `dist/` is organized by domain and country shard to minimize runtime overhead:

- `dist/core/countries.json`
  Canonical country catalog.
- `dist/core/subdivisions-by-country/{COUNTRY}.json`
  Only loads subdivisions for the requested country.
- `dist/core/localities/manifest.json`
  Lists available locality shards.
- `dist/core/localities/by-country-state/{COUNTRY}/{SUBDIVISION}.json`
  Loads one locality shard at a time.
- `dist/addressing/country-operational/{COUNTRY}.json`
  Addressing and shipping metadata for one country.
- `dist/compliance/customs/{COUNTRY}.json`
  Customs-focused compliance slice.
- `dist/compliance/trade-regions/{COUNTRY}.json`
  Trade-region slice for one country.
- `dist/metadata/countries/{COUNTRY}.json`
  Country metadata such as currency, languages, capital, TLD, and timezones.

This keeps runtime reads narrow and predictable instead of loading giant global JSON blobs.

## GitHub Pages As Dataset API

This repository keeps code in Git while publishing the generated dataset to GitHub Pages as static JSON shards.

The intended flow is:

1. GitHub Actions checks upstream GeoNames and UN sources every day.
2. If upstream changed, the workflow runs `populate:data`.
3. The workflow builds `dist/`.
4. The workflow deploys `dist/` to GitHub Pages.
5. Runtime consumers fetch only the shards they need over HTTPS.

This avoids committing multi-gigabyte generated artifacts into Git while also avoiding local dataset installs in consumer apps.

### Daily Refresh Workflow

The workflow lives in `.github/workflows/refresh-geo-dataset.yml`.

It:

- runs daily on a cron schedule
- checks upstream headers through `.github/scripts/check-geo-sources.mjs`
- skips the expensive rebuild when sources did not change
- deploys the refreshed `dist/` to GitHub Pages when they did

### Runtime Base URL

The runtime uses GitHub Pages directly:

```txt
https://disocy.github.io/disocy-geo/
```

Examples:

- `https://disocy.github.io/disocy-geo/core/countries.json`
- `https://disocy.github.io/disocy-geo/core/subdivisions-by-country/ES.json`
- `https://disocy.github.io/disocy-geo/core/localities/by-country-state/ES/51.json`
- `https://disocy.github.io/disocy-geo/addressing/postal-codes/ES.json`

All public data access APIs are asynchronous because they fetch remote shards.

## Public API

### Root

```js
import {
  getCountry,
  listSubdivisions,
  findCityByName,
  getCityDetails,
  getCountryOperationalMetadata,
  getCountryMetadata,
} from "@disocy/geo";

const country = await getCountry("ES");
const subdivisions = await listSubdivisions("ES");
```

### Core

```js
import {
  listCountries,
  getCountry,
  listSubdivisions,
  getSubdivision,
  listCityShards,
  listCitiesBySubdivision,
  findCityByGeonameId,
  findCityByName,
  getCityDetails,
} from "@disocy/geo/core";

const countries = await listCountries();
const city = await getCityDetails({ name: "Jatar", countryCode: "ES" });
```

### Addressing

```js
import {
  getShippingProfile,
  getCountryOperationalMetadata,
} from "@disocy/geo/addressing";

const shipping = await getCountryOperationalMetadata("ES");
```

### Compliance

```js
import {
  getCustomsMetadata,
  getTradeRegionMetadata,
} from "@disocy/geo/compliance";

const customs = await getCustomsMetadata("ES");
```

### Metadata

```js
import {
  getPhoneMetadata,
  getCountryMetadata,
  listCountryMetadata,
} from "@disocy/geo/metadata";

const metadata = await getCountryMetadata("ES");
```

### Search

```js
import {
  normalizePlaceName,
  searchCities,
  findCityByName,
  getCityDetails,
} from "@disocy/geo/search";

const cities = await searchCities("Jatar", { countryCode: "ES" });
```

## Main Runtime Entities

### Country

Country records include:

- `code`
- `iso3`
- `m49`
- `name`
- `continent`
- `continentCode`
- `region`
- `subregion`
- `capital`
- `currencyCode`
- `currencyName`
- `tld`
- `languages`

### Subdivision

Subdivision records include:

- `code`
- `countryCode`
- `name`
- `type`

### Locality

Locality records include:

- `geonameId`
- `name`
- `asciiName`
- `countryCode`
- `subdivisionCode`
- `admin1Code`
- `admin2Code`
- `population`
- `lat`
- `lng`
- `timezone`

### Country Operational Metadata

Country operational metadata includes:

- `countryCode`
- `customsRegion`
- `locodeCountryCode`
- `phonePrefix`
- `postalCodeFormat`
- `postalCodeRegex`
- `requiresSubdivisionForShipping`

## Usage Examples

### Country + Subdivisions

```js
import { getCountry, listSubdivisions } from "@disocy/geo/core";

const spain = getCountry("ES");
const spainSubdivisions = listSubdivisions("ES");
```

### Search A Place By Name

```js
import { findCityByName } from "@disocy/geo/search";

const jatar = findCityByName("Játar", {
  countryCode: "ES",
});
```

### Get Maximum City Detail

```js
import { getCityDetails } from "@disocy/geo/search";

const details = getCityDetails({
  name: "Játar",
  countryCode: "ES",
});

console.log(details);
```

Returned shape:

- `city`
- `country`
- `subdivision`
- `shipping`
- `continent`
- `region`
- `subregion`

### Addressing / Shipping Metadata

```js
import { getCountryOperationalMetadata } from "@disocy/geo/addressing";

const esOperational = getCountryOperationalMetadata("ES");
```

### Metadata Slice

```js
import { getCountryMetadata, getPhoneMetadata } from "@disocy/geo/metadata";

const esMetadata = getCountryMetadata("ES");
const esPhone = getPhoneMetadata("ES");
```

### Customs Slice

```js
import { getCustomsMetadata } from "@disocy/geo/compliance";

const esCustoms = getCustomsMetadata("ES");
```

## Search Behavior

Search is normalized with accent stripping and case folding.

Examples:

- `Játar` -> `jatar`
- `Los Ángeles` -> `los angeles`

The search layer currently supports:

- normalized name search
- exact and non-exact matching
- country filtering
- subdivision filtering
- match ranking plus population bias

## Populate Pipeline

Run the full ingestion pipeline:

```bash
pnpm run populate:data
```

The populate pipeline:

1. Downloads upstream providers
2. Normalizes country, subdivision, locality, and operational metadata
3. Rebuilds the domain-oriented `dist/`

Optional source override variables for maintainers:

```bash
DISOCY_GEO_UN_M49_URL=
DISOCY_GEO_ISO_COUNTRIES_URL=
DISOCY_GEO_ISO_SUBDIVISIONS_URL=
DISOCY_GEO_ADMIN2_SUBDIVISIONS_URL=
DISOCY_GEO_GEONAMES_CITIES_URL=
DISOCY_GEO_GEONAMES_POSTAL_CODES_URL=
DISOCY_GEO_GEONAMES_ALTERNATE_NAMES_BASE_URL=
DISOCY_GEO_SHIPPING_URL=
```

These are only intended for source maintenance, mirrors, or debugging the ingest pipeline. Consumer apps do not need to set any geo-specific environment variables.

## Build Dist From Existing Source Snapshots

```bash
pnpm run build:data
```

This rebuilds `dist/` from the normalized snapshots under `src/sources/*`.

## Test

```bash
pnpm test
```

## Source Inputs

Current upstream model:

- `UN M49`
  Continent, region, subregion, numeric country codes
- `GeoNames countryInfo.txt`
  Country codes, ISO3, capital, TLD, currency, phone prefix, postal fields, languages
- `GeoNames admin1Codes.txt` (UTF-8 names)
  Primary subdivision catalog
- `GeoNames admin2Codes.txt`
  Secondary subdivision catalog
- `GeoNames allCountries.zip`
  Localities, coordinates, population, admin hierarchy, timezone
- optional curated shipping input
  Explicit overrides for operational metadata when needed

If no external shipping payload is provided, shipping metadata is derived from country metadata plus subdivision presence.

## Current Notes

- Runtime is file-backed and intended for server-side / Node.js usage.
- `dist/` is a generated artifact and should stay committed with the package.
- `src/sources/*` is the normalized source layer for rebuilds.
- Large locality imports are handled through shard-oriented processing to avoid giant in-memory JSON objects.
