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
language plpgsql
security definer
stable
set search_path = public, auth, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'login_required';
  end if;

  return query
  with profile_row as (
    select p.*
    from public.profiles p
    where p.id = v_uid
    limit 1
  ),
  selected_club as (
    select coalesce(
      (select club_id from profile_row),
      (
        select cmi.club_id
        from public.club_member_identities cmi
        where cmi.user_id = v_uid
        order by cmi.created_at asc nulls last, cmi.club_id asc
        limit 1
      )
    ) as club_id
  ),
  identity_row as (
    select cmi.*
    from public.club_member_identities cmi
    join selected_club sc on sc.club_id = cmi.club_id
    where cmi.user_id = v_uid
    limit 1
  ),
  club_row as (
    select cm.*
    from public.club_members cm
    join selected_club sc on sc.club_id = cm.club_id
    where cm.member_no = coalesce(
      (select member_no from identity_row),
      (select member_no from profile_row)
    )
    limit 1
  ),
  member_row as (
    select m.*
    from public.members m
    join selected_club sc on sc.club_id = m.club_id
    where m.membership_number = coalesce(
      (select member_no from identity_row),
      (select member_no from profile_row)
    )
    limit 1
  )
  select
    resolved.resolved_member_no,
    resolved.resolved_internal_member_no,
    resolved.resolved_club_code,
    resolved.resolved_first_name,
    resolved.resolved_last_name,
    resolved.resolved_email,
    resolved.resolved_street,
    resolved.resolved_zip,
    resolved.resolved_city,
    resolved.resolved_phone,
    resolved.resolved_mobile
  from (
    select
      coalesce(
        nullif(trim((select club_member_no from member_row)), ''),
        nullif(trim((select club_member_no from club_row)), ''),
        nullif(trim((select member_no from club_row)), ''),
        nullif(trim((select member_no from profile_row)), '')
      ) as resolved_member_no,
      coalesce(
        nullif(trim((select member_no from club_row)), ''),
        nullif(trim((select member_no from identity_row)), ''),
        nullif(trim((select member_no from profile_row)), '')
      ) as resolved_internal_member_no,
      coalesce(nullif(trim((select club_code from club_row)), ''), '-') as resolved_club_code,
      coalesce(
        nullif(trim((select first_name from member_row)), ''),
        nullif(trim((select first_name from club_row)), ''),
        nullif(trim((select first_name from profile_row)), ''),
        '-'
      ) as resolved_first_name,
      coalesce(
        nullif(trim((select last_name from member_row)), ''),
        nullif(trim((select last_name from club_row)), ''),
        nullif(trim((select last_name from profile_row)), ''),
        '-'
      ) as resolved_last_name,
      coalesce(
        nullif(trim((select email from member_row)), ''),
        nullif(trim((select email from profile_row)), ''),
        '-'
      ) as resolved_email,
      coalesce(nullif(trim((select street from member_row)), ''), '-') as resolved_street,
      coalesce(nullif(trim((select zip from member_row)), ''), '-') as resolved_zip,
      coalesce(nullif(trim((select city from member_row)), ''), '-') as resolved_city,
      coalesce(nullif(trim((select phone from member_row)), ''), '-') as resolved_phone,
      coalesce(nullif(trim((select mobile from member_row)), ''), '-') as resolved_mobile
  ) resolved
  where exists (select 1 from profile_row)
     or exists (select 1 from identity_row)
     or exists (select 1 from club_row)
     or exists (select 1 from member_row);
end;
$$;
grant execute on function public.self_member_profile_get() to authenticated;
notify pgrst, 'reload schema';
commit;
