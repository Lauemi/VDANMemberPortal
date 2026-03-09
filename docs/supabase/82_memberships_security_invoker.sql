-- VDAN Patch 82
-- Purpose:
--   Fix Supabase linter error:
--   0010_security_definer_view for public.memberships
--
-- Strategy:
--   Recreate the view as SECURITY INVOKER.

create or replace view public.memberships
with (security_invoker = true) as
select
  id as user_id,
  club_id,
  'active'::text as status,
  coalesce(last_seen_at, last_sign_in_at, last_login_at, first_login_at, created_at, now()) as updated_at
from public.profiles p
where club_id is not null;

