-- Migration: AGB (Plattformvertrag) in legal_documents + Gate-Erweiterung
-- Ticket: MINAAA-28
-- Stand: 2026-05-11
--
-- Änderungen:
-- 1. CHECK-Constraint auf legal_documents.document_key + legal_acceptance_events.document_key erweitert um 'agb'
-- 2. AGB v2026-05-10-v1 in legal_documents eingetragen
-- 3. legal_acceptance_state() gibt agb_version, agb_accepted, agb_required zurück
-- 4. needs_acceptance berücksichtigt AGB (club-scope, wie AVV)
-- 5. accept_current_legal() nimmt p_agb-Parameter entgegen (same flow wie AVV)
--
-- Stabilität bestehender Flows:
-- - terms/privacy/avv bleiben unverändert
-- - bestehende club admins (VDAN) werden beim nächsten Login zur AGB-Akzeptanz aufgefordert
-- - kein Eingriff in Invite/Claim/Billing/Member-Flow

begin;

-- ─── 1. CHECK-CONSTRAINT ERWEITERN ──────────────────────────────────────────

alter table public.legal_documents
  drop constraint if exists legal_documents_document_key_check;
alter table public.legal_documents
  add constraint legal_documents_document_key_check
  check (document_key in ('terms', 'privacy', 'avv', 'agb'));

alter table public.legal_acceptance_events
  drop constraint if exists legal_acceptance_events_document_key_check;
alter table public.legal_acceptance_events
  add constraint legal_acceptance_events_document_key_check
  check (document_key in ('terms', 'privacy', 'avv', 'agb'));

-- ─── 2. AGB IN LEGAL_DOCUMENTS ───────────────────────────────────────────────

insert into public.legal_documents (
  document_key,
  applies_to,
  version,
  title,
  document_url,
  snapshot_path,
  is_active,
  published_at
)
values (
  'agb',
  'club',
  '2026-05-10-v1',
  'Allgemeine Geschäftsbedingungen – Fishing-Club-Portal (Plattformvertrag)',
  '/agb.html/',
  'docs/legal/fcp-agb-plattformvertrag-v2026-05-10-v1.md',
  true,
  now()
)
on conflict (document_key, version) do update
set is_active = true,
    title = excluded.title,
    document_url = excluded.document_url,
    snapshot_path = excluded.snapshot_path,
    published_at = excluded.published_at;

-- Ältere AGB-Versionen deaktivieren (sicher: keine anderen existieren)
update public.legal_documents
set is_active = false
where document_key = 'agb'
  and version <> '2026-05-10-v1';

-- ─── 3. LEGAL_ACCEPTANCE_STATE() ERWEITERN ──────────────────────────────────

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

  club_id        := v_club_id;
  terms_version  := v_terms_version;
  privacy_version := v_privacy_version;
  avv_version    := v_avv_version;
  agb_version    := v_agb_version;
  terms_accepted  := v_terms_accepted;
  privacy_accepted := v_privacy_accepted;
  avv_accepted   := v_avv_accepted;
  agb_accepted   := v_agb_accepted;
  avv_required   := v_avv_required;
  agb_required   := v_agb_required;
  needs_acceptance :=
    not (coalesce(v_terms_accepted, false) and coalesce(v_privacy_accepted, false))
    or (v_avv_required and not coalesce(v_avv_accepted, false))
    or (v_agb_required and not coalesce(v_agb_accepted, false));
  return next;
end;
$$;
grant execute on function public.legal_acceptance_state() to authenticated;

-- ─── 4. ACCEPT_CURRENT_LEGAL() ERWEITERN ────────────────────────────────────

