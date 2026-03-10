-- VDAN/FCP - Self-service account settings for members
-- Date: 2026-03-09
-- Goal:
--   Allow authenticated users to read/update their own account master data
--   (name + contact/address) without opening broad table write access.
--
-- Run after:
--   16_wiso_members_import.sql
--   26_membership_applications.sql
--   66_admin_member_registry.sql
--   67_club_id_scope_rollout.sql

begin;

drop function if exists public.self_member_profile_get();

create or replace function public.self_member_profile_get()
returns table(
  member_no text,
  club_code text,
  first_name text,
  last_name text,
  email text,
  street text,
  zip text,
  city text,
  phone text,
  mobile text
)
language plpgsql
security definer
stable
set search_path = public, auth, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  return query
  with me as (
    select p.id, p.member_no, p.club_id, p.email, p.first_name, p.last_name
    from public.profiles p
    where p.id = v_uid
    limit 1
  )
  select
    me.member_no,
    cm.club_code,
    coalesce(nullif(trim(m.first_name), ''), nullif(trim(me.first_name), ''), nullif(trim(cm.first_name), ''), '') as first_name,
    coalesce(nullif(trim(m.last_name), ''), nullif(trim(me.last_name), ''), nullif(trim(cm.last_name), ''), '') as last_name,
    coalesce(me.email, '') as email,
    coalesce(m.street, '') as street,
    coalesce(m.zip, '') as zip,
    coalesce(m.city, '') as city,
    coalesce(m.phone, '') as phone,
    coalesce(m.mobile, '') as mobile
  from me
  left join public.members m
    on m.membership_number = me.member_no
   and (me.club_id is null or m.club_id = me.club_id)
  left join public.club_members cm
    on cm.member_no = me.member_no
   and (me.club_id is null or cm.club_id = me.club_id);
end;
$$;

grant execute on function public.self_member_profile_get() to authenticated;

drop function if exists public.self_member_profile_update(text, text, text, text, text, text, text);

create or replace function public.self_member_profile_update(
  p_first_name text default null,
  p_last_name text default null,
  p_street text default null,
  p_zip text default null,
  p_city text default null,
  p_phone text default null,
  p_mobile text default null
)
returns table(
  member_no text,
  club_code text,
  first_name text,
  last_name text,
  email text,
  street text,
  zip text,
  city text,
  phone text,
  mobile text
)
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_member_no text;
  v_club_id uuid;
  v_first_name text := nullif(trim(coalesce(p_first_name, '')), '');
  v_last_name text := nullif(trim(coalesce(p_last_name, '')), '');
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select p.member_no, p.club_id
    into v_member_no, v_club_id
  from public.profiles p
  where p.id = v_uid
  limit 1;

  if v_member_no is null or trim(v_member_no) = '' then
    raise exception 'member_no missing on profile';
  end if;

  update public.members m
  set
    first_name = coalesce(v_first_name, m.first_name),
    last_name = coalesce(v_last_name, m.last_name),
    street = coalesce(nullif(trim(p_street), ''), m.street),
    zip = coalesce(nullif(trim(p_zip), ''), m.zip),
    city = coalesce(nullif(trim(p_city), ''), m.city),
    phone = case when p_phone is null then m.phone else nullif(trim(p_phone), '') end,
    mobile = case when p_mobile is null then m.mobile else nullif(trim(p_mobile), '') end,
    updated_at = now()
  where m.membership_number = v_member_no
    and (v_club_id is null or m.club_id = v_club_id);

  update public.club_members cm
  set
    first_name = coalesce(v_first_name, cm.first_name),
    last_name = coalesce(v_last_name, cm.last_name),
    updated_at = now()
  where cm.member_no = v_member_no
    and (v_club_id is null or cm.club_id = v_club_id);

  update public.profiles p
  set
    first_name = coalesce(v_first_name, p.first_name),
    last_name = coalesce(v_last_name, p.last_name),
    display_name = trim(concat_ws(' ', coalesce(v_first_name, p.first_name), coalesce(v_last_name, p.last_name))),
    updated_at = now()
  where p.id = v_uid;

  return query
  select *
  from public.self_member_profile_get();
end;
$$;

grant execute on function public.self_member_profile_update(text, text, text, text, text, text, text) to authenticated;

commit;
