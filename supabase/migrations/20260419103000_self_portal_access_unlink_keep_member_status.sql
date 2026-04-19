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
    'unlinked'::text as state_key,
    v_unlinked_members as unlinked_members,
    v_removed_identity_links as removed_identity_links,
    v_removed_user_roles as removed_user_roles,
    v_removed_club_user_roles as removed_club_user_roles;
end;
$$;

grant execute on function public.self_portal_access_unlink() to authenticated;

notify pgrst, 'reload schema';
