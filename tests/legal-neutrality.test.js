import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function text(path) {
  return readFileSync(path, "utf8");
}

test("PASS: FCP Datenschutz-Markdown ist mandantenneutral und plattformbezogen", () => {
  const s = text("docs/legal/fcp-privacy.md");
  assert.match(s, /Fishing-Club-Portal/i);
  assert.match(s, /Michael Lauenroth/i);
  assert.match(s, /jeweilige[rn]? Verein/i);
  assert.match(s, /Plattformbetreiber/i);
  assert.doesNotMatch(s, /VDAN/i);
  assert.doesNotMatch(s, /Ottenheim/i);
  assert.doesNotMatch(s, /freenet\.de/i);
});

test("PASS: FCP Nutzungsbedingungen-Markdown ist mandantenneutral und plattformbezogen", () => {
  const s = text("docs/legal/fcp-terms.md");
  assert.match(s, /Fishing-Club-Portal/i);
  assert.match(s, /Michael Lauenroth/i);
  assert.match(s, /jeweilige[rn]? Verein/i);
  assert.match(s, /vereinsunabhängige Softwareplattform/i);
  assert.doesNotMatch(s, /VDAN/i);
  assert.doesNotMatch(s, /Ottenheim/i);
  assert.doesNotMatch(s, /freenet\.de/i);
});

test("PASS: FCP technische Rahmendaten dokumentieren Plattform- und Mandantenrolle", () => {
  const s = text("docs/legal/fcp_technische_rahmendaten.md");
  assert.match(s, /Multi-Tenant-Softwareplattform/i);
  assert.match(s, /Plattformbetreiber/i);
  assert.match(s, /Jeweiliger Verein/i);
  assert.match(s, /mandantenspezifisch/i);
});

test("PASS: VDAN Rechtstexte bleiben vereinsbezogen getrennt vorhanden", () => {
  const privacy = text("docs/legal/vdan-privacy.md");
  const terms = text("docs/legal/vdan-terms.md");
  assert.match(privacy, /VDAN|Ottenheim|freenet\.de/i);
  assert.match(terms, /VDAN|Ottenheim/i);
});
