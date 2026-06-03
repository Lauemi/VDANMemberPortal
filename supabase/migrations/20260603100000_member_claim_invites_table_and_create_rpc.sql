-- Member-Claim STEP 1: club_member_invites Tabelle + admin_member_invite_create RPC
-- Admin-initiierte, mitglied-gebundene Einladung (single-use, 14d Ablauf).
-- Deployed via Supabase-MCP 2026-06-03, hier repo-wahr gespiegelt.
-- Plan: ROSCCX SYSTEM/FCP/MEMBER_CLAIM_INTEGRATION/

begin;

-- ============================================================
-- 1. Tabelle club_member_invites
-- ============================================================
create table if not exists public.club_member_invites (
  id              uuid        not null default gen_random_uuid() primary key,
  club_id         uuid        not null,
  club_member_id  uuid        not null references public.club_members(id) on delete cascade,
  token           text        not null unique,
  status          text        not null default 'active'
                    check (status in ('active','claimed','revoked','expired')),
  created_by      uuid,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null default (now() + interval '14 days'),
  claimed_at      timestamptz,
  claimed_user_id uuid
);

create unique index if not exists uniq_cmi_one_active_per_member
  on public.club_member_invites (club_member_id) where status = 'active';
create index if not exists idx_cmi_token on public.club_member_invites (token);
create index if not exists idx_cmi_club  on public.club_member_invites (club_id);

alter table public.club_member_invites enable row level security;
drop policy if exists cmi_admin_manage on public.club_member_invites;
create policy cmi_admin_manage
  on public.club_member_invites
  for all
  using  (public.is_admin_or_vorstand_in_club(club_id) or public.fcp_is_superadmin())
  with check (public.is_admin_or_vorstand_in_club(club_id) or public.fcp_is_superadmin());

-- ============================================================
-- 2. RPC admin_member_invite_create
-- ============================================================
drop function if exists public.admin_member_invite_create(uuid, uuid);

create or replace function public.admin_member_invite_create(
  p_club_id        uuid,
  p_club_member_id uuid
)
returns table(
  ok           boolean,
  message      text,
  token        text,
  first_name   text,
  last_name    text,
  member_email text,
  expires_at   timestamptz
)
language plpgsql
security definer
set search_path = public, auth, extensions, pg_catalog
as $$
declare
  v_member  record;
  v_token   text;
  v_expires timestamptz := now() + interval '14 days';
begin
  if not (public.is_admin_or_vorstand_in_club(p_club_id) or public.fcp_is_superadmin()) then
    return query select false, 'Keine Berechtigung.'::text,
      null::text, null::text, null::text, null::text, null::timestamptz;
    return;
  end if;

  select cm.id, cm.first_name, cm.last_name, cm.email, cm.auth_user_id
    into v_member
  from public.club_members cm
  where cm.id = p_club_member_id and cm.club_id = p_club_id;

  if not found then
    return query select false, 'Mitglied nicht gefunden.'::text,
      null::text, null::text, null::text, null::text, null::timestamptz;
    return;
  end if;

  if v_member.auth_user_id is not null then
    return query select false, 'Dieses Mitglied hat bereits einen Zugang.'::text,
      null::text, null::text, null::text, null::text, null::timestamptz;
    return;
  end if;

  update public.club_member_invites
    set status = 'revoked'
    where club_member_id = p_club_member_id and status = 'active';

  v_token := encode(gen_random_bytes(32), 'hex');

  insert into public.club_member_invites
    (club_id, club_member_id, token, status, created_by, expires_at)
  values
    (p_club_id, p_club_member_id, v_token, 'active', auth.uid(), v_expires);

  return query select true, 'Einladung erstellt.'::text, v_token,
    v_member.first_name, v_member.last_name, v_member.email, v_expires;
end;
$$;

revoke all on function public.admin_member_invite_create(uuid, uuid) from public, anon;
grant execute on function public.admin_member_invite_create(uuid, uuid) to authenticated;
grant execute on function public.admin_member_invite_create(uuid, uuid) to service_role;

notify pgrst, 'reload schema';

commit;
