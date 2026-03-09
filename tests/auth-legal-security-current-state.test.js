import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function text(path) {
  return readFileSync(path, "utf8");
}

test("Nutzungsbedingungen enthalten Auth-Login-Identifier-Hinweis", () => {
  const s = text("src/pages/nutzungsbedingungen.html.astro");
  assert.match(s, /technische[nr]* login-identifier ist.*e-mail-adresse/i);
  assert.match(s, /mitgliedsnummern.*kürzel.*nicht zwingend.*direkter login-name/i);
});

test("Datenschutz enthält Hinweis auf Auth-E-Mail als Login-Basis", () => {
  const s = text("src/pages/datenschutz.html.astro");
  assert.match(s, /auth-system.*e-mail-adresse maßgeblich/i);
  assert.match(s, /mitgliedsnummern\/kürzel/i);
  assert.match(s, /nicht zwingend der primäre login-identifier/i);
});

test("Security-DSGVO-Checklist enthält Auth-Source-of-Truth Check", () => {
  const s = text("docs/security-dsgvo-checklist.md");
  assert.match(s, /Auth-Source-of-Truth festgelegt/i);
  assert.match(s, /Login-Identifier ist Auth-E-Mail/i);
});
