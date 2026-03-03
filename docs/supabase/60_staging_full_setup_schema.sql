-- Full staging schema setup (structure only)
-- Generated: 2026-03-02
-- This file bundles existing migrations from docs/supabase/00..51 (filtered).
-- Excluded: seed/demo/import templates and diagnostics-only SQL.

-- Run in Supabase SQL Editor (service role) against empty staging DB.
-- Optional seeds/imports should be executed separately.

-- ==================================================================
-- BEGIN: docs/supabase/00_baseline.sql
-- ==================================================================
-- VDAN Template — Supabase baseline (service role)
-- Goal:
-- - profiles linked to auth.users
-- - simple role model (member/admin/vorstand)
-- - demo table app_notes with strict RLS

begin;

-- =========================
-- 1) Profiles
-- =========================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Keep profile in sync (optional: you can call this from app or trigger)
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_profiles_touch on public.profiles;
create trigger trg_profiles_touch
before update on public.profiles
for each row execute function public.touch_updated_at();

-- profile: owner can read/write own row
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

-- =========================
-- 2) Roles (simple)
-- =========================
create table if not exists public.user_roles (
  user_id uuid references auth.users(id) on delete cascade,
  role text not null check (role in ('member','admin','vorstand')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

alter table public.user_roles enable row level security;

-- helper: is admin?
create or replace function public.is_admin()
returns boolean language sql stable as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  );
$$;

-- roles: only admins can read/write role assignments
drop policy if exists "roles_admin_all" on public.user_roles;
create policy "roles_admin_all"
on public.user_roles
for all
using (public.is_admin())
with check (public.is_admin());

-- =========================
-- 3) Demo table: app_notes
-- =========================
create table if not exists public.app_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

alter table public.app_notes enable row level security;

-- Member: only own rows
drop policy if exists "notes_select_own" on public.app_notes;
create policy "notes_select_own"
on public.app_notes for select
using (public.is_admin() or auth.uid() = user_id);

drop policy if exists "notes_insert_own" on public.app_notes;
create policy "notes_insert_own"
on public.app_notes for insert
with check (public.is_admin() or auth.uid() = user_id);

drop policy if exists "notes_update_own" on public.app_notes;
create policy "notes_update_own"
on public.app_notes for update
using (public.is_admin() or auth.uid() = user_id)
with check (public.is_admin() or auth.uid() = user_id);

drop policy if exists "notes_delete_own" on public.app_notes;
create policy "notes_delete_own"
on public.app_notes for delete
using (public.is_admin() or auth.uid() = user_id);

commit;

-- ==================================================================
-- END: docs/supabase/00_baseline.sql
-- ==================================================================

-- ==================================================================
-- BEGIN: docs/supabase/01_bootstrap_admin.sql
-- ==================================================================
-- VDAN Template — bootstrap
-- 1) Create user in Supabase Auth UI (email/password)
-- 2) Then run:

insert into public.user_roles(user_id, role)
values
  ('4ec2ca98-39d7-4cc4-97c7-d3b7af94ebcb', 'admin'),
  ('eb43742c-a803-4473-b7b3-4992fec15603', 'admin')
on conflict (user_id, role) do nothing;

-- Example for vorstand:
-- insert into public.user_roles(user_id, role)
-- values ('<USER_UUID>', 'vorstand')
-- on conflict (user_id, role) do nothing;

-- ==================================================================
-- END: docs/supabase/01_bootstrap_admin.sql
-- ==================================================================

-- ==================================================================
-- BEGIN: docs/supabase/02_feed_posts.sql
-- ==================================================================
-- VDAN Template — feed posts + role extension (service role)
-- Run this after 00_baseline.sql

begin;

-- 1) Extend role model to include 'vorstand'
alter table public.user_roles drop constraint if exists user_roles_role_check;
alter table public.user_roles
  add constraint user_roles_role_check
  check (role in ('member','admin','vorstand'));

-- 2) Helper: admin or vorstand
create or replace function public.is_admin_or_vorstand()
returns boolean language sql stable as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin','vorstand')
  );
$$;

-- 3) Let users read their own roles (admins still manage all)
drop policy if exists "roles_select_own" on public.user_roles;
create policy "roles_select_own"
on public.user_roles for select
using (auth.uid() = user_id or public.is_admin());

-- 4) Feed table
create table if not exists public.feed_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('info','termin','jugend','arbeitseinsatz')),
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_feed_posts_created_at_desc on public.feed_posts(created_at desc);

alter table public.feed_posts enable row level security;

drop trigger if exists trg_feed_posts_touch on public.feed_posts;
create trigger trg_feed_posts_touch
before update on public.feed_posts
for each row execute function public.touch_updated_at();

-- public read for homepage feed
grant select on public.feed_posts to anon, authenticated;
-- writes only for logged-in users; RLS limits to admin/vorstand
grant insert, update, delete on public.feed_posts to authenticated;

-- RLS policies
drop policy if exists "feed_select_all" on public.feed_posts;
create policy "feed_select_all"
on public.feed_posts for select
using (true);

drop policy if exists "feed_insert_manager" on public.feed_posts;
create policy "feed_insert_manager"
on public.feed_posts for insert
with check (public.is_admin_or_vorstand() and auth.uid() = author_id);

drop policy if exists "feed_update_manager" on public.feed_posts;
create policy "feed_update_manager"
on public.feed_posts for update
using (public.is_admin_or_vorstand())
with check (public.is_admin_or_vorstand());

drop policy if exists "feed_delete_manager" on public.feed_posts;
create policy "feed_delete_manager"
on public.feed_posts for delete
using (public.is_admin_or_vorstand());

commit;

-- ==================================================================
-- END: docs/supabase/02_feed_posts.sql
-- ==================================================================

-- ==================================================================
-- BEGIN: docs/supabase/04_feed_post_media.sql
-- ==================================================================
-- VDAN Template — feed post media (max 2 images per post)
-- Run this after:
-- 00_baseline.sql
-- 02_feed_posts.sql

begin;

-- 1) Storage bucket for feed images (public read)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('feed-media', 'feed-media', true, 524288, array['image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- 2) Media metadata table
create table if not exists public.feed_post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.feed_posts(id) on delete cascade,
  sort_order smallint not null check (sort_order between 1 and 2),
  storage_bucket text not null default 'feed-media',
  storage_path text not null unique,
  photo_bytes integer not null check (photo_bytes > 0),
  width integer,
  height integer,
  mime_type text not null default 'image/webp',
  uploaded_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '5 years'),
  created_by uuid not null references auth.users(id) on delete cascade,
  unique (post_id, sort_order)
);

create index if not exists idx_feed_post_media_post on public.feed_post_media(post_id);
create index if not exists idx_feed_post_media_expires on public.feed_post_media(expires_at);

alter table public.feed_post_media enable row level security;

grant select on public.feed_post_media to anon, authenticated;
grant insert, update, delete on public.feed_post_media to authenticated;

-- 3) Enforce max. 2 images per post
create or replace function public.enforce_feed_media_limit()
returns trigger language plpgsql as $$
declare
  media_count integer;
begin
  select count(*) into media_count
  from public.feed_post_media m
  where m.post_id = new.post_id
    and (tg_op <> 'UPDATE' or m.id <> new.id);

  if media_count >= 2 then
    raise exception 'Maximal 2 Bilder pro Feed-Post erlaubt.';
  end if;

  return new;
end $$;

drop trigger if exists trg_feed_media_limit on public.feed_post_media;
create trigger trg_feed_media_limit
before insert or update on public.feed_post_media
for each row execute function public.enforce_feed_media_limit();

-- 4) RLS: read all, write only admin/vorstand

drop policy if exists "feed_media_select_all" on public.feed_post_media;
create policy "feed_media_select_all"
on public.feed_post_media for select
using (true);

drop policy if exists "feed_media_insert_manager" on public.feed_post_media;
create policy "feed_media_insert_manager"
on public.feed_post_media for insert
with check (public.is_admin_or_vorstand() and auth.uid() = created_by);

drop policy if exists "feed_media_update_manager" on public.feed_post_media;
create policy "feed_media_update_manager"
on public.feed_post_media for update
using (public.is_admin_or_vorstand())
with check (public.is_admin_or_vorstand());

drop policy if exists "feed_media_delete_manager" on public.feed_post_media;
create policy "feed_media_delete_manager"
on public.feed_post_media for delete
using (public.is_admin_or_vorstand());

-- 5) Storage policies

drop policy if exists "feed_media_public_read" on storage.objects;
create policy "feed_media_public_read"
on storage.objects for select
using (bucket_id = 'feed-media');

drop policy if exists "feed_media_manager_insert" on storage.objects;
create policy "feed_media_manager_insert"
on storage.objects for insert
with check (
  bucket_id = 'feed-media'
  and public.is_admin_or_vorstand()
  and name like 'posts/%'
);

drop policy if exists "feed_media_manager_update" on storage.objects;
create policy "feed_media_manager_update"
on storage.objects for update
using (
  bucket_id = 'feed-media'
  and public.is_admin_or_vorstand()
  and name like 'posts/%'
)
with check (
  bucket_id = 'feed-media'
  and public.is_admin_or_vorstand()
  and name like 'posts/%'
);

drop policy if exists "feed_media_manager_delete" on storage.objects;
create policy "feed_media_manager_delete"
on storage.objects for delete
using (
  bucket_id = 'feed-media'
  and public.is_admin_or_vorstand()
  and name like 'posts/%'
);

commit;

-- ==================================================================
-- END: docs/supabase/04_feed_post_media.sql
-- ==================================================================

-- ==================================================================
-- BEGIN: docs/supabase/05_catchlist_core.sql
-- ==================================================================
-- VDAN Template — catch list core
-- Run this after:
-- 00_baseline.sql
-- 02_feed_posts.sql

begin;

-- 1) Master data: water bodies
create table if not exists public.water_bodies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  area_kind text not null check (area_kind in ('vereins_gemeinschaftsgewaesser','rheinlos39')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (name, area_kind)
);

alter table public.water_bodies enable row level security;
grant select on public.water_bodies to anon, authenticated;
grant insert, update, delete on public.water_bodies to authenticated;

drop policy if exists "water_select_all" on public.water_bodies;
create policy "water_select_all"
on public.water_bodies for select
using (true);

drop policy if exists "water_write_manager" on public.water_bodies;
create policy "water_write_manager"
on public.water_bodies for all
using (public.is_admin_or_vorstand())
with check (public.is_admin_or_vorstand());

-- 2) Master data: fish species
create table if not exists public.fish_species (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.fish_species enable row level security;
grant select on public.fish_species to anon, authenticated;
grant insert, update, delete on public.fish_species to authenticated;

drop policy if exists "species_select_all" on public.fish_species;
create policy "species_select_all"
on public.fish_species for select
using (true);

drop policy if exists "species_write_manager" on public.fish_species;
create policy "species_write_manager"
on public.fish_species for all
using (public.is_admin_or_vorstand())
with check (public.is_admin_or_vorstand());

-- 3) Catch list records
create table if not exists public.catch_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  water_body_id uuid not null references public.water_bodies(id),
  fish_species_id uuid not null references public.fish_species(id),
  caught_on date not null,
  quantity integer not null check (quantity > 0 and quantity <= 200),
  length_cm numeric(5,1),
  weight_g integer,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length_cm is null or length_cm > 0),
  check (weight_g is null or weight_g > 0)
);

create index if not exists idx_catch_entries_user_date on public.catch_entries(user_id, caught_on desc);
create index if not exists idx_catch_entries_caught_on on public.catch_entries(caught_on desc);

alter table public.catch_entries enable row level security;
grant select, insert, update, delete on public.catch_entries to authenticated;

drop trigger if exists trg_catch_entries_touch on public.catch_entries;
create trigger trg_catch_entries_touch
before update on public.catch_entries
for each row execute function public.touch_updated_at();

-- own entries + manager override

drop policy if exists "catch_select_own_or_manager" on public.catch_entries;
create policy "catch_select_own_or_manager"
on public.catch_entries for select
using (auth.uid() = user_id or public.is_admin_or_vorstand());

drop policy if exists "catch_insert_own_or_manager" on public.catch_entries;
create policy "catch_insert_own_or_manager"
on public.catch_entries for insert
with check ((auth.uid() = user_id) or public.is_admin_or_vorstand());

drop policy if exists "catch_update_own_or_manager" on public.catch_entries;
create policy "catch_update_own_or_manager"
on public.catch_entries for update
using ((auth.uid() = user_id) or public.is_admin_or_vorstand())
with check ((auth.uid() = user_id) or public.is_admin_or_vorstand());

drop policy if exists "catch_delete_own_or_manager" on public.catch_entries;
create policy "catch_delete_own_or_manager"
on public.catch_entries for delete
using ((auth.uid() = user_id) or public.is_admin_or_vorstand());

commit;

-- ==================================================================
-- END: docs/supabase/05_catchlist_core.sql
-- ==================================================================

-- ==================================================================
-- BEGIN: docs/supabase/07_water_bodies_multikey_migration.sql
-- ==================================================================
-- VDAN Template — migration for existing DBs
-- Enables same water name in multiple keys (e.g. Angelweiher)

begin;

alter table public.water_bodies
  drop constraint if exists water_bodies_name_key;

alter table public.water_bodies
  add constraint water_bodies_name_area_kind_key unique (name, area_kind);

commit;

-- ==================================================================
-- END: docs/supabase/07_water_bodies_multikey_migration.sql
-- ==================================================================

-- ==================================================================
-- BEGIN: docs/supabase/08_work_events.sql
-- ==================================================================
-- VDAN Template — work events (Arbeitseinsaetze)
-- Run this after:
-- 00_baseline.sql
-- 02_feed_posts.sql

begin;

-- =========================
-- 1) Enums
-- =========================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'work_event_status') then
    create type public.work_event_status as enum ('draft', 'published', 'cancelled', 'archived');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'work_participation_status') then
    create type public.work_participation_status as enum ('registered', 'checked_in', 'submitted', 'approved', 'rejected', 'no_show');
  end if;
end $$;

-- =========================
-- 2) Tables
-- =========================
create table if not exists public.work_events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid,
  title text not null check (char_length(trim(title)) >= 3),
  description text,
  location text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  max_participants integer check (max_participants is null or max_participants > 0),
  status public.work_event_status not null default 'draft',
  public_token text not null unique default encode(gen_random_bytes(16), 'hex'),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists idx_work_events_status_start on public.work_events(status, starts_at);
create index if not exists idx_work_events_start on public.work_events(starts_at);

drop trigger if exists trg_work_events_touch on public.work_events;
create trigger trg_work_events_touch
before update on public.work_events
for each row execute function public.touch_updated_at();

create table if not exists public.work_participations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.work_events(id) on delete cascade,
  auth_uid uuid not null references auth.users(id) on delete cascade,
  status public.work_participation_status not null default 'registered',
  minutes_reported integer check (minutes_reported is null or minutes_reported >= 0),
  minutes_approved integer check (minutes_approved is null or minutes_approved >= 0),
  checkin_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  note_member text,
  note_admin text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, auth_uid)
);

create index if not exists idx_work_participations_event on public.work_participations(event_id);
create index if not exists idx_work_participations_uid on public.work_participations(auth_uid);
create index if not exists idx_work_participations_status on public.work_participations(status);

drop trigger if exists trg_work_participations_touch on public.work_participations;
create trigger trg_work_participations_touch
before update on public.work_participations
for each row execute function public.touch_updated_at();

-- Optional audit table
create table if not exists public.work_checkins (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.work_events(id) on delete cascade,
  auth_uid uuid not null references auth.users(id) on delete cascade,
  checkin_at timestamptz not null default now(),
  method text not null check (method in ('qr', 'manual'))
);

