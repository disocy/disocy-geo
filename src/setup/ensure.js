import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, "../..");
const DIST_DIR = path.join(PACKAGE_ROOT, "dist");
const DIST_MARKER = path.join(DIST_DIR, "core", "countries.json");
const DEFAULT_ARCHIVE_URL = "https://github.com/disocy/disocy-geo/releases/latest/download/geo-dist.tar.gz";

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: PACKAGE_ROOT,
    stdio: "inherit",
    ...options,
  });

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
}

async function downloadArchive(url, targetFile) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "@disocy/geo ensure",
      accept: "*/*",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download geo dist archive: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  mkdirSync(path.dirname(targetFile), { recursive: true });
  writeFileSync(targetFile, buffer);
}

async function restoreDistFromArchive(url) {
  const tempDir = path.join(os.tmpdir(), `disocy-geo-${Date.now()}`);
  const archiveFile = path.join(tempDir, "geo-dist.tar.gz");

  mkdirSync(tempDir, { recursive: true });
  try {
    await downloadArchive(url, archiveFile);
    rmSync(DIST_DIR, { recursive: true, force: true });
    mkdirSync(PACKAGE_ROOT, { recursive: true });
    runCommand("tar", ["-xzf", archiveFile, "-C", PACKAGE_ROOT]);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

export function getGeoDistDir() {
  return DIST_DIR;
}

export function getDefaultGeoDistArchiveUrl() {
  return process.env.DISOCY_GEO_DIST_ARCHIVE_URL?.trim() || DEFAULT_ARCHIVE_URL;
}

export async function ensureGeoDataset(options = {}) {
  const archiveUrl = options.archiveUrl?.trim() || getDefaultGeoDistArchiveUrl();
  const forceRefresh = options.force === true;

  if (!forceRefresh && existsSync(DIST_MARKER)) {
    return {
      status: "present",
      distDir: DIST_DIR,
      marker: DIST_MARKER,
    };
  }

  await restoreDistFromArchive(archiveUrl);

  if (!existsSync(DIST_MARKER)) {
    throw new Error("Geo dist archive was extracted, but the dataset marker is still missing");
  }

  return {
    status: "downloaded",
    distDir: DIST_DIR,
    marker: DIST_MARKER,
    archiveUrl,
  };
}
