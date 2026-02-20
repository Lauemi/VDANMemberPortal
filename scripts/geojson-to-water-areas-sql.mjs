#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const inFile = process.argv[2];
const outFile = process.argv[3] || "docs/supabase/22_water_areas_import_generated.sql";

if (!inFile) {
  console.error("Usage: node scripts/geojson-to-water-areas-sql.mjs <input.geojson> [output.sql]");
  process.exit(1);
}

const raw = fs.readFileSync(inFile, "utf8");
const gj = JSON.parse(raw);
const features = gj?.type === "FeatureCollection" ? gj.features : [];
if (!Array.isArray(features) || !features.length) {
  console.error("No GeoJSON features found.");
  process.exit(1);
}

function sqlStr(s) {
  return `'${String(s).replace(/'/g, "''")}'`;
}

function descriptionText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    return String(value.value || value.text || value.description || "");
  }
  return String(value);
}

function detectAreaKinds(name, props) {
  const src = `${name || ""} ${props?.layer || ""} ${props?.type || ""} ${descriptionText(props?.description)}`.toLowerCase();
  const hasVgw =
    src.includes("vereins") ||
    src.includes("gemeinschaftsgew") ||
    src.includes("innenwasser") ||
    src.includes("innewasser");
  const hasR39 = src.includes("rheinlos") || src.includes("rhein");

  if (hasVgw && hasR39) return ["vereins_gemeinschaftsgewaesser", "rheinlos39"];
  if (hasR39) return ["rheinlos39"];
  return ["vereins_gemeinschaftsgewaesser"];
}

const rows = [];
for (const f of features) {
  if (!f || f.type !== "Feature" || !f.geometry) continue;
  const props = f.properties || {};
  const name = String(props.name || props.title || props.Name || "Unbenannt").trim();
  const areaKinds = detectAreaKinds(name, props);
  for (const areaKind of areaKinds) {
    rows.push({ name, areaKind, feature: f });
  }
}

if (!rows.length) {
  console.error("No valid features to export.");
  process.exit(1);
}

let sql = "";
sql += "-- Auto-generated from GeoJSON\n";
sql += "-- Run after: 20_water_areas_map.sql\n\n";
sql += "begin;\n\n";
sql += "-- Optional full refresh\n";
sql += "-- delete from public.water_areas;\n\n";
sql += "insert into public.water_areas (name, area_kind, geojson, source, is_active)\nvalues\n";
sql += rows
  .map((r) => {
    const featureJson = JSON.stringify(r.feature).replace(/'/g, "''");
    return `  (${sqlStr(r.name)}, ${sqlStr(r.areaKind)}, '${featureJson}'::jsonb, 'google_my_maps', true)`;
  })
  .join(",\n");
sql += "\non conflict do nothing;\n\n";
sql += "commit;\n";

const outPath = path.resolve(outFile);
fs.writeFileSync(outPath, sql, "utf8");
console.log(`Generated ${rows.length} rows -> ${outPath}`);
