#!/usr/bin/env node

import { ensureGeoDataset } from "../setup/index.js";

const command = process.argv[2] ?? "help";
const force = process.argv.includes("--force");

function printHelp() {
  console.log("disocy-geo");
  console.log("");
  console.log("Commands:");
  console.log("  ensure      Download and extract the latest prebuilt dist dataset if missing");
  console.log("");
  console.log("Options:");
  console.log("  --force     Re-download the latest dist archive even if dist already exists");
}

try {
  switch (command) {
    case "ensure": {
      const result = await ensureGeoDataset({ force });
      console.log(`[@disocy/geo] dataset ${result.status} at ${result.distDir}`);
      break;
    }
    case "help":
    case "--help":
    case "-h":
      printHelp();
      break;
    default:
      console.error(`[@disocy/geo] unknown command: ${command}`);
      printHelp();
      process.exitCode = 1;
  }
} catch (error) {
  console.error(`[@disocy/geo] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