create index if not exists idx_work_checkins_event_uid on public.work_checkins(event_id, auth_uid);

-- =========================
-- 3) Privileges + RLS
-- =========================
alter table public.work_events enable row level security;
alter table public.work_participations enable row level security;
alter table public.work_checkins enable row level security;

grant select on public.work_events to anon, authenticated;
grant select, insert, update, delete on public.work_events to authenticated;
grant select on public.work_participations to authenticated;
grant select, insert, update, delete on public.work_participations to authenticated;
grant select on public.work_checkins to authenticated;
grant insert on public.work_checkins to authenticated;

drop policy if exists "work_events_member_select_published" on public.work_events;
create policy "work_events_member_select_published"
on public.work_events for select
using (status = 'published' or public.is_admin_or_vorstand());

drop policy if exists "work_events_manager_all" on public.work_events;
create policy "work_events_manager_all"
on public.work_events for all
using (public.is_admin_or_vorstand())
with check (public.is_admin_or_vorstand());

drop policy if exists "work_participations_member_select_own_or_manager" on public.work_participations;
create policy "work_participations_member_select_own_or_manager"
on public.work_participations for select
using (auth_uid = auth.uid() or public.is_admin_or_vorstand());

drop policy if exists "work_participations_member_insert_own_published" on public.work_participations;
create policy "work_participations_member_insert_own_published"
on public.work_participations for insert
with check (
  (
    auth_uid = auth.uid()
    and exists (
      select 1
      from public.work_events e
      where e.id = event_id
        and e.status = 'published'
    )
  )
  or public.is_admin_or_vorstand()
);

drop policy if exists "work_participations_member_update_own_or_manager" on public.work_participations;
create policy "work_participations_member_update_own_or_manager"
on public.work_participations for update
using (auth_uid = auth.uid() or public.is_admin_or_vorstand())
with check (auth_uid = auth.uid() or public.is_admin_or_vorstand());

drop policy if exists "work_participations_manager_delete" on public.work_participations;
create policy "work_participations_manager_delete"
on public.work_participations for delete
using (public.is_admin_or_vorstand());

drop policy if exists "work_checkins_select_own_or_manager" on public.work_checkins;
create policy "work_checkins_select_own_or_manager"
on public.work_checkins for select
using (auth_uid = auth.uid() or public.is_admin_or_vorstand());

drop policy if exists "work_checkins_insert_own_or_manager" on public.work_checkins;
create policy "work_checkins_insert_own_or_manager"
on public.work_checkins for insert
with check (auth_uid = auth.uid() or public.is_admin_or_vorstand());

-- Guard member updates so they cannot change status/admin fields directly.
create or replace function public.enforce_work_participation_update()
returns trigger
language plpgsql
as $$
begin
  if public.is_admin_or_vorstand() then
    return new;
  end if;

  if old.auth_uid <> auth.uid() then
    raise exception 'Not allowed';
  end if;

  if old.status in ('approved', 'rejected', 'no_show') then
    raise exception 'Finalized participations can only be changed by vorstand/admin';
  end if;

  if new.event_id <> old.event_id
     or new.auth_uid <> old.auth_uid
     or new.status <> old.status
     or coalesce(new.minutes_approved, -1) <> coalesce(old.minutes_approved, -1)
     or coalesce(new.approved_by, '00000000-0000-0000-0000-000000000000'::uuid) <> coalesce(old.approved_by, '00000000-0000-0000-0000-000000000000'::uuid)
     or coalesce(new.approved_at, 'epoch'::timestamptz) <> coalesce(old.approved_at, 'epoch'::timestamptz)
     or coalesce(new.note_admin, '') <> coalesce(old.note_admin, '')
     or coalesce(new.checkin_at, 'epoch'::timestamptz) <> coalesce(old.checkin_at, 'epoch'::timestamptz)
  then
    raise exception 'Members may only edit minutes_reported and note_member';
  end if;

  if coalesce(new.minutes_reported, -1) <> coalesce(old.minutes_reported, -1)
     or coalesce(new.note_member, '') <> coalesce(old.note_member, '')
  then
    new.status := 'submitted';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_work_participations_member_guard on public.work_participations;
create trigger trg_work_participations_member_guard
before update on public.work_participations
for each row execute function public.enforce_work_participation_update();

-- =========================
-- 4) RPCs
-- =========================
create or replace function public.work_event_create(
  p_title text,
  p_description text default null,
  p_location text default null,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_max_participants integer default null
)
returns public.work_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.work_events;
begin
  if not public.is_admin_or_vorstand() then
    raise exception 'Only vorstand/admin can create work events';
  end if;

  insert into public.work_events (
    title, description, location, starts_at, ends_at, max_participants, status, created_by
  )
  values (
    p_title,
    nullif(trim(coalesce(p_description, '')), ''),
    nullif(trim(coalesce(p_location, '')), ''),
    coalesce(p_starts_at, now() + interval '1 day'),
    coalesce(p_ends_at, now() + interval '1 day' + interval '2 hours'),
    p_max_participants,
    'draft',
    auth.uid()
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.work_event_publish(p_event_id uuid)
returns public.work_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.work_events;
begin
  if not public.is_admin_or_vorstand() then
    raise exception 'Only vorstand/admin can publish work events';
  end if;

  update public.work_events
  set status = 'published',
      updated_at = now()
  where id = p_event_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Event not found';
  end if;

  return v_row;
end;
$$;

create or replace function public.work_register(p_event_id uuid)
returns public.work_participations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.work_events;
  v_row public.work_participations;
  v_now_berlin timestamp := (now() at time zone 'Europe/Berlin');
  v_start_berlin timestamp;
  v_end_berlin timestamp;
begin
  select * into v_event from public.work_events where id = p_event_id;
  if v_event.id is null then
    raise exception 'Event not found';
  end if;
  if v_event.status <> 'published' then
    raise exception 'Event is not published';
  end if;

  v_start_berlin := (v_event.starts_at at time zone 'Europe/Berlin');
  v_end_berlin := (v_event.ends_at at time zone 'Europe/Berlin');

  if v_now_berlin < (v_start_berlin - interval '10 minutes') then
    raise exception 'Registration opens 10 minutes before event start';
  end if;

  if v_now_berlin > v_end_berlin then
    raise exception 'Registration closed (event already ended)';
  end if;

  if v_event.max_participants is not null and (
    select count(*) from public.work_participations wp where wp.event_id = v_event.id
  ) >= v_event.max_participants then
    raise exception 'Event is full';
  end if;

  insert into public.work_participations (event_id, auth_uid, status)
  values (v_event.id, auth.uid(), 'registered')
  on conflict (event_id, auth_uid) do update
  set status = case
        when public.work_participations.status in ('approved', 'rejected', 'no_show') then public.work_participations.status
        else 'registered'
      end,
      updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.work_checkin(p_public_token text)
returns public.work_participations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.work_events;
  v_row public.work_participations;
  v_now timestamptz := now();
  v_today date := timezone('Europe/Berlin', now())::date;
  v_event_day date;
begin
  select * into v_event
  from public.work_events
  where public_token = p_public_token
  limit 1;

  if v_event.id is null then
    raise exception 'Event not found';
  end if;

  if v_event.status <> 'published' then
    raise exception 'Event is not published';
  end if;

  v_event_day := timezone('Europe/Berlin', v_event.starts_at)::date;
  if v_event_day <> v_today then
    raise exception 'Check-in is only possible on event day';
  end if;

  if not (
    v_now >= (v_event.starts_at - interval '2 hours')
    and v_now <= (v_event.ends_at + interval '2 hours')
  ) then
    raise exception 'Check-in window is closed';
  end if;

  insert into public.work_participations (event_id, auth_uid, status, checkin_at)
  values (v_event.id, auth.uid(), 'checked_in', v_now)
  on conflict (event_id, auth_uid) do update
  set status = case
        when public.work_participations.status = 'approved' then 'approved'
        else 'checked_in'
      end,
      checkin_at = v_now,
      updated_at = now()
  returning * into v_row;

  insert into public.work_checkins(event_id, auth_uid, checkin_at, method)
  values (v_event.id, auth.uid(), v_now, 'qr');

  return v_row;
end;
$$;

create or replace function public.work_approve(p_participation_id uuid, p_minutes_approved integer)
returns public.work_participations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.work_participations;
begin
  if not public.is_admin_or_vorstand() then
    raise exception 'Only vorstand/admin can approve';
  end if;

  update public.work_participations
  set status = 'approved',
      minutes_approved = greatest(coalesce(p_minutes_approved, 0), 0),
      approved_by = auth.uid(),
      approved_at = now(),
      updated_at = now()
  where id = p_participation_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Participation not found';
  end if;

  return v_row;
end;
$$;

create or replace function public.work_reject(p_participation_id uuid, p_note_admin text default null)
returns public.work_participations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.work_participations;
begin
  if not public.is_admin_or_vorstand() then
    raise exception 'Only vorstand/admin can reject';
  end if;

  update public.work_participations
  set status = 'rejected',
      note_admin = nullif(trim(coalesce(p_note_admin, '')), ''),
      approved_by = auth.uid(),
      approved_at = now(),
      updated_at = now()
  where id = p_participation_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Participation not found';
  end if;

  return v_row;
end;
$$;

grant execute on function public.work_event_create(text, text, text, timestamptz, timestamptz, integer) to authenticated;
grant execute on function public.work_event_publish(uuid) to authenticated;
grant execute on function public.work_register(uuid) to authenticated;
grant execute on function public.work_checkin(text) to authenticated;
grant execute on function public.work_approve(uuid, integer) to authenticated;
grant execute on function public.work_reject(uuid, text) to authenticated;

commit;

-- ==================================================================
-- END: docs/supabase/08_work_events.sql
-- ==================================================================

-- ==================================================================
-- BEGIN: docs/supabase/09_terms_core.sql
-- ==================================================================
-- VDAN Template — regular club events (Termine) for shared calendar/feed
-- Run this after:
-- 00_baseline.sql
-- 02_feed_posts.sql
-- 08_work_events.sql

begin;

create table if not exists public.club_events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) >= 3),
  description text,
  location text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.work_event_status not null default 'draft',
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists idx_club_events_status_start on public.club_events(status, starts_at);

drop trigger if exists trg_club_events_touch on public.club_events;
create trigger trg_club_events_touch
before update on public.club_events
for each row execute function public.touch_updated_at();

alter table public.club_events enable row level security;

grant select on public.club_events to anon, authenticated;
grant insert, update, delete on public.club_events to authenticated;

drop policy if exists "club_events_select_published_or_manager" on public.club_events;
create policy "club_events_select_published_or_manager"
on public.club_events for select
using (status = 'published' or public.is_admin_or_vorstand());

drop policy if exists "club_events_manager_all" on public.club_events;
create policy "club_events_manager_all"
on public.club_events for all
using (public.is_admin_or_vorstand())
with check (public.is_admin_or_vorstand());

create or replace function public.term_event_create(
  p_title text,
  p_description text default null,
  p_location text default null,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null
)
returns public.club_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.club_events;
begin
  if not public.is_admin_or_vorstand() then
    raise exception 'Only vorstand/admin can create terms';
  end if;

  insert into public.club_events(title, description, location, starts_at, ends_at, status, created_by)
  values (
    p_title,
    nullif(trim(coalesce(p_description, '')), ''),
    nullif(trim(coalesce(p_location, '')), ''),
    coalesce(p_starts_at, now() + interval '1 day'),
    coalesce(p_ends_at, now() + interval '1 day' + interval '2 hours'),
    'draft',
    auth.uid()
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.term_event_publish(p_event_id uuid)
returns public.club_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.club_events;
begin
  if not public.is_admin_or_vorstand() then
    raise exception 'Only vorstand/admin can publish terms';
  end if;

  update public.club_events
  set status = 'published',
      updated_at = now()
  where id = p_event_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Term event not found';
  end if;

  return v_row;
end;
$$;

grant execute on function public.term_event_create(text, text, text, timestamptz, timestamptz) to authenticated;
grant execute on function public.term_event_publish(uuid) to authenticated;

commit;

-- ==================================================================
-- END: docs/supabase/09_terms_core.sql
-- ==================================================================

-- ==================================================================
-- BEGIN: docs/supabase/10_work_time_and_audit.sql
-- ==================================================================
-- VDAN Template — work time tracking + audit actor fields
-- Run this after:
-- 08_work_events.sql
-- 09_terms_core.sql

begin;

-- =========================
-- 1) Audit columns
-- =========================
alter table if exists public.work_events
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

alter table if exists public.work_participations
  add column if not exists checkout_at timestamptz,
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

alter table if exists public.club_events
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

alter table if exists public.feed_posts
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

update public.work_events set updated_by = created_by where updated_by is null;
update public.club_events set updated_by = created_by where updated_by is null;
update public.feed_posts set updated_by = author_id where updated_by is null;

-- Vorstand/Admin darf Namen aufloesen (Cockpit-Teilnehmerlisten).
drop policy if exists "profiles_select_manager" on public.profiles;
create policy "profiles_select_manager"
on public.profiles for select
using (public.is_admin_or_vorstand());

-- actor tracking trigger
create or replace function public.touch_updated_by()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null then
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_work_events_updated_by on public.work_events;
create trigger trg_work_events_updated_by
before insert or update on public.work_events
for each row execute function public.touch_updated_by();

drop trigger if exists trg_work_participations_updated_by on public.work_participations;
create trigger trg_work_participations_updated_by
before insert or update on public.work_participations
for each row execute function public.touch_updated_by();

drop trigger if exists trg_club_events_updated_by on public.club_events;
create trigger trg_club_events_updated_by
before insert or update on public.club_events
for each row execute function public.touch_updated_by();

drop trigger if exists trg_feed_posts_updated_by on public.feed_posts;
create trigger trg_feed_posts_updated_by
before insert or update on public.feed_posts
for each row execute function public.touch_updated_by();

-- =========================
-- 2) Participation rules
-- =========================
create or replace function public.enforce_work_participation_update()
returns trigger
language plpgsql
as $$
begin
  if public.is_admin_or_vorstand() then
    return new;
  end if;

  if old.auth_uid <> auth.uid() then
    raise exception 'Not allowed';
  end if;

  if old.status in ('approved', 'rejected', 'no_show') then
    raise exception 'Finalized participations can only be changed by vorstand/admin';
  end if;

  if new.event_id <> old.event_id
     or new.auth_uid <> old.auth_uid
     or new.status <> old.status
     or coalesce(new.minutes_approved, -1) <> coalesce(old.minutes_approved, -1)
     or coalesce(new.approved_by, '00000000-0000-0000-0000-000000000000'::uuid) <> coalesce(old.approved_by, '00000000-0000-0000-0000-000000000000'::uuid)
     or coalesce(new.approved_at, 'epoch'::timestamptz) <> coalesce(old.approved_at, 'epoch'::timestamptz)
     or coalesce(new.note_admin, '') <> coalesce(old.note_admin, '')
  then
    raise exception 'Members may only edit own time and note';
  end if;

  if coalesce(new.checkin_at, 'epoch'::timestamptz) <> coalesce(old.checkin_at, 'epoch'::timestamptz)
     or coalesce(new.checkout_at, 'epoch'::timestamptz) <> coalesce(old.checkout_at, 'epoch'::timestamptz)
     or coalesce(new.note_member, '') <> coalesce(old.note_member, '')
  then
    new.status := 'submitted';
  end if;

  return new;
end;
$$;

-- =========================
-- 3) RPCs
-- =========================
create or replace function public.work_register(p_event_id uuid)
returns public.work_participations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.work_events;
  v_row public.work_participations;
  v_now_berlin timestamp := (now() at time zone 'Europe/Berlin');
  v_start_berlin timestamp;
  v_end_berlin timestamp;
