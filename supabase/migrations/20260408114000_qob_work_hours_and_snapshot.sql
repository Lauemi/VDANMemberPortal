begin;
create or replace function public.admin_upsert_work_hours_config(
  p_club_id uuid,
  p_enabled boolean,
  p_default_hours integer default 0,
  p_youth_exempt boolean default false,
  p_honorary_exempt boolean default false,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_config jsonb;
begin
  if p_club_id is null then
    raise exception 'club_id_required';
  end if;

  if not (
    public.is_admin_or_vorstand_in_club(p_club_id)
    or public.is_admin_in_any_club()
    or public.is_service_role_request()
  ) then
    raise exception 'forbidden_club_scope';
  end if;

  v_config := jsonb_build_object(
    'enabled', coalesce(p_enabled, false),
    'default_hours', case when coalesce(p_enabled, false) then greatest(coalesce(p_default_hours, 0), 0) else 0 end,
    'youth_exempt', coalesce(p_youth_exempt, false),
    'honorary_exempt', coalesce(p_honorary_exempt, false),
    'note', nullif(trim(p_note), ''),
    'configured_at', now()::text
  );

  insert into public.app_secure_settings (setting_key, setting_value, updated_at)
  values (
    'club_work_hours_config:' || p_club_id::text,
    v_config::text,
    now()
  )
  on conflict (setting_key) do update
    set setting_value = excluded.setting_value,
        updated_at = now();

  perform public.upsert_club_onboarding_progress(
    p_club_id := p_club_id,
    p_notes := jsonb_build_object('work_hours_configured', true)
  );
end;
$$;
create or replace function public.get_work_hours_config(p_club_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select coalesce(
    (
      select (s.setting_value::jsonb) || jsonb_build_object('configured', true)
      from public.app_secure_settings s
      where s.setting_key = 'club_work_hours_config:' || p_club_id::text
      limit 1
    ),
    jsonb_build_object(
      'configured', false,
      'enabled', false,
      'default_hours', 0,
      'youth_exempt', false,
      'honorary_exempt', false,
      'note', null
    )
  );
$$;
grant execute on function public.admin_upsert_work_hours_config(uuid, boolean, integer, boolean, boolean, text) to authenticated;
grant execute on function public.get_work_hours_config(uuid) to authenticated;
commit;
