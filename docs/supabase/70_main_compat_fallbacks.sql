-- VDAN/FCP - Main compatibility hardening (fallbacks + profile club mapping)
-- Run after:
--   69_public_content_tenant_scope.sql
--
-- Goal:
--   - Keep current main user flows stable in single-club operation
--   - Preserve tenant security baseline

begin;

-- -------------------------------------------------------------------
-- 0) Ensure public_active_club_id is valid, else reset to existing club
-- -------------------------------------------------------------------
do $$
declare
  v_cfg text;
  v_cfg_uuid uuid;
  v_exists boolean := false;
  v_default uuid;
begin
  select setting_value into v_cfg
  from public.app_secure_settings
  where setting_key = 'public_active_club_id'
  limit 1;

  begin
    v_cfg_uuid := nullif(trim(coalesce(v_cfg, '')), '')::uuid;
  exception when others then
    v_cfg_uuid := null;
  end;

  if v_cfg_uuid is not null then
    select exists (
      select 1 from public.club_members cm where cm.club_id = v_cfg_uuid
    ) into v_exists;
  end if;

  if not v_exists then
    select cm.club_id into v_default
    from public.club_members cm
    where cm.club_id is not null
    limit 1;

    if v_default is null then
      raise exception 'No club_id available in club_members';
    end if;

    insert into public.app_secure_settings(setting_key, setting_value)
    values ('public_active_club_id', v_default::text)
    on conflict (setting_key) do update
      set setting_value = excluded.setting_value,
          updated_at = now();
  end if;
end $$;

-- -------------------------------------------------------------------
-- 1) Make public_active_club_id() resilient (fallback to first club)
-- -------------------------------------------------------------------
create or replace function public.public_active_club_id()
returns uuid
language plpgsql
security definer
stable
set search_path = public, pg_catalog
as $$
declare
  v_val text;
  v_uuid uuid;
begin
  select s.setting_value
    into v_val
  from public.app_secure_settings s
  where s.setting_key = 'public_active_club_id'
  limit 1;

  begin
    v_uuid := nullif(trim(coalesce(v_val, '')), '')::uuid;
  exception when others then
    v_uuid := null;
  end;

  if v_uuid is not null and exists (
    select 1 from public.club_members cm where cm.club_id = v_uuid
  ) then
    return v_uuid;
  end if;

  -- Fallback for single-club legacy mode.
  select cm.club_id into v_uuid
  from public.club_members cm
  where cm.club_id is not null
  limit 1;

  return v_uuid;
end;
$$;

-- -------------------------------------------------------------------
-- 2) Backfill missing profiles.club_id to keep existing users working
-- -------------------------------------------------------------------
-- First try precise mapping via member_no.
update public.profiles p
   set club_id = cm.club_id
  from public.club_members cm
 where p.club_id is null
   and p.member_no is not null
   and cm.member_no = p.member_no
   and cm.club_id is not null;

-- Fallback for remaining profiles in current single-club operation.
update public.profiles p
   set club_id = public.public_active_club_id()
 where p.club_id is null
   and exists (
     select 1 from public.user_roles ur where ur.user_id = p.id
   );

-- -------------------------------------------------------------------
-- 3) Keep helper functions deterministic in legacy+tenant mode
-- -------------------------------------------------------------------
create or replace function public.current_user_club_id()
returns uuid
language sql
stable
as $$
  select coalesce(
    (select p.club_id from public.profiles p where p.id = auth.uid() limit 1),
    (select public.public_active_club_id() where auth.uid() is not null)
  )
$$;

create or replace function public.is_same_club(p_club_id uuid)
returns boolean
language sql
stable
as $$
  select p_club_id is not null and p_club_id = public.current_user_club_id()
$$;

commit;

-- Verification:
-- select public.public_active_club_id();
-- select count(*) as profiles_without_club from public.profiles where club_id is null;
