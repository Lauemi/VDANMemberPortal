import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PAGES_DIR = path.join(ROOT, "src", "pages");
const OUT_FILE = path.join(ROOT, "docs", "page-component-index.md");

function walk(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (entry.isFile() && entry.name.endsWith(".astro")) {
      out.push(full);
    }
  }
  return out;
}

function toRoute(relPath) {
  let route = `/${relPath.replaceAll(path.sep, "/")}`;
  route = route.replace(/\.astro$/, "");
  route = route.replace(/\.html$/, "");
  if (route.endsWith("/index")) route = route.slice(0, -"/index".length) || "/";
  return route;
}

function pageKind(route) {
  return route.startsWith("/app/") || route === "/app" ? "PORTAL" : "WEB";
}

function attr(tag, name) {
  const re = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i");
  const m = tag.match(re);
  return m ? (m[2] ?? m[3] ?? "").trim() : "";
}

function parseComponents(source) {
  const components = [];
  const re = /<([a-zA-Z][\w:-]*)\b[^>]*\bdata-studio-component-id\s*=\s*("([^"]*)"|'([^']*)')[^>]*>/gms;
  let m;
  while ((m = re.exec(source)) !== null) {
    const tagRaw = m[0];
    components.push({
      tag: m[1].toLowerCase(),
      id: (m[3] ?? m[4] ?? "").trim(),
      type: attr(tagRaw, "data-studio-component-type") || "-",
      slot: attr(tagRaw, "data-studio-slot") || "-",
      tableId: attr(tagRaw, "data-table-id") || "-",
      fcpComponent: attr(tagRaw, "data-fcp-component") || "-",
    });
  }
  return components;
}

function render(pages) {
  const now = new Date().toISOString();
  const lines = [];
  lines.push("# Seiten- und Komponentenindex");
  lines.push("");
  lines.push(`Generiert: \`${now}\``);
  lines.push("");
  lines.push("Quelle: `src/pages/**/*.astro`");
  lines.push("");
  lines.push("## Übersicht");
  lines.push("");
  lines.push("| Typ | Route | Datei | Komponenten |");
  lines.push("|---|---|---|---:|");
  for (const page of pages) {
    lines.push(`| ${page.kind} | \`${page.route}\` | \`${page.file}\` | ${page.components.length} |`);
  }
  lines.push("");

  lines.push("## Details je Seite");
  lines.push("");
  for (const page of pages) {
    lines.push(`### ${page.route}`);
    lines.push("");
    lines.push(`- Typ: \`${page.kind}\``);
    lines.push(`- Datei: \`${page.file}\``);
    lines.push(`- Komponenten mit ID: **${page.components.length}**`);
    lines.push("");
    if (!page.components.length) {
      lines.push("_Keine `data-studio-component-id` in dieser Seite gefunden._");
      lines.push("");
      continue;
    }
    lines.push("| ID | Tag | Type | Slot | Table-ID | FCP-Komponente |");
    lines.push("|---|---|---|---|---|---|");
    for (const c of page.components) {
      lines.push(`| \`${c.id}\` | \`${c.tag}\` | \`${c.type}\` | \`${c.slot}\` | \`${c.tableId}\` | \`${c.fcpComponent}\` |`);
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

const files = walk(PAGES_DIR)
  .map((abs) => path.relative(PAGES_DIR, abs))
  .sort((a, b) => a.localeCompare(b, "de"));

const pages = files.map((rel) => {
  const abs = path.join(PAGES_DIR, rel);
  const src = fs.readFileSync(abs, "utf8");
  const route = toRoute(rel);
  return {
    route,
    file: path.join("src/pages", rel).replaceAll(path.sep, "/"),
    kind: pageKind(route),
    components: parseComponents(src),
  };
});

fs.writeFileSync(OUT_FILE, render(pages), "utf8");
console.log(`Wrote ${path.relative(ROOT, OUT_FILE)} with ${pages.length} pages.`);
