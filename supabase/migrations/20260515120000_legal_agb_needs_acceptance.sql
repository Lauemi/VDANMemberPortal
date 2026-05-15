-- Migration: AGB in needs_acceptance Gate aufnehmen
-- Ticket: MINAAA-28 (Follow-up)
-- Stand: 2026-05-15
--
-- Voraussetzung: UI /app/rechtliches-bestaetigen/ unterstützt AGB-Checkbox (legalAgbBlock).
-- Diese Migration aktiviert die AGB-Pflicht im Gate. Bestehende Admins werden beim
-- nächsten Login zur AGB-Akzeptanz aufgefordert.

begin;

drop function if exists public.legal_acceptance_state();
create or replace function public.legal_acceptance_state()
returns table(
  club_id uuid,
  terms_version text,
  privacy_version text,
  avv_version text,
  agb_version text,
  terms_accepted boolean,
  privacy_accepted boolean,
  avv_accepted boolean,
  agb_accepted boolean,
  avv_required boolean,
  agb_required boolean,
  needs_acceptance boolean
)
language plpgsql
security definer
stable
set search_path = public, auth, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_club_id uuid := public.current_user_club_id();
  v_terms_version text;
  v_privacy_version text;
  v_avv_version text;
  v_agb_version text;
  v_terms_accepted boolean := false;
  v_privacy_accepted boolean := false;
  v_avv_accepted boolean := false;
  v_agb_accepted boolean := false;
  v_avv_required boolean := false;
  v_agb_required boolean := false;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select d.version into v_terms_version
  from public.legal_documents d
  where d.document_key = 'terms' and d.is_active limit 1;

  select d.version into v_privacy_version
  from public.legal_documents d
  where d.document_key = 'privacy' and d.is_active limit 1;

  select d.version into v_avv_version
  from public.legal_documents d
  where d.document_key = 'avv' and d.is_active limit 1;

  select d.version into v_agb_version
  from public.legal_documents d
  where d.document_key = 'agb' and d.is_active limit 1;

  -- terms + privacy: user-scope
  select exists (
    select 1 from public.legal_acceptance_events e
    where e.accepted_by_user_id = v_uid
      and e.accepted_scope = 'user'
      and e.document_key = 'terms'
      and e.document_version = v_terms_version
  ) into v_terms_accepted;

  select exists (
    select 1 from public.legal_acceptance_events e
    where e.accepted_by_user_id = v_uid
      and e.accepted_scope = 'user'
      and e.document_key = 'privacy'
      and e.document_version = v_privacy_version
  ) into v_privacy_accepted;

  -- avv + agb: club-scope, nur für admin/vorstand
  v_avv_required := v_club_id is not null
    and v_avv_version is not null
    and public.is_admin_or_vorstand_in_club(v_club_id);

  v_agb_required := v_club_id is not null
    and v_agb_version is not null
    and public.is_admin_or_vorstand_in_club(v_club_id);

  if v_avv_required then
    select exists (
      select 1 from public.legal_acceptance_events e
      where e.club_id = v_club_id
        and e.accepted_scope = 'club'
        and e.document_key = 'avv'
        and e.document_version = v_avv_version
    ) into v_avv_accepted;
  end if;

  if v_agb_required then
    select exists (
      select 1 from public.legal_acceptance_events e
      where e.club_id = v_club_id
        and e.accepted_scope = 'club'
        and e.document_key = 'agb'
        and e.document_version = v_agb_version
    ) into v_agb_accepted;
  end if;

  club_id          := v_club_id;
  terms_version    := v_terms_version;
  privacy_version  := v_privacy_version;
  avv_version      := v_avv_version;
  agb_version      := v_agb_version;
  terms_accepted   := v_terms_accepted;
  privacy_accepted := v_privacy_accepted;
  avv_accepted     := v_avv_accepted;
  agb_accepted     := v_agb_accepted;
  avv_required     := v_avv_required;
  agb_required     := v_agb_required;
  needs_acceptance :=
    not (coalesce(v_terms_accepted, false) and coalesce(v_privacy_accepted, false))
    or (v_avv_required and not coalesce(v_avv_accepted, false))
    or (v_agb_required and not coalesce(v_agb_accepted, false));
  return next;
end;
$$;
grant execute on function public.legal_acceptance_state() to authenticated;

commit;
