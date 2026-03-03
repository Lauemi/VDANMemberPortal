-- VDAN Template — Staging hardening: Multi-tenant + RLS + offline write safety
-- Run this AFTER:
--   60_staging_full_setup_schema.sql
--
-- Goal:
-- 1) Close remaining RLS gap (`club_members`)
-- 2) Establish clubs/memberships as tenant authority
-- 3) Enforce `club_id` on core domain tables (staging hardening)
-- 4) Add idempotency + optimistic conflict primitives for offline/retry flows
--
-- IMPORTANT:
-- - This is intended for STAGING first.
-- - Validate app flows after execution (feed, events, catches, docs, notes).

begin;

-- -------------------------------------------------------------------
-- 0) Tenant helper tables (idempotent)
-- -------------------------------------------------------------------
create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  logo_url text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_clubs_touch on public.clubs;
create trigger trg_clubs_touch
before update on public.clubs
for each row execute function public.touch_updated_at();

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete restrict,
  role text not null default 'member' check (role in ('member','vorstand','admin','webmaster','gewaesserwart','kassenwart','schriftfuehrer','jugendwart')),
  member_no text,
  status text not null default 'active' check (status in ('active', 'pending', 'suspended', 'left')),
  valid_from date,
  valid_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_memberships_user_club
  on public.memberships(user_id, club_id);
create unique index if not exists uq_memberships_club_member_no
  on public.memberships(club_id, member_no)
  where member_no is not null;
create index if not exists idx_memberships_user_status
  on public.memberships(user_id, status);
create index if not exists idx_memberships_club_status
  on public.memberships(club_id, status);

drop trigger if exists trg_memberships_touch on public.memberships;
create trigger trg_memberships_touch
before update on public.memberships
for each row execute function public.touch_updated_at();

alter table public.clubs enable row level security;
alter table public.memberships enable row level security;

grant select on public.clubs to authenticated;
grant select, insert, update, delete on public.memberships to authenticated;

create or replace function public.has_active_membership(
  p_club_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security invoker
as $$
  select exists (
    select 1
    from public.memberships m
    where m.user_id = p_user_id
      and m.club_id = p_club_id
      and m.status = 'active'
  );
$$;

create or replace function public.has_manager_membership(
  p_club_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security invoker
as $$
  select exists (
    select 1
    from public.memberships m
    where m.user_id = p_user_id
      and m.club_id = p_club_id
      and m.status = 'active'
      and m.role in ('vorstand', 'admin')
  );
$$;

drop policy if exists "clubs_select_member" on public.clubs;
create policy "clubs_select_member"
on public.clubs for select
using (public.has_active_membership(id));

drop policy if exists "memberships_select_own_or_manager" on public.memberships;
create policy "memberships_select_own_or_manager"
on public.memberships for select
using (user_id = auth.uid() or public.has_manager_membership(club_id));

drop policy if exists "memberships_manager_write" on public.memberships;
create policy "memberships_manager_write"
on public.memberships for all
using (public.has_manager_membership(club_id))
with check (public.has_manager_membership(club_id));

-- -------------------------------------------------------------------
-- 1) Ensure one default staging club and backfill tenant links
-- -------------------------------------------------------------------
insert into public.clubs (name, slug, status)
values ('VDAN Staging', 'vdan-staging', 'active')
on conflict (slug) do nothing;

with default_club as (
  select id as club_id
  from public.clubs
  where slug = 'vdan-staging'
  limit 1
)
update public.profiles p
set club_id = dc.club_id,
    updated_at = now()
from default_club dc
where p.club_id is null;

with default_club as (
  select id as club_id
  from public.clubs
  where slug = 'vdan-staging'
  limit 1
),
effective_roles as (
  select
    p.id as user_id,
    p.member_no,
    coalesce(
      (
        select ur.role
        from public.user_roles ur
        where ur.user_id = p.id
          and ur.role in ('admin', 'vorstand')
        order by case ur.role when 'admin' then 1 else 2 end
        limit 1
      ),
      'member'
    ) as role
  from public.profiles p
)
insert into public.memberships (user_id, club_id, role, member_no, status)
select er.user_id, dc.club_id, er.role, er.member_no, 'active'
from effective_roles er
cross join default_club dc
on conflict (user_id, club_id) do nothing;

-- -------------------------------------------------------------------
-- 2) club_members hardening (RLS gap closure)
-- -------------------------------------------------------------------
alter table if exists public.club_members
  add column if not exists club_id uuid;

