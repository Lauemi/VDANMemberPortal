begin;

alter table if exists public.profiles
  add column if not exists active_club_id uuid;

create index if not exists profiles_active_club_id_idx
  on public.profiles(active_club_id);

create or replace function public.current_user_club_id()
returns uuid
language plpgsql
security definer
stable
set search_path = public, auth, pg_catalog
as $$
declare
  v_uid uuid := (select auth.uid());
  v_active_club uuid;
  v_profile_club uuid;
  v_candidate_count integer := 0;
  v_only_club uuid;
begin
  if v_uid is null then
    return null;
  end if;

  select p.active_club_id, p.club_id
    into v_active_club, v_profile_club
  from public.profiles p
  where p.id = v_uid
  limit 1;

  with club_candidates as (
    select distinct u.club_id
    from (
      select cur.club_id
      from public.club_user_roles cur
      where cur.user_id = v_uid
        and cur.club_id is not null
      union
      select ur.club_id
      from public.user_roles ur
      where ur.user_id = v_uid
        and ur.club_id is not null
      union
      select cmi.club_id
      from public.club_member_identities cmi
      where cmi.user_id = v_uid
        and cmi.club_id is not null
    ) u
  )
  select count(*), min(club_id)
    into v_candidate_count, v_only_club
  from club_candidates;

  if v_active_club is not null then
    if exists (
      with club_candidates as (
        select distinct u.club_id
        from (
          select cur.club_id
          from public.club_user_roles cur
          where cur.user_id = v_uid
            and cur.club_id is not null
          union
          select ur.club_id
          from public.user_roles ur
          where ur.user_id = v_uid
            and ur.club_id is not null
          union
          select cmi.club_id
          from public.club_member_identities cmi
          where cmi.user_id = v_uid
            and cmi.club_id is not null
        ) u
      )
      select 1
      from club_candidates cc
      where cc.club_id = v_active_club
      limit 1
    ) then
      return v_active_club;
    end if;
  end if;

  if v_candidate_count = 1 then
    return v_only_club;
  end if;

  if v_candidate_count > 1 then
    return null;
  end if;

  -- Legacy default only when no explicit memberships are available.
  if v_profile_club is not null then
    return v_profile_club;
  end if;

  if public.legacy_single_club_fallback_enabled() then
    return public.public_active_club_id();
  end if;

  return null;
end;
$$;

notify pgrst, 'reload schema';
commit;
