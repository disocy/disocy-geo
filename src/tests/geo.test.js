import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  listCountries,
  getCountry,
  getSubdivision,
  listSubdivisions,
  listCityShards,
  listCitiesBySubdivision,
  listCitiesByCountry,
  findCityByGeonameId,
  enrichGeoRecord,
  normalizePlaceName,
  searchCities,
  findCityByName,
  getCityDetails,
  getCountryOperationalMetadata,
  getCustomsMetadata,
  getTradeRegionMetadata,
  getPhoneMetadata,
  listCountryMetadata,
  getCountryMetadata,
} from "../index.js";
import { buildGeoDataset } from "../build/index.js";

test("countries are indexed by ISO code", () => {
  const countries = listCountries();

  assert.ok(countries.length >= 4);
  assert.ok(countries.some((entry) => entry.code === "ES"));
  assert.ok(countries.some((entry) => entry.code === "JP"));
  assert.ok(countries.some((entry) => entry.code === "US"));

  assert.equal(getCountry("es")?.name, "Spain");
  assert.ok(typeof getCountry("JP")?.subregion === "string");
  assert.equal(getCountry("XX"), null);
});

test("subdivisions are grouped by country and individually addressable", () => {
  assert.ok(listSubdivisions("ES").length >= 3);
  assert.equal(getSubdivision("ES-29")?.name, "Madrid");
  assert.equal(getSubdivision("JP-13")?.type, "admin1");
  assert.equal(getSubdivision("JP-99"), null);
});

test("subdivisions can expose native names and search aliases when inferred", () => {
  const madrid = getSubdivision("ES-29");

  assert.ok(madrid);
  assert.equal(madrid?.displayName ?? madrid?.name, "Comunidad de Madrid");
  assert.ok(Array.isArray(madrid?.searchKeywords));
  assert.ok(madrid?.searchKeywords?.includes("ES-29"));
});

test("city shards can be listed and resolved", () => {
  const shardKeys = listCityShards("ES").map((entry) => entry.subdivisionKey).sort();
  assert.deepEqual(shardKeys, ["AN", "CT", "MD"]);

  const madridCities = listCitiesBySubdivision("ES", "MD");
  assert.equal(madridCities[0]?.name, "Madrid");

  const japaneseCities = listCitiesByCountry("JP");
  assert.equal(japaneseCities.length, 2);

  const tokyo = findCityByGeonameId(1850144);
  assert.equal(tokyo?.name, "Tokyo");
  assert.equal(tokyo?.subdivisionCode, "JP-13");
});

test("geo enrichment returns joined geographic and shipping context", () => {
  const enriched = enrichGeoRecord({
    countryCode: "US",
    subdivisionCode: "US-CA",
    geonameId: 5368361,
  });

  assert.equal(enriched.country?.name, "United States");
  assert.equal(enriched.subdivision?.name, "California");
  assert.equal(enriched.city?.name, "Los Angeles");
  assert.ok(typeof enriched.continent === "string");
  assert.ok(enriched.shipping === null || typeof enriched.shipping === "object");
});

test("city queries support normalized name search and detail resolution", () => {
  assert.equal(normalizePlaceName("  Los Ángeles "), "los angeles");

  const searchResults = searchCities("los ángeles", {
    countryCode: "us",
    limit: 5,
  });

  assert.ok(searchResults.length >= 1);
  assert.equal(searchResults[0].city.name, "Los Angeles");
  assert.equal(searchResults[0].country?.code, "US");

  const bestMatch = findCityByName("madrid", {
    countryCode: "es",
  });

  assert.equal(bestMatch?.city.name, "Madrid");
  assert.equal(bestMatch?.country?.code, "ES");

  const detailsByName = getCityDetails({
    name: "tokyo",
    countryCode: "jp",
  });

  assert.equal(detailsByName?.city?.geonameId, 1850144);
  assert.equal(detailsByName?.country?.name, "Japan");

  const detailsById = getCityDetails({
    geonameId: 5368361,
    countryCode: "us",
  });

  assert.equal(detailsById?.city?.name, "Los Angeles");
  assert.equal(detailsById?.subdivision?.name, "California");
});

test("domain metadata helpers expose operational, customs, and phone slices", () => {
  const operational = getCountryOperationalMetadata("us");
  assert.equal(operational?.countryCode, "US");
  assert.equal(operational?.locodeCountryCode, "US");

  const customs = getCustomsMetadata("us");
  assert.equal(customs?.countryCode, "US");
  assert.equal(typeof customs?.requiresSubdivisionForShipping, "boolean");

  const tradeRegion = getTradeRegionMetadata("us");
  assert.equal(tradeRegion?.countryCode, "US");

  const phone = getPhoneMetadata("us");
  assert.equal(phone?.countryCode, "US");

  const metadata = listCountryMetadata();
  assert.ok(Array.isArray(metadata));
});

test("dataset build regenerates expected dist artifacts", () => {
  const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

  assert.doesNotThrow(() => buildGeoDataset());
  assert.ok(existsSync(path.join(packageRoot, "dist", "core", "countries.json")));
  assert.ok(existsSync(path.join(packageRoot, "dist", "addressing", "country-operational", "US.json")));

  const manifest = JSON.parse(
    readFileSync(path.join(packageRoot, "dist", "core", "localities", "manifest.json"), "utf8"),
  );

  assert.equal(manifest.version, "2026.04.13");
  assert.equal(manifest.countries.ES.MD.count, 1);
});