with default_club as (
  select id as club_id
  from public.clubs
  where slug = 'vdan-staging'
  limit 1
)
update public.club_members cm
set club_id = dc.club_id
from default_club dc
where cm.club_id is null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'club_members'
      and column_name = 'club_id'
      and is_nullable = 'YES'
  ) then
    execute 'alter table public.club_members alter column club_id set not null';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'club_members_club_id_fkey'
  ) then
    alter table public.club_members
      add constraint club_members_club_id_fkey
      foreign key (club_id) references public.clubs(id) on delete restrict;
  end if;
end $$;

create index if not exists idx_club_members_club on public.club_members(club_id);
create unique index if not exists uq_club_members_club_member_no
  on public.club_members(club_id, member_no);

alter table if exists public.club_members enable row level security;
grant select on public.club_members to authenticated;

drop policy if exists "club_members_select_own_or_manager" on public.club_members;
create policy "club_members_select_own_or_manager"
on public.club_members for select
using (
  public.has_manager_membership(club_id)
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.member_no = club_members.member_no
      and (p.club_id = club_members.club_id or p.club_id is null)
  )
);

drop policy if exists "club_members_manager_write" on public.club_members;
create policy "club_members_manager_write"
on public.club_members for all
using (public.has_manager_membership(club_id))
with check (public.has_manager_membership(club_id));

-- -------------------------------------------------------------------
-- 3) Enforce club_id on core domain tables
-- -------------------------------------------------------------------
alter table if exists public.feed_posts add column if not exists club_id uuid;
alter table if exists public.club_events add column if not exists club_id uuid;
alter table if exists public.catch_entries add column if not exists club_id uuid;
alter table if exists public.fishing_trips add column if not exists club_id uuid;
alter table if exists public.documents add column if not exists club_id uuid;
alter table if exists public.app_notes add column if not exists club_id uuid;

with default_club as (
  select id as club_id
  from public.clubs
  where slug = 'vdan-staging'
  limit 1
)
update public.feed_posts t
set club_id = dc.club_id
from default_club dc
where t.club_id is null;

with default_club as (
  select id as club_id
  from public.clubs
  where slug = 'vdan-staging'
  limit 1
)
update public.club_events t
set club_id = dc.club_id
from default_club dc
where t.club_id is null;

with default_club as (
  select id as club_id
  from public.clubs
  where slug = 'vdan-staging'
  limit 1
)
update public.work_events t
set club_id = dc.club_id
from default_club dc
where t.club_id is null;

with default_club as (
  select id as club_id
  from public.clubs
  where slug = 'vdan-staging'
  limit 1
)
update public.catch_entries t
set club_id = dc.club_id
from default_club dc
where t.club_id is null;

with default_club as (
  select id as club_id
  from public.clubs
  where slug = 'vdan-staging'
  limit 1
)
update public.fishing_trips t
set club_id = dc.club_id
from default_club dc
where t.club_id is null;

with default_club as (
  select id as club_id
  from public.clubs
  where slug = 'vdan-staging'
  limit 1
)
update public.documents t
set club_id = dc.club_id
from default_club dc
where t.club_id is null;

