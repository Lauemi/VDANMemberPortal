import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const OUT_MD = path.join(ROOT, "docs", "role-page-matrix.md");
const OUT_CSV = path.join(ROOT, "docs", "role-page-matrix.csv");

const ROLE_KEYS = ["guest", "member", "manager", "admin", "superadmin"];

const PAGE_INDEX = [
  { route: "/app/", kind: "PORTAL", label: "App Start" },
  { route: "/app/admin-panel/", kind: "PORTAL", label: "Admin Board" },
  { route: "/app/arbeitseinsaetze/", kind: "PORTAL", label: "Arbeitseinsätze" },
  { route: "/app/arbeitseinsaetze/cockpit", kind: "PORTAL", label: "Arbeitseinsätze Cockpit" },
  { route: "/app/ausweis/", kind: "PORTAL", label: "Ausweis" },
  { route: "/app/ausweis/verifizieren", kind: "PORTAL", label: "Ausweis Verifizieren" },
  { route: "/app/bewerbungen/", kind: "PORTAL", label: "Bewerbungen" },
  { route: "/app/component-library/", kind: "PORTAL", label: "Component Library" },
  { route: "/app/dokumente/", kind: "PORTAL", label: "Dokumente" },
  { route: "/app/einstellungen/", kind: "PORTAL", label: "Einstellungen" },
  { route: "/app/fangliste/", kind: "PORTAL", label: "Fangliste" },
  { route: "/app/fangliste/cockpit", kind: "PORTAL", label: "Fangliste Cockpit" },
  { route: "/app/gewaesserkarte/", kind: "PORTAL", label: "Gewässerkarte" },
  { route: "/app/mitglieder/", kind: "PORTAL", label: "Mitglieder" },
  { route: "/app/mitgliederverwaltung/", kind: "PORTAL", label: "Mitgliederverwaltung" },
  { route: "/app/notes/", kind: "PORTAL", label: "Notes" },
  { route: "/app/passwort-aendern/", kind: "PORTAL", label: "Passwort ändern" },
  { route: "/app/sitzungen/", kind: "PORTAL", label: "Sitzungen" },
  { route: "/app/template-studio/", kind: "PORTAL", label: "Template Studio" },
  { route: "/app/termine/cockpit", kind: "PORTAL", label: "Termine Cockpit" },
  { route: "/app/ui-neumorph-demo/", kind: "PORTAL", label: "UI Neumorph Demo" },
  { route: "/app/vereine/", kind: "PORTAL", label: "Vereine" },
  { route: "/app/zustaendigkeiten/", kind: "PORTAL", label: "Zuständigkeiten" },
  { route: "/", kind: "WEB", label: "Startseite" },
  { route: "/anglerheim-ottenheim", kind: "WEB", label: "Anglerheim Ottenheim" },
  { route: "/datenschutz", kind: "WEB", label: "Datenschutz" },
  { route: "/docs", kind: "WEB", label: "Docs" },
  { route: "/downloads", kind: "WEB", label: "Downloads" },
  { route: "/fischereipruefung", kind: "WEB", label: "Fischereiprüfung" },
  { route: "/impressum", kind: "WEB", label: "Impressum" },
  { route: "/kontakt", kind: "WEB", label: "Kontakt" },
  { route: "/login", kind: "WEB", label: "Login" },
  { route: "/mitglied-werden", kind: "WEB", label: "Mitglied werden" },
  { route: "/nutzungsbedingungen", kind: "WEB", label: "Nutzungsbedingungen" },
  { route: "/offline", kind: "WEB", label: "Offline" },
  { route: "/passwort-vergessen", kind: "WEB", label: "Passwort vergessen" },
  { route: "/registrieren", kind: "WEB", label: "Registrieren" },
  { route: "/termine", kind: "WEB", label: "Termine" },
  { route: "/vdan-jugend", kind: "WEB", label: "VDAN Jugend" },
  { route: "/veranstaltungen", kind: "WEB", label: "Veranstaltungen" },
  { route: "/vereinsshop", kind: "WEB", label: "Vereinsshop" },
];

function roleMatrixDefaultFor(route, kind) {
  const r = String(route || "");
  if (kind === "WEB") return { guest: true, member: true, manager: true, admin: true, superadmin: true };
  if (r === "/app/") return { guest: false, member: true, manager: true, admin: true, superadmin: true };
  if (/\/app\/(component-library|template-studio|admin-panel|vereine)\//.test(r)) return { guest: false, member: false, manager: false, admin: false, superadmin: true };
  if (/\/app\/(mitglieder|dokumente|fangliste\/cockpit)/.test(r)) return { guest: false, member: false, manager: true, admin: true, superadmin: true };
  if (/\/cockpit/.test(r)) return { guest: false, member: false, manager: true, admin: true, superadmin: true };
  return { guest: false, member: true, manager: true, admin: true, superadmin: true };
}

function mark(v) {
  return v ? "x" : "";
}

function csvCell(v) {
  const s = String(v ?? "");
  return `"${s.replaceAll('"', '""')}"`;
}

async function main() {
  const now = new Date().toISOString();
  const rows = PAGE_INDEX.map((page) => {
    const role = roleMatrixDefaultFor(page.route, page.kind);
    return { ...page, ...role };
  });

  const summary = {
    total: rows.length,
    portal: rows.filter((r) => r.kind === "PORTAL").length,
    web: rows.filter((r) => r.kind === "WEB").length,
  };

  const md = [
    "# Rollen-/Seiten-Matrix",
    "",
    `Generiert: \`${now}\``,
    "",
    "Quelle: `PAGE_INDEX + roleMatrixDefaultFor` (gleiche Datenbasis wie Admin-Board)",
    "",
    "## Übersicht",
    "",
    `- Seiten gesamt: **${summary.total}**`,
    `- Portal-Seiten: **${summary.portal}**`,
    `- Web-Seiten: **${summary.web}**`,
    "",
    "## Matrix",
    "",
    "| Label | Typ | Route | Guest | Member | Manager | Admin | Superadmin |",
    "|---|---|---|:---:|:---:|:---:|:---:|:---:|",
    ...rows.map((r) => `| ${r.label} | ${r.kind} | \`${r.route}\` | ${mark(r.guest)} | ${mark(r.member)} | ${mark(r.manager)} | ${mark(r.admin)} | ${mark(r.superadmin)} |`),
    "",
    "## Hinweise",
    "",
    "- Diese Matrix sind die **Default-Regeln**.",
    "- Laufzeit-Änderungen aus dem Admin-Board werden in `localStorage` gespeichert.",
    "- Für Board-Report/Review ist diese Datei der stabile Exportstand.",
    "",
  ].join("\n");

  const csvHeader = ["label", "kind", "route", ...ROLE_KEYS];
  const csvRows = [
    csvHeader.map(csvCell).join(","),
    ...rows.map((r) => [r.label, r.kind, r.route, r.guest, r.member, r.manager, r.admin, r.superadmin].map(csvCell).join(",")),
  ];

  await fs.writeFile(OUT_MD, md, "utf8");
  await fs.writeFile(OUT_CSV, csvRows.join("\n") + "\n", "utf8");
  process.stdout.write(`Wrote ${path.relative(ROOT, OUT_MD)} and ${path.relative(ROOT, OUT_CSV)}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
