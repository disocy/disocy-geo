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

function buildShortNameDataset({ countryCode, country, subdivisions, subdivisionAlternateNames, geonamesPostalCodes }) {
  const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

  buildGeoDataset({
    unM49: [
      {
        countryCode,
        name: country.name,
        m49: country.m49,
        continent: "Europe",
        region: "Europe",
        subregion: "Southern Europe",
      },
    ],
    isoCountries: [
      {
        code: countryCode,
        iso3: country.iso3,
        numeric: country.m49,
        name: country.name,
        capital: country.capital,
        continentCode: "EU",
        tld: country.tld,
        currencyCode: "EUR",
        currencyName: "Euro",
        phonePrefix: country.phonePrefix,
        postalCodeFormat: "#####",
        postalCodeRegex: "^[0-9]{5}$",
        languages: country.languages,
      },
    ],
    isoSubdivisions: subdivisions,
    subdivisionAlternateNames,
    admin1OfficialNames: {},
    geonamesCities: [],
    geonamesPostalCodes,
    shippingProfiles: {},
  });

  return JSON.parse(
    readFileSync(path.join(packageRoot, "dist", "core", "subdivisions-by-country", `${countryCode}.json`), "utf8"),
  );
}

test("a subdivision shows its short name and keeps its official name, even when English reads the same", () => {
  // Rows as GeoNames serves them for the province of Granada (2517115): Spanish prefers the long form and flags
  // «Granada» as short, while English prefers and flags «Granada» too.
  const subdivisions = buildShortNameDataset({
    countryCode: "ES",
    country: { name: "Spain", m49: "724", iso3: "ESP", capital: "Madrid", tld: ".es", phonePrefix: "34", languages: ["es-ES"] },
    subdivisions: [
      { code: "ES-51", countryCode: "ES", name: "Andalusia", geonameId: 2593109, type: "admin1" },
      { code: "ES-51-GR", countryCode: "ES", name: "Provincia de Granada", geonameId: 2517115, type: "admin2" },
      { code: "ES-56-B", countryCode: "ES", name: "Província de Barcelona", geonameId: 3128759, type: "admin2" },
    ],
    subdivisionAlternateNames: [
      { geonameId: 2593109, language: "es", name: "Andalucía", isPreferredName: false, isShortName: true },
      { geonameId: 2517115, language: "es", name: "Provincia de Granada", isPreferredName: true, isShortName: false },
      { geonameId: 2517115, language: "es", name: "Granada", isPreferredName: false, isShortName: true },
      { geonameId: 2517115, language: "en", name: "Granada", isPreferredName: true, isShortName: true },
      { geonameId: 2517115, language: "en", name: "Granada Province", isPreferredName: false, isShortName: false },
      { geonameId: 3128759, language: "es", name: "Provincia de Barcelona", isPreferredName: true, isShortName: false },
      { geonameId: 3128759, language: "es", name: "Barcelona", isPreferredName: false, isShortName: true },
      { geonameId: 3128759, language: "ca", name: "Província de Barcelona", isPreferredName: true, isShortName: false },
    ],
    geonamesPostalCodes: [],
  });

  const granada = subdivisions.find((entry) => entry.code === "ES-51-GR");
  assert.equal(granada?.shortName, "Granada");
  assert.equal(granada?.officialName, "Provincia de Granada");
  assert.equal(granada?.name, "Granada");
  assert.ok(granada?.searchKeywords?.includes("Provincia de Granada"));

  const barcelona = subdivisions.find((entry) => entry.code === "ES-56-B");
  assert.equal(barcelona?.shortName, "Barcelona");
  assert.equal(barcelona?.officialName, "Província de Barcelona");

  const andalusia = subdivisions.find((entry) => entry.code === "ES-51");
  assert.equal(andalusia?.shortName, "Andalucía");
  assert.equal(andalusia?.officialName, "Andalusia");
});

test("a subdivision without a flagged name in the country's language shows its plain name", () => {
  const subdivisions = buildShortNameDataset({
    countryCode: "ES",
    country: { name: "Spain", m49: "724", iso3: "ESP", capital: "Madrid", tld: ".es", phonePrefix: "34", languages: ["es-ES"] },
    subdivisions: [{ code: "ES-51-AL", countryCode: "ES", name: "Provincia de Almería", geonameId: 2521858, type: "admin2" }],
    subdivisionAlternateNames: [
      { geonameId: 2521858, language: "es", name: "Almeria prov.", isPreferredName: false, isShortName: false },
    ],
    geonamesPostalCodes: [],
  });

  assert.equal(subdivisions[0]?.shortName, "Provincia de Almería");
  assert.equal(subdivisions[0]?.officialName, "Provincia de Almería");
});

test("outside Spain the short name keeps only the unit the country's postal data names", () => {
  // Rows as GeoNames serves them for the province of Milan (3173434): Italian flags the long form as short,
  // while the Italian postal places name the unit «Milano».
  const subdivisions = buildShortNameDataset({
    countryCode: "IT",
    country: { name: "Italy", m49: "380", iso3: "ITA", capital: "Rome", tld: ".it", phonePrefix: "39", languages: ["it-IT"] },
    subdivisions: [
      { code: "IT-09", countryCode: "IT", name: "Lombardy", geonameId: 3174618, type: "admin1" },
      { code: "IT-09-MI", countryCode: "IT", name: "Città metropolitana di Milano", geonameId: 3173434, type: "admin2" },
    ],
    subdivisionAlternateNames: [
      { geonameId: 3173434, language: "it", name: "Provincia di Milano", isPreferredName: true, isShortName: true },
      { geonameId: 3173434, language: "en", name: "Province of Milan", isPreferredName: true, isShortName: true },
      { geonameId: 3173434, language: "es", name: "Provincia de Milán", isPreferredName: true, isShortName: true },
    ],
    geonamesPostalCodes: [
      {
        countryCode: "IT",
        postalCode: "20001",
        placeName: "Inveruno",
        admin1Name: "Lombardia",
        admin1Code: "09",
        admin2Name: "Milano",
        admin2Code: "MI",
      },
    ],
  });

  const milan = subdivisions.find((entry) => entry.code === "IT-09-MI");
  assert.equal(milan?.shortName, "Milano");
  assert.equal(milan?.officialName, "Città metropolitana di Milano");
  assert.equal(subdivisions.find((entry) => entry.code === "IT-09")?.shortName, "Lombardy");
});