with default_club as (
  select id as club_id
  from public.clubs
  where slug = 'vdan-staging'
  limit 1
)
update public.app_notes t
set club_id = dc.club_id
from default_club dc
where t.club_id is null;

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='feed_posts' and column_name='club_id' and is_nullable='YES') then
    execute 'alter table public.feed_posts alter column club_id set not null';
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='club_events' and column_name='club_id' and is_nullable='YES') then
    execute 'alter table public.club_events alter column club_id set not null';
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='work_events' and column_name='club_id' and is_nullable='YES') then
    execute 'alter table public.work_events alter column club_id set not null';
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='catch_entries' and column_name='club_id' and is_nullable='YES') then
    execute 'alter table public.catch_entries alter column club_id set not null';
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='fishing_trips' and column_name='club_id' and is_nullable='YES') then
    execute 'alter table public.fishing_trips alter column club_id set not null';
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='documents' and column_name='club_id' and is_nullable='YES') then
    execute 'alter table public.documents alter column club_id set not null';
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='app_notes' and column_name='club_id' and is_nullable='YES') then
    execute 'alter table public.app_notes alter column club_id set not null';
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='feed_posts_club_id_fkey') then
    alter table public.feed_posts add constraint feed_posts_club_id_fkey foreign key (club_id) references public.clubs(id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname='club_events_club_id_fkey') then
    alter table public.club_events add constraint club_events_club_id_fkey foreign key (club_id) references public.clubs(id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname='work_events_club_id_fkey') then
    alter table public.work_events add constraint work_events_club_id_fkey foreign key (club_id) references public.clubs(id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname='catch_entries_club_id_fkey') then
    alter table public.catch_entries add constraint catch_entries_club_id_fkey foreign key (club_id) references public.clubs(id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname='fishing_trips_club_id_fkey') then
    alter table public.fishing_trips add constraint fishing_trips_club_id_fkey foreign key (club_id) references public.clubs(id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname='documents_club_id_fkey') then
    alter table public.documents add constraint documents_club_id_fkey foreign key (club_id) references public.clubs(id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname='app_notes_club_id_fkey') then
    alter table public.app_notes add constraint app_notes_club_id_fkey foreign key (club_id) references public.clubs(id) on delete restrict;
  end if;
end $$;

create index if not exists idx_feed_posts_club_created_at on public.feed_posts(club_id, created_at desc);
create index if not exists idx_club_events_club_starts_at on public.club_events(club_id, starts_at);
create index if not exists idx_work_events_club_starts_at on public.work_events(club_id, starts_at);
create index if not exists idx_catch_entries_club_created_at on public.catch_entries(club_id, created_at desc);
create index if not exists idx_fishing_trips_club_trip_date on public.fishing_trips(club_id, trip_date desc);
create index if not exists idx_documents_club_sort on public.documents(club_id, category, sort_order);
create index if not exists idx_app_notes_club_created_at on public.app_notes(club_id, created_at desc);

-- -------------------------------------------------------------------
-- 4) Offline safety primitives: idempotency + row_version
-- -------------------------------------------------------------------
alter table if exists public.feed_posts add column if not exists client_request_id uuid;
alter table if exists public.club_events add column if not exists client_request_id uuid;
alter table if exists public.work_participations add column if not exists client_request_id uuid;
alter table if exists public.catch_entries add column if not exists client_request_id uuid;
alter table if exists public.fishing_trips add column if not exists client_request_id uuid;
alter table if exists public.app_notes add column if not exists client_request_id uuid;

create unique index if not exists uq_feed_posts_club_client_request
  on public.feed_posts(club_id, client_request_id)
  where client_request_id is not null;
create unique index if not exists uq_club_events_club_client_request
  on public.club_events(club_id, client_request_id)
  where client_request_id is not null;
create unique index if not exists uq_work_participations_event_client_request
  on public.work_participations(event_id, client_request_id)
  where client_request_id is not null;
create unique index if not exists uq_catch_entries_club_client_request
  on public.catch_entries(club_id, client_request_id)
  where client_request_id is not null;
