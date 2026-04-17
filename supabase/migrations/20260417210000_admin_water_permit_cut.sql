-- =============================================================
-- Gewässer ↔ Karten: Admin-Reader + Admin-Writer auf Permit-Wahrheit
-- =============================================================
-- Schließt den zweiten Hauptbruch im Admin-Gewässerpanel:
--   Bisher: water_cards aus Edge-Workspace-Blob (kein Bezug zu permit_water_links)
--   Jetzt:  card_keys aus permit_water_links, Schreiben direkt in permit_water_links
--
-- Reader: admin_water_bodies_with_cards(p_club_id)
--   → water_bodies + aggregierte card_keys aus permit_water_links
--
-- Writer: admin_water_permit_link_update(p_club_id, p_water_body_id, p_card_type_keys)
--   → ersetzt permit_water_links für einen Water-Body vollständig
--   → nur Card-Types, die für diesen Club/Tenant registriert sind, sind erlaubt
-- =============================================================

begin;

-- -------------------------------------------------------------
-- 1. Reader
-- -------------------------------------------------------------
drop function if exists public.admin_water_bodies_with_cards(uuid);

create or replace function public.admin_water_bodies_with_cards(
  p_club_id uuid
)
returns table (
  water_body_id uuid,
  name          text,
  area_kind     text,
  is_active     boolean,
  card_keys     jsonb
)
language sql
security definer
stable
set search_path = public, pg_catalog
as $$
  with
  _guard as (
    select 1
    where (
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
    wb.id                                                         as water_body_id,
    wb.name,
    wb.area_kind,
    wb.is_active,
    coalesce(
      (
        select jsonb_agg(pct.card_type_key order by pct.card_type_key)
        from public.permit_water_links pwl
        join public.permit_card_types pct
          on  pct.id        = pwl.card_type_id
          and pct.tenant_id = (select tenant_id from tenant)
        where pwl.legacy_water_body_id = wb.id
      ),
      '[]'::jsonb
    ) as card_keys
  from _guard
  cross join public.water_bodies wb
  where wb.club_id = p_club_id
  order by wb.name;
$$;

revoke all on function public.admin_water_bodies_with_cards(uuid) from public, anon;
grant execute on function public.admin_water_bodies_with_cards(uuid) to authenticated;
grant execute on function public.admin_water_bodies_with_cards(uuid) to service_role;

-- -------------------------------------------------------------
-- 2. Writer
-- -------------------------------------------------------------
-- Ersetzt permit_water_links für genau einen Water-Body vollständig.
-- Nur Card-Types, die für diesen Club/Tenant in permit_card_types registriert
-- sind, werden akzeptiert. Unbekannte Keys werden mit Fehler abgewiesen.
-- -------------------------------------------------------------
drop function if exists public.admin_water_permit_link_update(uuid, uuid, jsonb);

create or replace function public.admin_water_permit_link_update(
  p_club_id        uuid,
  p_water_body_id  uuid,
  p_card_type_keys jsonb default '[]'::jsonb
)
returns table (
  water_body_id uuid,
  name          text,
  area_kind     text,
  is_active     boolean,
  card_keys     jsonb
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_tenant_id    uuid;
  v_keys         text[];
  v_key          text;
  v_card_type_id uuid;
begin
  -- Guard
  if p_club_id is null then
    raise exception 'club_id_required';
  end if;
  if p_water_body_id is null then
    raise exception 'water_body_id_required';
  end if;
  if not (
    current_user in ('postgres', 'service_role')
    or public.is_admin_in_any_club()
    or public.is_admin_or_vorstand_in_club(p_club_id)
  ) then
    raise exception 'forbidden_club_scope';
  end if;

  -- Water-Body muss zum Club gehören
  if not exists (
    select 1 from public.water_bodies wb
    where wb.id = p_water_body_id and wb.club_id = p_club_id
  ) then
    raise exception 'water_body_not_found_in_club';
  end if;

  -- tenant_id des Clubs
  select tn.tenant_id into v_tenant_id
  from public.tenant_nodes tn
  where tn.legacy_club_id = p_club_id
  limit 1;

  if v_tenant_id is null then
    raise exception 'tenant_not_found_for_club';
  end if;

  -- Keys aus jsonb extrahieren
  if jsonb_typeof(coalesce(p_card_type_keys, '[]'::jsonb)) <> 'array' then
    raise exception 'card_type_keys_must_be_array';
  end if;

  select array_remove(
    array_agg(distinct lower(trim(value)) order by lower(trim(value))),
    null
  ) into v_keys
  from jsonb_array_elements_text(coalesce(p_card_type_keys, '[]'::jsonb)) as value
  where nullif(trim(value), '') is not null;

  -- Alle Keys müssen für diesen Tenant existieren
  if v_keys is not null then
    foreach v_key in array v_keys
    loop
      if not exists (
        select 1 from public.permit_card_types pct
        where pct.tenant_id    = v_tenant_id
          and pct.card_type_key = v_key
      ) then
        raise exception 'unknown_card_type_key: %', v_key;
      end if;
    end loop;
  end if;

  -- Bestehende Links für diesen Body entfernen (nur Tenant-eigene Card-Types)
  delete from public.permit_water_links pwl
  where pwl.legacy_water_body_id = p_water_body_id
    and pwl.card_type_id in (
      select pct.id from public.permit_card_types pct
      where pct.tenant_id = v_tenant_id
    );

  -- Neue Links einfügen
  if v_keys is not null then
    foreach v_key in array v_keys
    loop
      select pct.id into v_card_type_id
      from public.permit_card_types pct
      where pct.tenant_id    = v_tenant_id
        and pct.card_type_key = v_key;

      insert into public.permit_water_links (card_type_id, legacy_water_body_id)
      values (v_card_type_id, p_water_body_id)
      on conflict (card_type_id, legacy_water_body_id) do nothing;
    end loop;
  end if;

  -- Aktualisierte Zeile zurückgeben
  return query
  select * from public.admin_water_bodies_with_cards(p_club_id)
  where water_body_id = p_water_body_id;
end;
$$;

revoke all on function public.admin_water_permit_link_update(uuid, uuid, jsonb) from public, anon;
grant execute on function public.admin_water_permit_link_update(uuid, uuid, jsonb) to authenticated;
grant execute on function public.admin_water_permit_link_update(uuid, uuid, jsonb) to service_role;

notify pgrst, 'reload schema';
commit;
