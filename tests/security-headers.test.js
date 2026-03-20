import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function text(path) {
  return readFileSync(path, "utf8");
}

test("PASS: Middleware setzt zentrale Security-Header", () => {
  const s = text("src/middleware.ts");
  assert.match(s, /Content-Security-Policy/);
  assert.match(s, /Referrer-Policy/);
  assert.match(s, /X-Frame-Options/);
  assert.match(s, /X-Content-Type-Options/);
  assert.match(s, /Permissions-Policy/);
  assert.match(s, /Strict-Transport-Security/);
});

test("PASS: CSP-Basis deckt Plattformquellen und Schutzdirektiven ab", () => {
  const s = text("src/middleware.ts");
  assert.match(s, /default-src 'self'/);
  assert.match(s, /frame-ancestors 'self'/);
  assert.match(s, /object-src 'none'/);
  assert.match(s, /script-src 'self' 'unsafe-inline'/);
  assert.match(s, /connect-src/);
  assert.match(s, /api\.open-meteo\.com/);
  assert.match(s, /challenges\.cloudflare\.com/);
});
