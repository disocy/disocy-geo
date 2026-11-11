import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAdministrativeDivisionRecord,
  normalizeAddressFormatRecord,
  normalizeAddressFormatsPayload,
  pickPostalSubdivisionLevel,
} from "../addressing/address-formats.js";
import { deriveShippingProfiles } from "../populate/normalize.js";

// Trimmed from https://chromium-i18n.appspot.com/ssl-address/data/{COUNTRY} (libaddressinput).
const SPAIN_PROVINCES = "VI~AB~A~AL~O~AV~BA~B~BU~CC~CA~S~CS~CE~CR~CO~CU~GI~GR~GU~SS~H~HU~PM~J~C~LO~GC~LE~L~LU~M~MA~ML~MU~NA~OR~P~PO~SA~TF~SG~SE~SO~T~TE~TO~V~VA~BI~ZA~Z";
const LIBADDRESSINPUT = {
  ES: { key: "ES", fmt: "%N%n%O%n%A%n%Z %C %S", require: "ACSZ", sub_keys: SPAIN_PROVINCES },
  IT: { key: "IT", fmt: "%N%n%O%n%A%n%Z %C %S", require: "ACSZ", sub_keys: "AG~MI~RM~TO", sub_isoids: "AG~MI~RM~TO" },
  FR: { key: "FR", fmt: "%O%n%N%n%A%n%Z %C", require: "ACZ" },
  DE: { key: "DE", fmt: "%N%n%O%n%A%n%Z %C", require: "ACZ" },
  GB: { key: "GB", fmt: "%N%n%O%n%A%n%C%n%Z", require: "ACZ" },
  GR: { key: "GR", fmt: "%N%n%O%n%A%n%Z %C", require: "ACZ" },
  PT: { key: "PT", fmt: "%N%n%O%n%A%n%Z %C", require: "ACZ" },
  US: { key: "US", fmt: "%N%n%O%n%A%n%C, %S %Z", require: "ACSZ", state_name_type: "state", sub_keys: "AL~AK~CA~NY", sub_isoids: "AL~AK~CA~NY" },
  JP: { key: "JP", fmt: "〒%Z%n%S%n%A%n%O%n%N", require: "ASZ", state_name_type: "prefecture", sub_keys: "北海道~東京都", sub_isoids: "01~13" },
  IE: { key: "IE", fmt: "%N%n%O%n%A%n%D%n%C%n%S%n%Z", state_name_type: "county", sub_keys: "Co. Cork~Co. Dublin" },
  BR: { key: "BR", fmt: "%O%n%N%n%A%n%D%n%C-%S%n%Z", require: "ASCZ", state_name_type: "state", sub_keys: "AC~SP~RJ" },
  CN: { key: "CN", fmt: "%Z%n%S%C%D%n%A%n%O%n%N", require: "ACSZ", sub_keys: "安徽省~北京市" },
  ZZ: { key: "ZZ", fmt: "%N%n%O%n%A%n%C", require: "AC", state_name_type: "province" },
};

const FORMATS = normalizeAddressFormatsPayload(LIBADDRESSINPUT);

function units(countryCode, level, suffixes) {
  return suffixes.map((suffix) => ({ code: `${countryCode}-${suffix}`, countryCode, type: level }));
}

// Spain as the dataset holds it: 19 autonomous communities (admin1) and the 52 provinces under them (admin2).
const SPAIN_SUBDIVISIONS = [
  ...units("ES", "admin1", Array.from({ length: 19 }, (_, index) => String(index + 51))),
  ...units("ES", "admin2", SPAIN_PROVINCES.split("~").map((province) => `51-${province}`)),
];

test("address formats keep only real countries and fall back to the ZZ defaults", () => {
  assert.equal(FORMATS.ZZ, undefined);
  assert.equal(normalizeAddressFormatRecord({ key: "zz" }), null);
  assert.equal(FORMATS.ES.subdivisionType, "province");
  assert.equal(FORMATS.CN.subdivisionType, "province");
  assert.equal(FORMATS.IE.requiresSubdivision, false);
  assert.equal(FORMATS.IE.usesSubdivision, true);
});

