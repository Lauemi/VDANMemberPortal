-- VDAN Template — Preflight checks for CTO scope
-- Run as SQL snippets in Supabase SQL editor.

-- 1) Feature flag defaults (QR hidden)
select key, enabled
from public.feature_flags
where key = 'work_qr_enabled';

-- 2) Demo users roles + member_no presence
select p.id, p.email, p.member_no, ur.role
from public.profiles p
left join public.user_roles ur on ur.user_id = p.id
where p.email in ('demo_vorstand@example.org', 'demo_member@example.org', 'demo_admin@example.org')
order by p.email, ur.role;

-- 3) Required RPC/function presence
select proname
from pg_proc
where proname in (
  'portal_bootstrap',
  'work_register',
  'work_checkin',
  'work_checkout',
  'work_approve',
  'work_reject',
  'work_event_create',
  'work_event_publish',
  'work_participation_admin_update',
  'work_event_token_rotate',
  'is_board_or_admin'
)
order by proname;

-- 4) Profiles constraints/index-related visibility
select column_name, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'profiles'
  and column_name in ('member_no', 'club_id')
order by column_name;

-- 5) Member scope sanity check (replace UID):
-- select * from public.work_participations where auth_uid = '<DEMO_MEMBER_UID>' order by created_at desc;
