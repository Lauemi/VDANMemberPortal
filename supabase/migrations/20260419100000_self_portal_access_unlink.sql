begin;

drop function if exists public.self_portal_access_state();
create or replace function public.self_portal_access_state()
returns table(
  state_key text,
  profile_club_id uuid,
  linked_club_id uuid,
  linked_member_no text,
  linked_status text,
  has_identity_link boolean,
  has_user_roles boolean,
  has_club_user_roles boolean
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
    select p.club_id
    from public.profiles p
    where p.id = v_uid
    limit 1
  ),
  linked_member as (
    select cm.club_id, cm.member_no, cm.status
    from public.club_members cm
    where cm.auth_user_id = v_uid
    order by cm.updated_at desc nulls last, cm.club_id asc
    limit 1
  ),
  identity_link as (
    select cmi.club_id
    from public.club_member_identities cmi
    where cmi.user_id = v_uid
    order by cmi.created_at asc nulls last, cmi.club_id asc
    limit 1
  )
  select
    case
      when exists (select 1 from linked_member) or exists (select 1 from identity_link) then 'linked'
      else 'unlinked'
    end as state_key,
    (select pr.club_id from profile_row pr limit 1) as profile_club_id,
    (select lm.club_id from linked_member lm limit 1) as linked_club_id,
    (select lm.member_no from linked_member lm limit 1) as linked_member_no,
    (select lm.status from linked_member lm limit 1) as linked_status,
    exists (select 1 from identity_link) as has_identity_link,
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = v_uid
    ) as has_user_roles,
    exists (
      select 1
      from public.club_user_roles cur
      where cur.user_id = v_uid
    ) as has_club_user_roles;
end;
$$;

grant execute on function public.self_portal_access_state() to authenticated;

drop function if exists public.self_portal_access_unlink();
create or replace function public.self_portal_access_unlink()
returns table(
  ok boolean,
  state_key text,
  unlinked_members integer,
  removed_identity_links integer,
  removed_user_roles integer,
  removed_club_user_roles integer
)
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_unlinked_members integer := 0;
  v_removed_identity_links integer := 0;
  v_removed_user_roles integer := 0;
  v_removed_club_user_roles integer := 0;
begin
  if v_uid is null then
    raise exception 'login_required';
  end if;

  update public.club_members
  set
    auth_user_id = null,
    status = case
      when nullif(trim(coalesce(status, '')), '') is null then 'left'
      when lower(trim(status)) in ('active', 'aktiv') then 'left'
      else status
    end,
    updated_at = now()
  where auth_user_id = v_uid;
  get diagnostics v_unlinked_members = row_count;

  delete from public.club_member_identities
  where user_id = v_uid;
  get diagnostics v_removed_identity_links = row_count;

  delete from public.user_roles
  where user_id = v_uid;
  get diagnostics v_removed_user_roles = row_count;

  delete from public.club_user_roles
  where user_id = v_uid;
  get diagnostics v_removed_club_user_roles = row_count;

  update public.profiles
  set
    club_id = null,
    updated_at = now()
  where id = v_uid;

  return query
  select
    true as ok,
    s.state_key,
    v_unlinked_members,
    v_removed_identity_links,
    v_removed_user_roles,
    v_removed_club_user_roles
  from public.self_portal_access_state() s;
end;
$$;

grant execute on function public.self_portal_access_unlink() to authenticated;

notify pgrst, 'reload schema';

commit;