begin
  select * into v_event from public.work_events where id = p_event_id;
  if v_event.id is null then
    raise exception 'Event not found';
  end if;
  if v_event.status <> 'published' then
    raise exception 'Event is not published';
  end if;

  v_start_berlin := (v_event.starts_at at time zone 'Europe/Berlin');
  v_end_berlin := (v_event.ends_at at time zone 'Europe/Berlin');

  if v_now_berlin < (v_start_berlin - interval '10 minutes') then
    raise exception 'Registration opens 10 minutes before event start';
  end if;
  if v_now_berlin > v_end_berlin then
    raise exception 'Registration closed (event already ended)';
  end if;

  if v_event.max_participants is not null and (
    select count(*) from public.work_participations wp where wp.event_id = v_event.id
  ) >= v_event.max_participants then
    raise exception 'Event is full';
  end if;

  insert into public.work_participations (event_id, auth_uid, status, checkin_at)
  values (v_event.id, auth.uid(), 'checked_in', now())
  on conflict (event_id, auth_uid) do update
  set status = case
        when public.work_participations.status in ('approved', 'rejected', 'no_show') then public.work_participations.status
        else 'checked_in'
      end,
      checkin_at = coalesce(public.work_participations.checkin_at, now()),
      updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.work_checkin(p_public_token text)
returns public.work_participations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.work_events;
  v_row public.work_participations;
  v_now timestamptz := now();
  v_today date := timezone('Europe/Berlin', now())::date;
  v_event_day date;
begin
  select * into v_event from public.work_events where public_token = p_public_token limit 1;
  if v_event.id is null then
    raise exception 'Event not found';
  end if;
  if v_event.status <> 'published' then
    raise exception 'Event is not published';
  end if;

  v_event_day := timezone('Europe/Berlin', v_event.starts_at)::date;
  if v_event_day <> v_today then
    raise exception 'Check-in is only possible on event day';
  end if;

  if not (v_now >= (v_event.starts_at - interval '2 hours') and v_now <= (v_event.ends_at + interval '2 hours')) then
    raise exception 'Check-in window is closed';
  end if;

  insert into public.work_participations (event_id, auth_uid, status, checkin_at)
  values (v_event.id, auth.uid(), 'checked_in', v_now)
  on conflict (event_id, auth_uid) do update
  set status = case when public.work_participations.status = 'approved' then 'approved' else 'checked_in' end,
      checkin_at = coalesce(public.work_participations.checkin_at, v_now),
      updated_at = now()
  returning * into v_row;

  insert into public.work_checkins(event_id, auth_uid, checkin_at, method)
  values (v_event.id, auth.uid(), v_now, 'qr');

  return v_row;
end;
$$;

create or replace function public.work_checkout(p_event_id uuid)
returns public.work_participations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.work_participations;
begin
  update public.work_participations
  set checkout_at = now(),
      status = case when status = 'approved' then 'approved' else 'submitted' end,
      updated_at = now()
  where event_id = p_event_id
    and auth_uid = auth.uid()
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Participation not found';
  end if;

  return v_row;
end;
$$;

create or replace function public.work_participation_admin_update(
  p_participation_id uuid,
  p_checkin_at timestamptz default null,
  p_checkout_at timestamptz default null,
  p_note_admin text default null
)
returns public.work_participations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.work_participations;
begin
  if not public.is_admin_or_vorstand() then
    raise exception 'Only vorstand/admin can update participation times';
  end if;

  update public.work_participations
  set checkin_at = coalesce(p_checkin_at, checkin_at),
      checkout_at = coalesce(p_checkout_at, checkout_at),
      note_admin = coalesce(p_note_admin, note_admin),
      updated_at = now()
  where id = p_participation_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Participation not found';
  end if;

  return v_row;
end;
$$;

create or replace function public.work_approve(p_participation_id uuid, p_minutes_approved integer default null)
returns public.work_participations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.work_participations;
  v_minutes integer;
begin
  if not public.is_admin_or_vorstand() then
    raise exception 'Only vorstand/admin can approve';
  end if;

  select * into v_row from public.work_participations where id = p_participation_id;
  if v_row.id is null then
    raise exception 'Participation not found';
  end if;

  v_minutes := p_minutes_approved;
  if v_minutes is null and v_row.checkin_at is not null and v_row.checkout_at is not null then
    v_minutes := greatest(0, floor(extract(epoch from (v_row.checkout_at - v_row.checkin_at)) / 60)::integer);
  end if;

  update public.work_participations
  set status = 'approved',
      minutes_approved = greatest(coalesce(v_minutes, 0), 0),
      approved_by = auth.uid(),
      approved_at = now(),
      updated_at = now()
  where id = p_participation_id
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.work_register(uuid) to authenticated;
grant execute on function public.work_checkin(text) to authenticated;
grant execute on function public.work_checkout(uuid) to authenticated;
grant execute on function public.work_participation_admin_update(uuid, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.work_approve(uuid, integer) to authenticated;

commit;

-- ==================================================================
-- END: docs/supabase/10_work_time_and_audit.sql
-- ==================================================================

-- ==================================================================
-- BEGIN: docs/supabase/11_cto_alignment_keep_logic.sql
-- ==================================================================
-- VDAN Template — CTO alignment (keep existing project logic)
-- Run this after:
-- 10_work_time_and_audit.sql
--
-- Purpose:
-- - Align naming to CTO wording without breaking current app logic.
-- - Keep existing role model: user_roles.role in ('member','vorstand','admin').
-- - Keep existing member start flow: work_register sets checked_in + checkin_at.

begin;

-- =========================
-- 1) Role helper alias
-- =========================
-- CTO wording uses "board/admin". In this project "board" maps to "vorstand".
create or replace function public.is_board_or_admin()
returns boolean
language sql
stable
as $$
  select public.is_admin_or_vorstand();
$$;

-- =========================
-- 2) Participation guard hardening
-- =========================
-- Allow SQL editor/service-context updates where auth.uid() is null.
create or replace function public.enforce_work_participation_update()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if public.is_admin_or_vorstand() then
    return new;
  end if;

  if old.auth_uid <> auth.uid() then
    raise exception 'Not allowed';
  end if;

  if old.status in ('approved', 'rejected', 'no_show') then
    raise exception 'Finalized participations can only be changed by vorstand/admin';
  end if;

  if new.event_id <> old.event_id
     or new.auth_uid <> old.auth_uid
     or new.status <> old.status
     or coalesce(new.minutes_approved, -1) <> coalesce(old.minutes_approved, -1)
     or coalesce(new.approved_by, '00000000-0000-0000-0000-000000000000'::uuid) <> coalesce(old.approved_by, '00000000-0000-0000-0000-000000000000'::uuid)
     or coalesce(new.approved_at, 'epoch'::timestamptz) <> coalesce(old.approved_at, 'epoch'::timestamptz)
     or coalesce(new.note_admin, '') <> coalesce(old.note_admin, '')
  then
    raise exception 'Members may only edit own time and note';
  end if;

  if coalesce(new.checkin_at, 'epoch'::timestamptz) <> coalesce(old.checkin_at, 'epoch'::timestamptz)
     or coalesce(new.checkout_at, 'epoch'::timestamptz) <> coalesce(old.checkout_at, 'epoch'::timestamptz)
     or coalesce(new.note_member, '') <> coalesce(old.note_member, '')
  then
    new.status := 'submitted';
  end if;

  return new;
end;
$$;

-- =========================
-- 3) Ensure complete RPC set for cockpit workflow
-- =========================
create or replace function public.work_reject(p_participation_id uuid, p_note_admin text default null)
returns public.work_participations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.work_participations;
begin
  if not public.is_admin_or_vorstand() then
    raise exception 'Only vorstand/admin can reject';
  end if;

  update public.work_participations
  set status = 'rejected',
      note_admin = nullif(trim(coalesce(p_note_admin, '')), ''),
      approved_by = auth.uid(),
      approved_at = now(),
      updated_at = now()
  where id = p_participation_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Participation not found';
  end if;

  return v_row;
end;
$$;

grant execute on function public.work_reject(uuid, text) to authenticated;
grant execute on function public.is_board_or_admin() to authenticated;

commit;

-- ==================================================================
-- END: docs/supabase/11_cto_alignment_keep_logic.sql
-- ==================================================================

-- ==================================================================
-- BEGIN: docs/supabase/12_cto_qr_hidden_and_member_no.sql
-- ==================================================================
-- VDAN Template — CTO: QR backend ready, UI hidden by feature flag + member_no
-- Run this after:
-- 11_cto_alignment_keep_logic.sql

begin;

-- =========================
-- 1) Profiles: member_no as primary business reference
-- =========================
alter table if exists public.profiles
  add column if not exists club_id uuid,
  add column if not exists member_no text;

-- Backfill existing rows to make member_no non-null without losing uniqueness.
update public.profiles
set member_no = coalesce(nullif(trim(member_no), ''), 'AUTO-' || replace(left(id::text, 8), '-', ''))
where member_no is null or trim(member_no) = '';

alter table if exists public.profiles
  alter column member_no set not null;

-- Unique per club scope. Null club_id is mapped to zero UUID for stable uniqueness.
create unique index if not exists uq_profiles_club_member_no
on public.profiles (coalesce(club_id, '00000000-0000-0000-0000-000000000000'::uuid), member_no);

create index if not exists idx_profiles_club_member_no
on public.profiles (club_id, member_no);

-- =========================
-- 2) Feature flags
-- =========================
create table if not exists public.feature_flags (
  key text primary key,
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.feature_flags enable row level security;

drop trigger if exists trg_feature_flags_touch on public.feature_flags;
create trigger trg_feature_flags_touch
before update on public.feature_flags
for each row execute function public.touch_updated_at();

drop policy if exists "feature_flags_select_authenticated" on public.feature_flags;
create policy "feature_flags_select_authenticated"
on public.feature_flags for select
using (auth.uid() is not null);

drop policy if exists "feature_flags_manager_write" on public.feature_flags;
create policy "feature_flags_manager_write"
on public.feature_flags for all
using (public.is_admin_or_vorstand())
with check (public.is_admin_or_vorstand());

insert into public.feature_flags (key, enabled)
values ('work_qr_enabled', false)
on conflict (key) do nothing;

grant select on public.feature_flags to authenticated;
grant insert, update, delete on public.feature_flags to authenticated;

-- =========================
-- 3) Bootstrap RPC for frontend flags
-- =========================
create or replace function public.portal_bootstrap()
returns jsonb
language sql
security definer
set search_path = public
as $$
  with roles as (
    select coalesce(jsonb_agg(distinct ur.role), '[]'::jsonb) as val
    from public.user_roles ur
    where ur.user_id = auth.uid()
  ),
  flags as (
    select coalesce(jsonb_object_agg(ff.key, ff.enabled), '{}'::jsonb) as val
    from public.feature_flags ff
  )
  select jsonb_build_object(
    'roles', roles.val,
    'flags', flags.val
  )
  from roles, flags;
$$;

grant execute on function public.portal_bootstrap() to authenticated;

-- =========================
-- 4) Optional token rotation RPC (admin/vorstand)
-- =========================
create or replace function public.work_event_token_rotate(p_event_id uuid)
returns public.work_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.work_events;
begin
  if not public.is_admin_or_vorstand() then
    raise exception 'Only vorstand/admin can rotate token';
  end if;

  update public.work_events
  set public_token = encode(gen_random_bytes(16), 'hex'),
      updated_at = now()
  where id = p_event_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Event not found';
  end if;

  return v_row;
end;
$$;

grant execute on function public.work_event_token_rotate(uuid) to authenticated;

commit;

-- ==================================================================
-- END: docs/supabase/12_cto_qr_hidden_and_member_no.sql
-- ==================================================================

-- ==================================================================
-- BEGIN: docs/supabase/14_preflight_checks.sql
-- ==================================================================
-- VDAN Template — Preflight checks for CTO scope
-- Run as SQL snippets in Supabase SQL editor.

-- 1) Feature flag defaults (QR hidden)
select key, enabled
from public.feature_flags
where key = 'work_qr_enabled';

-- 2) Demo users roles + member_no presence
select p.id, p.email, p.member_no, ur.role
from public.profiles p
left join public.user_roles ur on ur.user_id = p.id
where p.email in ('demo_vorstand@example.org', 'demo_member@example.org', 'demo_admin@example.org')
order by p.email, ur.role;

-- 3) Required RPC/function presence
select proname
from pg_proc
where proname in (
  'portal_bootstrap',
  'work_register',
  'work_checkin',
  'work_checkout',
  'work_approve',
  'work_reject',
  'work_event_create',
  'work_event_publish',
  'work_participation_admin_update',
  'work_event_token_rotate',
  'is_board_or_admin'
)
order by proname;

-- 4) Profiles constraints/index-related visibility
select column_name, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'profiles'
  and column_name in ('member_no', 'club_id')
order by column_name;

-- 5) Member scope sanity check (replace UID):
-- select * from public.work_participations where auth_uid = '<DEMO_MEMBER_UID>' order by created_at desc;

-- ==================================================================
-- END: docs/supabase/14_preflight_checks.sql
-- ==================================================================

-- ==================================================================
-- BEGIN: docs/supabase/15_fix_role_helper_recursion.sql
-- ==================================================================
-- VDAN Template — fix stack depth recursion in role helpers
-- Run this after:
-- 12_cto_qr_hidden_and_member_no.sql
--
-- Problem:
-- - RLS policies on public.user_roles reference helper functions.
-- - Helpers queried public.user_roles under RLS again, which can recurse.
--
-- Fix:
-- - Recreate helper functions as SECURITY DEFINER with fixed search_path.
-- - This avoids recursive policy evaluation when checking roles.

begin;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  );
$$;

create or replace function public.is_admin_or_vorstand()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin','vorstand')
  );
$$;

commit;

-- ==================================================================
-- END: docs/supabase/15_fix_role_helper_recursion.sql
-- ==================================================================

-- ==================================================================
-- BEGIN: docs/supabase/17_profiles_force_password_change.sql
-- ==================================================================
-- VDAN Template — first-login password change flag
-- Run this after:
-- 12_cto_qr_hidden_and_member_no.sql

begin;

alter table if exists public.profiles
  add column if not exists must_change_password boolean not null default false,
  add column if not exists password_changed_at timestamptz;

create index if not exists idx_profiles_must_change_password
on public.profiles(must_change_password);

commit;


-- ==================================================================
-- END: docs/supabase/17_profiles_force_password_change.sql
-- ==================================================================

-- ==================================================================
-- BEGIN: docs/supabase/18_member_data_scope_hardening.sql
-- ==================================================================
-- VDAN Template — harden member data scope (own data only)
-- Run this after:
-- 15_fix_role_helper_recursion.sql
--
-- Goal:
-- - Members can only read/write their own catch/work rows.
-- - Vorstand/Admin keep cockpit scope.

begin;

-- =========================================
-- Catch entries: own rows for member, full for manager
-- =========================================
drop policy if exists "catch_select_own_or_manager" on public.catch_entries;
create policy "catch_select_own_or_manager"
on public.catch_entries for select
using (auth.uid() = user_id or public.is_admin_or_vorstand());

drop policy if exists "catch_insert_own_or_manager" on public.catch_entries;
create policy "catch_insert_own_or_manager"
on public.catch_entries for insert
with check (auth.uid() = user_id or public.is_admin_or_vorstand());

drop policy if exists "catch_update_own_or_manager" on public.catch_entries;
create policy "catch_update_own_or_manager"
on public.catch_entries for update
using (auth.uid() = user_id or public.is_admin_or_vorstand())
with check (auth.uid() = user_id or public.is_admin_or_vorstand());

