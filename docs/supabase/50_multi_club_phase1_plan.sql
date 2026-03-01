-- 50_multi_club_phase1_plan.sql
-- PURPOSE:
--   Vorbereitung Multi-Club Phase 1 (Schema + Indizes + optionale Backfill-Hooks).
-- IMPORTANT:
--   Dieses Skript ist als PLAN/Template gedacht. Vor produktiver Ausfuehrung auf Staging pruefen.
--
-- ORDER OF EXECUTION (empfohlen):
--   1) clubs/memberships bereitstellen
--   2) club_id columns nullable adden
--   3) Backfill
--   4) FK + index
--   5) NOT NULL erzwingen
--   6) RLS Policies umstellen

begin;

-- -------------------------------------------------------------------
-- 1) Clubs table (falls nicht vorhanden)
-- -------------------------------------------------------------------
create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now()
);

create index if not exists clubs_status_idx on public.clubs(status);

-- -------------------------------------------------------------------
-- 2) Memberships core (falls nicht vorhanden)
-- -------------------------------------------------------------------
create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  club_id uuid not null references public.clubs(id) on delete restrict,
  role text not null default 'member',
  member_no text,
  status text not null default 'active' check (status in ('active','pending','suspended','left')),
  valid_from date,
  valid_to date,
  attributes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists memberships_club_member_no_uniq
  on public.memberships(club_id, member_no)
  where member_no is not null;

create index if not exists memberships_user_club_status_idx
  on public.memberships(user_id, club_id, status);

-- -------------------------------------------------------------------
-- 3) club_id preparation on domain tables (EXAMPLE BLOCK)
-- -------------------------------------------------------------------
-- IMPORTANT:
--   Nur Tabellen anfassen, die im Projekt wirklich vorhanden sind.
--   Die folgenden ALTERs ggf. an eure echten Tabellennamen anpassen.

-- Feed
alter table if exists public.feed_posts
  add column if not exists club_id uuid;

create index if not exists feed_posts_club_created_idx
  on public.feed_posts(club_id, created_at desc);

-- Termine (Beispiel)
alter table if exists public.club_events
  add column if not exists club_id uuid;

create index if not exists club_events_club_start_idx
  on public.club_events(club_id, start_at);

-- Arbeitseinsaetze (Beispiel)
alter table if exists public.work_events
  add column if not exists club_id uuid;

create index if not exists work_events_club_start_idx
  on public.work_events(club_id, starts_at);

-- Fangliste (Beispiel)
alter table if exists public.catch_entries
  add column if not exists club_id uuid;

create index if not exists catch_entries_club_created_idx
  on public.catch_entries(club_id, created_at desc);

-- Dokumente (Beispiel)
alter table if exists public.public_documents
  add column if not exists club_id uuid;

create index if not exists public_documents_club_created_idx
  on public.public_documents(club_id, created_at desc);

-- Notizen (Beispiel)
alter table if exists public.app_notes
  add column if not exists club_id uuid;

create index if not exists app_notes_club_created_idx
  on public.app_notes(club_id, created_at desc);

-- -------------------------------------------------------------------
-- 4) Optional helper for "active memberships of current user"
-- -------------------------------------------------------------------
create or replace function public.active_user_club_ids()
returns table(club_id uuid)
language sql
stable
security invoker
as $$
  select m.club_id
  from public.memberships m
  where m.user_id = auth.uid()
    and m.status = 'active'
$$;

-- -------------------------------------------------------------------
-- 5) TODO BACKFILL SECTION (manuell fuer euer System ausfuehren)
-- -------------------------------------------------------------------
-- Beispiel:
-- update public.feed_posts set club_id = '<DEFAULT_CLUB_UUID>' where club_id is null;
-- update public.work_events set club_id = '<DEFAULT_CLUB_UUID>' where club_id is null;
-- ...

-- -------------------------------------------------------------------
-- 6) FK + NOT NULL (erst NACH Backfill)
-- -------------------------------------------------------------------
-- Beispiel:
-- alter table public.feed_posts
--   add constraint feed_posts_club_fk foreign key (club_id) references public.clubs(id) on delete restrict;
-- alter table public.feed_posts alter column club_id set not null;

-- Wiederhole je Tabelle nach erfolgreichem Backfill.

commit;
