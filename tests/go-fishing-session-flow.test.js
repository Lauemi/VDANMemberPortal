import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function text(path) {
  return readFileSync(path, "utf8");
}

test("GoFishing Dialog hat Start-Button und no-draft Guard-Flag", () => {
  const site = text("src/layouts/Site.astro");
  assert.match(site, /id="goFishingDialog"[\s\S]*data-guard-no-draft="1"/i);
  assert.match(site, /id="goFishingStartBtn"[^>]*>Start</i);
});

test("Dialog Guard umgeht Draft-Sheet für GoFishing", () => {
  const guard = text("public/js/dialog-ux-guard.js");
  assert.match(guard, /function shouldBypassDraftGuard\(dialog\)/);
  assert.match(guard, /dialog\.dataset\.guardNoDraft === "1" \|\| dialog\.id === "goFishingDialog"/);
});

test("GoFishing Session startet nur per Start-Button und erfordert Gewässer", () => {
  const s = text("public/js/go-fishing.js");
  assert.match(s, /function startSession\(\)/);
  assert.match(s, /validateWaterSelectionFromState\(\)/);
  assert.match(s, /if \(waterError\)\s*\{\s*setMsg\(waterError\)/);
  assert.match(s, /sessionState\.active = true/);
  assert.match(s, /document\.getElementById\("goFishingStartBtn"\)\?\.addEventListener\("click", startSession\)/);
});

test("GoFishing hat automatisches Mitternachts-Ende", () => {
  const s = text("public/js/go-fishing.js");
  assert.match(s, /function scheduleMidnightAutoEnd\(\)/);
  assert.match(s, /cutoff\.setHours\(24, 0, 0, 0\)/);
  assert.match(s, /endSession\(\{ auto: true, endedAtIso:/);
});