drop policy if exists "catch_delete_own_or_manager" on public.catch_entries;
create policy "catch_delete_own_or_manager"
on public.catch_entries for delete
using (auth.uid() = user_id or public.is_admin_or_vorstand());

-- =========================================
-- Work participations: own rows for member, full for manager
-- =========================================
drop policy if exists "work_participations_member_select_own_or_manager" on public.work_participations;
create policy "work_participations_member_select_own_or_manager"
on public.work_participations for select
using (auth_uid = auth.uid() or public.is_admin_or_vorstand());

drop policy if exists "work_participations_member_insert_own_published" on public.work_participations;
create policy "work_participations_member_insert_own_published"
on public.work_participations for insert
with check (
  (
    auth_uid = auth.uid()
    and exists (
      select 1
      from public.work_events e
      where e.id = event_id
        and e.status = 'published'
    )
  )
  or public.is_admin_or_vorstand()
);

drop policy if exists "work_participations_member_update_own_or_manager" on public.work_participations;
create policy "work_participations_member_update_own_or_manager"
on public.work_participations for update
using (auth_uid = auth.uid() or public.is_admin_or_vorstand())
with check (auth_uid = auth.uid() or public.is_admin_or_vorstand());

drop policy if exists "work_participations_manager_delete" on public.work_participations;
create policy "work_participations_manager_delete"
on public.work_participations for delete
using (public.is_admin_or_vorstand());

-- =========================================
-- Work checkins: own rows for member, full for manager
-- =========================================
drop policy if exists "work_checkins_select_own_or_manager" on public.work_checkins;
create policy "work_checkins_select_own_or_manager"
on public.work_checkins for select
using (auth_uid = auth.uid() or public.is_admin_or_vorstand());

drop policy if exists "work_checkins_insert_own_or_manager" on public.work_checkins;
create policy "work_checkins_insert_own_or_manager"
on public.work_checkins for insert
with check (auth_uid = auth.uid() or public.is_admin_or_vorstand());

commit;


-- ==================================================================
-- END: docs/supabase/18_member_data_scope_hardening.sql
-- ==================================================================

-- ==================================================================
-- BEGIN: docs/supabase/19_member_card_validity.sql
-- ==================================================================
-- VDAN Template — member card validity
-- Run this after:
-- 17_profiles_force_password_change.sql

begin;

alter table if exists public.profiles
  add column if not exists member_card_valid boolean not null default true,
  add column if not exists member_card_valid_from date,
  add column if not exists member_card_valid_until date;

update public.profiles
set member_card_valid = true,
    member_card_valid_from = coalesce(member_card_valid_from, current_date),
    member_card_valid_until = coalesce(member_card_valid_until, (current_date + interval '1 year' - interval '1 day')::date)
where member_card_valid is distinct from true
   or member_card_valid_from is null
   or member_card_valid_until is null;

create index if not exists idx_profiles_member_card_valid
on public.profiles(member_card_valid, member_card_valid_until);

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin"
on public.profiles for update
using (public.is_admin())
with check (public.is_admin());

commit;


-- ==================================================================
-- END: docs/supabase/19_member_card_validity.sql
-- ==================================================================

-- ==================================================================
-- BEGIN: docs/supabase/20_water_areas_map.sql
-- ==================================================================
-- VDAN Template — water areas map source for member portal
-- Run this after:
-- 19_member_card_validity.sql

begin;

create table if not exists public.water_areas (
  id uuid primary key default gen_random_uuid(),
  water_body_id uuid references public.water_bodies(id) on delete set null,
  name text not null,
  area_kind text not null check (area_kind in ('vereins_gemeinschaftsgewaesser','rheinlos39')),
  geojson jsonb not null,
  source text default 'google_my_maps',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_water_areas_kind_active
on public.water_areas(area_kind, is_active);

drop trigger if exists trg_water_areas_touch on public.water_areas;
create trigger trg_water_areas_touch
before update on public.water_areas
for each row execute function public.touch_updated_at();

alter table public.water_areas enable row level security;

grant select on public.water_areas to authenticated;
grant insert, update, delete on public.water_areas to authenticated;

drop policy if exists "water_areas_select_authenticated" on public.water_areas;
create policy "water_areas_select_authenticated"
on public.water_areas for select
using (auth.uid() is not null);

drop policy if exists "water_areas_write_manager" on public.water_areas;
create policy "water_areas_write_manager"
on public.water_areas for all
using (public.is_admin_or_vorstand())
with check (public.is_admin_or_vorstand());

commit;


-- ==================================================================
-- END: docs/supabase/20_water_areas_map.sql
-- ==================================================================

-- ==================================================================
-- BEGIN: docs/supabase/23_public_documents.sql
-- ==================================================================
-- VDAN Template — public documents index for downloads page
-- Run this after existing core migrations

begin;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  description text,
  public_url text,
  storage_bucket text,
  storage_path text,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint documents_source_check check (
    (public_url is not null and length(trim(public_url)) > 0)
    or (
      storage_bucket is not null and length(trim(storage_bucket)) > 0
      and storage_path is not null and length(trim(storage_path)) > 0
    )
  )
);

create index if not exists idx_documents_category_sort on public.documents(category, sort_order, title);
create index if not exists idx_documents_active on public.documents(is_active);

alter table public.documents enable row level security;

drop trigger if exists trg_documents_touch on public.documents;
create trigger trg_documents_touch
before update on public.documents
for each row execute function public.touch_updated_at();

drop policy if exists "documents_select_public" on public.documents;
create policy "documents_select_public"
on public.documents for select
using (true);

drop policy if exists "documents_write_manager" on public.documents;
create policy "documents_write_manager"
on public.documents for all
using (public.is_admin_or_vorstand())
with check (public.is_admin_or_vorstand());

grant select on public.documents to anon, authenticated;
grant insert, update, delete on public.documents to authenticated;

insert into public.documents (title, category, description, public_url, sort_order, is_active)
values
  ('Aufnahmeantrag', 'Aufnahmeanträge', 'Antrag für Erwachsene', '/Downloads/Aufnahmeantrag.pdf', 10, true),
  ('Aufnahmeantrag Jugend', 'Aufnahmeanträge', 'Antrag für Jugendliche', '/Downloads/Aufnahmeantrag_Jugend.pdf', 20, true),
  ('Änderungsformular persönliche Daten', 'Änderungsformulare', 'Änderungen zu Adresse/Kontakt/Bankdaten', '/Downloads/Aenderungsformular_Persoenliche_Daten.pdf', 10, true),
  ('Einwilligung Datenschutz', 'Datenschutz', 'Datenschutzrechtliche Einwilligungserklärung', '/Downloads/Datenschutzrechtliche_Einwilligungserklaerung_01.pdf', 10, true),
  ('Satzung', 'Satzung', 'Aktuelle Vereinssatzung', '/Downloads/Satzung.pdf', 10, true),
  ('Fangliste Innenwasser', 'Fanglisten/Stundennachweise', 'Fangliste Innenwasser', '/Downloads/Fangliste_Innenwasser.pdf', 10, true),
  ('Fangliste Rheinlos', 'Fanglisten/Stundennachweise', 'Fangliste Rheinlos', '/Downloads/Fangliste_Rheinlos.pdf', 20, true),
  ('Stundennachweis', 'Fanglisten/Stundennachweise', 'Stundennachweis', '/Downloads/Stundennachweis_01.pdf', 30, true)
on conflict do nothing;

commit;

-- ==================================================================
-- END: docs/supabase/23_public_documents.sql
-- ==================================================================

-- ==================================================================
-- BEGIN: docs/supabase/24_member_card_verification.sql
-- ==================================================================
-- VDAN Template — member card verification with card_id + key + QR support
-- Run this after:
-- 19_member_card_validity.sql

begin;

alter table if exists public.profiles
  add column if not exists member_card_id text,
  add column if not exists member_card_key text;

update public.profiles
set member_card_id = coalesce(nullif(trim(member_card_id), ''), 'MC-' || upper(substr(md5(id::text), 1, 10))),
    member_card_key = coalesce(nullif(trim(member_card_key), ''), upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 12)))
where member_card_id is null
   or trim(member_card_id) = ''
   or member_card_key is null
   or trim(member_card_key) = '';

alter table if exists public.profiles
  alter column member_card_id set not null,
  alter column member_card_key set not null;

create unique index if not exists uq_profiles_member_card_id
on public.profiles(member_card_id);

create or replace function public.member_card_verify(p_card_id text, p_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_role text := 'member';
  v_is_valid boolean := false;
begin
  if not public.is_admin_or_vorstand() then
    raise exception 'Only vorstand/admin can verify member cards';
  end if;

  select *
  into v_profile
  from public.profiles p
  where p.member_card_id = nullif(trim(p_card_id), '')
    and p.member_card_key = nullif(trim(p_key), '')
  limit 1;

  if v_profile.id is null then
    return jsonb_build_object(
      'ok', false,
      'reason', 'not_found'
    );
  end if;

  select case
           when exists (select 1 from public.user_roles ur where ur.user_id = v_profile.id and ur.role = 'admin') then 'admin'
           when exists (select 1 from public.user_roles ur where ur.user_id = v_profile.id and ur.role = 'vorstand') then 'vorstand'
           else 'member'
         end
  into v_role;

  v_is_valid := coalesce(v_profile.member_card_valid, false)
                and coalesce(v_profile.member_card_valid_from, current_date) <= current_date
                and coalesce(v_profile.member_card_valid_until, current_date) >= current_date;

  return jsonb_build_object(
    'ok', true,
    'valid', v_is_valid,
    'display_name', v_profile.display_name,
    'member_no', v_profile.member_no,
    'member_card_id', v_profile.member_card_id,
    'member_card_valid_from', v_profile.member_card_valid_from,
    'member_card_valid_until', v_profile.member_card_valid_until,
    'fishing_card_type', v_profile.fishing_card_type,
    'role', v_role
  );
end;
$$;

grant execute on function public.member_card_verify(text, text) to authenticated;

commit;

-- ==================================================================
-- END: docs/supabase/24_member_card_verification.sql
-- ==================================================================

-- ==================================================================
-- BEGIN: docs/supabase/25_member_card_rotate.sql
-- ==================================================================
-- VDAN Template — rotate member card key after verification/control
-- Run this after:
-- 24_member_card_verification.sql

begin;

create or replace function public.member_card_rotate_key(
  p_card_id text,
  p_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_new_key text;
begin
  if not public.is_admin_or_vorstand() then
    raise exception 'Only vorstand/admin can rotate member card key';
  end if;

  select *
  into v_profile
  from public.profiles p
  where p.member_card_id = nullif(trim(p_card_id), '')
    and p.member_card_key = nullif(trim(p_key), '')
  limit 1;

  if v_profile.id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  v_new_key := upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 12));

  update public.profiles
  set member_card_key = v_new_key,
      updated_at = now()
  where id = v_profile.id;

  return jsonb_build_object(
    'ok', true,
    'member_card_id', v_profile.member_card_id,
    'member_card_key', v_new_key,
    'display_name', v_profile.display_name,
    'member_no', v_profile.member_no
  );
end;
$$;

grant execute on function public.member_card_rotate_key(text, text) to authenticated;

commit;

-- ==================================================================
-- END: docs/supabase/25_member_card_rotate.sql
-- ==================================================================

-- ==================================================================
-- BEGIN: docs/supabase/26_membership_applications.sql
-- ==================================================================
-- VDAN Template — public membership applications with manager approval workflow
-- Run this after:
-- 25_member_card_rotate.sql
--
-- IMPORTANT:
-- Set a strong encryption key in DB settings before productive use, e.g.:
--   alter database postgres set app.settings.encryption_key = '<min-16-char-secret>';

begin;

create extension if not exists pgcrypto with schema extensions;

create sequence if not exists public.membership_number_seq start 1000;

create table if not exists public.membership_applications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  first_name text not null,
  last_name text not null,
  birthdate date not null,
  street text not null,
  zip text not null,
  city text not null,
  is_local boolean not null default false,
  known_member text,
  fishing_card_type text not null,
  iban_last4 text not null check (iban_last4 ~ '^[0-9]{4}$'),
  sepa_approved boolean not null default true check (sepa_approved = true),
  internal_questionnaire jsonb,
  decision_by uuid references auth.users(id),
  decision_at timestamptz,
  rejection_reason text
);

create table if not exists public.membership_application_bank_data (
  application_id uuid primary key references public.membership_applications(id) on delete cascade,
  iban_encrypted bytea not null,
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active', 'inactive')),
  membership_number text unique,
  first_name text not null,
  last_name text not null,
  birthdate date not null,
  street text not null,
  zip text not null,
  city text not null,
  is_local boolean not null default false,
  known_member text,
  fishing_card_type text not null,
  sepa_approved boolean not null default true check (sepa_approved = true),
  source_application_id uuid unique references public.membership_applications(id)
);

