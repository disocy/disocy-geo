import { buildGeoDataset } from "../build/index.js";

try {
  const summary = buildGeoDataset();

  console.log("[@disocy/geo] Dataset build complete");
  console.log(`  Version: ${summary.version}`);
  console.log(`  Countries: ${summary.countries}`);
  console.log(`  Countries with subdivisions: ${summary.subdivisionCountries}`);
  console.log(`  Countries with city shards: ${summary.cityCountries}`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const missingCitySnapshots = message.includes("src/sources/geonames/cities.json");

  console.error("[@disocy/geo] Dataset build failed");
  if (missingCitySnapshots) {
    console.error("  Missing city snapshots in src/sources/geonames.");
    console.error("  Run `pnpm --dir lib/@disocy/geo run populate:data` first to regenerate source shards and dist.");
  } else {
    console.error(`  ${message}`);
  }

  process.exitCode = 1;
}
