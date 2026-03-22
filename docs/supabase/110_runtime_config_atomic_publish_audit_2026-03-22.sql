-- 110 Runtime config atomic publish audit
-- Date: 2026-03-22
-- Run AFTER:
--   supabase/migrations/20260322093000_runtime_config_atomic_publish.sql
--
-- Purpose:
-- - Verify atomic publish RPC exists and is hardened
-- - Verify function privileges are revoked from public / anon / authenticated
-- - Verify publish side effects land in runtime config, release log and audit log
--
-- Usage:
-- - Read-only audit queries for Supabase SQL editor
-- - Each query can be run independently

-- -------------------------------------------------------------------
-- A) RPC existence and signature
-- -------------------------------------------------------------------
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'admin_publish_runtime_config';

-- -------------------------------------------------------------------
-- B) Function definition sanity
-- -------------------------------------------------------------------
select
  p.proname as function_name,
  p.prosecdef as security_definer,
  l.lanname as language_name,
  case when pg_get_functiondef(p.oid) ilike '%set search_path = public%' then true else false end as search_path_pinned,
  case when pg_get_functiondef(p.oid) ilike '%invalid_config_key%' then true else false end as validates_config_key,
  case when pg_get_functiondef(p.oid) ilike '%for update%' then true else false end as locks_current_active_row,
  case when pg_get_functiondef(p.oid) ilike '%insert into public.app_runtime_audit_log%' then true else false end as writes_audit_log,
  case when pg_get_functiondef(p.oid) ilike '%insert into public.app_runtime_releases%' then true else false end as writes_release_log
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_language l on l.oid = p.prolang
where n.nspname = 'public'
  and p.proname = 'admin_publish_runtime_config';

-- -------------------------------------------------------------------
-- C) EXECUTE privilege posture
-- -------------------------------------------------------------------
select
  'public' as role_name,
  has_function_privilege('public', 'public.admin_publish_runtime_config(text, text, jsonb, uuid)', 'EXECUTE') as can_execute
union all
select
  'anon' as role_name,
  has_function_privilege('anon', 'public.admin_publish_runtime_config(text, text, jsonb, uuid)', 'EXECUTE') as can_execute
union all
select
  'authenticated' as role_name,
  has_function_privilege('authenticated', 'public.admin_publish_runtime_config(text, text, jsonb, uuid)', 'EXECUTE') as can_execute;

-- -------------------------------------------------------------------
-- D) Published runtime states relevant to atomic publish
-- -------------------------------------------------------------------
select
  scope_type,
  scope_key,
  config_key,
  version,
  is_active,
  status,
  published_at,
  supersedes_version
from public.app_runtime_configs
where scope_type = 'site_mode'
  and config_key in ('branding.static_web_matrix', 'branding.app_mask_matrix')
order by scope_key, config_key, version desc;

-- Should be empty: duplicate active published rows for keys published by RPC
select
  scope_key,
  config_key,
  count(*) as active_rows
from public.app_runtime_configs
where scope_type = 'site_mode'
  and config_key in ('branding.static_web_matrix', 'branding.app_mask_matrix')
  and status = 'published'
  and is_active = true
group by scope_key, config_key
having count(*) > 1
order by scope_key, config_key;

-- -------------------------------------------------------------------
-- E) Audit + release trail presence
-- -------------------------------------------------------------------
select
  actor_id,
  scope_key,
  entity_key,
  action,
  created_at
from public.app_runtime_audit_log
where scope_type = 'site_mode'
  and entity_type = 'runtime_config'
  and entity_key in ('branding.static_web_matrix', 'branding.app_mask_matrix')
order by created_at desc;

select
  release_key,
  scope_key,
  release_type,
  published_at
from public.app_runtime_releases
where scope_type = 'site_mode'
  and release_type in ('branding.static_web_matrix', 'branding.app_mask_matrix')
order by published_at desc;

-- -------------------------------------------------------------------
-- F) Final status summary
-- -------------------------------------------------------------------
with checks as (
  select
    exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'admin_publish_runtime_config'
    ) as has_publish_rpc,
    exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'admin_publish_runtime_config'
        and p.prosecdef = true
    ) as rpc_is_security_definer,
    not has_function_privilege('public', 'public.admin_publish_runtime_config(text, text, jsonb, uuid)', 'EXECUTE') as public_execute_revoked,
    not has_function_privilege('anon', 'public.admin_publish_runtime_config(text, text, jsonb, uuid)', 'EXECUTE') as anon_execute_revoked,
    not has_function_privilege('authenticated', 'public.admin_publish_runtime_config(text, text, jsonb, uuid)', 'EXECUTE') as authenticated_execute_revoked,
    not exists (
      select 1
      from public.app_runtime_configs
      where scope_type = 'site_mode'
        and config_key in ('branding.static_web_matrix', 'branding.app_mask_matrix')
        and status = 'published'
        and is_active = true
      group by scope_key, config_key
      having count(*) > 1
    ) as publish_state_unique
)
select
  case
    when has_publish_rpc
      and rpc_is_security_definer
      and public_execute_revoked
      and anon_execute_revoked
      and authenticated_execute_revoked
      and publish_state_unique
    then 'runtime-config-atomic-publish-green'
    else 'runtime-config-atomic-publish-review-required'
  end as audit_status,
  *
from checks;