create table if not exists public.member_bank_data (
  member_id uuid primary key references public.members(id) on delete cascade,
  source_application_id uuid references public.membership_applications(id),
  iban_encrypted bytea not null,
  iban_last4 text not null check (iban_last4 ~ '^[0-9]{4}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.membership_application_audit (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references public.membership_applications(id) on delete cascade,
  action text not null check (action in ('submitted', 'questionnaire_updated', 'approved', 'rejected')),
  actor_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb
);

create index if not exists idx_membership_applications_status_created
on public.membership_applications(status, created_at desc);

create index if not exists idx_membership_applications_decision_by
on public.membership_applications(decision_by, decision_at desc);

create index if not exists idx_members_status_membership_number
on public.members(status, membership_number);

create index if not exists idx_membership_application_audit_app
on public.membership_application_audit(application_id, created_at desc);

drop trigger if exists trg_membership_applications_touch on public.membership_applications;
create trigger trg_membership_applications_touch
before update on public.membership_applications
for each row execute function public.touch_updated_at();

drop trigger if exists trg_members_touch on public.members;
create trigger trg_members_touch
before update on public.members
for each row execute function public.touch_updated_at();

alter table public.membership_applications enable row level security;
alter table public.membership_application_bank_data enable row level security;
alter table public.members enable row level security;
alter table public.member_bank_data enable row level security;
alter table public.membership_application_audit enable row level security;

drop policy if exists "membership_applications_anon_insert" on public.membership_applications;
create policy "membership_applications_anon_insert"
on public.membership_applications for insert
to anon
with check (
  status = 'pending'
  and decision_by is null
  and decision_at is null
  and internal_questionnaire is null
  and rejection_reason is null
  and sepa_approved = true
);

drop policy if exists "membership_applications_manager_select" on public.membership_applications;
create policy "membership_applications_manager_select"
on public.membership_applications for select
to authenticated
using (public.is_admin_or_vorstand());

drop policy if exists "membership_applications_admin_all" on public.membership_applications;
create policy "membership_applications_admin_all"
on public.membership_applications for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "membership_application_bank_data_admin_all" on public.membership_application_bank_data;
create policy "membership_application_bank_data_admin_all"
on public.membership_application_bank_data for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "members_manager_select" on public.members;
create policy "members_manager_select"
on public.members for select
to authenticated
using (public.is_admin_or_vorstand());

drop policy if exists "members_admin_all" on public.members;
create policy "members_admin_all"
on public.members for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "member_bank_data_admin_all" on public.member_bank_data;
create policy "member_bank_data_admin_all"
on public.member_bank_data for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "membership_application_audit_manager_select" on public.membership_application_audit;
create policy "membership_application_audit_manager_select"
on public.membership_application_audit for select
to authenticated
using (public.is_admin_or_vorstand());

drop policy if exists "membership_application_audit_admin_all" on public.membership_application_audit;
create policy "membership_application_audit_admin_all"
on public.membership_application_audit for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace function public.membership_get_encryption_key()
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_key text;
begin
  v_key := nullif(trim(current_setting('app.settings.encryption_key', true)), '');
  if v_key is null or length(v_key) < 16 then
    raise exception 'Encryption key missing. Set app.settings.encryption_key (min. 16 chars).';
  end if;
  return v_key;
end;
$$;

create or replace function public.membership_normalize_iban(p_iban text)
returns text
language sql
immutable
as $$
  select upper(regexp_replace(coalesce(p_iban, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

create or replace function public.membership_iban_last4(p_iban text)
returns text
language plpgsql
immutable
as $$
declare
  v_norm text := public.membership_normalize_iban(p_iban);
  v_digits text;
begin
  if length(v_norm) < 8 then
    raise exception 'IBAN appears invalid';
  end if;
  v_digits := regexp_replace(v_norm, '[^0-9]', '', 'g');
  if length(v_digits) < 4 then
    raise exception 'IBAN appears invalid';
  end if;
  return right(v_digits, 4);
end;
$$;

create or replace function public.submit_membership_application(
  p_first_name text,
  p_last_name text,
  p_birthdate date,
  p_street text,
  p_zip text,
  p_city text,
  p_is_local boolean,
  p_iban text,
  p_sepa_approved boolean,
  p_fishing_card_type text,
  p_known_member text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_app_id uuid;
  v_key text;
  v_iban_norm text;
  v_iban_last4 text;
begin
  if coalesce(p_sepa_approved, false) is distinct from true then
    raise exception 'SEPA approval is required';
  end if;

  v_key := public.membership_get_encryption_key();
  v_iban_norm := public.membership_normalize_iban(p_iban);
  v_iban_last4 := public.membership_iban_last4(v_iban_norm);

  insert into public.membership_applications (
    first_name,
    last_name,
    birthdate,
    street,
    zip,
    city,
    is_local,
    known_member,
    fishing_card_type,
    iban_last4,
    sepa_approved,
    status
  ) values (
    trim(p_first_name),
    trim(p_last_name),
    p_birthdate,
    trim(p_street),
    trim(p_zip),
    trim(p_city),
    coalesce(p_is_local, false),
    nullif(trim(p_known_member), ''),
    trim(p_fishing_card_type),
    v_iban_last4,
    true,
    'pending'
  )
  returning id into v_app_id;

  insert into public.membership_application_bank_data (application_id, iban_encrypted)
  values (
    v_app_id,
    extensions.pgp_sym_encrypt(v_iban_norm, v_key, 'cipher-algo=aes256')
  );

  insert into public.membership_application_audit (application_id, action, actor_id, payload)
  values (
    v_app_id,
    'submitted',
    auth.uid(),
    jsonb_build_object('is_local', coalesce(p_is_local, false), 'fishing_card_type', trim(p_fishing_card_type))
  );

  return v_app_id;
end;
$$;

create or replace function public.membership_set_internal_questionnaire(
  p_application_id uuid,
  p_internal_questionnaire jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.is_admin_or_vorstand() then
    raise exception 'Only vorstand/admin can edit questionnaire';
  end if;

  if p_internal_questionnaire is null or jsonb_typeof(p_internal_questionnaire) <> 'object' then
    raise exception 'internal_questionnaire must be a JSON object';
  end if;

  update public.membership_applications
  set internal_questionnaire = p_internal_questionnaire,
      updated_at = now()
  where id = p_application_id
    and status = 'pending';

  if not found then
    raise exception 'Application not found or not pending';
  end if;

  insert into public.membership_application_audit (application_id, action, actor_id, payload)
  values (
    p_application_id,
    'questionnaire_updated',
    auth.uid(),
    jsonb_build_object('keys', (select jsonb_agg(key) from jsonb_object_keys(p_internal_questionnaire) as key))
  );
end;
$$;

create or replace function public.approve_membership(
  p_application_id uuid,
  p_membership_number text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_app public.membership_applications;
  v_member_id uuid;
  v_membership_number text;
  v_iban bytea;
  v_questionnaire_keys int;
begin
  if not public.is_admin_or_vorstand() then
    raise exception 'Only vorstand/admin can approve';
  end if;

  select *
  into v_app
  from public.membership_applications
  where id = p_application_id
    and status = 'pending'
  for update;

  if v_app.id is null then
    raise exception 'Application not found or already processed';
  end if;

  if v_app.internal_questionnaire is null or jsonb_typeof(v_app.internal_questionnaire) <> 'object' then
    raise exception 'Internal questionnaire is required before approval';
  end if;

  select count(*) into v_questionnaire_keys
  from jsonb_object_keys(v_app.internal_questionnaire);

  if coalesce(v_questionnaire_keys, 0) = 0 then
    raise exception 'Internal questionnaire must not be empty';
  end if;

  v_membership_number := nullif(trim(p_membership_number), '');
  if v_membership_number is null then
    v_membership_number := 'M' || lpad(nextval('public.membership_number_seq')::text, 6, '0');
  end if;

  select b.iban_encrypted
  into v_iban
  from public.membership_application_bank_data b
  where b.application_id = v_app.id;

  if v_iban is null then
    raise exception 'Encrypted IBAN missing for application';
  end if;

  insert into public.members (
    membership_number,
    first_name,
    last_name,
    birthdate,
    street,
    zip,
    city,
    is_local,
    known_member,
    fishing_card_type,
    sepa_approved,
    status,
    source_application_id
  ) values (
    v_membership_number,
    v_app.first_name,
    v_app.last_name,
    v_app.birthdate,
    v_app.street,
    v_app.zip,
    v_app.city,
    v_app.is_local,
    v_app.known_member,
    v_app.fishing_card_type,
    v_app.sepa_approved,
    'active',
    v_app.id
  )
  returning id into v_member_id;

  insert into public.member_bank_data (
    member_id,
    source_application_id,
    iban_encrypted,
    iban_last4
  ) values (
    v_member_id,
    v_app.id,
    v_iban,
    v_app.iban_last4
  );

  update public.membership_applications
  set status = 'approved',
      decision_by = auth.uid(),
      decision_at = now(),
      updated_at = now(),
      rejection_reason = null
  where id = v_app.id;

  insert into public.membership_application_audit (application_id, action, actor_id, payload)
  values (
    v_app.id,
    'approved',
    auth.uid(),
    jsonb_build_object('member_id', v_member_id, 'membership_number', v_membership_number)
  );

  return v_member_id;
end;
$$;

create or replace function public.reject_membership(
  p_application_id uuid,
  p_rejection_reason text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_app public.membership_applications;
begin
  if not public.is_admin_or_vorstand() then
    raise exception 'Only vorstand/admin can reject';
  end if;

  select *
  into v_app
  from public.membership_applications
  where id = p_application_id
    and status = 'pending'
  for update;

  if v_app.id is null then
    raise exception 'Application not found or already processed';
  end if;

  update public.membership_applications
  set status = 'rejected',
      decision_by = auth.uid(),
      decision_at = now(),
      updated_at = now(),
      rejection_reason = nullif(trim(p_rejection_reason), '')
  where id = v_app.id;

  insert into public.membership_application_audit (application_id, action, actor_id, payload)
  values (
    v_app.id,
    'rejected',
    auth.uid(),
    jsonb_build_object('reason', nullif(trim(p_rejection_reason), ''))
  );
end;
$$;

create or replace view public.export_members
with (security_invoker = true)
as
select
  m.membership_number,
  m.first_name,
  m.last_name,
  m.birthdate,
  m.street,
  m.zip,
  m.city,
  m.fishing_card_type,
  m.is_local,
  m.created_at
from public.members m
where m.status = 'active';

grant select on public.membership_applications to authenticated;
grant select on public.membership_application_audit to authenticated;
grant select on public.members to authenticated;
grant select on public.export_members to authenticated;

revoke execute on function public.membership_get_encryption_key() from public, anon, authenticated;
revoke execute on function public.membership_normalize_iban(text) from public, anon, authenticated;
revoke execute on function public.membership_iban_last4(text) from public, anon, authenticated;
revoke execute on function public.submit_membership_application(
  text, text, date, text, text, text, boolean, text, boolean, text, text
) from public;
revoke execute on function public.membership_set_internal_questionnaire(uuid, jsonb) from public, anon;
revoke execute on function public.approve_membership(uuid, text) from public, anon;
revoke execute on function public.reject_membership(uuid, text) from public, anon;

grant execute on function public.submit_membership_application(
  text, text, date, text, text, text, boolean, text, boolean, text, text
) to anon, authenticated;

grant execute on function public.membership_set_internal_questionnaire(uuid, jsonb) to authenticated;
grant execute on function public.approve_membership(uuid, text) to authenticated;
grant execute on function public.reject_membership(uuid, text) to authenticated;

commit;

-- ==================================================================
-- END: docs/supabase/26_membership_applications.sql
-- ==================================================================

-- ==================================================================
-- BEGIN: docs/supabase/27_member_privacy_lifecycle.sql
-- ==================================================================
-- VDAN Template — member deletion/anonymization lifecycle
-- Run this after:
-- 26_membership_applications.sql

begin;

alter table if exists public.members
  add column if not exists deleted_at timestamptz,
  add column if not exists anonymized_at timestamptz;

alter table if exists public.profiles
  add column if not exists deleted_at timestamptz,
  add column if not exists anonymized_at timestamptz;

create index if not exists idx_members_deleted_at on public.members(deleted_at);
create index if not exists idx_members_anonymized_at on public.members(anonymized_at);
create index if not exists idx_profiles_deleted_at on public.profiles(deleted_at);
create index if not exists idx_profiles_anonymized_at on public.profiles(anonymized_at);

create or replace function public.admin_delete_or_anonymize_member(
  p_member_id uuid,
  p_mode text default 'anonymize'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mode text := lower(coalesce(trim(p_mode), 'anonymize'));
  v_member public.members;
begin
  if not public.is_admin_or_vorstand() then
    raise exception 'Only vorstand/admin can process member deletion';
  end if;

  select *
  into v_member
  from public.members m
  where m.id = p_member_id
  for update;

  if v_member.id is null then
    raise exception 'Member not found';
  end if;

  if v_mode not in ('anonymize', 'hard') then
    raise exception 'Unsupported mode: %, allowed: anonymize|hard', v_mode;
  end if;

  if v_mode = 'hard' then
    delete from public.member_bank_data where member_id = v_member.id;
    delete from public.members where id = v_member.id;
    return;
  end if;

  update public.members
  set
    status = 'inactive',
    first_name = 'ANONYM',
    last_name = 'ANONYM',
    birthdate = date '1900-01-01',
    street = '',
    zip = '',
    city = '',
    known_member = null,
    deleted_at = coalesce(deleted_at, now()),
    anonymized_at = now(),
    updated_at = now()
  where id = v_member.id;

  delete from public.member_bank_data where member_id = v_member.id;
end;
$$;

grant execute on function public.admin_delete_or_anonymize_member(uuid, text) to authenticated;

commit;

-- ==================================================================
-- END: docs/supabase/27_member_privacy_lifecycle.sql
-- ==================================================================

-- ==================================================================
-- BEGIN: docs/supabase/28_contact_requests.sql
-- ==================================================================
-- VDAN Template — contact requests (anti-spam ready)
-- Run this after:
-- 27_member_privacy_lifecycle.sql

begin;

create table if not exists public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ip_hash text not null,
  user_agent text,
  email text not null,
  name text not null,
  subject text not null,
  message text not null,
  turnstile_verified boolean not null default false,
  email_verified boolean not null default false,
  status text not null default 'pending' check (status in ('pending','confirmed','sent','rejected')),
  honeypot_triggered boolean not null default false,
  spam_score integer not null default 0,
  rejection_reason text,
  confirm_token_hash text unique,
  confirm_expires_at timestamptz,
  confirmed_at timestamptz
);

create index if not exists idx_contact_requests_created_at on public.contact_requests(created_at desc);
create index if not exists idx_contact_requests_status_created on public.contact_requests(status, created_at desc);
create index if not exists idx_contact_requests_ip_hash_created on public.contact_requests(ip_hash, created_at desc);
create index if not exists idx_contact_requests_email_created on public.contact_requests(email, created_at desc);

drop trigger if exists trg_contact_requests_touch on public.contact_requests;
create trigger trg_contact_requests_touch
before update on public.contact_requests
for each row execute function public.touch_updated_at();

alter table public.contact_requests enable row level security;

drop policy if exists "contact_requests_manager_select" on public.contact_requests;
create policy "contact_requests_manager_select"
on public.contact_requests for select
to authenticated
using (public.is_admin_or_vorstand());

drop policy if exists "contact_requests_admin_all" on public.contact_requests;
create policy "contact_requests_admin_all"
on public.contact_requests for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select on public.contact_requests to authenticated;

commit;

-- ==================================================================
-- END: docs/supabase/28_contact_requests.sql
-- ==================================================================

-- ==================================================================
-- BEGIN: docs/supabase/29_catch_whitefish_daily_limit.sql
-- ==================================================================
-- VDAN Template — catch whitefish daily limit
-- Run this after:
-- 28_contact_requests.sql

begin;

-- Extend existing fish master data to classify whitefish species.
alter table if exists public.fish_species
  add column if not exists is_whitefish boolean not null default false;

-- Baseline classification for existing seed species.
update public.fish_species
set is_whitefish = true
where lower(name) in ('brasse', 'rotauge')
  and coalesce(is_whitefish, false) = false;

-- Guard: max 25 whitefish per user per day.
create or replace function public.enforce_whitefish_daily_limit()
returns trigger
language plpgsql
as $$
declare
  is_target_whitefish boolean;
  current_total integer;
begin
  -- No-op when required columns are missing in incoming row.
  if new.user_id is null or new.fish_species_id is null or new.caught_on is null or new.quantity is null then
    return new;
  end if;

  select coalesce(fs.is_whitefish, false)
    into is_target_whitefish
  from public.fish_species fs
  where fs.id = new.fish_species_id;

  -- Rule applies only to whitefish rows.
  if not coalesce(is_target_whitefish, false) then
    return new;
  end if;

  select coalesce(sum(ce.quantity), 0)
    into current_total
  from public.catch_entries ce
  join public.fish_species fs on fs.id = ce.fish_species_id
  where ce.user_id = new.user_id
    and ce.caught_on = new.caught_on
    and coalesce(fs.is_whitefish, false) = true
    and (tg_op <> 'UPDATE' or ce.id <> new.id);

  if current_total + new.quantity > 25 then
    raise exception 'Taegliches Limit fuer Weissfische ueberschritten (max 25). Aktuell: %, Neu: %', current_total, new.quantity
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_whitefish_daily_limit on public.catch_entries;
create trigger trg_enforce_whitefish_daily_limit
before insert or update on public.catch_entries
for each row
execute function public.enforce_whitefish_daily_limit();

commit;

-- Verification
-- select column_name, data_type from information_schema.columns where table_schema='public' and table_name='fish_species' and column_name='is_whitefish';
-- select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='enforce_whitefish_daily_limit';
-- select tgname from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='catch_entries' and t.tgname='trg_enforce_whitefish_daily_limit';

-- ==================================================================
-- END: docs/supabase/29_catch_whitefish_daily_limit.sql
-- ==================================================================

-- ==================================================================
-- BEGIN: docs/supabase/30_paket_1_catches.sql
-- ==================================================================
-- VDAN Template — PAKET_1_CATCHES
-- Run this after:
-- 29_catch_whitefish_daily_limit.sql

begin;

-- =========================================
-- 1) Angeltage (Trips/Sessions)
-- =========================================
create table if not exists public.fishing_trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  water_body_id uuid not null references public.water_bodies(id),
  trip_date date not null,
  entry_type text not null default 'catch',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (entry_type in ('catch', 'no_catch'))
);

create unique index if not exists uq_fishing_trips_user_date_water
  on public.fishing_trips(user_id, trip_date, water_body_id);

create index if not exists idx_fishing_trips_user_trip_date
  on public.fishing_trips(user_id, trip_date desc);

create index if not exists idx_fishing_trips_trip_date
  on public.fishing_trips(trip_date desc);

alter table public.fishing_trips enable row level security;
grant select, insert, update, delete on public.fishing_trips to authenticated;

drop trigger if exists trg_fishing_trips_touch on public.fishing_trips;
create trigger trg_fishing_trips_touch
before update on public.fishing_trips
for each row execute function public.touch_updated_at();

drop policy if exists "fishing_trips_select_own_or_manager" on public.fishing_trips;
create policy "fishing_trips_select_own_or_manager"
on public.fishing_trips for select
using (auth.uid() = user_id or public.is_admin_or_vorstand());

drop policy if exists "fishing_trips_insert_own_or_manager" on public.fishing_trips;
create policy "fishing_trips_insert_own_or_manager"
on public.fishing_trips for insert
with check (auth.uid() = user_id or public.is_admin_or_vorstand());

drop policy if exists "fishing_trips_update_own_or_manager" on public.fishing_trips;
create policy "fishing_trips_update_own_or_manager"
on public.fishing_trips for update
using (auth.uid() = user_id or public.is_admin_or_vorstand())
with check (auth.uid() = user_id or public.is_admin_or_vorstand());

drop policy if exists "fishing_trips_delete_own_or_manager" on public.fishing_trips;
create policy "fishing_trips_delete_own_or_manager"
on public.fishing_trips for delete
using (auth.uid() = user_id or public.is_admin_or_vorstand());

-- =========================================
-- 2) Sync catch_entries -> fishing_trips
-- =========================================
create or replace function public.sync_fishing_trip_from_catch_entry()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is null or new.caught_on is null or new.water_body_id is null then
    return new;
  end if;

  insert into public.fishing_trips (user_id, water_body_id, trip_date, entry_type)
  values (new.user_id, new.water_body_id, new.caught_on, 'catch')
  on conflict (user_id, trip_date, water_body_id)
  do update
    set entry_type = 'catch',
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists trg_sync_fishing_trip_from_catch_entry on public.catch_entries;
create trigger trg_sync_fishing_trip_from_catch_entry
before insert or update of user_id, caught_on, water_body_id on public.catch_entries
for each row
execute function public.sync_fishing_trip_from_catch_entry();

-- Backfill existing catches into trips.
insert into public.fishing_trips (user_id, water_body_id, trip_date, entry_type)
select ce.user_id, ce.water_body_id, ce.caught_on, 'catch'
from public.catch_entries ce
on conflict (user_id, trip_date, water_body_id) do update
set entry_type = 'catch',
    updated_at = now();

-- =========================================
-- 3) Quick insert path for "Kein Fang"
-- =========================================
create or replace function public.catch_trip_quick_no_catch(
  p_trip_date date,
  p_water_body_id uuid,
  p_note text default null
)
returns public.fishing_trips
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.fishing_trips;
  v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_trip_date is null then
    raise exception 'trip_date is required';
  end if;

  if p_water_body_id is null then
    raise exception 'water_body_id is required';
  end if;

  insert into public.fishing_trips (user_id, water_body_id, trip_date, entry_type, note)
  values (v_uid, p_water_body_id, p_trip_date, 'no_catch', nullif(trim(p_note), ''))
  on conflict (user_id, trip_date, water_body_id)
  do update
    set note = coalesce(nullif(trim(excluded.note), ''), public.fishing_trips.note),
        updated_at = now()
  where public.fishing_trips.entry_type = 'no_catch'
  returning * into v_row;

  if v_row.id is null then
    select *
      into v_row
    from public.fishing_trips
    where user_id = v_uid
      and trip_date = p_trip_date
      and water_body_id = p_water_body_id
    limit 1;
  end if;

  return v_row;
end;
$$;

grant execute on function public.catch_trip_quick_no_catch(date, uuid, text) to authenticated;

-- =========================================
-- 4) Admin-Kennzahlen pro Mitglied
-- =========================================
create or replace function public.admin_catch_member_stats()
returns table (
  user_id uuid,
  member_no text,
  display_name text,
  angeltage_count bigint,
  no_catch_count bigint,
  catches_total_qty bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_or_vorstand() then
    raise exception 'Only vorstand/admin can access catch stats';
  end if;

  return query
  with base_users as (
    select distinct ft.user_id
    from public.fishing_trips ft
    union
    select distinct ce.user_id
    from public.catch_entries ce
  ),
  trip_stats as (
    select
      ft.user_id,
      count(distinct ft.trip_date)::bigint as angeltage_count,
      count(*) filter (where ft.entry_type = 'no_catch')::bigint as no_catch_count
    from public.fishing_trips ft
    group by ft.user_id
  ),
  catch_stats as (
    select
      ce.user_id,
      coalesce(sum(ce.quantity), 0)::bigint as catches_total_qty
    from public.catch_entries ce
    group by ce.user_id
  )
  select
    bu.user_id,
    p.member_no,
    p.display_name,
    coalesce(ts.angeltage_count, 0)::bigint,
    coalesce(ts.no_catch_count, 0)::bigint,
    coalesce(cs.catches_total_qty, 0)::bigint
  from base_users bu
  left join public.profiles p on p.id = bu.user_id
  left join trip_stats ts on ts.user_id = bu.user_id
  left join catch_stats cs on cs.user_id = bu.user_id
  order by p.member_no nulls last, p.display_name nulls last, bu.user_id;
end;
$$;

grant execute on function public.admin_catch_member_stats() to authenticated;

commit;

-- Verification
-- select column_name from information_schema.columns where table_schema='public' and table_name='fishing_trips';
-- select count(*) from public.fishing_trips;
-- select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('catch_trip_quick_no_catch','admin_catch_member_stats','sync_fishing_trip_from_catch_entry');
-- select tgname from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='catch_entries' and t.tgname='trg_sync_fishing_trip_from_catch_entry';

-- ==================================================================
-- END: docs/supabase/30_paket_1_catches.sql
-- ==================================================================

-- ==================================================================
-- BEGIN: docs/supabase/31_paket_2_usage_tracking.sql
-- ==================================================================
-- VDAN Template — PAKET_2_USAGE_TRACKING
-- Run this after:
-- 30_paket_1_catches.sql

begin;

-- =========================================
-- 1) Usage timestamps on existing user metadata table
-- =========================================
alter table if exists public.profiles
  add column if not exists first_login_at timestamptz,
  add column if not exists last_seen_at timestamptz;

create index if not exists idx_profiles_first_login_at
  on public.profiles(first_login_at);

create index if not exists idx_profiles_last_seen_at
  on public.profiles(last_seen_at desc);

-- =========================================
-- 2) RPC: touch current user usage
-- =========================================
create or replace function public.rpc_touch_user()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_email text;
  v_now timestamptz := now();
  v_row public.profiles;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  v_email := nullif(trim(coalesce(auth.jwt() ->> 'email', '')), '');

  insert into public.profiles (
    id,
    email,
    display_name,
    member_no,
    member_card_id,
    member_card_key,
    first_login_at,
    last_seen_at
  )
  values (
    v_uid,
    v_email,
    coalesce(nullif(trim(coalesce(auth.jwt() ->> 'user_metadata' ->> 'display_name', '')), ''),
             nullif(trim(coalesce(auth.jwt() ->> 'user_metadata' ->> 'full_name', '')), ''),
             split_part(coalesce(v_email, ''), '@', 1),
             'Mitglied'),
    'AUTO-' || replace(v_uid::text, '-', ''),
    'MC-' || upper(substr(md5(v_uid::text), 1, 10)),
    upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 12)),
    v_now,
    v_now
  )
  on conflict (id)
  do update
    set first_login_at = coalesce(public.profiles.first_login_at, excluded.first_login_at),
        last_seen_at = excluded.last_seen_at,
        updated_at = now();

  select *
  into v_row
  from public.profiles p
  where p.id = v_uid
  limit 1;

  return v_row;
