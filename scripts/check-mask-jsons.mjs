import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { readMaskJsonFile } from "./fcp-mask-reader.mjs";

const ROOT = process.cwd();
const MASKS_ROOT = path.join(ROOT, "docs", "masks");
const FORBIDDEN_HYBRID_KEYS = new Set([
  "status",
  "blockingReason",
  "sourceOfTruth",
  "whatCanBeDerivedSafely",
  "cannotBeDerivedSafely",
  "affectedStructure",
  "minimalBlockedDraft",
  "missingRequiredInfos",
  "nextValidAction",
]);

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(fullPath));
      continue;
    }
    files.push(fullPath);
  }
  return files;
}

function isMaskJsonFile(filePath) {
  const base = path.basename(filePath);
  return filePath.endsWith(".json") && (base.startsWith("QFM_") || base.startsWith("ADM_"));
}

function isRealTemplate(filePath) {
  const base = path.basename(filePath);
  return base === "QFM_mask.template.json" || base === "ADM_mask.template.json" || base === "QFM_onboarding.template.json";
}

async function loadJson(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  return JSON.parse(text);
}

function findForbiddenHybridKeys(json) {
  return Object.keys(json || {}).filter((key) => FORBIDDEN_HYBRID_KEYS.has(key));
}

async function main() {
  const allFiles = await walk(MASKS_ROOT);
  const maskFiles = allFiles.filter(isMaskJsonFile);
  const findings = [];

  for (const filePath of maskFiles) {
    const relativePath = path.relative(ROOT, filePath);
    if (isRealTemplate(filePath)) {
      continue;
    }

    let raw;
    try {
      raw = await loadJson(filePath);
    } catch (error) {
      findings.push({
        level: "error",
        file: relativePath,
        message: `JSON konnte nicht gelesen werden: ${error instanceof Error ? error.message : String(error)}`,
      });
      continue;
    }

    const hybridKeys = findForbiddenHybridKeys(raw);
    if (hybridKeys.length > 0) {
      findings.push({
        level: "error",
        file: relativePath,
        message: `Hybrid-/Review-Schluessel auf Top-Level in Masken-Datei gefunden: ${hybridKeys.join(", ")}`,
      });
    }

    const resolved = await readMaskJsonFile(filePath);
    if (!resolved.valid) {
      const summary = resolved.diagnostics.errors
        .map((entry) => `${entry.path}: ${entry.message}`)
        .join(" | ");
      findings.push({
        level: "error",
        file: relativePath,
        message: `Masken-Datei ist fuer den Reader nicht gueltig: ${summary}`,
      });
    }
  }

  if (findings.length > 0) {
    console.error("[check-mask-jsons] FAIL");
    for (const finding of findings) {
      console.error(`- ${finding.file}: ${finding.message}`);
    }
    process.exit(1);
  }

  console.log("[check-mask-jsons] PASS: alle QFM_/ADM_-Dateien sind reader-valid und ohne Hybrid-Top-Level.");
}

main().catch((error) => {
  console.error("[check-mask-jsons] ERROR:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
