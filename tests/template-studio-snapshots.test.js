import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function text(path) {
  return readFileSync(path, "utf8");
}

function json(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function uniqSorted(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function extractMaskPathsFromAstro(astro) {
  const matches = [...astro.matchAll(/<option\s+value="([^"]+)"/g)].map((m) => m[1]);
  return uniqSorted(matches);
}

function extractDefaultLayoutFromJs(js) {
  const blockMatch = js.match(/function createInitialSchema\(\)\s*\{[\s\S]*?slots:\s*\{([\s\S]*?)\}\s*,\s*\};/);
  assert.ok(blockMatch, "createInitialSchema slots block nicht gefunden");
  const block = blockMatch[1];

  const parseSlot = (slot) => {
    const rx = new RegExp(`${slot}:\\s*\\[([\\s\\S]*?)\\]\\.filter\\(Boolean\\)`);
    const m = block.match(rx);
    assert.ok(m, `Slot ${slot} im createInitialSchema nicht gefunden`);
    return [...m[1].matchAll(/buildComponentFromTemplate\('([^']+)'\)/g)].map((x) => x[1]);
  };

  return {
    header: parseSlot("header"),
    main: parseSlot("main"),
    footer: parseSlot("footer"),
  };
}

test("Snapshot: erlaubte Maskenpfade entsprechen Baseline", () => {
  const astro = text("src/pages/app/template-studio/index.astro");
  const baseline = json("tests/baselines/template-studio/mask-paths.snapshot.json");
  const actual = extractMaskPathsFromAstro(astro);
  const expected = uniqSorted(baseline);
  assert.deepEqual(actual, expected);
});

test("Snapshot: Default-Layout im Editor entspricht Baseline", () => {
  const js = text("public/js/template-studio.js");
  const baseline = json("tests/baselines/template-studio/default-layout.snapshot.json");
  const actual = extractDefaultLayoutFromJs(js);
  assert.deepEqual(actual, baseline);
});