drop function if exists public.accept_current_legal(boolean, boolean, boolean, text, boolean, text, text, text);
create or replace function public.accept_current_legal(
  p_terms boolean default false,
  p_privacy boolean default false,
  p_avv boolean default false,
  p_user_agent text default null,
  p_authority_confirmed boolean default false,
  p_signer_name text default null,
  p_signer_function text default null,
  p_signer_email text default null,
  p_agb boolean default false
)
returns table(
  ok boolean,
  accepted_at timestamptz,
  avv_recorded boolean,
  agb_recorded boolean
)
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_club_id uuid := public.current_user_club_id();
  v_now timestamptz := now();
  v_terms public.legal_documents%rowtype;
  v_privacy public.legal_documents%rowtype;
  v_avv public.legal_documents%rowtype;
  v_agb public.legal_documents%rowtype;
  v_signer_email text := nullif(trim(coalesce(p_signer_email, auth.jwt() ->> 'email', '')), '');
  v_avv_recorded boolean := false;
  v_agb_recorded boolean := false;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not coalesce(p_terms, false) or not coalesce(p_privacy, false) then
    raise exception 'Terms and privacy must be accepted';
  end if;

  select * into v_terms from public.legal_documents
  where document_key = 'terms' and is_active limit 1;

  select * into v_privacy from public.legal_documents
  where document_key = 'privacy' and is_active limit 1;

  if v_terms.id is null or v_privacy.id is null then
    raise exception 'Active legal documents missing';
  end if;

  -- terms (user-scope)
  insert into public.legal_acceptance_events (
    document_key, document_version, document_sha256,
    accepted_scope, accepted_by_user_id, accepted_at, user_agent, accepted_text, signer_email
  ) values (
    'terms', v_terms.version, v_terms.snapshot_sha256,
    'user', v_uid, v_now,
    nullif(trim(coalesce(p_user_agent, '')), ''),
    'Ich habe die Nutzungsbedingungen gelesen und akzeptiere sie.',
    v_signer_email
  ) on conflict do nothing;

  -- privacy (user-scope)
  insert into public.legal_acceptance_events (
    document_key, document_version, document_sha256,
    accepted_scope, accepted_by_user_id, accepted_at, user_agent, accepted_text, signer_email
  ) values (
    'privacy', v_privacy.version, v_privacy.snapshot_sha256,
    'user', v_uid, v_now,
    nullif(trim(coalesce(p_user_agent, '')), ''),
    'Ich habe die Datenschutzhinweise gelesen und bestätige sie.',
    v_signer_email
  ) on conflict do nothing;

  -- avv (club-scope)
  if coalesce(p_avv, false) then
    if v_club_id is null then
      raise exception 'No club context available for AVV acceptance';
    end if;
    if not public.is_admin_or_vorstand_in_club(v_club_id) then
      raise exception 'AVV may only be accepted by admin or vorstand';
    end if;
    if not coalesce(p_authority_confirmed, false) then
      raise exception 'Authority confirmation required for AVV acceptance';
    end if;
    if nullif(trim(coalesce(p_signer_name, '')), '') is null then
      raise exception 'Signer name required for AVV acceptance';
    end if;
    if nullif(trim(coalesce(p_signer_function, '')), '') is null then
      raise exception 'Signer function required for AVV acceptance';
    end if;

    select * into v_avv from public.legal_documents
    where document_key = 'avv' and is_active limit 1;

    if v_avv.id is null then
      raise exception 'Active AVV document missing';
    end if;

    insert into public.legal_acceptance_events (
      document_key, document_version, document_sha256,
      accepted_scope, club_id, accepted_by_user_id, accepted_at, user_agent, accepted_text,
      signer_name, signer_function, signer_email, authority_confirmed
    ) values (
      'avv', v_avv.version, v_avv.snapshot_sha256,
      'club', v_club_id, v_uid, v_now,
      nullif(trim(coalesce(p_user_agent, '')), ''),
      'Ich bestätige, dass ich für den Verein vertretungsberechtigt oder zur Annahme des AVV bevollmächtigt bin, den AVV in der vorliegenden Version gelesen habe und ihn im Namen des Vereins akzeptiere.',
      nullif(trim(coalesce(p_signer_name, '')), ''),
      nullif(trim(coalesce(p_signer_function, '')), ''),
      v_signer_email,
      true
    ) on conflict do nothing;

    v_avv_recorded := true;
  end if;

  -- agb (club-scope, same guard as avv)
  if coalesce(p_agb, false) then
    if v_club_id is null then
      raise exception 'No club context available for AGB acceptance';
    end if;
    if not public.is_admin_or_vorstand_in_club(v_club_id) then
      raise exception 'AGB may only be accepted by admin or vorstand';
    end if;
    if not coalesce(p_authority_confirmed, false) then
      raise exception 'Authority confirmation required for AGB acceptance';
    end if;
    if nullif(trim(coalesce(p_signer_name, '')), '') is null then
      raise exception 'Signer name required for AGB acceptance';
    end if;
    if nullif(trim(coalesce(p_signer_function, '')), '') is null then
      raise exception 'Signer function required for AGB acceptance';
    end if;

    select * into v_agb from public.legal_documents
    where document_key = 'agb' and is_active limit 1;

    if v_agb.id is null then
      raise exception 'Active AGB document missing';
    end if;

    insert into public.legal_acceptance_events (
      document_key, document_version, document_sha256,
      accepted_scope, club_id, accepted_by_user_id, accepted_at, user_agent, accepted_text,
      signer_name, signer_function, signer_email, authority_confirmed
    ) values (
      'agb', v_agb.version, v_agb.snapshot_sha256,
      'club', v_club_id, v_uid, v_now,
      nullif(trim(coalesce(p_user_agent, '')), ''),
      'Ich bestätige, dass ich für den Verein vertretungsberechtigt oder zur Annahme der AGB bevollmächtigt bin, die AGB in der vorliegenden Version gelesen habe und sie im Namen des Vereins akzeptiere.',
      nullif(trim(coalesce(p_signer_name, '')), ''),
      nullif(trim(coalesce(p_signer_function, '')), ''),
      v_signer_email,
      true
    ) on conflict do nothing;

    v_agb_recorded := true;
  end if;

  ok           := true;
  accepted_at  := v_now;
  avv_recorded := v_avv_recorded;
  agb_recorded := v_agb_recorded;
  return next;
end;
$$;
grant execute on function public.accept_current_legal(boolean, boolean, boolean, text, boolean, text, text, text, boolean) to authenticated;

commit;
