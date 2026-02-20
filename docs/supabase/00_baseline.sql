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
