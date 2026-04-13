function cleanString(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function decodeHtmlEntities(value) {
  return cleanString(value)
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function cleanUpper(value) {
  return cleanString(value).toUpperCase();
}

function cleanNumber(value) {
  const normalized = cleanString(value);
  if (!normalized) {
    return undefined;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function cleanFloat(value) {
  return cleanNumber(value);
}

function readField(record, aliases) {
  for (const alias of aliases) {
    if (record[alias] !== undefined && record[alias] !== null && record[alias] !== "") {
      return record[alias];
    }
  }

  return undefined;
}

function parseJsonIfPossible(payload) {
  if (typeof payload !== "string") {
    return null;
  }

  const trimmed = cleanString(payload);
  if (!trimmed) {
    return null;
  }

  if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) {
    return null;
  }

  return JSON.parse(trimmed);
}

function splitDelimitedLine(line, delimiter) {
  const result = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === "\"") {
      if (quoted && next === "\"") {
        current += "\"";
        index += 1;
        continue;
      }

      quoted = !quoted;
      continue;
    }

    if (char === delimiter && !quoted) {
      result.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current);
  return result.map((entry) => entry.trim());
}

function parseDelimitedRecords(text, delimiter) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const headers = splitDelimitedLine(lines[0], delimiter);
  return lines.slice(1).map((line) => {
    const values = splitDelimitedLine(line, delimiter);
    const record = {};

    headers.forEach((header, index) => {
      record[header] = values[index] ?? "";
    });

    return record;
  });
}

function parseTabularPayload(payload) {
  if (typeof payload !== "string") {
    return [];
  }

  const json = parseJsonIfPossible(payload);

  if (Array.isArray(json)) {
    return json;
  }

  if (json && Array.isArray(json.data)) {
    return json.data;
  }

  const trimmed = cleanString(payload);
  if (!trimmed) {
    return [];
  }

  const delimiter = trimmed.includes("\t") ? "\t" : ",";
  return parseDelimitedRecords(trimmed, delimiter);
}

function sortByCode(left, right) {
  return String(left.code).localeCompare(String(right.code));
}

function parseHtmlTableRows(payload) {
  if (typeof payload !== "string" || !payload.includes("<table")) {
    return [];
  }

  const rowMatches = [...payload.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  const rows = [];

  for (const match of rowMatches) {
    const cells = [...match[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map((cellMatch) => decodeHtmlEntities(cellMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")));

    if (cells.length > 0) {
      rows.push(cells);
    }
  }

  return rows;
}

export function normalizeUnM49Payload(payload) {
  const htmlRows = parseHtmlTableRows(payload);
  if (htmlRows.length > 0) {
    const records = htmlRows
      .map((cells) => ({
        countryCode: cleanUpper(cells[10]),
        name: cleanString(cells[8]),
        m49: cleanString(cells[9]),
        continent: cleanString(cells[1]),
        region: cleanString(cells[3]),
        subregion: cleanString(cells[5]),
      }))
      .filter((record) => /^[A-Z]{2}$/.test(record.countryCode) && record.name && record.m49);

    const deduped = new Map();
    for (const record of records) {
      if (!deduped.has(record.countryCode)) {
        deduped.set(record.countryCode, record);
      }
    }

    return [...deduped.values()].sort((left, right) => left.countryCode.localeCompare(right.countryCode));
  }

  return parseTabularPayload(payload)
    .map((record) => ({
      countryCode: cleanUpper(readField(record, ["countryCode", "iso2", "ISO2", "alpha2", "Alpha-2 code"])),
      name: cleanString(readField(record, ["name", "country", "countryName", "official_name_en"])),
      m49: cleanString(readField(record, ["m49", "numeric", "numericCode", "iso_numeric"])),
      continent: cleanString(readField(record, ["continent", "continentName"])),
      region: cleanString(readField(record, ["region", "regionName"])),
      subregion: cleanString(readField(record, ["subregion", "subregionName"])),
    }))
    .filter((record) => record.countryCode && record.name)
    .sort((left, right) => left.countryCode.localeCompare(right.countryCode));
}

export function normalizeIsoCountriesPayload(payload) {
  if (typeof payload === "string" && payload.includes("#ISO")) {
    return payload
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const columns = line.split("\t");
        return {
          code: cleanUpper(columns[0]),
          iso3: cleanUpper(columns[1]),
          numeric: cleanString(columns[2]),
          name: cleanString(columns[4]),
          capital: cleanString(columns[5]),
          continentCode: cleanUpper(columns[8]),
          tld: cleanString(columns[9]),
          currencyCode: cleanUpper(columns[10]),
          currencyName: cleanString(columns[11]),
          phonePrefix: cleanString(columns[12]),
          postalCodeFormat: cleanString(columns[13]),
          postalCodeRegex: cleanString(columns[14]),
          languages: cleanString(columns[15])
            .split(",")
            .map((entry) => cleanString(entry))
            .filter(Boolean),
        };
      })
      .filter((record) => record.code && record.name)
      .sort(sortByCode);
  }

  return parseTabularPayload(payload)
    .map((record) => ({
      code: cleanUpper(readField(record, ["code", "iso2", "ISO2", "alpha2", "Alpha-2 code"])),
      name: cleanString(readField(record, ["name", "country", "countryName", "official_name_en"])),
      iso3: cleanUpper(readField(record, ["iso3", "ISO3", "alpha3", "Alpha-3 code"])),
      numeric: cleanString(readField(record, ["numeric", "numericCode", "iso_numeric", "M49"])),
      capital: cleanString(readField(record, ["capital"])),
      continentCode: cleanUpper(readField(record, ["continentCode", "continent_code", "continent"])),
      tld: cleanString(readField(record, ["tld", "topLevelDomain"])),
      currencyCode: cleanUpper(readField(record, ["currencyCode", "currency_code"])),
      currencyName: cleanString(readField(record, ["currencyName", "currency_name"])),
      phonePrefix: cleanString(readField(record, ["phonePrefix", "phone", "country_phone"])),
      postalCodeFormat: cleanString(readField(record, ["postalCodeFormat", "postalCode", "postal_code_format"])),
      postalCodeRegex: cleanString(readField(record, ["postalCodeRegex", "postal_code_regex"])),
      languages: (() => {
        const raw = readField(record, ["languages", "languageCodes", "language_codes"]);
        if (Array.isArray(raw)) {
          return raw.map((entry) => cleanString(entry)).filter(Boolean);
        }

        return cleanString(raw)
          .split(",")
          .map((entry) => cleanString(entry))
          .filter(Boolean);
      })(),
    }))
    .filter((record) => record.code && record.name)
    .sort(sortByCode);
}

export function normalizeIsoSubdivisionsPayload(payload) {
  if (typeof payload === "string" && payload.includes(".") && payload.includes("\t")) {
    const derived = payload
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [compoundCode, name, asciiName, geonameId] = line.split("\t");
        const sourceCode = cleanString(compoundCode);
        const segments = sourceCode.split(".").filter(Boolean);
        const [countryCode = ""] = segments;

        return {
          code: cleanUpper(segments.join("-")),
          countryCode: cleanUpper(countryCode),
          name: cleanString(name),
          asciiName: cleanString(asciiName),
          geonameId: cleanNumber(geonameId),
          type: segments.length >= 3 ? "admin2" : "admin1",
        };
      })
      .filter((record) => record.code && record.countryCode && record.name);

    if (derived.length > 0) {
      return derived.sort(sortByCode);
    }
  }

  return parseTabularPayload(payload)
    .map((record) => {
      const code = cleanUpper(readField(record, ["code", "subdivisionCode", "isoCode", "ISO 3166-2 code"]));
      const countryCode = cleanUpper(
        readField(record, ["countryCode", "country_code"]) ?? code.split("-")[0],
      );

      return {
        code,
        countryCode,
        name: cleanString(readField(record, ["name", "subdivisionName", "Subdivision name"])),
        asciiName: cleanString(readField(record, ["asciiName", "asciiname"])),
        geonameId: cleanNumber(readField(record, ["geonameId", "geonameid"])),
        type: cleanString(readField(record, ["type", "category", "subdivisionType", "Subdivision category"])),
      };
    })
    .filter((record) => record.code && record.countryCode && record.name)
    .sort(sortByCode);
}

export function normalizeSubdivisionAlternateNameRecord(record) {
  const geonameId = cleanNumber(readField(record, ["geonameId", "geonameid"]));
  const language = cleanString(readField(record, ["language", "isolanguage"])).toLowerCase();
  const name = cleanString(readField(record, ["name", "alternateName", "alternate_name"]));
  const isPreferredName = cleanString(readField(record, ["isPreferredName", "is_preferred_name"])) === "1";
  const isShortName = cleanString(readField(record, ["isShortName", "is_short_name"])) === "1";

  if (!Number.isInteger(geonameId) || !name || !language) {
    return null;
  }

  return {
    geonameId,
    language,
    name,
    isPreferredName,
    isShortName,
  };
}

function parseGeonamesDump(payload) {
  const lines = payload
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.map((line) => {
    const [
      geonameId,
      name,
      asciiName,
      alternateNames,
      lat,
      lng,
      featureClass,
      featureCode,
      countryCode,
      cc2,
      admin1Code,
      admin2Code,
      admin3Code,
      admin4Code,
      population,
      elevation,
      dem,
      timezone,
    ] = line.split("\t");

    return {
      geonameId,
      name,
      asciiName,
      alternateNames,
      lat,
      lng,
      featureClass,
      featureCode,
      countryCode,
      cc2,
      admin1Code,
      admin2Code,
      population,
      elevation,
      dem,
      timezone,
    };
  });
}

export function compareNormalizedCities(left, right) {
  const countryDelta = left.countryCode.localeCompare(right.countryCode);
  if (countryDelta !== 0) {
    return countryDelta;
  }

  const subdivisionDelta = left.subdivisionCode.localeCompare(right.subdivisionCode);
  if (subdivisionDelta !== 0) {
    return subdivisionDelta;
  }

  const populationDelta = (right.population ?? 0) - (left.population ?? 0);
  if (populationDelta !== 0) {
    return populationDelta;
  }

  return left.name.localeCompare(right.name);
}

function deriveLocalityType(featureCode) {
  switch (cleanString(featureCode).toUpperCase()) {
    case "PPLC":
    case "PPLA":
    case "PPLA2":
    case "PPLA3":
    case "PPLA4":
    case "PPL":
      return "city";
    case "PPLG":
    case "PPLS":
    case "PPLX":
      return "town";
    case "PPLL":
    case "PPLQ":
    case "PPLR":
    case "PPLW":
      return "village";
    default:
      return "other";
  }
}

export function normalizeCityRecord(record) {
  const countryCode = cleanUpper(readField(record, ["countryCode", "country_code"]));
  const admin1Code = cleanUpper(readField(record, ["admin1Code", "admin1_code"]));
  const subdivisionCode = cleanUpper(
    readField(record, ["subdivisionCode", "stateCode"]) ?? `${countryCode}-${admin1Code}`,
  );

  const normalized = {
    geonameId: cleanNumber(readField(record, ["geonameId", "geonameid"])),
    name: cleanString(readField(record, ["name"])),
    asciiName: cleanString(readField(record, ["asciiName", "asciiname"])),
    countryCode,
    subdivisionCode,
    admin1Code,
    admin2Code: cleanString(readField(record, ["admin2Code", "admin2_code"])),
    population: cleanNumber(readField(record, ["population"])),
    lat: cleanFloat(readField(record, ["lat", "latitude"])),
    lng: cleanFloat(readField(record, ["lng", "lon", "longitude"])),
    timezone: cleanString(readField(record, ["timezone", "timeZone"])),
    featureClass: cleanString(readField(record, ["featureClass", "feature class"])),
    featureCode: cleanString(readField(record, ["featureCode", "feature code"])),
    localityType: deriveLocalityType(readField(record, ["featureCode", "feature code"])),
  };

  if (
    !Number.isInteger(normalized.geonameId) ||
    !normalized.countryCode ||
    !normalized.name ||
    typeof normalized.lat !== "number" ||
    typeof normalized.lng !== "number" ||
    (normalized.featureClass && normalized.featureClass !== "P")
  ) {
    return null;
  }

  return normalized;
}

export function normalizePostalCodeRecord(record) {
  const countryCode = cleanUpper(readField(record, ["countryCode", "country_code"]));
  const postalCode = cleanString(readField(record, ["postalCode", "postal_code", "zip", "postcode"]));
  const placeName = cleanString(readField(record, ["placeName", "place_name", "name"]));
  const admin1Name = cleanString(readField(record, ["admin1Name", "admin_name1"]));
  const admin1Code = cleanString(readField(record, ["admin1Code", "admin_code1"]));
  const admin2Name = cleanString(readField(record, ["admin2Name", "admin_name2"]));
  const admin2Code = cleanString(readField(record, ["admin2Code", "admin_code2"]));
  const admin3Name = cleanString(readField(record, ["admin3Name", "admin_name3"]));
  const admin3Code = cleanString(readField(record, ["admin3Code", "admin_code3"]));
  const lat = cleanFloat(readField(record, ["lat", "latitude"]));
  const lng = cleanFloat(readField(record, ["lng", "longitude", "lon"]));
  const accuracy = cleanNumber(readField(record, ["accuracy"]));

  if (!countryCode || !postalCode || !placeName) {
    return null;
  }

  return {
    countryCode,
    postalCode,
    placeName,
    admin1Name,
    admin1Code,
    admin2Name,
    admin2Code,
    admin3Name,
    admin3Code,
    lat,
    lng,
    accuracy,
  };
}

export function normalizeCitiesPayload(payload) {
  const payloadText = Buffer.isBuffer(payload) ? payload.toString("utf8") : payload;
  const json = parseJsonIfPossible(payloadText);
  const records = Array.isArray(json)
    ? json
    : json && Array.isArray(json.data)
      ? json.data
      : cleanString(payloadText).includes("\t")
        ? parseGeonamesDump(payloadText)
        : parseTabularPayload(payloadText);

  return records
    .map(normalizeCityRecord)
    .filter(Boolean)
    .sort(compareNormalizedCities);
}

export function normalizePostalCodesPayload(payload) {
  const payloadText = Buffer.isBuffer(payload) ? payload.toString("utf8") : payload;
  const json = parseJsonIfPossible(payloadText);
  const records = Array.isArray(json)
    ? json
    : json && Array.isArray(json.data)
      ? json.data
      : cleanString(payloadText).includes("\t")
        ? payloadText
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => {
            const [
              countryCode,
              postalCode,
              placeName,
              admin1Name,
              admin1Code,
              admin2Name,
              admin2Code,
              admin3Name,
              admin3Code,
              lat,
              lng,
              accuracy,
            ] = line.split("\t");

            return {
              countryCode,
              postalCode,
              placeName,
              admin1Name,
              admin1Code,
              admin2Name,
              admin2Code,
              admin3Name,
              admin3Code,
              lat,
              lng,
              accuracy,
            };
          })
        : parseTabularPayload(payloadText);

  return records
    .map(normalizePostalCodeRecord)
    .filter(Boolean)
    .sort((left, right) => {
      const countryDelta = left.countryCode.localeCompare(right.countryCode);
      if (countryDelta !== 0) {
        return countryDelta;
      }

      const postalDelta = left.postalCode.localeCompare(right.postalCode);
      if (postalDelta !== 0) {
        return postalDelta;
      }

      return left.placeName.localeCompare(right.placeName);
    });
}

export function normalizeShippingProfilesPayload(payload) {
  const json = parseJsonIfPossible(payload);
  if (json && !Array.isArray(json) && typeof json === "object") {
    return Object.fromEntries(
      Object.entries(json).map(([countryCode, record]) => [
        cleanUpper(countryCode),
        {
          customsRegion: cleanString(record.customsRegion),
          locodeCountryCode: cleanUpper(record.locodeCountryCode),
          phonePrefix: cleanString(record.phonePrefix),
          postalCodeFormat: cleanString(record.postalCodeFormat),
          postalCodeRegex: cleanString(record.postalCodeRegex),
          requiresSubdivisionForShipping: record.requiresSubdivisionForShipping === true,
        },
      ]),
    );
  }

  const records = Array.isArray(json) ? json : parseTabularPayload(payload);

  if (!Array.isArray(records)) {
    return {};
  }

  return records.reduce((accumulator, record) => {
    const countryCode = cleanUpper(readField(record, ["countryCode", "code", "iso2"]));
    if (!countryCode) {
      return accumulator;
    }

    accumulator[countryCode] = {
      customsRegion: cleanString(readField(record, ["customsRegion"])),
      locodeCountryCode: cleanUpper(readField(record, ["locodeCountryCode", "locode", "locodeCountry"])),
      phonePrefix: cleanString(readField(record, ["phonePrefix", "phone", "country_phone"])),
      postalCodeFormat: cleanString(readField(record, ["postalCodeFormat"])),
      postalCodeRegex: cleanString(readField(record, ["postalCodeRegex", "postal_code_regex"])),
      requiresSubdivisionForShipping: (
        cleanString(readField(record, ["requiresSubdivisionForShipping"])).toLowerCase() === "true"
      ),
    };

    return accumulator;
  }, {});
}

export function deriveShippingProfiles(records, subdivisionsByCountry = {}) {
  if (!Array.isArray(records)) {
    return {};
  }

  return records.reduce((accumulator, record) => {
    const countryCode = cleanUpper(record?.code);
    if (!countryCode) {
      return accumulator;
    }

    const subdivisionCount = Array.isArray(subdivisionsByCountry[countryCode])
      ? subdivisionsByCountry[countryCode].length
      : 0;

    accumulator[countryCode] = {
      customsRegion: "",
      locodeCountryCode: countryCode,
      phonePrefix: cleanString(record.phonePrefix),
      postalCodeFormat: cleanString(record.postalCodeFormat),
      postalCodeRegex: cleanString(record.postalCodeRegex),
      requiresSubdivisionForShipping: subdivisionCount > 0,
    };

    return accumulator;
  }, {});
}