end;
$$;

grant execute on function public.rpc_touch_user() to authenticated;

-- =========================================
-- 3) Admin view: online status (last_seen_at <= 5 min)
-- =========================================
create or replace view public.v_admin_online_users
with (security_invoker = true)
as
select
  p.id as user_id,
  p.member_no,
  p.display_name,
  p.first_login_at,
  p.last_seen_at,
  (p.last_seen_at is not null and p.last_seen_at >= (now() - interval '5 minutes')) as is_online
from public.profiles p
where public.is_admin_or_vorstand();

grant select on public.v_admin_online_users to authenticated;

commit;

-- Verification
-- select column_name from information_schema.columns where table_schema='public' and table_name='profiles' and column_name in ('first_login_at','last_seen_at');
-- select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='rpc_touch_user';
-- select * from public.v_admin_online_users limit 20;

-- ==================================================================
-- END: docs/supabase/31_paket_2_usage_tracking.sql
-- ==================================================================

-- ==================================================================
-- BEGIN: docs/supabase/32_paket_3_assignments.sql
-- ==================================================================
-- VDAN Template — PAKET_3_ASSIGNMENTS
-- Run this after:
-- 31_paket_2_usage_tracking.sql

begin;

-- =========================================
-- 1) Sitzungstasks (Protokoll-Maßnahmen)
-- =========================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'meeting_task_status') then
    create type public.meeting_task_status as enum ('open', 'done', 'blocked');
  end if;
end $$;

create table if not exists public.meeting_tasks (
  id uuid primary key default gen_random_uuid(),
  club_event_id uuid references public.club_events(id) on delete set null,
  title text not null check (char_length(trim(title)) >= 3),
  description text,
  status public.meeting_task_status not null default 'open',
  due_date date,
  status_note text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_meeting_tasks_status_due
  on public.meeting_tasks(status, due_date);

create index if not exists idx_meeting_tasks_club_event
  on public.meeting_tasks(club_event_id);

create index if not exists idx_meeting_tasks_created_by
  on public.meeting_tasks(created_by);

drop trigger if exists trg_meeting_tasks_touch on public.meeting_tasks;
create trigger trg_meeting_tasks_touch
before update on public.meeting_tasks
for each row execute function public.touch_updated_at();

alter table public.meeting_tasks enable row level security;
grant select, insert, update, delete on public.meeting_tasks to authenticated;

-- =========================================
-- 2) Multi-Assign für Sitzungstasks
-- =========================================
create table if not exists public.task_assignees (
  task_id uuid not null references public.meeting_tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references auth.users(id) on delete set null,
  primary key (task_id, user_id)
);

create index if not exists idx_task_assignees_user
  on public.task_assignees(user_id);

alter table public.task_assignees enable row level security;
grant select, insert, update, delete on public.task_assignees to authenticated;

-- =========================================
-- 3) Multi-Assign Leitung für Arbeitseinsätze
-- =========================================
create table if not exists public.work_event_leads (
  work_event_id uuid not null references public.work_events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references auth.users(id) on delete set null,
  primary key (work_event_id, user_id)
);

create index if not exists idx_work_event_leads_user
  on public.work_event_leads(user_id);

alter table public.work_event_leads enable row level security;
grant select, insert, update, delete on public.work_event_leads to authenticated;

-- =========================================
-- 4) Policies
-- =========================================
drop policy if exists "meeting_tasks_select_assignee_or_manager" on public.meeting_tasks;
create policy "meeting_tasks_select_assignee_or_manager"
on public.meeting_tasks for select
using (
  public.is_admin_or_vorstand()
  or created_by = auth.uid()
  or exists (
    select 1
    from public.task_assignees ta
    where ta.task_id = id
      and ta.user_id = auth.uid()
  )
);

drop policy if exists "meeting_tasks_manager_write" on public.meeting_tasks;
create policy "meeting_tasks_manager_write"
on public.meeting_tasks for all
using (public.is_admin_or_vorstand())
with check (public.is_admin_or_vorstand());

drop policy if exists "task_assignees_select_own_or_manager" on public.task_assignees;
create policy "task_assignees_select_own_or_manager"
on public.task_assignees for select
using (user_id = auth.uid() or public.is_admin_or_vorstand());

drop policy if exists "task_assignees_manager_write" on public.task_assignees;
create policy "task_assignees_manager_write"
on public.task_assignees for all
using (public.is_admin_or_vorstand())
with check (public.is_admin_or_vorstand());

drop policy if exists "work_event_leads_select_own_or_manager" on public.work_event_leads;
create policy "work_event_leads_select_own_or_manager"
on public.work_event_leads for select
using (user_id = auth.uid() or public.is_admin_or_vorstand());

drop policy if exists "work_event_leads_manager_write" on public.work_event_leads;
create policy "work_event_leads_manager_write"
on public.work_event_leads for all
using (public.is_admin_or_vorstand())
with check (public.is_admin_or_vorstand());

-- =========================================
-- 5) Meine Zuständigkeiten (auth.uid())
-- =========================================
create or replace view public.v_my_responsibilities
with (security_invoker = true)
as
select
  'meeting_task'::text as responsibility_type,
  mt.id as source_id,
  mt.title,
  mt.status::text as status,
  mt.due_date,
  mt.status_note,
  null::timestamptz as starts_at,
  null::timestamptz as ends_at,
  null::text as location,
  mt.created_at,
  mt.updated_at
from public.meeting_tasks mt
join public.task_assignees ta
  on ta.task_id = mt.id
 and ta.user_id = auth.uid()

union all

select
  'work_event_lead'::text as responsibility_type,
  we.id as source_id,
  we.title,
  we.status::text as status,
  (we.starts_at at time zone 'Europe/Berlin')::date as due_date,
  null::text as status_note,
  we.starts_at,
  we.ends_at,
  we.location,
  we.created_at,
  we.updated_at
from public.work_events we
join public.work_event_leads wl
  on wl.work_event_id = we.id
 and wl.user_id = auth.uid();

grant select on public.v_my_responsibilities to authenticated;

commit;

-- Verification
-- select table_name from information_schema.tables where table_schema='public' and table_name in ('meeting_tasks','task_assignees','work_event_leads');
-- select column_name from information_schema.columns where table_schema='public' and table_name='meeting_tasks' and column_name in ('status','due_date','status_note');
-- select * from public.v_my_responsibilities limit 20;

-- ==================================================================
-- END: docs/supabase/32_paket_3_assignments.sql
-- ==================================================================

-- ==================================================================
-- BEGIN: docs/supabase/33_member_card_check_tracking.sql
-- ==================================================================
-- VDAN Template — member card check tracking (checked at/by)
-- Run this after:
-- 32_paket_3_assignments.sql

begin;

alter table if exists public.profiles
  add column if not exists member_card_checked_at timestamptz,
  add column if not exists member_card_checked_by uuid references auth.users(id) on delete set null,
  add column if not exists member_card_checked_by_label text;

create index if not exists idx_profiles_member_card_checked_at
  on public.profiles(member_card_checked_at desc);

