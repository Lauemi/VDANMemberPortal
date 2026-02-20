import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function sql(path) {
  return readFileSync(path, "utf8");
}

test("CTO-Alignment Migration ist vorhanden und mappt board->vorstand/admin", () => {
  const s = sql("docs/supabase/11_cto_alignment_keep_logic.sql");
  assert.match(s, /create or replace function public\.is_board_or_admin\(\)/i);
  assert.match(s, /select public\.is_admin_or_vorstand\(\);/i);
});

test("Participation-Guard ist für SQL-Editor/Service-Context gehärtet", () => {
  const s = sql("docs/supabase/11_cto_alignment_keep_logic.sql");
  assert.match(s, /create or replace function public\.enforce_work_participation_update\(\)/i);
  assert.match(s, /if auth\.uid\(\) is null then\s+return new;/i);
});

test("work_reject RPC ist im Alignment enthalten und ausführbar für authenticated", () => {
  const s = sql("docs/supabase/11_cto_alignment_keep_logic.sql");
  assert.match(s, /create or replace function public\.work_reject\(/i);
  assert.match(s, /status = 'rejected'/i);
  assert.match(s, /grant execute on function public\.work_reject\(uuid, text\) to authenticated;/i);
});

test("Projektlogik bleibt erhalten: work_register setzt checked_in plus checkin_at", () => {
  const s = sql("docs/supabase/10_work_time_and_audit.sql");
  assert.match(s, /create or replace function public\.work_register\(/i);
  assert.match(s, /values \(v_event\.id, auth\.uid\(\), 'checked_in', now\(\)\)/i);
  assert.match(s, /checkin_at = coalesce\(public\.work_participations\.checkin_at, now\(\)\)/i);
});

test("Rollenbasis im Projekt bleibt user_roles mit vorstand/admin", () => {
  const s = sql("docs/supabase/02_feed_posts.sql");
  assert.match(s, /role in \('member','admin','vorstand'\)/i);
  assert.match(s, /create or replace function public\.is_admin_or_vorstand\(\)/i);
});
