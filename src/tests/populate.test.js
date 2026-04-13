import test from "node:test";
import assert from "node:assert/strict";

import { populateGeoSources } from "../populate/index.js";

function toDataUrl(contentType, value) {
  return `data:${contentType};charset=utf-8,${encodeURIComponent(value)}`;
}

test("populate API normalizes remote payloads in dry-run mode", async () => {
  const unM49 = JSON.stringify([
    {
      iso2: "ES",
      countryName: "Spain",
      numericCode: "724",
      continentName: "Europe",
      regionName: "Europe",
      subregionName: "Southern Europe",
    },
  ]);

  const isoCountries = [
    "code,name,iso3,numeric",
    "ES,Spain,ESP,724",
  ].join("\n");

  const isoSubdivisions = [
    "code,countryCode,name,type",
    "ES-MD,ES,Community of Madrid,autonomous community",
  ].join("\n");

  const geonames = [
    "3117735\tMadrid\tMadrid\tMadrid\t40.4165\t-3.70256\tP\tPPLC\tES\t\tMD\tM\t\t\t3255944\t667\t655\tEurope/Madrid\t2024-01-01",
  ].join("\n");

  const shipping = JSON.stringify([
    {
      countryCode: "ES",
      customsRegion: "EU Customs Union",
      locodeCountryCode: "ES",
      phonePrefix: "34",
      postalCodeFormat: "NNNNN",
      requiresSubdivisionForShipping: "false",
    },
  ]);

  const result = await populateGeoSources({
    dryRun: true,
    sourceUrls: {
      unM49: toDataUrl("application/json", unM49),
      isoCountries: toDataUrl("text/csv", isoCountries),
      isoSubdivisions: toDataUrl("text/csv", isoSubdivisions),
      admin2Subdivisions: toDataUrl("text/tab-separated-values", ""),
      geonamesCities: toDataUrl("text/tab-separated-values", geonames),
      geonamesPostalCodes: toDataUrl("text/tab-separated-values", ""),
      shippingProfiles: toDataUrl("application/json", shipping),
    },
  });

  assert.equal(result.manifest.dryRun, true);
  assert.equal(result.normalized.unM49[0].countryCode, "ES");
  assert.equal(result.normalized.isoCountries[0].iso3, "ESP");
  assert.equal(result.normalized.isoSubdivisions[0].code, "ES-MD");
  assert.equal(result.normalized.geonamesCities[0].name, "Madrid");
  assert.equal(result.normalized.shippingProfiles.ES.locodeCountryCode, "ES");
  assert.equal(result.normalized.shippingProfiles.ES.phonePrefix, "34");
});

test("populate API allows shipping profiles to be omitted", async () => {
  const result = await populateGeoSources({
    dryRun: true,
    sourceUrls: {
      unM49: toDataUrl("application/json", JSON.stringify([{ iso2: "US", countryName: "United States", numericCode: "840", continentName: "Americas", regionName: "Americas", subregionName: "Northern America" }])),
      isoCountries: toDataUrl("text/csv", "code,name,iso3,numeric\nUS,United States,USA,840"),
      isoSubdivisions: toDataUrl("text/csv", "code,countryCode,name,type\nUS-CA,US,California,state"),
      admin2Subdivisions: toDataUrl("text/tab-separated-values", ""),
      geonamesCities: toDataUrl("text/tab-separated-values", "5368361\tLos Angeles\tLos Angeles\tLos Angeles\t34.05223\t-118.24368\tP\tPPLA\tUS\t\tCA\t037\t\t\t3898747\t0\t0\tAmerica/Los_Angeles\t2024-01-01"),
      geonamesPostalCodes: toDataUrl("text/tab-separated-values", ""),
    },
  });

  assert.equal(result.normalized.shippingProfiles.US.locodeCountryCode, "US");
  assert.equal(result.normalized.shippingProfiles.US.requiresSubdivisionForShipping, true);
});

test("populate API derives phone prefix and postal format from geonames country info", async () => {
  const geonamesCountryInfo = [
    "#ISO\tISO3\tISO-Numeric\tfips\tCountry\tCapital\tArea(in sq km)\tPopulation\tContinent\ttld\tCurrencyCode\tCurrencyName\tPhone\tPostal Code Format\tPostal Code Regex\tLanguages\tgeonameid\tneighbours\tEquivalentFipsCode",
    "ES\tESP\t724\tSP\tSpain\tMadrid\t504782\t47000000\tEU\t.es\tEUR\tEuro\t34\t#####\t^(?:0[1-9]|[1-4]\\d|5[0-2])\\d{3}$\tes\t2510769\tPT,FR,AD,GI\t",
  ].join("\n");

  const result = await populateGeoSources({
    dryRun: true,
    sourceUrls: {
      unM49: toDataUrl("application/json", JSON.stringify([{ iso2: "ES", countryName: "Spain", numericCode: "724", continentName: "Europe", regionName: "Europe", subregionName: "Southern Europe" }])),
      isoCountries: toDataUrl("text/plain", geonamesCountryInfo),
      isoSubdivisions: toDataUrl("text/csv", "code,countryCode,name,type\nES-MD,ES,Community of Madrid,autonomous community"),
      admin2Subdivisions: toDataUrl("text/tab-separated-values", ""),
      geonamesCities: toDataUrl("text/tab-separated-values", "3117735\tMadrid\tMadrid\tMadrid\t40.4165\t-3.70256\tP\tPPLC\tES\t\tMD\tM\t\t\t3255944\t667\t655\tEurope/Madrid\t2024-01-01"),
      geonamesPostalCodes: toDataUrl("text/tab-separated-values", ""),
    },
  });

  assert.equal(result.normalized.isoCountries[0].phonePrefix, "34");
  assert.equal(result.normalized.isoCountries[0].postalCodeFormat, "#####");
  assert.equal(result.normalized.isoCountries[0].currencyCode, "EUR");
  assert.equal(result.normalized.isoCountries[0].currencyName, "Euro");
  assert.deepEqual(result.normalized.isoCountries[0].languages, ["es"]);
  assert.equal(result.normalized.shippingProfiles.ES.phonePrefix, "34");
  assert.equal(result.normalized.shippingProfiles.ES.postalCodeFormat, "#####");
  assert.equal(result.normalized.shippingProfiles.ES.postalCodeRegex, "^(?:0[1-9]|[1-4]\\d|5[0-2])\\d{3}$");
});

test("populate API fails when a remote source cannot be fetched", async () => {
  await assert.rejects(
    populateGeoSources({
      dryRun: true,
      sourceUrls: {
        unM49: "https://example.invalid/un-m49.json",
      },
    }),
    /Failed to fetch|fetch failed|ENOTFOUND|getaddrinfo/i,
  );
});
