import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

function text(path) {
  return readFileSync(path, "utf8");
}

test("PASS: Legal Markdown Quellen fuer Datenschutz und Nutzungsbedingungen sind versioniert vorhanden", () => {
  assert.equal(existsSync("docs/legal/fcp-privacy.md"), true);
  assert.equal(existsSync("docs/legal/fcp-terms.md"), true);
  assert.equal(existsSync("docs/legal/vdan-privacy.md"), true);
  assert.equal(existsSync("docs/legal/vdan-terms.md"), true);
  assert.equal(existsSync("docs/legal/fcp_technische_rahmendaten.md"), true);
});

test("PASS: portal-quick kritische Modulzeilen nutzen keine unsicheren innerHTML-Pfade mehr", () => {
  const s = text("public/js/portal-quick.js");
  assert.doesNotMatch(s, /section\.innerHTML\s*=\s*`<h3 class="portal-quick-group__title">/);
  assert.doesNotMatch(s, /row\.innerHTML\s*=\s*`[\s\S]*portal-quick-row__title/);
  assert.match(s, /document\.createElement\("h3"\)/);
  assert.match(s, /document\.createElement\("article"\)/);
  assert.match(s, /title\.textContent = mod\.label/);
});
