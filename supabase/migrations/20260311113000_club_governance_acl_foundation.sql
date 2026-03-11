-- 79 Club Governance ACL Foundation
-- Status: DRAFT PREPARED (not executed by Codex)
-- Date: 2026-03-11
--
-- Goal:
-- - Add persistent club-scoped role/permission foundation
-- - Keep existing user_roles flow intact
-- - Protect core roles: member, vorstand, admin
--
-- Mandatory follow-up:
-- - Run companion audit SQL:
--   docs/supabase/79_club_governance_acl_foundation_audit.sql
--
-- Non-goals:
-- - No RLS cutover to ACL tables in this migration
-- - No deletion/refactor of public.user_roles

begin;

create table if not exists public.club_roles (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null,
  role_key text not null,
  label text not null,
  is_core boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, role_key),
  check (role_key ~ '^[a-z0-9_]{2,40}$')
);

create table if not exists public.club_role_permissions (
  club_id uuid not null,
  role_key text not null,
  module_key text not null,
  can_read boolean not null default false,
  can_write boolean not null default false,
  can_update boolean not null default false,
  can_delete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (club_id, role_key, module_key),
  foreign key (club_id, role_key)
    references public.club_roles (club_id, role_key)
    on delete cascade,
  check (module_key ~ '^[a-z0-9_]{2,60}$')
);

create table if not exists public.club_user_roles (
  user_id uuid not null,
  club_id uuid not null,
  role_key text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, club_id, role_key),
  foreign key (club_id, role_key)
    references public.club_roles (club_id, role_key)
    on delete cascade
);

create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

drop trigger if exists trg_club_roles_updated_at on public.club_roles;
create trigger trg_club_roles_updated_at
before update on public.club_roles
for each row execute function public.tg_set_updated_at();

drop trigger if exists trg_club_role_permissions_updated_at on public.club_role_permissions;
create trigger trg_club_role_permissions_updated_at
before update on public.club_role_permissions
for each row execute function public.tg_set_updated_at();

create or replace function public.tg_protect_core_roles()
returns trigger
language plpgsql
as $$
begin
  if old.is_core then
    if tg_op = 'DELETE' then
      raise exception 'core role cannot be deleted';
    end if;
    if new.role_key <> old.role_key then
      raise exception 'core role_key cannot be changed';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end
$$;

drop trigger if exists trg_protect_core_roles_upd on public.club_roles;
create trigger trg_protect_core_roles_upd
before update on public.club_roles
for each row execute function public.tg_protect_core_roles();

drop trigger if exists trg_protect_core_roles_del on public.club_roles;
create trigger trg_protect_core_roles_del
before delete on public.club_roles
for each row execute function public.tg_protect_core_roles();

-- Ensure core roles for every known club.
insert into public.club_roles (club_id, role_key, label, is_core)
select c.club_id, r.role_key, r.label, true
from (
  select distinct club_id
  from public.user_roles
  where club_id is not null
) c
cross join (
  values
    ('member', 'Mitglied'),
    ('vorstand', 'Vorstand'),
    ('admin', 'Admin')
) as r(role_key, label)
on conflict (club_id, role_key) do update
set label = excluded.label;

-- Backfill existing assignments.
insert into public.club_user_roles (user_id, club_id, role_key)
select distinct ur.user_id, ur.club_id, lower(ur.role)
from public.user_roles ur
where ur.club_id is not null
  and lower(ur.role) in ('member','vorstand','admin')
on conflict do nothing;

commit;
