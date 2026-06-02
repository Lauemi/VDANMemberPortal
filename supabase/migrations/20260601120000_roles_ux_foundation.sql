-- Migration: Rollen/Rechte UX Fundament (Spiegel aus Remote-Supabase)
-- Hintergrund: Diese Objekte wurden am 2026-06-01 via Supabase-MCP direkt deployed
--              und fehlten bisher im Repo. Diese Migration spiegelt den DB-Stand
--              repo-wahr nach. Idempotent (IF NOT EXISTS + CREATE OR REPLACE).
-- Naechste Schritte (OFFEN): Write-RPCs, Propagation-Trigger → club_user_roles, Frontend.
-- Referenz: SYSTEM/FCP/LAUNCH_CRITERIA/GATE_A_Rollen_Rechte_UX.md

begin;

-- ============================================================
-- 1. Tabelle: club_member_role_assignments
--    Zweck: Member-basierte Rollenzuweisung (Option 2).
--    Trennt die Zuweisungs-Quelle von club_user_roles (Zugriffs-Gate).
--    Propagation → club_user_roles erfolgt ueber Write-RPCs (noch offen).
-- ============================================================

create table if not exists public.club_member_role_assignments (
  id             uuid        not null default gen_random_uuid() primary key,
  club_id        uuid        not null,
  club_member_id uuid        not null,
  role_key       text        not null,
  assigned_at    timestamptz not null default now(),
  assigned_by    uuid,
  created_at     timestamptz not null default now(),
  unique (club_member_id, role_key)
);

-- Indexe
create index if not exists idx_cmra_club_role
  on public.club_member_role_assignments (club_id, role_key);

create index if not exists idx_cmra_member
  on public.club_member_role_assignments (club_member_id);

-- RLS
alter table public.club_member_role_assignments enable row level security;

drop policy if exists cmra_admin_manage on public.club_member_role_assignments;
create policy cmra_admin_manage
  on public.club_member_role_assignments
  for all
  using  (public.is_admin_or_vorstand_in_club(club_id) or public.fcp_is_superadmin())
  with check (public.is_admin_or_vorstand_in_club(club_id) or public.fcp_is_superadmin());

-- ============================================================
-- 2. RPC: admin_club_role_permissions_read
--    Zweck: Rechte-Matrix pro Rolle × Modul (Tab-1-Datenquelle im ADM).
--    Liest aus module_catalog + club_role_permissions.
-- ============================================================

drop function if exists public.admin_club_role_permissions_read(uuid, text);

create or replace function public.admin_club_role_permissions_read(
  p_club_id  uuid,
  p_role_key text
)
returns table(
  module_key   text,
  module_label text,
  sort_order   integer,
  can_view     boolean,
  can_read     boolean,
  can_write    boolean,
  can_update   boolean,
  can_delete   boolean
)
language sql
stable
security definer
set search_path = public, auth, pg_catalog
as $$
  select
    m.module_key,
    m.label as module_label,
    m.sort_order,
    coalesce(p.can_view,   false),
    coalesce(p.can_read,   false),
    coalesce(p.can_write,  false),
    coalesce(p.can_update, false),
    coalesce(p.can_delete, false)
  from public.module_catalog m
  left join public.club_role_permissions p
    on  p.module_key = m.module_key
    and p.club_id    = p_club_id
    and p.role_key   = p_role_key
  where m.is_active
    and (public.is_admin_or_vorstand_in_club(p_club_id) or public.fcp_is_superadmin())
  order by m.sort_order, m.module_key;
$$;

revoke all on function public.admin_club_role_permissions_read(uuid, text) from public, anon;
grant execute on function public.admin_club_role_permissions_read(uuid, text) to authenticated;
grant execute on function public.admin_club_role_permissions_read(uuid, text) to service_role;

-- ============================================================
-- 3. RPC: admin_club_role_members_read
--    Zweck: Mitglieder die einer Rolle zugewiesen sind (Tab-2-Datenquelle).
--    Liest aus club_member_role_assignments + club_members.
-- ============================================================

drop function if exists public.admin_club_role_members_read(uuid, text);

create or replace function public.admin_club_role_members_read(
  p_club_id  uuid,
  p_role_key text
)
returns table(
  club_member_id uuid,
  member_no      text,
  first_name     text,
  last_name      text,
  has_login      boolean
)
language sql
stable
security definer
set search_path = public, auth, pg_catalog
as $$
  select
    cm.id,
    cm.member_no,
    cm.first_name,
    cm.last_name,
    (cm.auth_user_id is not null)
  from public.club_member_role_assignments a
  join public.club_members cm on cm.id = a.club_member_id
  where a.club_id  = p_club_id
    and a.role_key = p_role_key
    and (public.is_admin_or_vorstand_in_club(p_club_id) or public.fcp_is_superadmin())
  order by cm.last_name, cm.first_name;
$$;

revoke all on function public.admin_club_role_members_read(uuid, text) from public, anon;
grant execute on function public.admin_club_role_members_read(uuid, text) to authenticated;
grant execute on function public.admin_club_role_members_read(uuid, text) to service_role;

-- ============================================================
-- 4. RPC: admin_club_members_for_role_assign
--    Zweck: Alle Mitglieder eines Clubs fuer den Zuweisungs-Dialog.
--    Zugewiesene zuerst. has_role + has_login als Flags.
-- ============================================================

drop function if exists public.admin_club_members_for_role_assign(uuid, text);

create or replace function public.admin_club_members_for_role_assign(
  p_club_id  uuid,
  p_role_key text
)
returns table(
  club_member_id uuid,
  member_no      text,
  first_name     text,
  last_name      text,
  has_role       boolean,
  has_login      boolean
)
language sql
stable
security definer
set search_path = public, auth, pg_catalog
as $$
  select
    cm.id,
    cm.member_no,
    cm.first_name,
    cm.last_name,
    exists (
      select 1 from public.club_member_role_assignments a
      where a.club_member_id = cm.id and a.role_key = p_role_key
    ),
    (cm.auth_user_id is not null)
  from public.club_members cm
  where cm.club_id = p_club_id
    and (public.is_admin_or_vorstand_in_club(p_club_id) or public.fcp_is_superadmin())
  order by
    exists (
      select 1 from public.club_member_role_assignments a
      where a.club_member_id = cm.id and a.role_key = p_role_key
    ) desc,
    cm.last_name,
    cm.first_name;
$$;

revoke all on function public.admin_club_members_for_role_assign(uuid, text) from public, anon;
grant execute on function public.admin_club_members_for_role_assign(uuid, text) to authenticated;
grant execute on function public.admin_club_members_for_role_assign(uuid, text) to service_role;

notify pgrst, 'reload schema';

commit;
