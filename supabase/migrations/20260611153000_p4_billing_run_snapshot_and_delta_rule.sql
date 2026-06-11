-- =============================================================
-- P4 Mitgliederabrechnung — Block 5: Snapshot-Lauf + Delta-Regel
-- =============================================================
-- Scope: P4 = Verein → Mitglied (Forderung/Rechnungsposition)
--   KEIN Bezug zu P6/Stripe/club_billing_subscriptions.
--
-- Problem:
--   Block 4 konnte Beitragsarten und Preisstufen berechnen, aber noch keine
--   saubere D3→D4-Logik abbilden. Für Pflichtstunden-Ablöse fehlte die
--   explizite Regel, dass eine Position nur bei positivem Delta berechnet wird.
--
-- Lösung:
--   1. club_billing_positions bekommt only_if_delta_debt (bool).
--   2. admin_get_billing_preview berücksichtigt Delta aus
--      admin_member_work_hours_overview().
--   3. admin_create_billing_run erzeugt einen unveränderlichen Snapshot in
--      billing_runs + billing_run_items.
--   4. Zwei Lese-RPCs liefern Läufe und Lauf-Items für ADM.
-- =============================================================

begin;

-- ------------------------------------------------------------------
-- 1. club_billing_positions — Delta-Regel explizit machen
-- ------------------------------------------------------------------

alter table public.club_billing_positions
  add column if not exists only_if_delta_debt boolean not null default false;

comment on column public.club_billing_positions.only_if_delta_debt is
  'P4: true = Position wird nur berechnet, wenn admin_member_work_hours_overview.delta_minutes > 0 ist. '
  'Gedacht für Pflichtstunden-Ablöse. Kein Bezug zu P6.';

-- ------------------------------------------------------------------
-- 2. CRUD-RPC an neues Feld anpassen
-- ------------------------------------------------------------------

drop function if exists public.admin_upsert_billing_position(
  uuid, uuid, text, text, text, numeric, numeric, numeric, boolean, integer
);
drop function if exists public.admin_get_billing_positions(uuid);
drop function if exists public.admin_get_billing_preview(uuid, integer);

create or replace function public.admin_get_billing_positions(
  p_club_id uuid
)
returns table (
  id                 uuid,
  name               text,
  period_from        text,
  period_to          text,
  amount_default     numeric,
  amount_youth       numeric,
  amount_honorary    numeric,
  only_if_delta_debt boolean,
  is_active          boolean,
  sort_order         integer,
  created_at         timestamptz,
  updated_at         timestamptz
)
language sql stable security definer
set search_path = public
as $$
  select
    id, name, period_from, period_to,
    amount_default, amount_youth, amount_honorary,
    only_if_delta_debt, is_active, sort_order, created_at, updated_at
  from public.club_billing_positions
  where club_id = p_club_id
  order by sort_order asc, name asc;
$$;

