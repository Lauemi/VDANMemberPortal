import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function text(path) {
  return readFileSync(path, "utf8");
}

test("PASS: Static-Web-Konfiguration trennt VDAN-Spezialseiten sauber von FCP", () => {
  const s = text("src/config/static-web-pages.ts");
  assert.match(s, /route: "\/vdan-jugend"/);
  assert.match(s, /route: "\/vereinsshop"/);
  assert.match(s, /route: "\/veranstaltungen"/);
  assert.match(s, /fcp: \{ visible: false, brand: "vdan" \}/);
  assert.match(s, /vdan: \{ visible: true, brand: "vdan" \}/);
});

test("PASS: Layout nutzt die Static-Web-Konfiguration fuer Sichtbarkeit und Seitenflag", () => {
  const s = text("src/layouts/Site.astro");
  assert.match(s, /getStaticWebPageEntry/);
  assert.match(s, /getStaticWebTargetConfig/);
  assert.match(s, /Astro\.response\.status = 404/);
  assert.match(s, /noindex,nofollow/);
  assert.match(s, /Diese Seite ist in diesem Deploy nicht freigegeben/);
  assert.match(s, /data-static-web-route/);
  assert.match(s, /static-web-runtime\.js/);
});

test("PASS: Admin-Board zeigt statische Seiten getrennt fuer FCP und VDAN", () => {
  const astro = text("src/pages/app/admin-panel/index.astro");
  const js = text("public/js/admin-board.js");
  assert.match(astro, /Statische Seiten nach Deploy-Ziel/);
  assert.match(astro, /adminStaticPagesFcpTable/);
  assert.match(astro, /adminStaticPagesVdanTable/);
  assert.match(astro, /App-Masken Brand-Overrides/);
  assert.match(astro, /adminAppMaskBrandTable/);
  assert.match(astro, /Brand- und Env-Hinweise/);
  assert.match(js, /STATIC_WEB_MATRIX_STORAGE_KEY/);
  assert.match(js, /APP_MASK_BRAND_STORAGE_KEY/);
  assert.match(js, /renderStaticWebTables/);
  assert.match(js, /renderAppMaskBrandTable/);
  assert.match(js, /data-static-web-target/);
});

test("PASS: Runtime-Seed enthaelt Default-Werte fuer Static-Web und App-Masken", () => {
  const s = text("supabase/migrations/20260322083000_runtime_config_defaults_seed.sql");
  assert.match(s, /branding\.static_web_matrix/);
  assert.match(s, /branding\.app_mask_matrix/);
  assert.match(s, /'fcp'/);
  assert.match(s, /'vdan'/);
  assert.match(s, /'\/vdan-jugend'/);
  assert.match(s, /'\/app\/mitgliederverwaltung\/'/);
});
