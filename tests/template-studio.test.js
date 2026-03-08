import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function text(path) {
  return readFileSync(path, "utf8");
}

test("Template Studio hat die erforderlichen Bereiche und IDs", () => {
  const astro = text("src/pages/app/template-studio/index.astro");
  assert.match(astro, /data-template-section="standard-template"/);
  assert.match(astro, /data-template-section="mask-editor"/);
  assert.match(astro, /id="templateMaskPath"/);
  assert.match(astro, /id="templateEditorMaskPath"/);
  assert.match(astro, /id="templateLiveFrame"/);
  assert.match(astro, /id="templatePickBtn"/);
  assert.match(astro, /id="templatePickLines"/);
  assert.match(astro, /id="editorCanvas"/);
  assert.match(astro, /data-slot-drop="header"/);
  assert.match(astro, /data-slot-drop="main"/);
  assert.match(astro, /data-slot-drop="footer"/);
  assert.match(astro, /id="editorSchemaJson"/);
});

test("Template Studio JS enthält Picker + Editor Kernfunktionen", () => {
  const js = text("public/js/template-studio.js");
  assert.match(js, /function startPicking\(\)/);
  assert.match(js, /function stopPicking\(\)/);
  assert.match(js, /function buildPickLines\(target, title, selector, area\)/);
  assert.match(js, /COMPONENT_ID:/);
  assert.match(js, /SLOT_PATH:/);
  assert.match(js, /NODE_PATH:/);
  assert.match(js, /function createInitialSchema\(\)/);
  assert.match(js, /function initEditorDnD\(\)/);
  assert.match(js, /function moveComponent\(slotFrom, id, slotTo\)/);
  assert.match(js, /function renderEditorJson\(\)/);
});

test("Template Studio kann Editor-JSON laden/kopieren", () => {
  const js = text("public/js/template-studio.js");
  assert.match(js, /#editorCopyJson/);
  assert.match(js, /#editorLoadJson/);
  assert.match(js, /window\.prompt\('Masken-JSON einfügen'\)/);
  assert.match(js, /JSON\.parse\(incoming\)/);
});