create or replace function public.admin_upsert_billing_position(
  p_club_id          uuid,
  id                 uuid    default null,
  name               text    default null,
  period_from        text    default null,
  period_to          text    default null,
  amount_default     numeric default null,
  amount_youth       numeric default null,
  amount_honorary    numeric default null,
  only_if_delta_debt boolean default false,
  is_active          boolean default true,
  sort_order         integer default 0
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin_or_vorstand_in_club(p_club_id) then
    raise exception 'Zugriff verweigert';
  end if;

  if name is null or trim(name) = '' then
    raise exception 'Name ist erforderlich';
  end if;
  if amount_default is null then
    raise exception 'Standardbetrag ist erforderlich';
  end if;
  if period_from is null or trim(period_from) = '' then
    raise exception 'Zeitraum-Von ist erforderlich';
  end if;
  if period_to is null or trim(period_to) = '' then
    raise exception 'Zeitraum-Bis ist erforderlich';
  end if;

  if admin_upsert_billing_position.id is null then
    insert into public.club_billing_positions (
      club_id,
      name,
      period_from,
      period_to,
      amount_default,
      amount_youth,
      amount_honorary,
      only_if_delta_debt,
      is_active,
      sort_order
    ) values (
      p_club_id,
      trim(admin_upsert_billing_position.name),
      trim(admin_upsert_billing_position.period_from),
      trim(admin_upsert_billing_position.period_to),
      admin_upsert_billing_position.amount_default,
      admin_upsert_billing_position.amount_youth,
      admin_upsert_billing_position.amount_honorary,
      coalesce(admin_upsert_billing_position.only_if_delta_debt, false),
      coalesce(admin_upsert_billing_position.is_active, true),
      coalesce(admin_upsert_billing_position.sort_order, 0)
    )
    returning to_jsonb(club_billing_positions.*) into v_result;
  else
    if not exists (
      select 1
      from public.club_billing_positions cbp
      where cbp.id = admin_upsert_billing_position.id
        and cbp.club_id = p_club_id
    ) then
      raise exception 'Eintrag nicht gefunden oder Zugriff verweigert';
    end if;

    update public.club_billing_positions
    set
      name               = trim(admin_upsert_billing_position.name),
      period_from        = trim(admin_upsert_billing_position.period_from),
      period_to          = trim(admin_upsert_billing_position.period_to),
      amount_default     = admin_upsert_billing_position.amount_default,
      amount_youth       = admin_upsert_billing_position.amount_youth,
      amount_honorary    = admin_upsert_billing_position.amount_honorary,
      only_if_delta_debt = coalesce(admin_upsert_billing_position.only_if_delta_debt, false),
      is_active          = coalesce(admin_upsert_billing_position.is_active, true),
      sort_order         = coalesce(admin_upsert_billing_position.sort_order, 0),
      updated_at         = now()
    where id = admin_upsert_billing_position.id
      and club_id = p_club_id
    returning to_jsonb(club_billing_positions.*) into v_result;
  end if;

  return coalesce(v_result, '{}'::jsonb);
end;
$$;

revoke all on function public.admin_upsert_billing_position(
  uuid, uuid, text, text, text, numeric, numeric, numeric, boolean, boolean, integer
) from public;
grant execute on function public.admin_upsert_billing_position(
  uuid, uuid, text, text, text, numeric, numeric, numeric, boolean, boolean, integer
) to authenticated;
grant execute on function public.admin_upsert_billing_position(
  uuid, uuid, text, text, text, numeric, numeric, numeric, boolean, boolean, integer
) to service_role;

comment on function public.admin_upsert_billing_position(
  uuid, uuid, text, text, text, numeric, numeric, numeric, boolean, boolean, integer
) is
  'P4: INSERT/UPDATE einer Beitragsart inkl. only_if_delta_debt. '
  'Damit wird Pflichtstunden-Ablöse explizit über Datenmodell statt Namens-Hack gesteuert.';

-- ------------------------------------------------------------------
-- 3. Preview-RPC um Delta-Regel erweitern
-- ------------------------------------------------------------------

create or replace function public.admin_get_billing_preview(
  p_club_id  uuid,
  p_run_year integer default extract(year from now())::integer
)
returns table (
  member_id        uuid,
  club_member_no   text,
  last_name        text,
  first_name       text,
  delta_minutes    integer,
  price_tier       text,
  total_amount     numeric,
  sepa_status      text,
  iban_last4       text,
  sepa_mandate_ref text,
  positions_json   jsonb
)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if not public.is_admin_or_vorstand_in_club(p_club_id) then
    raise exception 'Zugriff verweigert';
  end if;

  return query
  with
  active_pos as (
    select
      id,
      name,
      amount_default,
      amount_youth,
      amount_honorary,
      only_if_delta_debt
    from public.club_billing_positions
    where club_id = p_club_id
      and is_active = true
  ),
  exemptions as (
    select member_id, billing_position_id
    from public.member_billing_exemptions
    where club_id = p_club_id and is_exempt = true
  ),
  bank as (
    select
      mbd.member_id,
      mbd.iban_last4,
      mbd.sepa_mandate_ref
    from public.member_bank_data mbd
    where mbd.club_id = p_club_id
  ),
  work_delta as (
    select
      cm.id as member_id,
      who.delta_minutes
    from public.club_members cm
    left join public.admin_member_work_hours_overview(p_club_id, p_run_year) who
      on who.member_no = cm.member_no
    where cm.club_id = p_club_id
      and cm.status = 'active'
  ),
  member_pos as (
    select
      cm.id                   as member_id,
      cm.club_member_no,
      cm.last_name,
      cm.first_name,
      cm.sepa_approved,
      coalesce(wd.delta_minutes, 0) as delta_minutes,
      ap.id                   as position_id,
      ap.name                 as position_name,
      ap.only_if_delta_debt,
      case
        when e.member_id is not null
          then 'exempt'
        when cm.is_youth or lower(coalesce(cm.role, '')) like '%jugend%'
          then 'youth'
        when lower(coalesce(cm.role, '')) like '%ehren%'
          then 'honorary'
        else 'default'
      end as pos_tier,
      case
        when e.member_id is not null
          then 0::numeric
        when ap.only_if_delta_debt and coalesce(wd.delta_minutes, 0) <= 0
          then 0::numeric
        when cm.is_youth or lower(coalesce(cm.role, '')) like '%jugend%'
          then coalesce(ap.amount_youth, ap.amount_default)
        when lower(coalesce(cm.role, '')) like '%ehren%'
          then coalesce(ap.amount_honorary, ap.amount_default)
        else ap.amount_default
      end as pos_amount
    from public.club_members cm
    cross join active_pos ap
    left join exemptions e
      on e.member_id = cm.id and e.billing_position_id = ap.id
    left join work_delta wd
      on wd.member_id = cm.id
    where cm.club_id = p_club_id
      and cm.status = 'active'
  ),
  member_totals as (
    select
      mp.member_id,
      mp.club_member_no,
      mp.last_name,
      mp.first_name,
      mp.sepa_approved,
      max(mp.delta_minutes) as delta_minutes,
      case
        when count(*) filter (where mp.pos_amount > 0) = 0 then 'exempt'
        when bool_or(mp.pos_tier = 'youth' and mp.pos_amount > 0) then 'youth'
        when bool_or(mp.pos_tier = 'honorary' and mp.pos_amount > 0) then 'honorary'
        else 'default'
      end as price_tier,
      coalesce(sum(mp.pos_amount), 0)::numeric(10,2) as total_amount,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'label',            mp.position_name || ' (' || to_char(mp.pos_amount, 'FM999990.00') || ' €)',
            'name',             mp.position_name,
            'amount',           mp.pos_amount,
            'tier',             mp.pos_tier,
            'position_id',      mp.position_id,
            'delta_required',   mp.only_if_delta_debt,
            'delta_minutes',    mp.delta_minutes
          )
          order by mp.position_name
        ) filter (where mp.pos_amount > 0),
        '[]'::jsonb
      ) as positions_json
    from member_pos mp
    group by
      mp.member_id,
      mp.club_member_no,
      mp.last_name,
      mp.first_name,
      mp.sepa_approved
  )
  select
    mt.member_id,
    mt.club_member_no,
    mt.last_name,
    mt.first_name,
    mt.delta_minutes,
    mt.price_tier,
    mt.total_amount,
    case
      when mt.sepa_approved
           and b.sepa_mandate_ref is not null
           and b.iban_last4 is not null
        then 'vollständig'
      when mt.sepa_approved
           and b.member_id is not null
        then 'mandat_genehmigt'
      when mt.sepa_approved
        then 'genehmigt_keine_iban'
      when b.member_id is not null
        then 'bankdaten_kein_mandat'
      else 'kein_sepa'
    end as sepa_status,
    b.iban_last4,
    b.sepa_mandate_ref,
    mt.positions_json
  from member_totals mt
  left join bank b on b.member_id = mt.member_id
  order by mt.total_amount desc nulls last, mt.delta_minutes desc nulls last, mt.last_name, mt.first_name;
