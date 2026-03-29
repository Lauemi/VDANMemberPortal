begin;

drop function if exists public.self_member_profile_get();

create or replace function public.self_member_profile_get()
returns table(
  member_no text,
  internal_member_no text,
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
language sql
security definer
stable
set search_path = public, auth, pg_catalog
as $$
  with current_actor as (
    select auth.uid() as uid
  ),
  profile_row as (
    select p.*
    from public.profiles p
    join current_actor ca on ca.uid = p.id
    limit 1
  ),
  selected_club as (
    select coalesce(
      (select pr.club_id from profile_row pr limit 1),
      (
        select cmi.club_id
        from public.club_member_identities cmi
        join current_actor ca on ca.uid = cmi.user_id
        order by cmi.created_at asc nulls last, cmi.club_id asc
        limit 1
      )
    ) as club_id
  ),
  identity_row as (
    select cmi.*
    from public.club_member_identities cmi
    join current_actor ca on ca.uid = cmi.user_id
    join selected_club sc on sc.club_id = cmi.club_id
    limit 1
  ),
  resolved_internal as (
    select coalesce(
      (select ir.member_no from identity_row ir limit 1),
      (select pr.member_no from profile_row pr limit 1)
    ) as member_no
  ),
  club_row as (
    select cm.*
    from public.club_members cm
    join selected_club sc on sc.club_id = cm.club_id
    join resolved_internal ri on ri.member_no = cm.member_no
    limit 1
  ),
  member_row as (
    select m.*
    from public.members m
    join selected_club sc on sc.club_id = m.club_id
    join resolved_internal ri on ri.member_no = m.membership_number
    limit 1
  )
  select
    coalesce(
      nullif(trim(mr.club_member_no), ''),
      nullif(trim(cr.club_member_no), ''),
      nullif(trim(cr.member_no), ''),
      nullif(trim(pr.member_no), '')
    ) as member_no,
    coalesce(
      nullif(trim(cr.member_no), ''),
      nullif(trim(ir.member_no), ''),
      nullif(trim(pr.member_no), '')
    ) as internal_member_no,
    coalesce(nullif(trim(cr.club_code), ''), '-') as club_code,
    coalesce(
      nullif(trim(mr.first_name), ''),
      nullif(trim(cr.first_name), ''),
      nullif(trim(pr.first_name), ''),
      '-'
    ) as first_name,
    coalesce(
      nullif(trim(mr.last_name), ''),
      nullif(trim(cr.last_name), ''),
      nullif(trim(pr.last_name), ''),
      '-'
    ) as last_name,
    coalesce(
      nullif(trim(mr.email), ''),
      nullif(trim(pr.email), ''),
      '-'
    ) as email,
    coalesce(nullif(trim(mr.street), ''), '-') as street,
    coalesce(nullif(trim(mr.zip), ''), '-') as zip,
    coalesce(nullif(trim(mr.city), ''), '-') as city,
    coalesce(nullif(trim(mr.phone), ''), '-') as phone,
    coalesce(nullif(trim(mr.mobile), ''), '-') as mobile
  from current_actor ca
  left join profile_row pr on true
  left join identity_row ir on true
  left join club_row cr on true
  left join member_row mr on true
  where ca.uid is not null
    and (
      pr.id is not null
      or ir.user_id is not null
      or cr.member_no is not null
      or mr.membership_number is not null
    );
$$;

grant execute on function public.self_member_profile_get() to authenticated;

notify pgrst, 'reload schema';

commit;
