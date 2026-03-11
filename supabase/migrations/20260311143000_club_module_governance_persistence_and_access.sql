-- 83 Club Module Governance Persistence + Access Helper
-- Status: DRAFT PREPARED (not executed by Codex)
-- Date: 2026-03-11
--
-- Goal:
-- - Persist module/usecase catalog in DB
-- - Persist club-specific module enablement in DB (club_id-scoped)
-- - Provide helper function to evaluate effective usecase access for current user
--
-- Mandatory follow-up:
-- - Run companion audit SQL:
--   docs/supabase/83_club_module_governance_persistence_and_access_audit.sql

begin;

create table if not exists public.module_catalog (
  module_key text primary key,
  label text not null,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (module_key ~ '^[a-z0-9_]{2,60}$')
);

create table if not exists public.module_usecases (
  module_key text not null,
  usecase_key text not null,
  label text not null,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (module_key, usecase_key),
  foreign key (module_key)
    references public.module_catalog (module_key)
    on delete cascade,
  check (usecase_key ~ '^[a-z0-9_]{2,60}$')
);

create table if not exists public.club_module_usecases (
  club_id uuid not null,
  module_key text not null,
  usecase_key text not null,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (club_id, module_key, usecase_key),
  foreign key (module_key, usecase_key)
    references public.module_usecases (module_key, usecase_key)
    on delete cascade
);

create index if not exists idx_club_module_usecases_club
  on public.club_module_usecases (club_id);

create index if not exists idx_club_module_usecases_usecase
  on public.club_module_usecases (usecase_key);

drop trigger if exists trg_module_catalog_updated_at on public.module_catalog;
create trigger trg_module_catalog_updated_at
before update on public.module_catalog
for each row execute function public.tg_set_updated_at();

drop trigger if exists trg_module_usecases_updated_at on public.module_usecases;
create trigger trg_module_usecases_updated_at
before update on public.module_usecases
for each row execute function public.tg_set_updated_at();

drop trigger if exists trg_club_module_usecases_updated_at on public.club_module_usecases;
create trigger trg_club_module_usecases_updated_at
before update on public.club_module_usecases
for each row execute function public.tg_set_updated_at();

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
    where cur.user_id = auth.uid()
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
     and cur.user_id = auth.uid()
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

insert into public.module_catalog (module_key, label, is_active, sort_order)
values
  ('fishing', 'Fishing', true, 10),
  ('work', 'Arbeitseinsätze', true, 20),
  ('feed', 'Feed', true, 30),
  ('members', 'Mitglieder', true, 40),
  ('documents', 'Dokumente', true, 50),
  ('meetings', 'Sitzungen', true, 60),
  ('settings', 'Einstellungen', true, 70)
on conflict (module_key) do update
set label = excluded.label,
    is_active = excluded.is_active,
    sort_order = excluded.sort_order;

insert into public.module_usecases (module_key, usecase_key, label, is_active, sort_order)
values
  ('fishing', 'fangliste', 'Fangliste', true, 10),
  ('fishing', 'go_fishing', 'Go Fishing', true, 20),
  ('fishing', 'fangliste_cockpit', 'Fangliste Cockpit', true, 30),
  ('work', 'arbeitseinsaetze', 'Arbeitseinsätze', true, 10),
  ('work', 'arbeitseinsaetze_cockpit', 'Arbeitseinsätze Cockpit', true, 20),
  ('feed', 'feed', 'Feed', true, 10),
  ('members', 'mitglieder', 'Mitglieder', true, 10),
  ('members', 'mitglieder_registry', 'Mitglieder Registry', true, 20),
  ('documents', 'dokumente', 'Dokumente', true, 10),
  ('meetings', 'sitzungen', 'Sitzungen', true, 10),
  ('settings', 'einstellungen', 'Einstellungen', true, 10)
on conflict (module_key, usecase_key) do update
set label = excluded.label,
    is_active = excluded.is_active,
    sort_order = excluded.sort_order;

insert into public.club_module_usecases (club_id, module_key, usecase_key, is_enabled)
select
  c.club_id,
  mu.module_key,
  mu.usecase_key,
  true
from (
  select distinct club_id
  from public.club_roles
) c
join public.module_usecases mu
  on mu.is_active = true
join public.module_catalog mc
  on mc.module_key = mu.module_key
 and mc.is_active = true
on conflict (club_id, module_key, usecase_key) do nothing;

