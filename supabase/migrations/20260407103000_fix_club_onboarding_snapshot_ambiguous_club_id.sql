begin;
-- =========================================================
-- FIX: public.club_onboarding_snapshot – 42702 ambiguous column reference
-- =========================================================
-- Ursache:
--   Die Funktion deklariert returns table(club_id uuid, ...).
--   In der state_src-CTE stand:
--     where club_id = p_club_id
--   PostgreSQL konnte club_id nicht eindeutig zuordnen:
--   Output-Spalte der Funktion vs. Spalte in club_onboarding_state.
--
-- Fix:
--   Tabellenalias "cos" eingeführt, WHERE auf cos.club_id qualifiziert.
--   Alle anderen Stellen waren bereits über Alias (ss, req, p_club_id) eindeutig.
--
-- Vorgänger: supabase/migrations/20260317103000_onboarding_foundation.sql
-- Bestehende Migration bleibt unberührt.
-- =========================================================

create or replace function public.club_onboarding_snapshot(p_club_id uuid)
returns table(
  club_id uuid,
  setup_state text,
  billing_state text,
  portal_state text,
  club_data_complete boolean,
  waters_complete boolean,
  cards_complete boolean,
  members_mode text,
  has_club_name boolean,
  has_club_code boolean,
  has_core_roles boolean,
  has_module_usecases boolean,
  has_water_bodies boolean,
  has_default_card boolean,
  member_directory_count bigint,
  member_identity_count bigint,
  manager_count bigint,
  setup_ready boolean
)
language plpgsql
security definer
stable
set search_path = public, auth, pg_catalog
as $$
begin
  if p_club_id is null then
    raise exception 'club_id_required';
  end if;

  if not (
    public.is_service_role_request()
    or public.is_admin_or_vorstand_in_club(p_club_id)
    or public.is_admin_in_any_club()
  ) then
    raise exception 'forbidden_club_scope';
  end if;

  return query
  with state_src as (
    select *
    from public.club_onboarding_state cos
    where cos.club_id = p_club_id          -- qualified: cos.club_id statt bare club_id
  ),
  req as (
    select *
    from public.club_onboarding_requirements(p_club_id)
  )
  select
    p_club_id as club_id,
    coalesce(ss.setup_state, 'pending_setup') as setup_state,
    coalesce(ss.billing_state, 'none') as billing_state,
    coalesce(ss.portal_state, 'draft') as portal_state,
    coalesce(ss.club_data_complete, false) as club_data_complete,
    coalesce(ss.waters_complete, false) as waters_complete,
    coalesce(ss.cards_complete, false) as cards_complete,
    coalesce(ss.members_mode, 'pending') as members_mode,
    coalesce(req.has_club_name, false) as has_club_name,
    coalesce(req.has_club_code, false) as has_club_code,
    coalesce(req.has_core_roles, false) as has_core_roles,
    coalesce(req.has_module_usecases, false) as has_module_usecases,
    coalesce(req.has_water_bodies, false) as has_water_bodies,
    coalesce(req.has_default_card, false) as has_default_card,
    coalesce(req.member_directory_count, 0) as member_directory_count,
    coalesce(req.member_identity_count, 0) as member_identity_count,
    coalesce(req.manager_count, 0) as manager_count,
    (
      coalesce(ss.club_data_complete, false)
      and coalesce(ss.waters_complete, false)
      and coalesce(ss.cards_complete, false)
      and coalesce(ss.members_mode, 'pending') in ('imported', 'confirmed_empty')
      and coalesce(req.has_club_name, false)
      and coalesce(req.has_club_code, false)
      and coalesce(req.has_core_roles, false)
      and coalesce(req.has_module_usecases, false)
      and coalesce(req.has_water_bodies, false)
      and coalesce(req.has_default_card, false)
      and (
        coalesce(req.member_directory_count, 0) > 0
        or coalesce(ss.members_mode, 'pending') = 'confirmed_empty'
      )
    ) as setup_ready
  from req
  left join state_src ss on true;
end;
$$;
commit;
