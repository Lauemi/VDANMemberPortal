import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function text(path) {
  return readFileSync(path, "utf8");
}

function sectionFrom(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  if (start === -1) return "";
  const end = endMarker ? source.indexOf(endMarker, start) : -1;
  return end === -1 ? source.slice(start) : source.slice(start, end);
}

test("PASS: Site-Mode Aufloesung kennt FCP- und VDAN-Hosts explizit", () => {
  const s = text("src/config/site-mode.ts");
  assert.match(s, /vdan-member-portal/);
  assert.match(s, /fishing-club-portal/);
  assert.match(s, /fishing-club-portal\.de/);
  assert.match(s, /vdan-ottenheim\.com/);
  assert.match(s, /return "fcp"/);
  assert.match(s, /return "vdan"/);
});

test("PASS: Layout trennt Branding, Manifest und Footer-Hinweis zwischen FCP und VDAN", () => {
  const s = text("src/layouts/Site.astro");
  assert.match(s, /const manifestPath = isFcpMode \? "\/manifest-fcp\.webmanifest" : "\/manifest-vdan\.webmanifest"/);
  assert.match(s, /const runtimeSiteName = isFcpMode \? "Fishing-Club-Portal" : "VDAN Ottenheim"/);
  assert.match(s, /© Fishing-Club-Portal/);
  assert.match(s, /© VDAN Ottenheim/);
  assert.match(s, /Plattform: Fishing-Club-Portal - Software von Michael Lauenroth/);
  assert.match(s, /Website des VDAN Ottenheim mit angeschlossenem Mitgliederportal/);
});

test("PASS: Startseite trennt FCP-Branch klar vom VDAN-Branch", () => {
  const s = text("src/pages/index.astro");
  const fcpBranch = sectionFrom(s, '<div class="fcp-brand-home">', '  ) : (');
  const vdanBranch = sectionFrom(s, '<section class="home-hero-slider"', '\n</Site>');
  assert.match(fcpBranch, /Fishing-Club-Portal ist die zentrale Plattform/i);
  assert.match(fcpBranch, /fcp-brand-home/);
  assert.doesNotMatch(fcpBranch, /VDAN Ottenheim/i);

  assert.match(vdanBranch, /VDAN Ottenheim/i);
  assert.match(vdanBranch, /Willkommen beim VDAN/i);
  assert.doesNotMatch(vdanBranch, /fcp-brand-home/);
});

test("PASS: Login-Seite zeigt FCP- und VDAN-Texte getrennt", () => {
  const s = text("src/pages/login.astro");
  assert.match(s, /const isFcpMode = resolveSiteMode\(Astro\.url\.hostname, APP\.siteMode\) === "fcp"/);
  assert.match(s, /{!isFcpMode && \(/);
  assert.match(s, /{isFcpMode \? "E-Mail" : "Mitgliedsnummer oder E-Mail"}/);
});
