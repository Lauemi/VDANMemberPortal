-- VDAN/FCP - Rollback helper for 90_auth_rollout_stabilization.sql
-- Date: 2026-03-09
-- Goal:
--   Disable rollout switches and remove helper functions without deleting backup/audit data.

begin;

-- Keep historical batch tables for audit/recovery.
-- Only disable active rollout switches.
insert into public.app_secure_settings (setting_key, setting_value)
values
  ('auth_email_change_enabled', 'false'),
  ('auth_rollout_mode', 'safe')
on conflict (setting_key) do update
set setting_value = excluded.setting_value,
    updated_at = now();

revoke execute on function public.admin_auth_email_repair_preview(text, text[], integer) from authenticated;
revoke execute on function public.admin_auth_email_repair_apply(text, text[], integer, boolean, boolean, text) from authenticated;
revoke execute on function public.admin_auth_email_repair_restore(uuid, boolean, text) from authenticated;

drop function if exists public.admin_auth_email_repair_restore(uuid, boolean, text);
drop function if exists public.admin_auth_email_repair_apply(text, text[], integer, boolean, boolean, text);
drop function if exists public.admin_auth_email_repair_preview(text, text[], integer);
drop function if exists public.member_no_login_email(text);

commit;
