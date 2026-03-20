begin;

create table if not exists public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  document_key text not null check (document_key in ('terms', 'privacy', 'avv')),
  applies_to text not null check (applies_to in ('user', 'club')),
  version text not null,
  title text not null,
  document_url text not null,
  snapshot_path text,
  snapshot_sha256 text,
  is_active boolean not null default false,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (document_key, version)
);

create unique index if not exists idx_legal_documents_one_active_per_key
  on public.legal_documents(document_key)
  where is_active;

create table if not exists public.legal_acceptance_events (
  id uuid primary key default gen_random_uuid(),
  document_key text not null check (document_key in ('terms', 'privacy', 'avv')),
  document_version text not null,
  document_sha256 text,
  accepted_scope text not null check (accepted_scope in ('user', 'club')),
  club_id uuid,
  accepted_by_user_id uuid not null references auth.users(id) on delete cascade,
  accepted_at timestamptz not null default now(),
  user_agent text,
  accepted_text text,
  signer_name text,
  signer_function text,
  signer_email text,
  authority_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  check (
    (accepted_scope = 'user' and club_id is null)
    or (accepted_scope = 'club' and club_id is not null)
  )
);

create unique index if not exists idx_legal_acceptance_user_once_per_version
  on public.legal_acceptance_events(accepted_by_user_id, document_key, document_version)
  where club_id is null;

create unique index if not exists idx_legal_acceptance_club_per_signer_once_per_version
  on public.legal_acceptance_events(accepted_by_user_id, club_id, document_key, document_version)
  where club_id is not null;

alter table public.legal_documents enable row level security;
alter table public.legal_acceptance_events enable row level security;

drop policy if exists "legal_documents_authenticated_select" on public.legal_documents;
create policy "legal_documents_authenticated_select"
on public.legal_documents
for select
to authenticated
using (is_active);

drop policy if exists "legal_acceptance_events_self_or_club_select" on public.legal_acceptance_events;
create policy "legal_acceptance_events_self_or_club_select"
on public.legal_acceptance_events
for select
to authenticated
using (
  accepted_by_user_id = auth.uid()
  or (club_id is not null and public.is_admin_or_vorstand_in_club(club_id))
);

insert into public.legal_documents (
  document_key,
  applies_to,
  version,
  title,
  document_url,
  snapshot_path,
  snapshot_sha256,
  is_active,
  published_at
)
values
  (
    'terms',
    'user',
    '2026-03-19-v1',
    'Nutzungsbedingungen – Fishing-Club-Portal',
    '/nutzungsbedingungen.html/',
    'docs/legal/fcp-terms.md',
    '3a07e13665d7318c7c0ebffe3af6dde3638f4d878af1deab166f08f0f982269b',
    true,
    now()
  ),
  (
    'privacy',
    'user',
    '2026-03-19-v1',
    'Datenschutzhinweise – Fishing-Club-Portal',
    '/datenschutz.html/',
    'docs/legal/fcp-privacy.md',
    '5d72dce15450545e09cac6951d8652f082eba10b95102dcddae4e9d58ac98d4c',
    true,
    now()
  ),
  (
    'avv',
    'club',
    '2026-03-19-v1',
    'Auftragsverarbeitungsvereinbarung – Fishing-Club-Portal',
    '/avv.html/',
    'docs/legal/fcp-avv-v2026-03-19-v1.md',
    'd55a4880a507a85389f4fa211862d5ee3f81f7b5040e63c9ffa6694cb7e3e616',
    true,
    now()
  )
on conflict (document_key, version) do update
set applies_to = excluded.applies_to,
    title = excluded.title,
    document_url = excluded.document_url,
    snapshot_path = excluded.snapshot_path,
    snapshot_sha256 = excluded.snapshot_sha256,
    is_active = excluded.is_active,
    published_at = excluded.published_at;

update public.legal_documents
set is_active = false
where document_key in ('terms', 'privacy', 'avv')
  and version <> '2026-03-19-v1';

insert into public.app_secure_settings(setting_key, setting_value)
values
  ('terms_version', '2026-03-19-v1'),
  ('privacy_version', '2026-03-19-v1'),
  ('avv_version', '2026-03-19-v1')
on conflict (setting_key) do update
set setting_value = excluded.setting_value,
    updated_at = now();

drop function if exists public.legal_acceptance_state();

