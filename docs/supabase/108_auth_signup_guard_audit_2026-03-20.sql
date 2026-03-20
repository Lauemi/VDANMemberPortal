-- 108 Auth signup guard audit
-- Date: 2026-03-20 
-- Run AFTER:
--   supabase/migrations/20260320140500_auth_signup_guard_invite_or_internal_club_create.sql

select to_regclass('auth.users') as auth_users_table;

select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('email_in_csv_list', 'enforce_auth_signup_guard')
order by p.proname;

select
  event_object_schema,
  event_object_table,
  trigger_name,
  action_timing,
  event_manipulation,
  action_statement
from information_schema.triggers
where event_object_schema = 'auth'
  and event_object_table = 'users'
  and trigger_name = 'trg_auth_signup_guard';

select
  s.setting_key,
  s.setting_value
from public.app_secure_settings s
where s.setting_key = 'club_creation_admin_emails';

select
  case
    when exists (
      select 1
      from information_schema.triggers
      where event_object_schema = 'auth'
        and event_object_table = 'users'
        and trigger_name = 'trg_auth_signup_guard'
    )
    and exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'enforce_auth_signup_guard'
    )
    and exists (
      select 1
      from public.app_secure_settings s
      where s.setting_key = 'club_creation_admin_emails'
        and trim(coalesce(s.setting_value, '')) <> ''
    )
    then 'auth-signup-guard-green'
    else 'auth-signup-guard-review-required'
  end as audit_status;
