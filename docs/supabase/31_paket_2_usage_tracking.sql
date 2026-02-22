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
create or replace view public.v_admin_online_users as
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