with defaults as (
  select * from (values
    ('member',   'fangliste',               true,  true,  false, false, false),
    ('member',   'go_fishing',              true,  true,  false, false, false),
    ('member',   'fangliste_cockpit',       false, false, false, false, false),
    ('member',   'arbeitseinsaetze',        true,  true,  false, false, false),
    ('member',   'arbeitseinsaetze_cockpit',false, false, false, false, false),
    ('member',   'feed',                    true,  true,  false, false, false),
    ('member',   'mitglieder',              false, false, false, false, false),
    ('member',   'mitglieder_registry',     false, false, false, false, false),
    ('member',   'dokumente',               false, false, false, false, false),
    ('member',   'sitzungen',               false, false, false, false, false),
    ('member',   'einstellungen',           true,  true,  false, false, false),

    ('vorstand', 'fangliste',               true,  true,  true,  true,  false),
    ('vorstand', 'go_fishing',              true,  true,  true,  true,  false),
    ('vorstand', 'fangliste_cockpit',       true,  true,  true,  true,  false),
    ('vorstand', 'arbeitseinsaetze',        true,  true,  true,  true,  false),
    ('vorstand', 'arbeitseinsaetze_cockpit',true,  true,  true,  true,  false),
    ('vorstand', 'feed',                    true,  true,  true,  true,  false),
    ('vorstand', 'mitglieder',              true,  true,  true,  true,  false),
    ('vorstand', 'mitglieder_registry',     true,  true,  true,  true,  false),
    ('vorstand', 'dokumente',               true,  true,  true,  true,  false),
    ('vorstand', 'sitzungen',               true,  true,  true,  true,  false),
    ('vorstand', 'einstellungen',           true,  true,  true,  true,  false),

    ('admin',    'fangliste',               true,  true,  true,  true,  true),
    ('admin',    'go_fishing',              true,  true,  true,  true,  true),
    ('admin',    'fangliste_cockpit',       true,  true,  true,  true,  true),
    ('admin',    'arbeitseinsaetze',        true,  true,  true,  true,  true),
    ('admin',    'arbeitseinsaetze_cockpit',true,  true,  true,  true,  true),
    ('admin',    'feed',                    true,  true,  true,  true,  true),
    ('admin',    'mitglieder',              true,  true,  true,  true,  true),
    ('admin',    'mitglieder_registry',     true,  true,  true,  true,  true),
    ('admin',    'dokumente',               true,  true,  true,  true,  true),
    ('admin',    'sitzungen',               true,  true,  true,  true,  true),
    ('admin',    'einstellungen',           true,  true,  true,  true,  true)
  ) as t(role_key, usecase_key, can_view, can_read, can_write, can_update, can_delete)
)
insert into public.club_role_permissions (
  club_id, role_key, module_key, can_view, can_read, can_write, can_update, can_delete
)
select
  cr.club_id,
  d.role_key,
  d.usecase_key,
  d.can_view,
  d.can_read,
  d.can_write,
  d.can_update,
  d.can_delete
from public.club_roles cr
join defaults d
  on d.role_key = cr.role_key
where cr.role_key in ('member', 'vorstand', 'admin')
on conflict (club_id, role_key, module_key) do nothing;

alter table public.module_catalog enable row level security;
alter table public.module_usecases enable row level security;
alter table public.club_module_usecases enable row level security;

drop policy if exists "module_catalog_select_authenticated" on public.module_catalog;
create policy "module_catalog_select_authenticated"
on public.module_catalog
for select
to authenticated
using (true);

drop policy if exists "module_catalog_admin_any_club_all" on public.module_catalog;
create policy "module_catalog_admin_any_club_all"
on public.module_catalog
for all
to authenticated
using (public.is_admin_in_any_club())
with check (public.is_admin_in_any_club());

drop policy if exists "module_usecases_select_authenticated" on public.module_usecases;
create policy "module_usecases_select_authenticated"
on public.module_usecases
for select
to authenticated
using (true);

drop policy if exists "module_usecases_admin_any_club_all" on public.module_usecases;
create policy "module_usecases_admin_any_club_all"
on public.module_usecases
for all
to authenticated
using (public.is_admin_in_any_club())
with check (public.is_admin_in_any_club());

drop policy if exists "club_module_usecases_select_same_club_or_admin" on public.club_module_usecases;
create policy "club_module_usecases_select_same_club_or_admin"
on public.club_module_usecases
for select
to authenticated
using (public.is_same_club(club_id) or public.is_admin_in_any_club());

drop policy if exists "club_module_usecases_admin_same_club_or_admin" on public.club_module_usecases;
create policy "club_module_usecases_admin_same_club_or_admin"
on public.club_module_usecases
for all
to authenticated
using (public.is_admin_in_club(club_id) or public.is_admin_in_any_club())
with check (public.is_admin_in_club(club_id) or public.is_admin_in_any_club());

commit;
