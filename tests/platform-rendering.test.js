import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function text(path) {
  return readFileSync(path, "utf8");
}

function extractFcpBranch(source) {
  const start = source.indexOf("{isFcp ? (");
  const split = source.indexOf(") : (", start);
  if (start === -1 || split === -1) return "";
  return source.slice(start, split);
}

test("PASS: Datenschutzseite rendert im FCP-Zweig neutralen Plattformtext", () => {
  const s = text("src/pages/datenschutz.html.astro");
  const fcp = extractFcpBranch(s);
  assert.match(fcp, /Datenschutzhinweise – Fishing-Club-Portal/i);
  assert.match(fcp, /Michael Lauenroth/i);
  assert.match(fcp, /jeweilige[rn]? Verein/i);
  assert.doesNotMatch(fcp, /VDAN/i);
  assert.doesNotMatch(fcp, /Ottenheim/i);
  assert.doesNotMatch(fcp, /freenet\.de/i);
});

test("PASS: Nutzungsbedingungen rendert im FCP-Zweig neutralen Plattformtext", () => {
  const s = text("src/pages/nutzungsbedingungen.html.astro");
  const fcp = extractFcpBranch(s);
  assert.match(fcp, /Nutzungsbedingungen – Fishing-Club-Portal/i);
  assert.match(fcp, /Michael Lauenroth/i);
  assert.match(fcp, /vereinsunabhängige Softwareplattform/i);
  assert.doesNotMatch(fcp, /VDAN/i);
  assert.doesNotMatch(fcp, /Ottenheim/i);
  assert.doesNotMatch(fcp, /freenet\.de/i);
});