test("dataset build emits metadata, compliance, and addressing artifacts", () => {
  const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

  buildGeoDataset({
    unM49: [
      {
        countryCode: "ES",
        name: "Spain",
        m49: "724",
        continent: "Europe",
        region: "Europe",
        subregion: "Southern Europe",
      },
    ],
    isoCountries: [
      {
        code: "ES",
        iso3: "ESP",
        numeric: "724",
        name: "Spain",
        capital: "Madrid",
        continentCode: "EU",
        tld: ".es",
        currencyCode: "EUR",
        currencyName: "Euro",
        phonePrefix: "34",
        postalCodeFormat: "#####",
        postalCodeRegex: "^[0-9]{5}$",
        languages: ["es", "ca"],
      },
    ],
    isoSubdivisions: [
      {
        code: "ES-GR",
        countryCode: "ES",
        name: "Granada",
        type: "province",
      },
    ],
    geonamesCities: [
      {
        geonameId: 2517117,
        name: "Jatar",
        asciiName: "Jatar",
        countryCode: "ES",
        subdivisionCode: "ES-GR",
        admin1Code: "GR",
        admin2Code: "GR",
        population: 900,
        lat: 36.93,
        lng: -3.91,
        timezone: "Europe/Madrid",
      },
    ],
    shippingProfiles: {
      ES: {
        customsRegion: "EU",
        locodeCountryCode: "ES",
        phonePrefix: "34",
        postalCodeFormat: "#####",
        postalCodeRegex: "^[0-9]{5}$",
        requiresSubdivisionForShipping: true,
      },
    },
  });

  assert.ok(existsSync(path.join(packageRoot, "dist", "metadata", "countries", "ES.json")));
  assert.ok(existsSync(path.join(packageRoot, "dist", "addressing", "country-operational", "ES.json")));
  assert.ok(existsSync(path.join(packageRoot, "dist", "compliance", "customs", "ES.json")));
  assert.ok(existsSync(path.join(packageRoot, "dist", "compliance", "trade-regions", "ES.json")));
  assert.ok(existsSync(path.join(packageRoot, "dist", "core", "countries.json")));

  const countryMetadata = JSON.parse(
    readFileSync(path.join(packageRoot, "dist", "metadata", "countries", "ES.json"), "utf8"),
  );
  assert.equal(countryMetadata.currencyCode, "EUR");
  assert.deepEqual(countryMetadata.languages, ["es", "ca"]);
  assert.deepEqual(countryMetadata.timezones, ["Europe/Madrid"]);

  const operational = JSON.parse(
    readFileSync(path.join(packageRoot, "dist", "addressing", "country-operational", "ES.json"), "utf8"),
  );
  assert.equal(operational.postalCodeRegex, "^[0-9]{5}$");
  assert.equal(operational.phonePrefix, "34");
});

test("dataset build keeps english, native, and official subdivision labels separated", () => {
  const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

  buildGeoDataset({
    unM49: [
      {
        countryCode: "ES",
        name: "Spain",
        m49: "724",
        continent: "Europe",
        region: "Europe",
        subregion: "Southern Europe",
      },
    ],
    isoCountries: [
      {
        code: "ES",
        iso3: "ESP",
        numeric: "724",
        name: "Spain",
        capital: "Madrid",
        continentCode: "EU",
        tld: ".es",
        currencyCode: "EUR",
        currencyName: "Euro",
        phonePrefix: "34",
        postalCodeFormat: "#####",
        postalCodeRegex: "^[0-9]{5}$",
        languages: ["es-ES", "ca", "eu"],
      },
    ],
    isoSubdivisions: [
      {
        code: "ES-56",
        countryCode: "ES",
        name: "Catalonia",
        geonameId: 3336901,
        type: "admin1",
      },
      {
        code: "ES-51",
        countryCode: "ES",
        name: "Andalusia",
        geonameId: 2593109,
        type: "admin1",
      },
    ],
    subdivisionAlternateNames: [
      {
        geonameId: 3336901,
        language: "en",
        name: "Catalonia",
        isPreferredName: true,
        isShortName: true,
      },
      {
        geonameId: 3336901,
        language: "es",
        name: "Cataluña",
        isPreferredName: true,
        isShortName: true,
      },
      {
        geonameId: 3336901,
        language: "ca",
        name: "Catalunya",
        isPreferredName: true,
        isShortName: true,
      },
      {
        geonameId: 2593109,
        language: "en",
        name: "Andalusia",
        isPreferredName: true,
        isShortName: true,
      },
      {
        geonameId: 2593109,
        language: "es",
        name: "Andalucía",
        isPreferredName: false,
        isShortName: true,
      },
    ],
    admin1OfficialNames: {
      "ES-56": "Catalunya",
      "ES-51": "Andalusia",
    },
    geonamesCities: [],
    geonamesPostalCodes: [],
    shippingProfiles: {},
  });

  const subdivisions = JSON.parse(
    readFileSync(path.join(packageRoot, "dist", "core", "subdivisions-by-country", "ES.json"), "utf8"),
  );
  const catalonia = subdivisions.find((entry) => entry.code === "ES-56");
  const andalusia = subdivisions.find((entry) => entry.code === "ES-51");

  assert.equal(catalonia?.name, "Catalonia");
  assert.equal(catalonia?.nativeName, "Catalunya");
  assert.equal(catalonia?.displayName, "Cataluña");

  assert.equal(andalusia?.name, "Andalusia");
  assert.equal(andalusia?.nativeName, "Andalucía");
  assert.equal(andalusia?.displayName, "Andalucía");
});
