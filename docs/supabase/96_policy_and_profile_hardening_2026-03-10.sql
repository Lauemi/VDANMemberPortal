-- VDAN/FCP - Follow-up hardening after readiness audit
-- Date: 2026-03-10
-- Purpose:
--   A) Reduce policy_smells by replacing global manager helper usage
--      with club-scoped helper where possible.
--   B) Backfill profiles.club_id for role users with deterministic single-club mapping.

begin;

-- -------------------------------------------------------------------
-- A) Deterministic profile club backfill (only unambiguous users)
-- -------------------------------------------------------------------
with one_club_role as (
  select
    ur.user_id,
    min(ur.club_id::text)::uuid as club_id
  from public.user_roles ur
  where ur.club_id is not null
  group by ur.user_id
  having count(distinct ur.club_id) = 1
)
update public.profiles p
set club_id = o.club_id,
    updated_at = now()
from one_club_role o
where p.id = o.user_id
  and p.club_id is null;

-- -------------------------------------------------------------------
-- B) Auto-harden policy expressions on club-scoped tables
-- -------------------------------------------------------------------
do $$
declare
  r record;
  v_roles text;
  v_new_qual text;
  v_new_with_check text;
  v_cmd text;
  v_create_sql text;
begin
  for r in
    select
      p.schemaname,
      p.tablename,
      p.policyname,
      p.permissive,
      p.cmd,
      p.roles,
      p.qual,
      p.with_check
    from pg_policies p
    where p.schemaname = 'public'
      and exists (
        select 1
        from information_schema.columns c
        where c.table_schema = p.schemaname
          and c.table_name = p.tablename
          and c.column_name = 'club_id'
      )
      and (
        coalesce(p.qual, '') ilike '%is_admin_or_vorstand()%'
        or coalesce(p.with_check, '') ilike '%is_admin_or_vorstand()%'
      )
      and coalesce(p.qual, '') not ilike '%is_admin_or_vorstand_in_club(%'
      and coalesce(p.with_check, '') not ilike '%is_admin_or_vorstand_in_club(%'
  loop
    v_new_qual := replace(
      replace(
        coalesce(r.qual, ''),
        'public.is_admin_or_vorstand()',
        'public.is_admin_or_vorstand_in_club(club_id)'
      ),
      'is_admin_or_vorstand()',
      'public.is_admin_or_vorstand_in_club(club_id)'
    );

    v_new_with_check := replace(
      replace(
        coalesce(r.with_check, ''),
        'public.is_admin_or_vorstand()',
        'public.is_admin_or_vorstand_in_club(club_id)'
      ),
      'is_admin_or_vorstand()',
      'public.is_admin_or_vorstand_in_club(club_id)'
    );

    select string_agg(quote_ident(x), ', ')
      into v_roles
    from unnest(r.roles) as x;
    if v_roles is null or trim(v_roles) = '' then
      v_roles := 'public';
    end if;

    execute format(
      'drop policy if exists %I on %I.%I',
      r.policyname, r.schemaname, r.tablename
    );

    v_cmd := case
      when upper(r.cmd) = 'ALL' then 'all'
      when upper(r.cmd) = 'SELECT' then 'select'
      when upper(r.cmd) = 'INSERT' then 'insert'
      when upper(r.cmd) = 'UPDATE' then 'update'
      when upper(r.cmd) = 'DELETE' then 'delete'
      else lower(r.cmd)
    end;

    v_create_sql := format(
      'create policy %I on %I.%I as %s for %s to %s',
      r.policyname,
      r.schemaname,
      r.tablename,
      lower(coalesce(r.permissive, 'permissive')),
      v_cmd,
      v_roles
    );

    if v_cmd in ('select', 'update', 'delete', 'all') and nullif(trim(v_new_qual), '') is not null then
      v_create_sql := v_create_sql || format(' using (%s)', v_new_qual);
    end if;

    if v_cmd in ('insert', 'update', 'all') and nullif(trim(v_new_with_check), '') is not null then
      v_create_sql := v_create_sql || format(' with check (%s)', v_new_with_check);
    end if;

    execute v_create_sql;
  end loop;
end
$$;

commit;

-- -------------------------------------------------------------------
-- Post-check snippets
-- -------------------------------------------------------------------
-- 1) Remaining users with roles but profiles.club_id is null:
-- select p.id
-- from public.profiles p
-- where p.club_id is null
--   and exists (select 1 from public.user_roles ur where ur.user_id = p.id);
--
-- 2) Remaining policy smells (club-scoped tables only):
-- select p.tablename, p.policyname
-- from pg_policies p
-- where p.schemaname = 'public'
--   and exists (
--     select 1
--     from information_schema.columns c
--     where c.table_schema = p.schemaname
--       and c.table_name = p.tablename
--       and c.column_name = 'club_id'
--   )
--   and (coalesce(p.qual, '') || ' ' || coalesce(p.with_check, '')) ilike '%is_admin_or_vorstand()%'
--   and (coalesce(p.qual, '') || ' ' || coalesce(p.with_check, '')) not ilike '%is_same_club(%'
--   and (coalesce(p.qual, '') || ' ' || coalesce(p.with_check, '')) not ilike '%is_admin_or_vorstand_in_club(%'
-- order by p.tablename, p.policyname;
