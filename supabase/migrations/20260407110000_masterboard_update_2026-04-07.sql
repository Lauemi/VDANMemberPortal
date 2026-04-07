begin;

-- =========================================================
-- MASTERBOARD UPDATE – 2026-04-07
-- =========================================================
-- Erfasst alle board-relevanten Änderungen aus der Session 07.04.2026:
--
-- 1. onboarding-process (neu): get_onboarding_process_state gehärtet
--    - invite_state: echte SHA-256-Validierung gegen app_secure_settings
--    - consent_state: versionshartes Prüfen über legal_acceptance_events
--    - actor.first_name ergänzt
--    - next_allowed_step_id echter Lookahead
--    - current_user_has_role_in_club als Migration nachgezogen
--
-- 2. members-ops: RLS auf club_members korrekt gesetzt
--    - fehlerhafte hardcodierte UUID-Policy ersetzt
--    - SELECT nur für admin/vorstand, INSERT/UPDATE/DELETE nur service_role
--
-- 3. roles: current_user_has_role_in_club in Migrations nachgezogen
--
-- 4. backstage-clean: neue Werkzeuge
--    - club-onboarding-status Edge Function live
--    - audit-panel-status.mjs automatisierbarer Panel-Audit
--    - ADM_clubSettings.json club_settings_onboarding_snapshot → live
--
-- 5. onboarding-state (club_onboarding_snapshot): 42702 Ambiguity Fix
-- =========================================================

insert into public.system_board_nodes (
  node_id, title, lane, status, launch_class, risk_level,
  progress_visible, progress_invisible, gaps, decisions_open, refs, last_verified_at
)
values (
  'onboarding-process',
  'Onboarding-Prozesssteuerung',
  'system',
  'teilweise',
  'L2',
  'mittel',
  '["get_onboarding_process_state RPC im Repo als Migration vorhanden"]'::jsonb,
  '["invite_state: SHA-256-Validierung gegen app_secure_settings (mirrors club-invite-verify)", "consent_state: versionshartes Prüfen über legal_acceptance_events + active legal_documents", "actor.first_name ergänzt", "next_allowed_step_id: echter Lookahead statt Placeholder", "current_user_has_role_in_club: fehlende Migration nachgezogen"]'::jsonb,
  '["Migration 20260407103200 muss gegen echte DB geprüft werden (war bereits produktiv vorhanden laut RPC_Functions.json)", "invite_state USED/EXPIRED/REVOKED im Client-Flow noch nicht vollständig sichtbar getestet"]'::jsonb,
  '["Wann wird get_onboarding_process_state der führende Step-State-Pfad für den Onboarding-Renderer?"]'::jsonb,
  '["supabase/migrations/20260407103200_harden_onboarding_process_state.sql", "supabase/migrations/20260407103100_fix_current_user_has_role_in_club.sql", "docs/contracts/VDAN_GET_ONBOARDING_PROCESS_STATE_SPEC.md", "docs/contracts/VDAN_GET_ONBOARDING_PROCESS_STATE_REVIEW_CHECKLIST.md", "docs/masks/templates/VDAN_get_onboarding_process_state.sql"]'::jsonb,
  '2026-04-07'
)
on conflict (node_id) do update
  set status = excluded.status,
      launch_class = excluded.launch_class,
      risk_level = excluded.risk_level,
      progress_visible = excluded.progress_visible,
      progress_invisible = excluded.progress_invisible,
      gaps = excluded.gaps,
      decisions_open = excluded.decisions_open,
      refs = excluded.refs,
      last_verified_at = excluded.last_verified_at;

-- members-ops: RLS club_members gesetzt
update public.system_board_nodes
set
  progress_invisible = progress_invisible || '["RLS auf public.club_members korrekt gesetzt: SELECT admin/vorstand, INSERT/UPDATE/DELETE nur service_role; hardcodierte UUID-Policy entfernt"]'::jsonb,
  refs = refs || '["supabase/migrations/20260407_club_members_rls_fix.sql"]'::jsonb,
  last_verified_at = '2026-04-07'
where node_id = 'members-ops';

-- multi: club_members RLS hinzugefügt
update public.system_board_nodes
set
  progress_invisible = progress_invisible || '["club_members RLS nachgehärtet: fehlerhafte UUID-Policy durch rollenbasierte Policy ersetzt"]'::jsonb,
  last_verified_at = '2026-04-07'
where node_id = 'multi';

-- roles: current_user_has_role_in_club in Migrations nachgezogen
update public.system_board_nodes
set
  progress_invisible = progress_invisible || '["current_user_has_role_in_club(p_club_id uuid, p_roles text[]) als Migration nachgezogen – war in DB vorhanden, fehlte nur im Repo"]'::jsonb,
  gaps = (
    select jsonb_agg(g)
    from jsonb_array_elements(gaps) as g
    where g::text not like '%current_user_has_role_in_club%'
  ),
  refs = refs || '["supabase/migrations/20260407103100_fix_current_user_has_role_in_club.sql"]'::jsonb,
  last_verified_at = '2026-04-07'
where node_id = 'roles';

-- backstage-clean: neue operative Werkzeuge
update public.system_board_nodes
set
  progress_visible = progress_visible || '["club_settings_onboarding_snapshot Panel ist live (club-onboarding-status Edge Function)"]'::jsonb,
  progress_invisible = progress_invisible || '["audit-panel-status.mjs: automatisierbarer Panel-Status-Audit (15/15 PASS)", "club-onboarding-status Edge Function deployed (--no-verify-jwt, User-JWT für RPC-Guard)", "club_onboarding_snapshot 42702-Ambiguity-Fix: cos-Alias in state_src CTE"]'::jsonb,
  gaps = (
    select jsonb_agg(g)
    from jsonb_array_elements(gaps) as g
    where g::text not like '%club-onboarding-status%'
  ),
  refs = refs || '["supabase/functions/club-onboarding-status/index.ts", "scripts/audit-panel-status.mjs", "supabase/migrations/20260407103000_fix_club_onboarding_snapshot_ambiguous_club_id.sql"]'::jsonb,
  last_verified_at = '2026-04-07'
where node_id = 'backstage-clean';

-- auth-profiles: Consent-Versionscheck gehärtet
update public.system_board_nodes
set
  progress_invisible = progress_invisible || '["Consent-State in get_onboarding_process_state gegen aktive Policy-Versionen gehärtet (legal_acceptance_events + legal_documents.is_active)"]'::jsonb,
  last_verified_at = '2026-04-07'
where node_id = 'auth-profiles';

commit;
