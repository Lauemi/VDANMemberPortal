begin;

-- Second-wave mechanical RLS initplan fixes.
-- Scope:
-- - Only helper functions that are reused by many RLS policies.
-- - No policy consolidation and no role-logic changes.
-- Intention:
-- - Keep the same authorization behavior while making auth helper access
--   easier for Postgres to initialize once per statement.

create or replace function public.current_user_club_id()
returns uuid
language plpgsql
security definer
stable
set search_path = public, auth, pg_catalog
as $$
declare
  v_uid uuid := (select auth.uid());
  v_profile_club uuid;
begin
  if v_uid is null then
    return null;
  end if;

  select p.club_id
    into v_profile_club
  from public.profiles p
  where p.id = v_uid
  limit 1;

  if v_profile_club is not null then
    return v_profile_club;
  end if;

  if public.legacy_single_club_fallback_enabled() then
    return public.public_active_club_id();
  end if;

  return null;
end;
$$;

create or replace function public.is_admin_in_club(p_club_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, auth, pg_catalog
as $$
  select exists (
    select 1
    from public.club_user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.club_id = p_club_id
      and ur.role_key = 'admin'
  )
$$;

create or replace function public.is_admin_or_vorstand_in_club(p_club_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, auth, pg_catalog
as $$
  select exists (
    select 1
    from public.club_user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.club_id = p_club_id
      and ur.role_key in ('admin','vorstand')
  )
$$;

create or replace function public.is_admin_in_any_club()
returns boolean
language sql
security definer
stable
set search_path = public, auth, pg_catalog
as $$
  select exists (
    select 1
    from public.club_user_roles cur
    where cur.user_id = (select auth.uid())
      and cur.role_key = 'admin'
  )
$$;

create or replace function public.has_usecase_access(
  p_club_id uuid,
  p_usecase_key text,
  p_action text default 'view'
)
returns boolean
language sql
security definer
stable
set search_path = public, auth, pg_catalog
as $$
  select exists (
    select 1
    from public.club_module_usecases cmu
    join public.club_user_roles cur
      on cur.club_id = cmu.club_id
     and cur.user_id = (select auth.uid())
    join public.club_role_permissions crp
      on crp.club_id = cmu.club_id
     and crp.role_key = cur.role_key
     and crp.module_key = cmu.usecase_key
    where cmu.club_id = p_club_id
      and cmu.usecase_key = p_usecase_key
      and cmu.is_enabled = true
      and (
        case lower(coalesce(p_action, 'view'))
          when 'view' then crp.can_view
          when 'read' then crp.can_read
          when 'write' then crp.can_write
          when 'update' then crp.can_update
          when 'delete' then crp.can_delete
          else false
        end
      )
  )
$$;

commit;