create or replace function public.member_card_verify(p_card_id text, p_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_role text := 'member';
  v_is_valid boolean := false;
  v_verifier_id uuid := auth.uid();
  v_verifier_label text;
begin
  if not public.is_admin_or_vorstand() then
    raise exception 'Only vorstand/admin can verify member cards';
  end if;

  if v_verifier_id is not null then
    select coalesce(
      nullif(trim(p.display_name), ''),
      nullif(trim(p.member_no), ''),
      nullif(trim(p.email), '')
    )
    into v_verifier_label
    from public.profiles p
    where p.id = v_verifier_id
    limit 1;
  end if;

  v_verifier_label := coalesce(
    nullif(trim(v_verifier_label), ''),
    nullif(trim(coalesce(auth.jwt() ->> 'email', '')), ''),
    'Vorstand/Admin'
  );

  select *
  into v_profile
  from public.profiles p
  where p.member_card_id = nullif(trim(p_card_id), '')
    and p.member_card_key = nullif(trim(p_key), '')
  limit 1;

  if v_profile.id is null then
    return jsonb_build_object(
      'ok', false,
      'reason', 'not_found'
    );
  end if;

  select case
           when exists (select 1 from public.user_roles ur where ur.user_id = v_profile.id and ur.role = 'admin') then 'admin'
           when exists (select 1 from public.user_roles ur where ur.user_id = v_profile.id and ur.role = 'vorstand') then 'vorstand'
           else 'member'
         end
  into v_role;

  v_is_valid := coalesce(v_profile.member_card_valid, false)
                and coalesce(v_profile.member_card_valid_from, current_date) <= current_date
                and coalesce(v_profile.member_card_valid_until, current_date) >= current_date;

  -- Only successful and currently valid scans are logged as control.
  if v_is_valid then
    update public.profiles
    set member_card_checked_at = now(),
        member_card_checked_by = v_verifier_id,
        member_card_checked_by_label = v_verifier_label,
        updated_at = now()
    where id = v_profile.id
    returning * into v_profile;
  end if;

  return jsonb_build_object(
    'ok', true,
    'valid', v_is_valid,
    'display_name', v_profile.display_name,
    'member_no', v_profile.member_no,
    'member_card_id', v_profile.member_card_id,
    'member_card_valid_from', v_profile.member_card_valid_from,
    'member_card_valid_until', v_profile.member_card_valid_until,
    'member_card_checked_at', v_profile.member_card_checked_at,
    'member_card_checked_by', v_profile.member_card_checked_by,
    'member_card_checked_by_label', v_profile.member_card_checked_by_label,
    'fishing_card_type', v_profile.fishing_card_type,
    'role', v_role
  );
end;
$$;

grant execute on function public.member_card_verify(text, text) to authenticated;

commit;

-- Verification
-- select column_name from information_schema.columns where table_schema='public' and table_name='profiles' and column_name in ('member_card_checked_at','member_card_checked_by','member_card_checked_by_label');
-- select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='member_card_verify';
-- select id, member_card_checked_at, member_card_checked_by_label from public.profiles where member_card_checked_at is not null order by member_card_checked_at desc limit 10;

-- ==================================================================
-- END: docs/supabase/33_member_card_check_tracking.sql
-- ==================================================================

-- ==================================================================
-- BEGIN: docs/supabase/34_meeting_sessions_and_agenda.sql
-- ==================================================================
-- VDAN Template — meeting sessions, attendance chips, agenda points
-- Run this after:
-- 33_member_card_check_tracking.sql

begin;

-- =========================================
-- 1) Enums
-- =========================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'meeting_attendance_status') then
    create type public.meeting_attendance_status as enum ('present', 'absent');
  end if;
end $$;

-- =========================================
-- 2) Meeting sessions
-- =========================================
create table if not exists public.meeting_sessions (
  id uuid primary key default gen_random_uuid(),
  meeting_date date not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_meeting_sessions_date
  on public.meeting_sessions(meeting_date desc);

drop trigger if exists trg_meeting_sessions_touch on public.meeting_sessions;
create trigger trg_meeting_sessions_touch
before update on public.meeting_sessions
for each row execute function public.touch_updated_at();

alter table public.meeting_sessions enable row level security;
grant select, insert, update, delete on public.meeting_sessions to authenticated;

drop policy if exists "meeting_sessions_select_manager" on public.meeting_sessions;
create policy "meeting_sessions_select_manager"
on public.meeting_sessions for select
using (public.is_admin_or_vorstand());

drop policy if exists "meeting_sessions_manager_write" on public.meeting_sessions;
create policy "meeting_sessions_manager_write"
on public.meeting_sessions for all
using (public.is_admin_or_vorstand())
with check (public.is_admin_or_vorstand());

-- =========================================
-- 3) Session attendees (chips: present/absent)
-- =========================================
create table if not exists public.meeting_session_attendees (
  session_id uuid not null references public.meeting_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  attendance_status public.meeting_attendance_status not null default 'absent',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (session_id, user_id)
);

create index if not exists idx_meeting_session_attendees_user
  on public.meeting_session_attendees(user_id);

drop trigger if exists trg_meeting_session_attendees_touch on public.meeting_session_attendees;
create trigger trg_meeting_session_attendees_touch
before update on public.meeting_session_attendees
for each row execute function public.touch_updated_at();

drop trigger if exists trg_meeting_session_attendees_updated_by on public.meeting_session_attendees;
create trigger trg_meeting_session_attendees_updated_by
before insert or update on public.meeting_session_attendees
for each row execute function public.touch_updated_by();

alter table public.meeting_session_attendees enable row level security;
grant select, insert, update, delete on public.meeting_session_attendees to authenticated;

drop policy if exists "meeting_session_attendees_select_own_or_manager" on public.meeting_session_attendees;
create policy "meeting_session_attendees_select_own_or_manager"
on public.meeting_session_attendees for select
using (user_id = auth.uid() or public.is_admin_or_vorstand());

drop policy if exists "meeting_session_attendees_manager_write" on public.meeting_session_attendees;
create policy "meeting_session_attendees_manager_write"
on public.meeting_session_attendees for all
using (public.is_admin_or_vorstand())
with check (public.is_admin_or_vorstand());

-- =========================================
-- 4) Agenda points (automatic numbering)
-- =========================================
create table if not exists public.meeting_agenda_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.meeting_sessions(id) on delete cascade,
  item_no integer not null,
  title text not null check (char_length(trim(title)) >= 2),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, item_no)
);

create index if not exists idx_meeting_agenda_items_session
  on public.meeting_agenda_items(session_id, item_no);

drop trigger if exists trg_meeting_agenda_items_touch on public.meeting_agenda_items;
create trigger trg_meeting_agenda_items_touch
before update on public.meeting_agenda_items
for each row execute function public.touch_updated_at();

create or replace function public.meeting_agenda_items_auto_number()
returns trigger
language plpgsql
as $$
begin
  if new.item_no is null or new.item_no <= 0 then
    select coalesce(max(ai.item_no), 0) + 1
      into new.item_no
    from public.meeting_agenda_items ai
    where ai.session_id = new.session_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_meeting_agenda_items_auto_number on public.meeting_agenda_items;
create trigger trg_meeting_agenda_items_auto_number
before insert on public.meeting_agenda_items
for each row execute function public.meeting_agenda_items_auto_number();

alter table public.meeting_agenda_items enable row level security;
grant select, insert, update, delete on public.meeting_agenda_items to authenticated;

drop policy if exists "meeting_agenda_items_select_manager" on public.meeting_agenda_items;
create policy "meeting_agenda_items_select_manager"
on public.meeting_agenda_items for select
using (public.is_admin_or_vorstand());

drop policy if exists "meeting_agenda_items_manager_write" on public.meeting_agenda_items;
create policy "meeting_agenda_items_manager_write"
on public.meeting_agenda_items for all
using (public.is_admin_or_vorstand())
with check (public.is_admin_or_vorstand());

-- =========================================
-- 5) Extend meeting tasks: bind to session + agenda point
-- =========================================
alter table if exists public.meeting_tasks
  add column if not exists meeting_session_id uuid references public.meeting_sessions(id) on delete set null,
  add column if not exists agenda_item_id uuid references public.meeting_agenda_items(id) on delete set null;

create index if not exists idx_meeting_tasks_session
  on public.meeting_tasks(meeting_session_id);

create index if not exists idx_meeting_tasks_agenda_item
  on public.meeting_tasks(agenda_item_id);

create or replace function public.enforce_meeting_task_agenda_scope()
returns trigger
language plpgsql
as $$
declare
  v_session_id uuid;
begin
  if new.agenda_item_id is null then
    return new;
  end if;

  select ai.session_id
    into v_session_id
  from public.meeting_agenda_items ai
  where ai.id = new.agenda_item_id
  limit 1;

  if v_session_id is null then
    raise exception 'agenda_item_id not found';
  end if;

  if new.meeting_session_id is null then
    new.meeting_session_id := v_session_id;
  elsif new.meeting_session_id <> v_session_id then
    raise exception 'meeting_session_id must match agenda item session';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_meeting_task_agenda_scope on public.meeting_tasks;
create trigger trg_enforce_meeting_task_agenda_scope
before insert or update on public.meeting_tasks
for each row execute function public.enforce_meeting_task_agenda_scope();

commit;

-- Verification
-- select table_name from information_schema.tables where table_schema='public' and table_name in ('meeting_sessions','meeting_session_attendees','meeting_agenda_items');
-- select column_name from information_schema.columns where table_schema='public' and table_name='meeting_tasks' and column_name in ('meeting_session_id','agenda_item_id');
-- select tgname from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='meeting_tasks' and t.tgname='trg_enforce_meeting_task_agenda_scope';

-- ==================================================================
-- END: docs/supabase/34_meeting_sessions_and_agenda.sql
-- ==================================================================

-- ==================================================================
-- BEGIN: docs/supabase/35_meeting_attendees_manager_only.sql
-- ==================================================================
-- VDAN Template — enforce manager-only attendees in meeting sessions
-- Run this after:
-- 34_meeting_sessions_and_agenda.sql

begin;

create or replace function public.enforce_meeting_attendee_is_manager()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = new.user_id
      and ur.role in ('admin', 'vorstand')
  ) then
    raise exception 'Only admin/vorstand can be meeting attendees';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_meeting_attendee_is_manager on public.meeting_session_attendees;
create trigger trg_enforce_meeting_attendee_is_manager
before insert or update of user_id on public.meeting_session_attendees
for each row
execute function public.enforce_meeting_attendee_is_manager();

-- Cleanup existing rows that violate the manager-only rule.
delete from public.meeting_session_attendees msa
where not exists (
  select 1
  from public.user_roles ur
  where ur.user_id = msa.user_id
    and ur.role in ('admin', 'vorstand')
);

commit;

-- Verification
-- select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'enforce_meeting_attendee_is_manager';
-- select tgname from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'meeting_session_attendees' and t.tgname = 'trg_enforce_meeting_attendee_is_manager';
-- select count(*) from public.meeting_session_attendees msa where not exists (select 1 from public.user_roles ur where ur.user_id = msa.user_id and ur.role in ('admin','vorstand'));

-- ==================================================================
-- END: docs/supabase/35_meeting_attendees_manager_only.sql
-- ==================================================================

-- ==================================================================
-- BEGIN: docs/supabase/36_feed_members_only_category.sql
-- ==================================================================
-- VDAN Template — feed category "nur_mitglieder" with member-only visibility
-- Run this after:
-- 35_meeting_attendees_manager_only.sql

begin;

alter table if exists public.feed_posts
  drop constraint if exists feed_posts_category_check;

alter table if exists public.feed_posts
  add constraint feed_posts_category_check
  check (category in ('info', 'termin', 'jugend', 'arbeitseinsatz', 'nur_mitglieder'));

drop policy if exists "feed_select_all" on public.feed_posts;
drop policy if exists "feed_select_public_or_member_only" on public.feed_posts;
create policy "feed_select_public_or_member_only"
on public.feed_posts for select
using (
  category <> 'nur_mitglieder'
  or auth.uid() is not null
);

commit;

-- Verification
-- select conname from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace where n.nspname='public' and t.relname='feed_posts' and c.conname='feed_posts_category_check';
-- select polname from pg_policy p join pg_class t on t.oid=p.polrelid join pg_namespace n on n.oid=t.relnamespace where n.nspname='public' and t.relname='feed_posts' and p.polname='feed_select_public_or_member_only';

-- ==================================================================
-- END: docs/supabase/36_feed_members_only_category.sql
-- ==================================================================

-- ==================================================================
-- BEGIN: docs/supabase/37_fangliste_multi_entries_and_editable.sql
-- ==================================================================
-- VDAN Template — Fangliste: multiple entries per day + editable trip/catch mapping
-- Run this after:
-- 36_feed_members_only_category.sql

begin;

-- =========================================
-- 1) Allow multiple catch trips per day/water, but keep no_catch unique
-- =========================================
drop index if exists public.uq_fishing_trips_user_date_water;

create unique index if not exists uq_fishing_trips_user_date_water_no_catch
  on public.fishing_trips(user_id, trip_date, water_body_id)
  where entry_type = 'no_catch';

-- =========================================
-- 2) Link catches directly to trip rows for reliable editing/detail views
-- =========================================
alter table if exists public.catch_entries
  add column if not exists fishing_trip_id uuid references public.fishing_trips(id) on delete set null;

create index if not exists idx_catch_entries_trip_id
  on public.catch_entries(fishing_trip_id);

-- Backfill relation for existing catch rows (best-match by user/date/water).
with matched as (
  select
    ce.id as catch_id,
    (
      select ft.id
      from public.fishing_trips ft
      where ft.user_id = ce.user_id
        and ft.trip_date = ce.caught_on
        and ft.water_body_id = ce.water_body_id
        and ft.entry_type = 'catch'
      order by ft.created_at asc, ft.id asc
      limit 1
    ) as trip_id
  from public.catch_entries ce
  where ce.fishing_trip_id is null
), created_trips as (
  insert into public.fishing_trips (user_id, water_body_id, trip_date, entry_type)
  select ce.user_id, ce.water_body_id, ce.caught_on, 'catch'
  from public.catch_entries ce
  where ce.fishing_trip_id is null
    and not exists (
      select 1
      from public.fishing_trips ft
      where ft.user_id = ce.user_id
        and ft.trip_date = ce.caught_on
        and ft.water_body_id = ce.water_body_id
        and ft.entry_type = 'catch'
    )
  returning id, user_id, water_body_id, trip_date
), rematched as (
  select
    ce.id as catch_id,
    coalesce(m.trip_id,
      (
        select ft.id
        from public.fishing_trips ft
        where ft.user_id = ce.user_id
          and ft.trip_date = ce.caught_on
          and ft.water_body_id = ce.water_body_id
          and ft.entry_type = 'catch'
        order by ft.created_at asc, ft.id asc
        limit 1
      )
    ) as trip_id
  from public.catch_entries ce
  left join matched m on m.catch_id = ce.id
  where ce.fishing_trip_id is null
)
update public.catch_entries ce
set fishing_trip_id = r.trip_id
from rematched r
where ce.id = r.catch_id
  and ce.fishing_trip_id is null
  and r.trip_id is not null;

-- =========================================
-- 3) Keep trip relation in sync when catch rows are inserted/updated
-- =========================================
create or replace function public.sync_fishing_trip_from_catch_entry()
returns trigger
language plpgsql
as $$
declare
  v_trip_id uuid;
begin
  if new.user_id is null or new.caught_on is null or new.water_body_id is null then
    return new;
  end if;

  if new.fishing_trip_id is not null then
    update public.fishing_trips
      set user_id = new.user_id,
          water_body_id = new.water_body_id,
          trip_date = new.caught_on,
          entry_type = 'catch',
          updated_at = now()
    where id = new.fishing_trip_id;

    return new;
  end if;

  insert into public.fishing_trips (user_id, water_body_id, trip_date, entry_type)
  values (new.user_id, new.water_body_id, new.caught_on, 'catch')
  returning id into v_trip_id;

  new.fishing_trip_id := v_trip_id;
  return new;
end;
$$;

