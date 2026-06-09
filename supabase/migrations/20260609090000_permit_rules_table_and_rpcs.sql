-- =============================================================
-- permit_rules: Tabelle + Admin-RPCs + Member-RPC
-- =============================================================
-- Schließt die fehlende DB-Schicht für club_settings_rules (ADM)
-- und das Regelwerk-Panel im Mitgliedsausweis.
--
-- Neue Tabelle:
--   permit_rules (rule_id, club_id, card_type_id TEXT,
--                 rule_text, sort_order, water_body_id, created_at)
--
-- Neue RPCs (Admin):
--   admin_permit_rules_for_club(p_club_id)         → ADM-Tabelle lesen
--   admin_permit_rule_upsert(...)                   → insert oder update
--   admin_permit_rule_delete(p_rule_id, p_club_id)  → Regel löschen
--   admin_permit_card_types_for_rules(p_club_id)    → Select-Options
--
-- Neuer RPC (Member):
--   get_my_permit_rules()   → Regelwerk für eingeloggtes Mitglied
-- =============================================================

begin;

-- ------------------------------------------------------------------
-- 1. Tabelle
-- ------------------------------------------------------------------

create table if not exists public.permit_rules (
  rule_id       uuid        primary key default gen_random_uuid(),
  club_id       uuid        not null,
  card_type_id  text        not null,
  rule_text     text        not null,
  sort_order    integer     not null default 0,
  water_body_id uuid        references public.water_bodies(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists permit_rules_club_id_idx
  on public.permit_rules (club_id);

create index if not exists permit_rules_club_card_idx
  on public.permit_rules (club_id, card_type_id);

-- ------------------------------------------------------------------
-- 2. admin_permit_rules_for_club(p_club_id uuid)
-- ------------------------------------------------------------------

drop function if exists public.admin_permit_rules_for_club(uuid);

create or replace function public.admin_permit_rules_for_club(
  p_club_id uuid
)
returns table (
  rule_id       uuid,
  card_type_id  text,
  card_title    text,
  water_body_id uuid,
  water_name    text,
  rule_text     text,
  sort_order    integer
)
language sql
security definer
stable
set search_path = public, pg_catalog
as $$
  with
  _guard as (
    select 1 where (
      current_user in ('postgres', 'service_role')
      or public.is_admin_in_any_club()
      or public.is_admin_or_vorstand_in_club(p_club_id)
    )
  ),
  tenant as (
    select tn.tenant_id
    from public.tenant_nodes tn
    where tn.legacy_club_id = p_club_id
    limit 1
  )
  select
    pr.rule_id,
    pr.card_type_id,
    coalesce(pct.title, pr.card_type_id) as card_title,
    pr.water_body_id,
    wb.name                              as water_name,
    pr.rule_text,
    pr.sort_order
  from _guard
  cross join public.permit_rules pr
  left join public.permit_card_types pct
    on  pct.card_type_key = pr.card_type_id
    and pct.tenant_id     = (select tenant_id from tenant)
  left join public.water_bodies wb on wb.id = pr.water_body_id
  where pr.club_id = p_club_id
  order by card_title, pr.sort_order;
$$;

revoke all on function public.admin_permit_rules_for_club(uuid) from public, anon;
grant execute on function public.admin_permit_rules_for_club(uuid) to authenticated;
grant execute on function public.admin_permit_rules_for_club(uuid) to service_role;

-- ------------------------------------------------------------------
-- 3. admin_permit_rule_upsert(...)
-- ------------------------------------------------------------------

drop function if exists public.admin_permit_rule_upsert(uuid, text, text, integer, uuid, uuid);

create or replace function public.admin_permit_rule_upsert(
  p_club_id       uuid,
  p_card_type_id  text,
  p_rule_text     text,
  p_sort_order    integer default 0,
  p_water_body_id uuid    default null,
  p_rule_id       uuid    default null
)
returns table (ok boolean, message text)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if not (
    current_user in ('postgres', 'service_role')
    or public.is_admin_in_any_club()
    or public.is_admin_or_vorstand_in_club(p_club_id)
  ) then
    return query select false, 'forbidden'::text;
    return;
  end if;

  if p_rule_id is not null then
    update public.permit_rules set
      card_type_id  = p_card_type_id,
      rule_text     = p_rule_text,
      sort_order    = p_sort_order,
      water_body_id = p_water_body_id
    where rule_id = p_rule_id and club_id = p_club_id;

    if not found then
      return query select false, 'Regel nicht gefunden.'::text;
      return;
    end if;
  else
    insert into public.permit_rules (club_id, card_type_id, rule_text, sort_order, water_body_id)
    values (p_club_id, p_card_type_id, p_rule_text, p_sort_order, p_water_body_id);
  end if;

  return query select true, 'OK'::text;
end;
$$;

revoke all on function public.admin_permit_rule_upsert(uuid, text, text, integer, uuid, uuid) from public, anon;
grant execute on function public.admin_permit_rule_upsert(uuid, text, text, integer, uuid, uuid) to authenticated;
grant execute on function public.admin_permit_rule_upsert(uuid, text, text, integer, uuid, uuid) to service_role;

-- ------------------------------------------------------------------
-- 4. admin_permit_rule_delete(p_rule_id uuid, p_club_id uuid)
-- ------------------------------------------------------------------

drop function if exists public.admin_permit_rule_delete(uuid, uuid);

create or replace function public.admin_permit_rule_delete(
  p_rule_id uuid,
  p_club_id uuid
)
returns table (ok boolean, message text)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if not (
    current_user in ('postgres', 'service_role')
    or public.is_admin_in_any_club()
    or public.is_admin_or_vorstand_in_club(p_club_id)
  ) then
    return query select false, 'forbidden'::text;
    return;
  end if;

  delete from public.permit_rules
  where rule_id = p_rule_id and club_id = p_club_id;

  if not found then
    return query select false, 'Regel nicht gefunden.'::text;
    return;
  end if;

  return query select true, 'OK'::text;
end;
$$;

revoke all on function public.admin_permit_rule_delete(uuid, uuid) from public, anon;
grant execute on function public.admin_permit_rule_delete(uuid, uuid) to authenticated;
grant execute on function public.admin_permit_rule_delete(uuid, uuid) to service_role;

-- ------------------------------------------------------------------
-- 5. admin_permit_card_types_for_rules(p_club_id uuid)
--    Select-Options für das card_type_id-Feld in club_settings_rules
-- ------------------------------------------------------------------

drop function if exists public.admin_permit_card_types_for_rules(uuid);

create or replace function public.admin_permit_card_types_for_rules(
  p_club_id uuid
)
returns table (card_type_id text, card_title text)
language sql
security definer
stable
set search_path = public, pg_catalog
as $$
  select
    pct.card_type_key as card_type_id,
    pct.title         as card_title
  from public.tenant_nodes tn
  join public.permit_card_types pct on pct.tenant_id = tn.tenant_id
  where tn.legacy_club_id = p_club_id
    and pct.is_active = true
    and (
      current_user in ('postgres', 'service_role')
      or public.is_admin_in_any_club()
      or public.is_admin_or_vorstand_in_club(p_club_id)
    )
  order by pct.title;
$$;

revoke all on function public.admin_permit_card_types_for_rules(uuid) from public, anon;
grant execute on function public.admin_permit_card_types_for_rules(uuid) to authenticated;
grant execute on function public.admin_permit_card_types_for_rules(uuid) to service_role;

-- ------------------------------------------------------------------
-- 6. get_my_permit_rules()
--    Regeln für das eingeloggte Mitglied, gefiltert nach Karten
-- ------------------------------------------------------------------

drop function if exists public.get_my_permit_rules();

create or replace function public.get_my_permit_rules()
returns table (
  rule_id       uuid,
  card_type_id  text,
  card_title    text,
  water_body_id uuid,
  water_name    text,
  rule_text     text,
  sort_order    integer
)
language sql
security definer
set search_path = public, pg_catalog
as $$
  with
  me as (
    select member_no, club_id
    from public.profiles
    where id = auth.uid()
  ),
  my_tenant as (
    select tn.tenant_id
    from public.tenant_nodes tn
    join me on tn.legacy_club_id = me.club_id
  ),
  my_card_keys as (
    select distinct mca.card_id
    from public.member_card_assignments mca
    join me on mca.member_no = me.member_no and mca.club_id = me.club_id
  )
  select
    pr.rule_id,
    pr.card_type_id,
    coalesce(pct.title, pr.card_type_id) as card_title,
    pr.water_body_id,
    wb.name                              as water_name,
    pr.rule_text,
    pr.sort_order
  from public.permit_rules pr
  join me on pr.club_id = me.club_id
  join my_card_keys mck on mck.card_id = pr.card_type_id
  left join my_tenant on true
  left join public.permit_card_types pct
    on  pct.card_type_key = pr.card_type_id
    and pct.tenant_id     = (select tenant_id from my_tenant)
  left join public.water_bodies wb on wb.id = pr.water_body_id
  order by card_title, pr.sort_order;
$$;

revoke all on function public.get_my_permit_rules() from public, anon;
grant execute on function public.get_my_permit_rules() to authenticated;
grant execute on function public.get_my_permit_rules() to service_role;

notify pgrst, 'reload schema';
commit;
