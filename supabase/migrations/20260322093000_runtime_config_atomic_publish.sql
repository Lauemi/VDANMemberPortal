-- Atomic publish helper for runtime configs

create or replace function public.admin_publish_runtime_config(
  p_scope_key text,
  p_config_key text,
  p_config_value jsonb,
  p_actor_id uuid default null
)
returns table (
  scope_key text,
  config_key text,
  version integer,
  config_value jsonb,
  published_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scope_key text := case when lower(trim(coalesce(p_scope_key, ''))) = 'vdan' then 'vdan' else 'fcp' end;
  v_config_key text := trim(coalesce(p_config_key, ''));
  v_current record;
  v_next_version integer;
  v_now timestamptz := now();
  v_release_key text;
begin
  if v_config_key not in ('branding.static_web_matrix', 'branding.app_mask_matrix') then
    raise exception 'invalid_config_key';
  end if;

  select id, version, config_value
  into v_current
  from public.app_runtime_configs
  where scope_type = 'site_mode'
    and scope_key = v_scope_key
    and config_key = v_config_key
    and status = 'published'
    and is_active = true
  order by version desc
  limit 1
  for update;

  v_next_version := coalesce(v_current.version, 0) + 1;

  update public.app_runtime_configs
  set
    is_active = false,
    updated_at = v_now,
    updated_by = p_actor_id
  where scope_type = 'site_mode'
    and scope_key = v_scope_key
    and config_key = v_config_key
    and status = 'published'
    and is_active = true;

  insert into public.app_runtime_configs (
    scope_type,
    scope_key,
    config_key,
    config_value,
    status,
    version,
    created_by,
    updated_by,
    approved_by,
    created_at,
    updated_at,
    published_at,
    is_active,
    supersedes_version
  )
  values (
    'site_mode',
    v_scope_key,
    v_config_key,
    coalesce(p_config_value, '{}'::jsonb),
    'published',
    v_next_version,
    p_actor_id,
    p_actor_id,
    p_actor_id,
    v_now,
    v_now,
    v_now,
    true,
    v_current.version
  );

  insert into public.app_runtime_audit_log (
    actor_id,
    scope_type,
    scope_key,
    entity_type,
    entity_key,
    action,
    before_json,
    after_json,
    created_at
  )
  values (
    p_actor_id,
    'site_mode',
    v_scope_key,
    'runtime_config',
    v_config_key,
    'publish',
    coalesce(v_current.config_value, null),
    coalesce(p_config_value, '{}'::jsonb),
    v_now
  );

  v_release_key := v_config_key || ':' || v_scope_key || ':' || extract(epoch from clock_timestamp())::bigint::text;

  insert into public.app_runtime_releases (
    release_key,
    scope_type,
    scope_key,
    release_type,
    payload_hash,
    published_by,
    published_at,
    notes,
    payload_json
  )
  values (
    v_release_key,
    'site_mode',
    v_scope_key,
    v_config_key,
    md5(coalesce(p_config_value, '{}'::jsonb)::text),
    p_actor_id,
    v_now,
    'admin-web-config publish',
    coalesce(p_config_value, '{}'::jsonb)
  );

  return query
  select
    v_scope_key,
    v_config_key,
    v_next_version,
    coalesce(p_config_value, '{}'::jsonb),
    v_now;
end;
$$;

revoke all on function public.admin_publish_runtime_config(text, text, jsonb, uuid) from public, anon, authenticated;
