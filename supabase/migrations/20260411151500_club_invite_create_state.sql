begin;

create or replace function public.club_invite_create_state(
  p_club_id uuid
)
returns table(
  club_name text,
  club_code text,
  max_uses integer,
  expires_in_days integer,
  invite_token text,
  invite_register_url text,
  invite_qr_url text,
  invite_expires_at timestamptz
)
language plpgsql
security definer
stable
set search_path = public, auth, pg_catalog
as $$
declare
  v_snapshot jsonb := '{}'::jsonb;
  v_club_code text := '';
  v_club_name text := '';
begin
  if p_club_id is null then
    raise exception 'club_id_required';
  end if;

  if not (
    current_user in ('postgres', 'service_role')
    or public.is_admin_in_any_club()
    or public.is_admin_or_vorstand_in_club(p_club_id)
  ) then
    raise exception 'Only club admin or vorstand can read invite state';
  end if;

  select
    gim.club_code,
    gim.club_name
    into v_club_code,
         v_club_name
  from public.get_club_identity_map()
  as gim
  where gim.club_id = p_club_id
  limit 1;

  select coalesce(s.setting_value::jsonb, '{}'::jsonb)
    into v_snapshot
  from public.app_secure_settings s
  where s.setting_key = 'club_invite_snapshot:' || p_club_id::text
  limit 1;

  return query
  select
    coalesce(nullif(trim(v_snapshot ->> 'club_name'), ''), nullif(trim(v_club_name), ''), 'Club') as club_name,
    coalesce(nullif(trim(v_snapshot ->> 'club_code'), ''), nullif(trim(v_club_code), ''), '') as club_code,
    coalesce(nullif(v_snapshot ->> 'max_uses', '')::integer, 25) as max_uses,
    coalesce(nullif(v_snapshot ->> 'expires_in_days', '')::integer, 14) as expires_in_days,
    nullif(trim(v_snapshot ->> 'invite_token'), '') as invite_token,
    nullif(trim(v_snapshot ->> 'invite_register_url'), '') as invite_register_url,
    nullif(trim(v_snapshot ->> 'invite_qr_url'), '') as invite_qr_url,
    nullif(trim(v_snapshot ->> 'invite_expires_at'), '')::timestamptz as invite_expires_at;
end;
$$;

revoke all on function public.club_invite_create_state(uuid) from public, anon;
grant execute on function public.club_invite_create_state(uuid) to authenticated;
grant execute on function public.club_invite_create_state(uuid) to service_role;

notify pgrst, 'reload schema';
commit;