end;
$$;

comment on function public.admin_get_billing_preview(uuid, integer) is
  'P4: Live-Vorschau der Mitgliederabrechnung pro aktivem Mitglied. '
  'Berücksichtigt only_if_delta_debt via admin_member_work_hours_overview(). '
  'Kein billing_run — reine Berechnung auf lebender Konfiguration.';

-- ------------------------------------------------------------------
-- 4. billing_run Snapshot erzeugen
-- ------------------------------------------------------------------

create or replace function public.admin_create_billing_run(
  p_club_id  uuid,
  p_run_year integer default extract(year from now())::integer,
  p_run_label text default null
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_run_id uuid;
  v_run_label text;
  v_member_count integer := 0;
  v_total_amount numeric(10,2) := 0;
begin
  if not public.is_admin_or_vorstand_in_club(p_club_id) then
    raise exception 'Zugriff verweigert';
  end if;

  if p_run_year is null or p_run_year < 2020 then
    raise exception 'Abrechnungsjahr ist erforderlich';
  end if;

  if not exists (
    select 1
    from public.club_billing_positions
    where club_id = p_club_id
      and is_active = true
  ) then
    raise exception 'Keine aktiven Beitragsarten vorhanden';
  end if;

  v_run_label := coalesce(nullif(trim(p_run_label), ''), 'Jahresabrechnung ' || p_run_year::text);

  if exists (
    select 1
    from public.billing_runs br
    where br.club_id = p_club_id
      and br.run_year = p_run_year
      and br.run_label = v_run_label
  ) then
    raise exception 'Ein Lauf mit Jahr und Bezeichnung existiert bereits';
  end if;

  insert into public.billing_runs (
    club_id,
    run_year,
    run_label,
    status,
    total_amount,
    member_count,
    created_by
  ) values (
    p_club_id,
    p_run_year,
    v_run_label,
    'draft',
    0,
    0,
    auth.uid()
  )
  returning id into v_run_id;

  insert into public.billing_run_items (
    billing_run_id,
    club_id,
    member_id,
    member_name_snapshot,
    member_no_snapshot,
    iban_last4_snapshot,
    sepa_mandate_ref_snapshot,
    price_tier,
    positions_json,
    total_amount,
    sepa_included,
    item_status
  )
  select
    v_run_id,
    p_club_id,
    preview.member_id,
    trim(coalesce(preview.last_name, '') || ', ' || coalesce(preview.first_name, '')),
    preview.club_member_no,
    preview.iban_last4,
    preview.sepa_mandate_ref,
    preview.price_tier,
    preview.positions_json,
    preview.total_amount,
    preview.sepa_status = 'vollständig',
    'calculated'
  from public.admin_get_billing_preview(p_club_id, p_run_year) preview
  where preview.total_amount > 0;

  get diagnostics v_member_count = row_count;

  if v_member_count = 0 then
    raise exception 'Keine abrechenbaren Positionen vorhanden';
  end if;

  select coalesce(sum(bri.total_amount), 0)::numeric(10,2)
    into v_total_amount
  from public.billing_run_items bri
  where bri.billing_run_id = v_run_id;

  update public.billing_runs
  set total_amount = v_total_amount,
      member_count = v_member_count
  where id = v_run_id;

  return jsonb_build_object(
    'ok', true,
    'billing_run_id', v_run_id,
    'run_year', p_run_year,
    'run_label', v_run_label,
    'status', 'draft',
    'member_count', v_member_count,
    'total_amount', v_total_amount
  );
end;
$$;

revoke all on function public.admin_create_billing_run(uuid, integer, text) from public;
grant execute on function public.admin_create_billing_run(uuid, integer, text) to authenticated;
grant execute on function public.admin_create_billing_run(uuid, integer, text) to service_role;

comment on function public.admin_create_billing_run(uuid, integer, text) is
  'P4: Friert die aktuelle Mitgliederabrechnung als billing_run + billing_run_items ein. '
  'Nur total_amount > 0 wird in den Snapshot übernommen. D3→D4 wird damit revisionssicher.';

-- ------------------------------------------------------------------
-- 5. billing_runs lesen
-- ------------------------------------------------------------------

create or replace function public.admin_get_billing_runs(
  p_club_id uuid
)
returns table (
  id           uuid,
  run_year     integer,
  run_label    text,
  status       text,
  total_amount numeric,
  member_count integer,
  created_at   timestamptz,
  exported_at  timestamptz,
  submitted_at timestamptz,
  completed_at timestamptz
)
language sql stable security definer
set search_path = public
as $$
  select
    br.id,
    br.run_year,
    br.run_label,
    br.status,
    br.total_amount,
    br.member_count,
    br.created_at,
    br.exported_at,
    br.submitted_at,
    br.completed_at
  from public.billing_runs br
  where br.club_id = p_club_id
  order by br.created_at desc, br.run_year desc, br.run_label asc;
$$;

revoke all on function public.admin_get_billing_runs(uuid) from public;
grant execute on function public.admin_get_billing_runs(uuid) to authenticated;
grant execute on function public.admin_get_billing_runs(uuid) to service_role;

comment on function public.admin_get_billing_runs(uuid) is
  'P4: Liefert alle Abrechnungsläufe eines Vereins für ADM. '
  'Reine Snapshot-Liste, kein XML/kein Bankstatus.';

-- ------------------------------------------------------------------
-- 6. billing_run_items lesen
-- ------------------------------------------------------------------

create or replace function public.admin_get_billing_run_items(
  p_club_id uuid
)
returns table (
  id                        uuid,
  billing_run_id            uuid,
  run_year                  integer,
  run_label                 text,
  member_id                 uuid,
  member_no_snapshot        text,
  member_name_snapshot      text,
  price_tier                text,
  total_amount              numeric,
  sepa_included             boolean,
  item_status               text,
  iban_last4_snapshot       text,
  sepa_mandate_ref_snapshot text,
  positions_json            jsonb,
  created_at                timestamptz
)
language sql stable security definer
set search_path = public
as $$
  select
    bri.id,
    bri.billing_run_id,
    br.run_year,
    br.run_label,
    bri.member_id,
    bri.member_no_snapshot,
    bri.member_name_snapshot,
    bri.price_tier,
    bri.total_amount,
    bri.sepa_included,
    bri.item_status,
    bri.iban_last4_snapshot,
    bri.sepa_mandate_ref_snapshot,
    bri.positions_json,
    bri.created_at
  from public.billing_run_items bri
  join public.billing_runs br
    on br.id = bri.billing_run_id
  where bri.club_id = p_club_id
  order by br.created_at desc, bri.total_amount desc, bri.member_name_snapshot asc;
$$;

revoke all on function public.admin_get_billing_run_items(uuid) from public;
grant execute on function public.admin_get_billing_run_items(uuid) to authenticated;
grant execute on function public.admin_get_billing_run_items(uuid) to service_role;

comment on function public.admin_get_billing_run_items(uuid) is
  'P4: Liefert alle Snapshot-Positionen aller billing_runs eines Vereins für ADM. '
  'Revisionssichere Forderungs-/Rechnungspositionen pro Mitglied.';

commit;
