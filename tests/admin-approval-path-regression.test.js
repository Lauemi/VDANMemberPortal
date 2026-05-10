import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function text(path) {
  return readFileSync(path, "utf8");
}

test("PASS: Club-Request-Decision erzwingt Admin-Approval-Gate", () => {
  const s = text("supabase/functions/club-request-decision/index.ts");
  assert.match(s, /if \(!\(await isAdmin\(String\(actor\.id\)\)\)\)/);
  assert.match(s, /forbidden_admin_only/);
  assert.match(s, /if \(txt\(requestRow\.status\) !== "pending"\)/);
});

test("PASS: Approve-Zweig startet Club-Setup und schreibt Approved-Status", () => {
  const s = text("supabase/functions/club-request-decision/index.ts");
  assert.match(s, /functions\/v1\/club-admin-setup/);
  assert.match(s, /status: "approved"/);
  assert.match(s, /approved_club_id: clubId/);
  assert.match(s, /decision_payload:\s*\{/);
  assert.match(s, /action: "approve"/);
});

test("PASS: Club-Admin-Setup laesst nur Admin oder eigenen approved Request zu", () => {
  const s = text("supabase/functions/club-admin-setup/index.ts");
  assert.match(s, /const actorIsAdmin = await isAdmin\(String\(actor\.id\)\)/);
  assert.match(s, /const approvedOwnRequest = actorIsAdmin \? null : await loadApprovedOwnRequest\(requestId, String\(actor\.id\)\)/);
  assert.match(s, /if \(!actorIsAdmin && !approvedOwnRequest\)/);
  assert.match(s, /forbidden_admin_only/);
});
