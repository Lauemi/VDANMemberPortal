-- 104 Onboarding Foundation - Audit SQL
-- Run after:
--   supabase/migrations/20260317103000_onboarding_foundation.sql

select to_regclass('public.club_onboarding_state') as club_onboarding_state;
select to_regclass('public.club_onboarding_audit') as club_onboarding_audit;
select to_regclass('public.club_billing_subscriptions') as club_billing_subscriptions;
select to_regclass('public.club_billing_webhook_events') as club_billing_webhook_events;

select schemaname, tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'club_onboarding_state',
    'club_onboarding_audit',
    'club_billing_subscriptions',
    'club_billing_webhook_events'
  )
order by tablename, policyname;

select proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and proname in (
    'ensure_club_onboarding_state',
    'club_onboarding_requirements',
    'club_onboarding_snapshot',
    'upsert_club_onboarding_progress',
    'set_club_billing_state'
  )
order by proname;
