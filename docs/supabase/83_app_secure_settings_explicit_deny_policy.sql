-- VDAN Patch 83
-- Purpose:
--   Resolve linter info 0008_rls_enabled_no_policy for public.app_secure_settings
--   by adding an explicit deny-all policy.
--
-- Context:
--   app_secure_settings is intended to be non-readable/non-writable from anon/authenticated.
--   Access should happen only through controlled SECURITY DEFINER functions.

begin;

alter table public.app_secure_settings enable row level security;

drop policy if exists "app_secure_settings_deny_all" on public.app_secure_settings;
create policy "app_secure_settings_deny_all"
on public.app_secure_settings
for all
to anon, authenticated
using (false)
with check (false);

commit;
