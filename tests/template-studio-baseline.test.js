import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function text(path) {
  return readFileSync(path, "utf8");
}

function json(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

test("Template Studio erfüllt den Baseline-Vertrag (Komponententypen, Slots, Pick-Felder)", () => {
  const contract = json("tests/baselines/template-studio.contract.json");
  const js = text("public/js/template-studio.js");
  const astro = text("src/pages/app/template-studio/index.astro");

  for (const type of contract.componentTypes) {
    const rx = new RegExp(`type:\\s*['"]${type}['"]`);
    assert.match(js, rx, `Komponententyp fehlt: ${type}`);
  }

  for (const slot of contract.slots) {
    const slotRx = new RegExp(`data-slot-drop="${slot}"`);
    assert.match(astro, slotRx, `Slot fehlt im Markup: ${slot}`);
    const schemaRx = new RegExp(`${slot}:`);
    assert.match(js, schemaRx, `Slot fehlt im Schema: ${slot}`);
  }

  for (const field of contract.pickFields) {
    const fieldRx = new RegExp(`${field}:`);
    assert.match(js, fieldRx, `Pick-Feld fehlt: ${field}`);
  }
});