create or replace function public.legal_acceptance_state()
returns table(
  club_id uuid,
  terms_version text,
  privacy_version text,
  avv_version text,
  terms_accepted boolean,
  privacy_accepted boolean,
  avv_accepted boolean,
  avv_required boolean,
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
  v_terms_accepted boolean := false;
  v_privacy_accepted boolean := false;
  v_avv_accepted boolean := false;
  v_avv_required boolean := false;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select d.version
    into v_terms_version
  from public.legal_documents d
  where d.document_key = 'terms'
    and d.is_active
  limit 1;

  select d.version
    into v_privacy_version
  from public.legal_documents d
  where d.document_key = 'privacy'
    and d.is_active
  limit 1;

  select d.version
    into v_avv_version
  from public.legal_documents d
  where d.document_key = 'avv'
    and d.is_active
  limit 1;

  select exists (
    select 1
    from public.legal_acceptance_events e
    where e.accepted_by_user_id = v_uid
      and e.accepted_scope = 'user'
      and e.document_key = 'terms'
      and e.document_version = v_terms_version
  )
  into v_terms_accepted;

  select exists (
    select 1
    from public.legal_acceptance_events e
    where e.accepted_by_user_id = v_uid
      and e.accepted_scope = 'user'
      and e.document_key = 'privacy'
      and e.document_version = v_privacy_version
  )
  into v_privacy_accepted;

  v_avv_required := v_club_id is not null
    and v_avv_version is not null
    and public.is_admin_or_vorstand_in_club(v_club_id);

  if v_avv_required then
    select exists (
      select 1
      from public.legal_acceptance_events e
      where e.club_id = v_club_id
        and e.accepted_scope = 'club'
        and e.document_key = 'avv'
        and e.document_version = v_avv_version
    )
    into v_avv_accepted;
  end if;

  club_id := v_club_id;
  terms_version := v_terms_version;
  privacy_version := v_privacy_version;
  avv_version := v_avv_version;
  terms_accepted := v_terms_accepted;
  privacy_accepted := v_privacy_accepted;
  avv_accepted := v_avv_accepted;
  avv_required := v_avv_required;
  needs_acceptance := not (coalesce(v_terms_accepted, false) and coalesce(v_privacy_accepted, false))
    or (v_avv_required and not coalesce(v_avv_accepted, false));
  return next;
end;
$$;

grant execute on function public.legal_acceptance_state() to authenticated;

drop function if exists public.accept_current_legal(boolean, boolean, text);
drop function if exists public.accept_current_legal(boolean, boolean, boolean, text, boolean, text, text, text);

create or replace function public.accept_current_legal(
  p_terms boolean default false,
  p_privacy boolean default false,
  p_avv boolean default false,
  p_user_agent text default null,
  p_authority_confirmed boolean default false,
  p_signer_name text default null,
  p_signer_function text default null,
  p_signer_email text default null
)
returns table(
  ok boolean,
  accepted_at timestamptz,
  avv_recorded boolean
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
  v_signer_email text := nullif(trim(coalesce(p_signer_email, auth.jwt() ->> 'email', '')), '');
  v_avv_recorded boolean := false;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not coalesce(p_terms, false) or not coalesce(p_privacy, false) then
    raise exception 'Terms and privacy must be accepted';
  end if;

  select * into v_terms
  from public.legal_documents
  where document_key = 'terms'
    and is_active
  limit 1;

  select * into v_privacy
  from public.legal_documents
  where document_key = 'privacy'
    and is_active
  limit 1;

  if v_terms.id is null or v_privacy.id is null then
    raise exception 'Active legal documents missing';
  end if;

  insert into public.legal_acceptance_events (
    document_key,
    document_version,
    document_sha256,
    accepted_scope,
    accepted_by_user_id,
    accepted_at,
    user_agent,
    accepted_text,
    signer_email
  )
  values (
    'terms',
    v_terms.version,
    v_terms.snapshot_sha256,
    'user',
    v_uid,
    v_now,
    nullif(trim(coalesce(p_user_agent, '')), ''),
    'Ich habe die Nutzungsbedingungen gelesen und akzeptiere sie.',
    v_signer_email
  )
  on conflict do nothing;

  insert into public.legal_acceptance_events (
    document_key,
    document_version,
    document_sha256,
    accepted_scope,
    accepted_by_user_id,
    accepted_at,
    user_agent,
    accepted_text,
    signer_email
  )
  values (
    'privacy',
    v_privacy.version,
    v_privacy.snapshot_sha256,
    'user',
    v_uid,
    v_now,
    nullif(trim(coalesce(p_user_agent, '')), ''),
    'Ich habe die Datenschutzhinweise gelesen und bestätige sie.',
    v_signer_email
  )
  on conflict do nothing;

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

    select * into v_avv
    from public.legal_documents
    where document_key = 'avv'
      and is_active
    limit 1;

    if v_avv.id is null then
      raise exception 'Active AVV document missing';
    end if;

    insert into public.legal_acceptance_events (
      document_key,
      document_version,
      document_sha256,
      accepted_scope,
      club_id,
      accepted_by_user_id,
      accepted_at,
      user_agent,
      accepted_text,
      signer_name,
      signer_function,
      signer_email,
      authority_confirmed
    )
    values (
      'avv',
      v_avv.version,
      v_avv.snapshot_sha256,
      'club',
      v_club_id,
      v_uid,
      v_now,
      nullif(trim(coalesce(p_user_agent, '')), ''),
      'Ich bestätige, dass ich für den Verein vertretungsberechtigt oder zur Annahme des AVV bevollmächtigt bin, den AVV in der vorliegenden Version gelesen habe und ihn im Namen des Vereins akzeptiere.',
      nullif(trim(coalesce(p_signer_name, '')), ''),
      nullif(trim(coalesce(p_signer_function, '')), ''),
      v_signer_email,
      true
    )
    on conflict do nothing;

    v_avv_recorded := true;
  end if;

  ok := true;
  accepted_at := v_now;
  avv_recorded := v_avv_recorded;
  return next;
end;
$$;

grant execute on function public.accept_current_legal(boolean, boolean, boolean, text, boolean, text, text, text) to authenticated;

commit;