-- =========================================
-- 4) Quick no-catch insert/update without depending on old full unique index
-- =========================================
create or replace function public.catch_trip_quick_no_catch(
  p_trip_date date,
  p_water_body_id uuid,
  p_note text default null
)
returns public.fishing_trips
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.fishing_trips;
  v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_trip_date is null then
    raise exception 'trip_date is required';
  end if;

  if p_water_body_id is null then
    raise exception 'water_body_id is required';
  end if;

  select *
    into v_row
  from public.fishing_trips ft
  where ft.user_id = v_uid
    and ft.trip_date = p_trip_date
    and ft.water_body_id = p_water_body_id
    and ft.entry_type = 'no_catch'
  order by ft.created_at desc
  limit 1;

  if v_row.id is not null then
    update public.fishing_trips
      set note = coalesce(nullif(trim(p_note), ''), note),
          updated_at = now()
    where id = v_row.id
    returning * into v_row;

    return v_row;
  end if;

  insert into public.fishing_trips (user_id, water_body_id, trip_date, entry_type, note)
  values (v_uid, p_water_body_id, p_trip_date, 'no_catch', nullif(trim(p_note), ''))
  returning * into v_row;

  return v_row;
end;
$$;

commit;

-- Verification
-- select indexname from pg_indexes where schemaname='public' and tablename='fishing_trips' and indexname in ('uq_fishing_trips_user_date_water','uq_fishing_trips_user_date_water_no_catch');
-- select column_name from information_schema.columns where table_schema='public' and table_name='catch_entries' and column_name='fishing_trip_id';
-- select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('sync_fishing_trip_from_catch_entry','catch_trip_quick_no_catch');

-- ==================================================================
-- END: docs/supabase/37_fangliste_multi_entries_and_editable.sql
-- ==================================================================

-- ==================================================================
-- BEGIN: docs/supabase/38_fangliste_trip_photos_in_db.sql
-- ==================================================================
-- VDAN Template — store fangliste trip photos in DB
-- Run this after:
-- 37_fangliste_multi_entries_and_editable.sql

begin;

alter table if exists public.fishing_trips
  add column if not exists photo_data_url text,
  add column if not exists photo_updated_at timestamptz;

commit;

-- Verification
-- select column_name from information_schema.columns where table_schema='public' and table_name='fishing_trips' and column_name in ('photo_data_url','photo_updated_at');

-- ==================================================================
-- END: docs/supabase/38_fangliste_trip_photos_in_db.sql
-- ==================================================================

-- ==================================================================
-- BEGIN: docs/supabase/39_feed_media_allow_jpeg_fallback.sql
-- ==================================================================
-- VDAN Template — feed media: allow jpeg fallback for clients without webp encode support
-- Run this after:
-- 04_feed_post_media.sql

begin;

update storage.buckets
set allowed_mime_types = array['image/webp', 'image/jpeg']
where id = 'feed-media';

commit;

-- Verification
-- select id, allowed_mime_types from storage.buckets where id='feed-media';

-- ==================================================================
-- END: docs/supabase/39_feed_media_allow_jpeg_fallback.sql
-- ==================================================================

-- ==================================================================
-- BEGIN: docs/supabase/40_work_events_youth_flag.sql
-- ==================================================================
-- VDAN Template — work events youth flag (Jugend vs Default)
-- Run this after:
-- 32_paket_3_assignments.sql

begin;

alter table if exists public.work_events
  add column if not exists is_youth boolean not null default false;

create index if not exists idx_work_events_is_youth_start
  on public.work_events(is_youth, starts_at);

create or replace function public.work_event_create(
  p_title text,
  p_description text default null,
  p_location text default null,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_max_participants integer default null,
  p_is_youth boolean default false
)
returns public.work_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.work_events;
begin
  if not public.is_admin_or_vorstand() then
    raise exception 'Only vorstand/admin can create work events';
  end if;

  insert into public.work_events (
    title, description, location, starts_at, ends_at, max_participants, is_youth, status, created_by
  )
  values (
    p_title,
    nullif(trim(coalesce(p_description, '')), ''),
    nullif(trim(coalesce(p_location, '')), ''),
    coalesce(p_starts_at, now() + interval '1 day'),
    coalesce(p_ends_at, now() + interval '1 day' + interval '2 hours'),
    p_max_participants,
    coalesce(p_is_youth, false),
    'draft',
    auth.uid()
  )
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.work_event_create(text, text, text, timestamptz, timestamptz, integer, boolean) to authenticated;

commit;

-- Verification
-- select column_name from information_schema.columns where table_schema='public' and table_name='work_events' and column_name='is_youth';
-- select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='work_event_create';

-- ==================================================================
-- END: docs/supabase/40_work_events_youth_flag.sql
-- ==================================================================

-- ==================================================================
-- BEGIN: docs/supabase/41_club_events_youth_flag.sql
-- ==================================================================
-- VDAN Template — club events youth flag (Jugend vs Default)
-- Run this after:
-- 40_work_events_youth_flag.sql

begin;

alter table if exists public.club_events
  add column if not exists is_youth boolean not null default false;

create index if not exists idx_club_events_is_youth_start
  on public.club_events(is_youth, starts_at);

drop function if exists public.term_event_create(text, text, text, timestamptz, timestamptz);

create or replace function public.term_event_create(
  p_title text,
  p_description text default null,
  p_location text default null,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_is_youth boolean default false
)
returns public.club_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.club_events;
begin
  if not public.is_admin_or_vorstand() then
    raise exception 'Only vorstand/admin can create terms';
  end if;

  insert into public.club_events (
    title, description, location, starts_at, ends_at, is_youth, status, created_by
  )
  values (
    p_title,
    nullif(trim(coalesce(p_description, '')), ''),
    nullif(trim(coalesce(p_location, '')), ''),
    coalesce(p_starts_at, now() + interval '1 day'),
    coalesce(p_ends_at, now() + interval '1 day' + interval '2 hours'),
    coalesce(p_is_youth, false),
    'draft',
    auth.uid()
  )
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.term_event_create(text, text, text, timestamptz, timestamptz, boolean) to authenticated;

commit;

-- Verification
-- select column_name from information_schema.columns where table_schema='public' and table_name='club_events' and column_name='is_youth';
-- select proname, oidvectortypes(proargtypes) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='term_event_create';

-- ==================================================================
-- END: docs/supabase/41_club_events_youth_flag.sql
-- ==================================================================

-- ==================================================================
-- BEGIN: docs/supabase/42_user_settings_notifications.sql
-- ==================================================================
-- VDAN Template — user settings (notifications)
-- Run after core member/auth setup.

begin;

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  notify_new_post boolean not null default true,
  notify_new_event boolean not null default true,
  notify_new_work_event boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_user_settings_touch on public.user_settings;
create trigger trg_user_settings_touch
before update on public.user_settings
for each row execute function public.touch_updated_at();

alter table public.user_settings enable row level security;

grant select, insert, update on public.user_settings to authenticated;

drop policy if exists "user_settings_select_own" on public.user_settings;
create policy "user_settings_select_own"
on public.user_settings for select
using (auth.uid() = user_id);

drop policy if exists "user_settings_insert_own" on public.user_settings;
create policy "user_settings_insert_own"
on public.user_settings for insert
with check (auth.uid() = user_id);

drop policy if exists "user_settings_update_own" on public.user_settings;
create policy "user_settings_update_own"
on public.user_settings for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

commit;

-- ==================================================================
-- END: docs/supabase/42_user_settings_notifications.sql
-- ==================================================================

-- ==================================================================
-- BEGIN: docs/supabase/43_user_settings_portal_quick.sql
-- ==================================================================
-- VDAN Template — portal quick settings (handedness + favorites)
-- Run after 42_user_settings_notifications.sql

begin;

alter table public.user_settings
  add column if not exists nav_handedness text not null default 'right',
  add column if not exists portal_favorites jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_settings_nav_handedness_chk'
  ) then
    alter table public.user_settings
      add constraint user_settings_nav_handedness_chk
      check (nav_handedness in ('left', 'right', 'auto'));
  end if;
end $$;

commit;

-- ==================================================================
-- END: docs/supabase/43_user_settings_portal_quick.sql
-- ==================================================================

-- ==================================================================
-- BEGIN: docs/supabase/45_membership_security_patch.sql
-- ==================================================================
-- VDAN Patch — membership crypto/schema/search_path hardening
-- Run this AFTER 26_membership_applications.sql

begin;

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.app_secure_settings (
  setting_key text primary key,
  setting_value text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_secure_settings enable row level security;

revoke all on public.app_secure_settings from public, anon, authenticated;

-- Set/rotate encryption key here (replace value with your secret)
insert into public.app_secure_settings (setting_key, setting_value)
values ('membership_encryption_key', 'REPLACE_WITH_RANDOM_SECRET_MIN_16')
on conflict (setting_key) do update
set setting_value = excluded.setting_value,
    updated_at = now();

create or replace function public.membership_get_encryption_key()
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_key text;
begin
  select nullif(trim(setting_value), '')
    into v_key
  from public.app_secure_settings
  where setting_key = 'membership_encryption_key'
  limit 1;

  if v_key is null then
    v_key := nullif(trim(current_setting('app.settings.encryption_key', true)), '');
  end if;

  if v_key is null or length(v_key) < 16 then
    raise exception 'Encryption key missing. Set app_secure_settings.membership_encryption_key (min. 16 chars).';
  end if;
  return v_key;
end;
$$;

create or replace function public.submit_membership_application(
  p_first_name text,
  p_last_name text,
  p_birthdate date,
  p_street text,
  p_zip text,
  p_city text,
  p_is_local boolean,
  p_iban text,
  p_sepa_approved boolean,
  p_fishing_card_type text,
  p_known_member text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_app_id uuid;
  v_key text;
  v_iban_norm text;
  v_iban_last4 text;
begin
  if coalesce(p_sepa_approved, false) is distinct from true then
    raise exception 'SEPA approval is required';
  end if;

  v_key := public.membership_get_encryption_key();
  v_iban_norm := public.membership_normalize_iban(p_iban);
  v_iban_last4 := public.membership_iban_last4(v_iban_norm);

  insert into public.membership_applications (
    first_name,
    last_name,
    birthdate,
    street,
    zip,
    city,
    is_local,
    known_member,
    fishing_card_type,
    iban_last4,
    sepa_approved,
    status
  ) values (
    trim(p_first_name),
    trim(p_last_name),
    p_birthdate,
    trim(p_street),
    trim(p_zip),
    trim(p_city),
    coalesce(p_is_local, false),
    nullif(trim(p_known_member), ''),
    trim(p_fishing_card_type),
    v_iban_last4,
    true,
    'pending'
  )
  returning id into v_app_id;

  insert into public.membership_application_bank_data (application_id, iban_encrypted)
  values (
    v_app_id,
    extensions.pgp_sym_encrypt(v_iban_norm, v_key, 'cipher-algo=aes256')
  );

  insert into public.membership_application_audit (application_id, action, actor_id, payload)
  values (
    v_app_id,
    'submitted',
    auth.uid(),
    jsonb_build_object('is_local', coalesce(p_is_local, false), 'fishing_card_type', trim(p_fishing_card_type))
  );

  return v_app_id;
end;
$$;

alter function public.membership_set_internal_questionnaire(uuid, jsonb)
  set search_path = pg_catalog, public;

alter function public.approve_membership(uuid, text)
  set search_path = pg_catalog, public;

alter function public.reject_membership(uuid, text)
  set search_path = pg_catalog, public;

revoke execute on function public.membership_get_encryption_key() from public, anon, authenticated;
revoke execute on function public.membership_normalize_iban(text) from public, anon, authenticated;
revoke execute on function public.membership_iban_last4(text) from public, anon, authenticated;
revoke execute on function public.submit_membership_application(
  text, text, date, text, text, text, boolean, text, boolean, text, text
) from public;
revoke execute on function public.membership_set_internal_questionnaire(uuid, jsonb) from public, anon;
revoke execute on function public.approve_membership(uuid, text) from public, anon;
revoke execute on function public.reject_membership(uuid, text) from public, anon;

grant execute on function public.submit_membership_application(
  text, text, date, text, text, text, boolean, text, boolean, text, text
) to anon, authenticated;
grant execute on function public.membership_set_internal_questionnaire(uuid, jsonb) to authenticated;
grant execute on function public.approve_membership(uuid, text) to authenticated;
grant execute on function public.reject_membership(uuid, text) to authenticated;

commit;

-- ==================================================================
-- END: docs/supabase/45_membership_security_patch.sql
-- ==================================================================

-- ==================================================================
-- BEGIN: docs/supabase/46_push_subscriptions.sql
-- ==================================================================
-- VDAN Template — web push subscriptions for app update notifications
-- Run after user/role baseline

begin;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  enabled boolean not null default true,
  notify_app_update boolean not null default true,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_push_subscriptions_user on public.push_subscriptions(user_id);
create index if not exists idx_push_subscriptions_enabled on public.push_subscriptions(enabled, notify_app_update);

drop trigger if exists trg_push_subscriptions_touch on public.push_subscriptions;
create trigger trg_push_subscriptions_touch
before update on public.push_subscriptions
for each row execute function public.touch_updated_at();

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_own_select" on public.push_subscriptions;
create policy "push_subscriptions_own_select"
on public.push_subscriptions for select
to authenticated
using (auth.uid() = user_id or public.is_admin());

drop policy if exists "push_subscriptions_own_insert" on public.push_subscriptions;
create policy "push_subscriptions_own_insert"
on public.push_subscriptions for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "push_subscriptions_own_update" on public.push_subscriptions;
create policy "push_subscriptions_own_update"
on public.push_subscriptions for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "push_subscriptions_own_delete" on public.push_subscriptions;
create policy "push_subscriptions_own_delete"
on public.push_subscriptions for delete
to authenticated
using (auth.uid() = user_id or public.is_admin());

grant select, insert, update, delete on public.push_subscriptions to authenticated;

commit;

-- ==================================================================
-- END: docs/supabase/46_push_subscriptions.sql
-- ==================================================================

-- ==================================================================
-- BEGIN: docs/supabase/47_security_invoker_views_patch.sql
-- ==================================================================
-- VDAN Patch — fix linter errors for SECURITY DEFINER views
-- Run this after existing migrations (especially 26/31/32)

begin;

create or replace view public.v_admin_online_users
with (security_invoker = true)
as
select
  p.id as user_id,
  p.member_no,
  p.display_name,
  p.first_login_at,
  p.last_seen_at,
  (p.last_seen_at is not null and p.last_seen_at >= (now() - interval '5 minutes')) as is_online
from public.profiles p
where public.is_admin_or_vorstand();

grant select on public.v_admin_online_users to authenticated;

create or replace view public.v_my_responsibilities
with (security_invoker = true)
as
select
  'meeting_task'::text as responsibility_type,
  mt.id as source_id,
  mt.title,
  mt.status::text as status,
  mt.due_date,
  mt.status_note,
  null::timestamptz as starts_at,
  null::timestamptz as ends_at,
  null::text as location,
  mt.created_at,
  mt.updated_at
from public.meeting_tasks mt
join public.task_assignees ta
  on ta.task_id = mt.id
 and ta.user_id = auth.uid()

union all

select
  'work_event_lead'::text as responsibility_type,
  we.id as source_id,
  we.title,
  we.status::text as status,
  (we.starts_at at time zone 'Europe/Berlin')::date as due_date,
  null::text as status_note,
  we.starts_at,
  we.ends_at,
  we.location,
  we.created_at,
  we.updated_at
from public.work_events we
join public.work_event_leads wl
  on wl.work_event_id = we.id
 and wl.user_id = auth.uid();

grant select on public.v_my_responsibilities to authenticated;

create or replace view public.export_members
with (security_invoker = true)
as
select
  m.membership_number,
  m.first_name,
  m.last_name,
  m.birthdate,
  m.street,
  m.zip,
  m.city,
  m.fishing_card_type,
  m.is_local,
  m.created_at
from public.members m
where m.status = 'active';

grant select on public.export_members to authenticated;

commit;

-- ==================================================================
-- END: docs/supabase/47_security_invoker_views_patch.sql
-- ==================================================================