test("each country carries the subdivision its postal address uses", () => {
  const expected = {
    ES: { usesSubdivision: true, requiresSubdivision: true, subdivisionType: "province" },
    IT: { usesSubdivision: true, requiresSubdivision: true, subdivisionType: "province" },
    US: { usesSubdivision: true, requiresSubdivision: true, subdivisionType: "state" },
    JP: { usesSubdivision: true, requiresSubdivision: true, subdivisionType: "prefecture" },
    BR: { usesSubdivision: true, requiresSubdivision: true, subdivisionType: "state" },
    IE: { usesSubdivision: true, requiresSubdivision: false, subdivisionType: "county" },
    FR: { usesSubdivision: false, requiresSubdivision: false },
    DE: { usesSubdivision: false, requiresSubdivision: false },
    GB: { usesSubdivision: false, requiresSubdivision: false },
    GR: { usesSubdivision: false, requiresSubdivision: false },
    PT: { usesSubdivision: false, requiresSubdivision: false },
  };

  for (const [countryCode, facts] of Object.entries(expected)) {
    for (const [field, value] of Object.entries(facts)) {
      assert.equal(FORMATS[countryCode][field], value, `${countryCode}.${field}`);
    }
  }
});

test("Spain and Italy address the province, not the autonomous community or the region", () => {
  assert.equal(pickPostalSubdivisionLevel(SPAIN_SUBDIVISIONS, FORMATS.ES), "admin2");

  const italy = [
    ...units("IT", "admin1", ["01", "09", "07", "12"]),
    ...units("IT", "admin2", ["09-MI", "07-RM", "12-TO", "01-AG", "01-PA"]),
  ];
  assert.equal(pickPostalSubdivisionLevel(italy, FORMATS.IT), "admin2");
});

test("states, prefectures and provinces stay at admin1 where the address names them there", () => {
  const unitedStates = [...units("US", "admin1", ["AL", "AK", "CA", "NY"]), ...units("US", "admin2", ["CA-037", "NY-061"])];
  assert.equal(pickPostalSubdivisionLevel(unitedStates, FORMATS.US), "admin1");

  const japan = [...units("JP", "admin1", ["01", "13"]), ...units("JP", "admin2", ["01-1", "01-2", "13-3", "13-4", "13-5"])];
  assert.equal(pickPostalSubdivisionLevel(japan, FORMATS.JP), "admin1");

  // GeoNames codes Brazil's states BR-01…, so no suffix matches and the closest count decides.
  const brazil = [...units("BR", "admin1", ["01", "02", "03"]), ...units("BR", "admin2", ["01-1", "01-2", "02-3", "02-4", "03-5"])];
  assert.equal(pickPostalSubdivisionLevel(brazil, FORMATS.BR), "admin1");
});

test("administrative division records say whether the form shows and requires the field", () => {
  assert.deepEqual(buildAdministrativeDivisionRecord("ES", SPAIN_SUBDIVISIONS, FORMATS.ES), {
    countryCode: "ES",
    preferredSubdivisionLevel: "admin2",
    primarySubdivisionType: "province",
    usesSubdivision: true,
    requiresSubdivision: true,
  });

  assert.deepEqual(buildAdministrativeDivisionRecord("DE", units("DE", "admin1", ["01", "02"]), FORMATS.DE), {
    countryCode: "DE",
    preferredSubdivisionLevel: "admin1",
    primarySubdivisionType: "province",
    usesSubdivision: false,
    requiresSubdivision: false,
  });

  assert.equal(buildAdministrativeDivisionRecord("XK", [], undefined).usesSubdivision, false);
});

test("shipping requires a subdivision only where the postal address does", () => {
  const profiles = deriveShippingProfiles(
    ["ES", "US", "JP", "DE", "FR", "GB", "GR", "IE"].map((code) => ({ code })),
    FORMATS,
  );

  assert.equal(profiles.ES.requiresSubdivisionForShipping, true);
  assert.equal(profiles.US.requiresSubdivisionForShipping, true);
  assert.equal(profiles.JP.requiresSubdivisionForShipping, true);
  for (const countryCode of ["DE", "FR", "GB", "GR", "IE"]) {
    assert.equal(profiles[countryCode].requiresSubdivisionForShipping, false, countryCode);
  }
});
