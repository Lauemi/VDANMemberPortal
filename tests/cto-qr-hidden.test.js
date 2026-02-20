import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function text(path) {
  return readFileSync(path, "utf8");
}

test("Migration 12 enthält member_no + feature_flags + portal_bootstrap", () => {
  const s = text("docs/supabase/12_cto_qr_hidden_and_member_no.sql");
  assert.match(s, /add column if not exists member_no text/i);
  assert.match(s, /alter column member_no set not null/i);
  assert.match(s, /create table if not exists public\.feature_flags/i);
  assert.match(s, /values \('work_qr_enabled', false\)/i);
  assert.match(s, /create or replace function public\.portal_bootstrap\(\)/i);
});

test("Member UI rendert QR-Checkin nur bei Feature-Flag", () => {
  const s = text("public/js/work-events-member.js");
  assert.match(s, /featureFlags = \{ work_qr_enabled: false/i);
  assert.match(s, /await loadFeatureFlags\(\)/i);
  assert.match(s, /featureFlags\.work_qr_enabled[\s\S]*\? `<button class="feed-btn feed-btn--ghost"/i);
});

test("Cockpit UI rendert QR-Box nur bei Feature-Flag und zeigt member_no", () => {
  const s = text("public/js/work-events-cockpit.js");
  assert.match(s, /select=id,display_name,email,member_no/i);
  assert.match(s, /Mitgliedsnummer:/i);
  assert.match(s, /featureFlags\.work_qr_enabled[\s\S]*work-qr-box/i);
});
