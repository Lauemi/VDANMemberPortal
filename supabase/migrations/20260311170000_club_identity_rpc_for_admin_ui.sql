begin;
create or replace function public.get_club_identity_map()
returns table (
  club_id uuid,
  club_code text,
  club_name text
)
language sql
security definer
stable
set search_path = public, auth, pg_catalog
as $$
  with codes as (
    select
      s.setting_value::uuid as club_id,
      upper(trim(replace(s.setting_key, 'club_code_map:', ''))) as club_code
    from public.app_secure_settings s
    where s.setting_key like 'club_code_map:%'
      and trim(replace(s.setting_key, 'club_code_map:', '')) <> ''
      and s.setting_value::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  names as (
    select
      replace(s.setting_key, 'club_name:', '')::uuid as club_id,
      nullif(trim(s.setting_value::text), '') as club_name
    from public.app_secure_settings s
    where s.setting_key like 'club_name:%'
      and replace(s.setting_key, 'club_name:', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  club_ids as (
    select distinct club_id from codes
    union
    select distinct club_id from names
  )
  select
    i.club_id,
    c.club_code,
    n.club_name
  from club_ids i
  left join codes c on c.club_id = i.club_id
  left join names n on n.club_id = i.club_id
  where auth.uid() is not null
    and (
      public.is_admin_in_any_club()
      or exists (
        select 1
        from public.club_user_roles cur
        where cur.user_id = auth.uid()
          and cur.club_id = i.club_id
      )
    )
  order by c.club_code nulls last, i.club_id;
$$;
revoke all on function public.get_club_identity_map() from public, anon, authenticated;
grant execute on function public.get_club_identity_map() to authenticated;
grant execute on function public.get_club_identity_map() to service_role;
commit;
