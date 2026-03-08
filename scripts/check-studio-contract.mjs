#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const APP_PAGES_DIR = path.join(ROOT, "src", "pages", "app");
const REQUIRED_COMPONENT_ATTRS = [
  "data-studio-component-id",
  "data-studio-component-type",
  "data-studio-slot",
];
const STUDIO_TYPES = new Set(["table", "card", "dialog", "button", "input", "list", "section", "header", "footer"]);
const STUDIO_SLOTS = new Set(["header", "main", "sidebar", "footer"]);

function walk(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && full.endsWith(".astro")) out.push(full);
  }
  return out;
}

function toRel(file) {
  return path.relative(ROOT, file).replace(/\\/g, "/");
}

function lineOf(content, idx) {
  return content.slice(0, idx).split("\n").length;
}

function parseAttrs(raw) {
  const attrs = new Map();
  const re = /([:@A-Za-z0-9_-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m;
  while ((m = re.exec(raw))) {
    const key = m[1];
    const val = m[2] ?? m[3] ?? m[4] ?? "";
    attrs.set(key, String(val));
  }
  return attrs;
}

function parseElements(content) {
  const out = [];
  const re = /<([A-Za-z][A-Za-z0-9:-]*)([\s\S]*?)>/g;
  let m;
  while ((m = re.exec(content))) {
    const [full, tag, rawAttrs] = m;
    if (full.startsWith("</") || full.startsWith("<!") || full.startsWith("<?")) continue;
    out.push({
      tag: tag.toLowerCase(),
      attrs: parseAttrs(rawAttrs),
      line: lineOf(content, m.index),
    });
  }
  return out;
}

function classifyNonEditorRelevant(relPath) {
  return (
    relPath.includes("/passwort-aendern/") ||
    relPath.includes("/ausweis/verifizieren.") ||
    relPath.includes("/admin-panel/")
  );
}

function checkFile(file) {
  const rel = toRel(file);
  const content = fs.readFileSync(file, "utf8");
  const elements = parseElements(content);

  const findings = [];
  const componentIds = new Map();
  let studioTaggedElements = 0;
  let tableElements = 0;

  for (const el of elements) {
    const hasAnyStudioAttr = REQUIRED_COMPONENT_ATTRS.some((k) => el.attrs.has(k));
    if (!hasAnyStudioAttr) continue;
    studioTaggedElements += 1;

    const compId = String(el.attrs.get("data-studio-component-id") || "").trim();
    const compType = String(el.attrs.get("data-studio-component-type") || "").trim();
    const compSlot = String(el.attrs.get("data-studio-slot") || "").trim();
    const label = compId || `${el.tag}@${el.line}`;

    for (const attr of REQUIRED_COMPONENT_ATTRS) {
      if (!el.attrs.has(attr) || !String(el.attrs.get(attr) || "").trim()) {
        findings.push({
          severity: "ERROR",
          type: "missing-component-attr",
          file: rel,
          line: el.line,
          component: label,
          message: `Fehlendes Attribut: ${attr}`,
        });
      }
    }

    if (compId) {
      if (componentIds.has(compId)) {
        findings.push({
          severity: "WARN",
          type: "duplicate-component-id",
          file: rel,
          line: el.line,
          component: label,
          message: `Duplicate data-studio-component-id im selben File: ${compId}`,
        });
      } else {
        componentIds.set(compId, el.line);
      }
    }

    if (compType && !STUDIO_TYPES.has(compType)) {
      findings.push({
        severity: "WARN",
        type: "unknown-component-type",
        file: rel,
        line: el.line,
        component: label,
        message: `Unbekannter component-type: ${compType}`,
      });
    }

    if (compSlot && !STUDIO_SLOTS.has(compSlot)) {
      findings.push({
        severity: "WARN",
        type: "unknown-component-slot",
        file: rel,
        line: el.line,
        component: label,
        message: `Unbekannter component-slot: ${compSlot}`,
      });
    }

    const isTable = compType === "table" || el.attrs.has("data-table-id");
    if (isTable) {
      tableElements += 1;
      const tableId = String(el.attrs.get("data-table-id") || "").trim();
      if (!tableId) {
        findings.push({
          severity: "ERROR",
          type: "missing-table-id",
          file: rel,
          line: el.line,
          component: label,
          message: "Table-Contract verletzt: data-table-id fehlt",
        });
      }
      const rowClick = String(el.attrs.get("data-row-click") || "").trim();
      if (!rowClick) {
        findings.push({
          severity: "WARN",
          type: "missing-row-click",
          file: rel,
          line: el.line,
          component: label,
          message: "Empfehlung: data-row-click fehlt",
        });
      }
    }
  }

  const errors = findings.filter((f) => f.severity === "ERROR").length;
  let rolloutStatus = "vollstaendig compliant";
  if (studioTaggedElements === 0) {
    rolloutStatus = classifyNonEditorRelevant(rel) ? "nicht editorrelevant" : "nicht compliant";
  } else if (errors > 0) {
    rolloutStatus = "teilweise compliant";
  }

  if (rolloutStatus === "nicht compliant") {
    findings.push({
      severity: "ERROR",
      type: "missing-page-contract",
      file: rel,
      line: 1,
      component: "page",
      message: "Keine data-studio-* Contract-Tags auf dieser /app/ Maske gefunden",
    });
  }

  return {
    file: rel,
    studioTaggedElements,
    tableElements,
    rolloutStatus,
    findings,
  };
}

function print(results) {
  const allFindings = results.flatMap((r) => r.findings);
  const errors = allFindings.filter((f) => f.severity === "ERROR");
  const warns = allFindings.filter((f) => f.severity === "WARN");

  console.log("Studio Contract Check");
  console.log("====================");
  console.log(`Scanned files: ${results.length}`);
  console.log(`Errors: ${errors.length}`);
  console.log(`Warnings: ${warns.length}`);
  console.log("");

  if (allFindings.length) {
    console.log("Findings:");
    for (const f of allFindings) {
      console.log(
        `- [${f.severity}] ${f.file}:${f.line} | ${f.component} | ${f.message}`
      );
    }
    console.log("");
  }

  console.log("Rollout Audit (/app/*):");
  for (const r of results) {
    const missing = r.findings
      .filter((f) => f.severity === "ERROR")
      .map((f) => f.message.replace(/^Fehlendes Attribut:\s*/, ""))
      .filter((v, i, a) => a.indexOf(v) === i);
    const missText = missing.length ? missing.join(", ") : "-";
    console.log(
      `- ${r.file} | ${r.rolloutStatus} | fehlend: ${missText}`
    );
  }
}

function main() {
  if (!fs.existsSync(APP_PAGES_DIR)) {
    console.error("Directory not found: src/pages/app");
    process.exit(2);
  }
  const files = walk(APP_PAGES_DIR).sort();
  const results = files.map(checkFile);
  print(results);

  const hasErrors = results.some((r) => r.findings.some((f) => f.severity === "ERROR"));
  process.exit(hasErrors ? 1 : 0);
}

main();