create unique index if not exists uq_fishing_trips_club_client_request
  on public.fishing_trips(club_id, client_request_id)
  where client_request_id is not null;
create unique index if not exists uq_app_notes_club_client_request
  on public.app_notes(club_id, client_request_id)
  where client_request_id is not null;

alter table if exists public.feed_posts add column if not exists row_version bigint not null default 1;
alter table if exists public.club_events add column if not exists row_version bigint not null default 1;
alter table if exists public.work_events add column if not exists row_version bigint not null default 1;
alter table if exists public.work_participations add column if not exists row_version bigint not null default 1;
alter table if exists public.catch_entries add column if not exists row_version bigint not null default 1;
alter table if exists public.fishing_trips add column if not exists row_version bigint not null default 1;
alter table if exists public.documents add column if not exists row_version bigint not null default 1;
alter table if exists public.app_notes add column if not exists row_version bigint not null default 1;

create or replace function public.bump_row_version()
returns trigger
language plpgsql
as $$
begin
  new.row_version := coalesce(old.row_version, 0) + 1;
  return new;
end;
$$;

drop trigger if exists trg_feed_posts_row_version on public.feed_posts;
create trigger trg_feed_posts_row_version
before update on public.feed_posts
for each row execute function public.bump_row_version();

drop trigger if exists trg_club_events_row_version on public.club_events;
create trigger trg_club_events_row_version
before update on public.club_events
for each row execute function public.bump_row_version();

drop trigger if exists trg_work_events_row_version on public.work_events;
create trigger trg_work_events_row_version
before update on public.work_events
for each row execute function public.bump_row_version();

drop trigger if exists trg_work_participations_row_version on public.work_participations;
create trigger trg_work_participations_row_version
before update on public.work_participations
for each row execute function public.bump_row_version();

drop trigger if exists trg_catch_entries_row_version on public.catch_entries;
create trigger trg_catch_entries_row_version
before update on public.catch_entries
for each row execute function public.bump_row_version();

drop trigger if exists trg_fishing_trips_row_version on public.fishing_trips;
create trigger trg_fishing_trips_row_version
before update on public.fishing_trips
for each row execute function public.bump_row_version();

drop trigger if exists trg_documents_row_version on public.documents;
create trigger trg_documents_row_version
before update on public.documents
for each row execute function public.bump_row_version();

drop trigger if exists trg_app_notes_row_version on public.app_notes;
create trigger trg_app_notes_row_version
before update on public.app_notes
for each row execute function public.bump_row_version();

-- -------------------------------------------------------------------
-- 5) Tighten RLS for core write flows to tenant scope
-- -------------------------------------------------------------------
drop policy if exists "feed_select_all" on public.feed_posts;
create policy "feed_select_all"
on public.feed_posts for select
to authenticated
using (public.has_active_membership(club_id));

drop policy if exists "feed_insert_manager" on public.feed_posts;
create policy "feed_insert_manager"
on public.feed_posts for insert
to authenticated
with check (
  auth.uid() = author_id
  and public.has_manager_membership(club_id)
);

drop policy if exists "feed_update_manager" on public.feed_posts;
create policy "feed_update_manager"
on public.feed_posts for update
to authenticated
using (public.has_manager_membership(club_id))
with check (public.has_manager_membership(club_id));

drop policy if exists "feed_delete_manager" on public.feed_posts;
create policy "feed_delete_manager"
on public.feed_posts for delete
to authenticated
using (public.has_manager_membership(club_id));

drop policy if exists "club_events_select_published_or_manager" on public.club_events;
create policy "club_events_select_published_or_manager"
on public.club_events for select
to authenticated
using (
  (status = 'published' and public.has_active_membership(club_id))
  or public.has_manager_membership(club_id)
);

drop policy if exists "club_events_manager_all" on public.club_events;
create policy "club_events_manager_all"
on public.club_events for all
to authenticated
using (public.has_manager_membership(club_id))
with check (public.has_manager_membership(club_id));

