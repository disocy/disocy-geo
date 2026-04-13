import { populateGeoSources } from "../populate/index.js";
import { buildGeoDataset } from "../build/index.js";

const COLORS = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
};

function color(name, value) {
  return `${COLORS[name]}${value}${COLORS.reset}`;
}

function formatBytes(size) {
  if (!Number.isFinite(size) || size <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function printLine(message = "") {
  process.stdout.write(`${message}\n`);
}

function printHeader() {
  printLine(color("cyan", "Disocy Geo Populate"));
  printLine(color("dim", "One-shot population pipeline for countries, subdivisions, cities, and manifests."));
  printLine();
}

function renderProgress(event) {
  switch (event.type) {
    case "pipeline-start":
      printLine(`${color("cyan", "●")} Starting pipeline${event.dryRun ? color("yellow", " (dry-run)") : ""}`);
      return;
    case "step-start":
      printLine(`${color("cyan", "→")} ${event.label}`);
      return;
    case "step-error":
      printLine(`  ${color("red", "✖")} source failed: ${event.error}`);
      return;
    case "step-complete":
      printLine(
        `  ${color("green", "✓")} downloaded ${color("dim", `(${formatBytes(event.size)})`)}`,
      );
      return;
    case "normalize-start":
      printLine(`${color("cyan", "→")} Normalizing provider payloads`);
      return;
    case "normalize-complete":
      printLine(
        `  ${color("green", "✓")} normalized ${event.counts.unM49} countries, ${event.counts.isoSubdivisions} subdivisions, ${event.counts.geonamesCities} cities`,
      );
      return;
    case "write-start":
      printLine(`${color("cyan", "→")} Writing canonical source snapshots`);
      return;
    case "build-start":
      printLine(`${color("cyan", "→")} Building dist artifacts`);
      return;
    case "build-complete":
      printLine(
        `  ${color("green", "✓")} built dist ${color("dim", `(${event.summary.countries} countries, ${event.summary.cityCountries} city countries)`)}`,
      );
      return;
    case "write-skipped":
      printLine(`  ${color("yellow", "•")} dry-run: skipped writing files`);
      return;
    case "pipeline-complete":
      printLine(`${color("green", "●")} Pipeline complete`);
      return;
    default:
      return;
  }
}

const startedAt = Date.now();
printHeader();

try {
  const result = await populateGeoSources({
    onProgress: renderProgress,
  });
  const buildSummary = buildGeoDataset();
  const elapsedMs = Date.now() - startedAt;

  printLine();
  printLine(color("bold", "Summary"));
  printLine(`  Populated at: ${result.manifest.populatedAt}`);
  printLine(`  Duration: ${elapsedMs}ms`);
  printLine(`  UN M49: ${result.manifest.sources.unM49.recordCount}`);
  printLine(`  ISO countries: ${result.manifest.sources.isoCountries.recordCount}`);
  printLine(`  ISO subdivisions: ${result.manifest.sources.isoSubdivisions.recordCount}`);
  printLine(`  Cities: ${result.manifest.sources.geonamesCities.recordCount}`);
  printLine(`  Shipping profiles: ${result.manifest.sources.shippingProfiles.recordCount}`);
  printLine(`  Dist countries: ${buildSummary.countries}`);
  printLine(`  Dist subdivision countries: ${buildSummary.subdivisionCountries}`);
  printLine(`  Dist city countries: ${buildSummary.cityCountries}`);
} catch (error) {
  printLine();
  printLine(`${color("red", "✖")} Populate failed`);
  printLine(`  ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
