-- VDAN Template — fix stack depth recursion in role helpers
-- Run this after:
-- 12_cto_qr_hidden_and_member_no.sql
--
-- Problem:
-- - RLS policies on public.user_roles reference helper functions.
-- - Helpers queried public.user_roles under RLS again, which can recurse.
--
-- Fix:
-- - Recreate helper functions as SECURITY DEFINER with fixed search_path.
-- - This avoids recursive policy evaluation when checking roles.

begin;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  );
$$;

create or replace function public.is_admin_or_vorstand()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin','vorstand')
  );
$$;

commit;