drop policy if exists "work_events_member_select_published" on public.work_events;
create policy "work_events_member_select_published"
on public.work_events for select
to authenticated
using (
  (status = 'published' and public.has_active_membership(club_id))
  or public.has_manager_membership(club_id)
);

drop policy if exists "work_events_manager_all" on public.work_events;
create policy "work_events_manager_all"
on public.work_events for all
to authenticated
using (public.has_manager_membership(club_id))
with check (public.has_manager_membership(club_id));

drop policy if exists "work_participations_member_select_own_or_manager" on public.work_participations;
create policy "work_participations_member_select_own_or_manager"
on public.work_participations for select
to authenticated
using (
  exists (
    select 1
    from public.work_events e
    where e.id = work_participations.event_id
      and public.has_active_membership(e.club_id)
      and (
        work_participations.auth_uid = auth.uid()
        or public.has_manager_membership(e.club_id)
      )
  )
);

drop policy if exists "work_participations_member_insert_own_published" on public.work_participations;
create policy "work_participations_member_insert_own_published"
on public.work_participations for insert
to authenticated
with check (
  exists (
    select 1
    from public.work_events e
    where e.id = work_participations.event_id
      and e.status = 'published'
      and public.has_active_membership(e.club_id)
      and (
        work_participations.auth_uid = auth.uid()
        or public.has_manager_membership(e.club_id)
      )
  )
);

drop policy if exists "work_participations_member_update_own_or_manager" on public.work_participations;
create policy "work_participations_member_update_own_or_manager"
on public.work_participations for update
to authenticated
using (
  exists (
    select 1
    from public.work_events e
    where e.id = work_participations.event_id
      and public.has_active_membership(e.club_id)
      and (
        work_participations.auth_uid = auth.uid()
        or public.has_manager_membership(e.club_id)
      )
  )
)
with check (
  exists (
    select 1
    from public.work_events e
    where e.id = work_participations.event_id
      and public.has_active_membership(e.club_id)
      and (
        work_participations.auth_uid = auth.uid()
        or public.has_manager_membership(e.club_id)
      )
  )
);

drop policy if exists "work_participations_manager_delete" on public.work_participations;
create policy "work_participations_manager_delete"
on public.work_participations for delete
to authenticated
using (
  exists (
    select 1
    from public.work_events e
    where e.id = work_participations.event_id
      and public.has_manager_membership(e.club_id)
  )
);

drop policy if exists "work_checkins_select_own_or_manager" on public.work_checkins;
create policy "work_checkins_select_own_or_manager"
on public.work_checkins for select
to authenticated
using (
  exists (
    select 1
    from public.work_events e
    where e.id = work_checkins.event_id
      and public.has_active_membership(e.club_id)
      and (
        work_checkins.auth_uid = auth.uid()
        or public.has_manager_membership(e.club_id)
      )
  )
);

drop policy if exists "work_checkins_insert_own_or_manager" on public.work_checkins;
create policy "work_checkins_insert_own_or_manager"
on public.work_checkins for insert
to authenticated
with check (
  exists (
    select 1
    from public.work_events e
    where e.id = work_checkins.event_id
      and public.has_active_membership(e.club_id)
      and (
        work_checkins.auth_uid = auth.uid()
        or public.has_manager_membership(e.club_id)
      )
  )
);

drop policy if exists "catch_select_own_or_manager" on public.catch_entries;
create policy "catch_select_own_or_manager"
on public.catch_entries for select
to authenticated
using (
  public.has_active_membership(club_id)
  and (auth.uid() = user_id or public.has_manager_membership(club_id))
);

drop policy if exists "catch_insert_own_or_manager" on public.catch_entries;
create policy "catch_insert_own_or_manager"
on public.catch_entries for insert
to authenticated
with check (
  public.has_active_membership(club_id)
  and (auth.uid() = user_id or public.has_manager_membership(club_id))
);

