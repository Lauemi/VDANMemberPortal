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
