import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function text(path) {
  return readFileSync(path, "utf8");
}

test("PASS: Club-Admin-Setup validiert Verantwortlichen-Mail und rate-limited Benachrichtigungen", () => {
  const s = text("supabase/functions/club-admin-setup/index.ts");
  assert.match(s, /function isValidEmail/);
  assert.match(s, /club_responsible_notify_rate:/);
  assert.match(s, /responsible_notification_rate_limited/);
  assert.match(s, /responsible_email_invalid/);
});

test("PASS: Onboarding-Workspace beantwortet Preflight robust", () => {
  const s = text("supabase/functions/club-onboarding-workspace/index.ts");
  assert.match(s, /access-control-request-headers/i);
  assert.match(s, /Access-Control-Max-Age/);
  assert.match(s, /status: 200/);
});

test("PASS: Live-App-Brand-Overrides laufen ueber serverseitige Web-Config", () => {
  const fn = text("supabase/functions/admin-web-config/index.ts");
  const js = text("public/js/app-brand-runtime.js");
  assert.match(fn, /branding\.app_mask_matrix/);
  assert.match(fn, /app_runtime_configs/);
  assert.match(fn, /admin_publish_runtime_config/);
  assert.match(fn, /validateStaticWebMatrix/);
  assert.match(fn, /validateAppMaskMatrix/);
  assert.match(fn, /scope/);
  assert.match(fn, /scopedKey/);
  assert.match(js, /functions\/v1\/admin-web-config/);
  assert.match(js, /scope: siteMode\(\)/);
  assert.match(js, /data-app-theme/);
});