drop policy if exists "catch_update_own_or_manager" on public.catch_entries;
create policy "catch_update_own_or_manager"
on public.catch_entries for update
to authenticated
using (
  public.has_active_membership(club_id)
  and (auth.uid() = user_id or public.has_manager_membership(club_id))
)
with check (
  public.has_active_membership(club_id)
  and (auth.uid() = user_id or public.has_manager_membership(club_id))
);

drop policy if exists "catch_delete_own_or_manager" on public.catch_entries;
create policy "catch_delete_own_or_manager"
on public.catch_entries for delete
to authenticated
using (
  public.has_active_membership(club_id)
  and (auth.uid() = user_id or public.has_manager_membership(club_id))
);

drop policy if exists "fishing_trips_select_own_or_manager" on public.fishing_trips;
create policy "fishing_trips_select_own_or_manager"
on public.fishing_trips for select
to authenticated
using (
  public.has_active_membership(club_id)
  and (auth.uid() = user_id or public.has_manager_membership(club_id))
);

drop policy if exists "fishing_trips_insert_own_or_manager" on public.fishing_trips;
create policy "fishing_trips_insert_own_or_manager"
on public.fishing_trips for insert
to authenticated
with check (
  public.has_active_membership(club_id)
  and (auth.uid() = user_id or public.has_manager_membership(club_id))
);

drop policy if exists "fishing_trips_update_own_or_manager" on public.fishing_trips;
create policy "fishing_trips_update_own_or_manager"
on public.fishing_trips for update
to authenticated
using (
  public.has_active_membership(club_id)
  and (auth.uid() = user_id or public.has_manager_membership(club_id))
)
with check (
  public.has_active_membership(club_id)
  and (auth.uid() = user_id or public.has_manager_membership(club_id))
);

drop policy if exists "fishing_trips_delete_own_or_manager" on public.fishing_trips;
create policy "fishing_trips_delete_own_or_manager"
on public.fishing_trips for delete
to authenticated
using (
  public.has_active_membership(club_id)
  and (auth.uid() = user_id or public.has_manager_membership(club_id))
);

drop policy if exists "documents_select_public" on public.documents;
create policy "documents_select_public"
on public.documents for select
to authenticated
using (public.has_active_membership(club_id));

drop policy if exists "documents_write_manager" on public.documents;
create policy "documents_write_manager"
on public.documents for all
to authenticated
using (public.has_manager_membership(club_id))
with check (public.has_manager_membership(club_id));

drop policy if exists "notes_select_own" on public.app_notes;
create policy "notes_select_own"
on public.app_notes for select
to authenticated
using (
  public.has_active_membership(club_id)
  and (auth.uid() = user_id or public.has_manager_membership(club_id))
);

drop policy if exists "notes_insert_own" on public.app_notes;
create policy "notes_insert_own"
on public.app_notes for insert
to authenticated
with check (
  public.has_active_membership(club_id)
  and (auth.uid() = user_id or public.has_manager_membership(club_id))
);

drop policy if exists "notes_update_own" on public.app_notes;
create policy "notes_update_own"
on public.app_notes for update
to authenticated
using (
  public.has_active_membership(club_id)
  and (auth.uid() = user_id or public.has_manager_membership(club_id))
)
with check (
  public.has_active_membership(club_id)
  and (auth.uid() = user_id or public.has_manager_membership(club_id))
);

drop policy if exists "notes_delete_own" on public.app_notes;
create policy "notes_delete_own"
on public.app_notes for delete
to authenticated
using (
  public.has_active_membership(club_id)
  and (auth.uid() = user_id or public.has_manager_membership(club_id))
);

commit;

-- Post-run checks (manual):
-- 1) select club_id, count(*) from public.feed_posts group by club_id;
-- 2) select club_id, count(*) from public.memberships group by club_id;
-- 3) explain analyze select * from public.feed_posts order by created_at desc limit 20;
