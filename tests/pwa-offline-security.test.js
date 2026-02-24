import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function text(path) {
  return readFileSync(path, "utf8");
}

test("Service Worker precacht kritische Offline-Routen und Skripte", () => {
  const s = text("public/sw.js");
  assert.match(s, /"\/app\/fangliste\/"/);
  assert.match(s, /"\/offline\/"/);
  assert.match(s, /"\/js\/catchlist\.js"/);
  assert.match(s, /"\/js\/offline-data-store\.js"/);
});

test("Service Worker cached keine Auth/API Requests", () => {
  const s = text("public/sw.js");
  assert.match(s, /request\.headers\.has\("authorization"\)/i);
  assert.match(s, /pathname\.startsWith\("\/auth\/v1\/"\)/i);
  assert.match(s, /pathname\.startsWith\("\/rest\/v1\/"\)/i);
  assert.match(s, /pathname\.startsWith\("\/storage\/v1\/"\)/i);
  assert.match(s, /pathname\.startsWith\("\/functions\/v1\/"\)/i);
});

test("Auth unterstützt Silent Refresh und Logout-Purge", () => {
  const s = text("public/js/member-auth.js");
  assert.match(s, /async function refreshSession\(\)/);
  assert.match(s, /grant_type=refresh_token/);
  assert.match(s, /clearUserData/);
});

test("Guard und Fangliste nutzen Silent Refresh", () => {
  const guard = text("public/js/member-guard.js");
  const catches = text("public/js/catchlist.js");
  assert.match(guard, /VDAN_AUTH\.refreshSession/);
  assert.match(catches, /VDAN_AUTH\?\.refreshSession/);
});

test("Kernmodule nutzen Offline-Queue", () => {
  const feed = text("public/js/home-feed.js");
  const workMember = text("public/js/work-events-member.js");
  const workCockpit = text("public/js/work-events-cockpit.js");
  const myResp = text("public/js/responsibilities-my.js");
  assert.match(feed, /OFFLINE_NS\s*=\s*"home_feed"/);
  assert.match(workMember, /OFFLINE_NS\s*=\s*"work_member"/);
  assert.match(workCockpit, /OFFLINE_NS\s*=\s*"work_cockpit"/);
  assert.match(myResp, /OFFLINE_NS\s*=\s*"my_responsibilities"/);
  assert.match(feed, /flushOfflineQueue/);
  assert.match(workMember, /flushOfflineQueue/);
  assert.match(workCockpit, /flushOfflineQueue/);
  assert.match(myResp, /flushOfflineQueue/);
});

test("Weitere Module nutzen Offline-Queue und Scanner blockt Offline-Verifikation", () => {
  const term = text("public/js/term-events-cockpit.js");
  const notes = text("public/js/notes-demo.js");
  const scanner = text("public/js/member-card-verify.js");
  assert.match(term, /OFFLINE_NS\s*=\s*"term_cockpit"/);
  assert.match(notes, /OFFLINE_NS\s*=\s*"notes"/);
  assert.match(term, /flushOfflineQueue/);
  assert.match(notes, /flushOfflineQueue/);
  assert.match(scanner, /verifyOfflineToken/);
  assert.match(scanner, /__APP_MEMBER_CARD_VERIFY_PUBKEY/);
});

test("Offline-Card-Token Function ist vorhanden", () => {
  const fn = text("supabase/functions/member-card-offline-token/index.ts");
  assert.match(fn, /MEMBER_CARD_SIGNING_PRIVATE_KEY/);
  assert.match(fn, /member-card-offline-verify/);
  assert.match(fn, /ES256/);
});

test("Keine Inline-Skripte in src/pages und src/layouts", () => {
  const files = [
    "src/layouts/Site.astro",
    "src/pages/login.astro",
    "src/pages/app/passwort-aendern/index.astro",
    "src/pages/vdan-jugend.html.astro",
  ];
  for (const file of files) {
    const s = text(file);
    assert.doesNotMatch(s, /<script(?![^>]*\bsrc=)/i);
  }
});

test("Apache Header enthalten CSP und Security Header", () => {
  const s = text("public/.htaccess");
  assert.match(s, /Content-Security-Policy/i);
  assert.match(s, /X-Content-Type-Options/i);
  assert.match(s, /Referrer-Policy/i);
  assert.match(s, /X-Frame-Options/i);
});
