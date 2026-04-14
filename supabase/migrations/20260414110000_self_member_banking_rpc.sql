-- Migration: Self-Service Banking RPC
-- Zweck: Mitglieder koennen ihre eigenen Bankdaten lesen und aktualisieren.
-- Sicherheit: SECURITY DEFINER, auth.uid()-Pruefung, kein direkter Tabellenzugriff.
-- IBAN wird serverseitig normalisiert und als SHA-256-Hash + iban_last4 gespeichert.
-- Die volle IBAN wird nicht gespeichert und kann nicht abgerufen werden.

begin;

-- ============================================================
-- Schema-Erweiterung: bic und account_holder auf member_bank_data
-- ============================================================

alter table public.member_bank_data
  add column if not exists bic text,
  add column if not exists account_holder text;

-- ============================================================
-- READ: self_member_banking_get
-- Gibt iban_last4, sepa_approved, bic, account_holder des eingeloggten Mitglieds zurueck.
-- Gibt keine Zeile zurueck wenn kein Mitgliedseintrag vorhanden.
-- ============================================================

drop function if exists public.self_member_banking_get();
create or replace function public.self_member_banking_get()
returns table(
  iban_last4       text,
  sepa_approved    boolean,
  bic              text,
  account_holder   text
)
language plpgsql
security definer
stable
set search_path = public, auth, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'login_required';
  end if;

  return query
  select
    coalesce(mbd.iban_last4, '')::text   as iban_last4,
    coalesce(cm.sepa_approved, false)    as sepa_approved,
    coalesce(mbd.bic, '')::text          as bic,
    coalesce(mbd.account_holder, '')::text as account_holder
  from public.club_member_identities cmi
  join public.club_members cm
    on cm.member_no = cmi.member_no
   and cm.club_id   = cmi.club_id
  left join public.member_bank_data mbd
    on mbd.member_id = cm.id
  where cmi.user_id = v_uid
  order by cmi.created_at asc nulls last
  limit 1;
end;
$$;

grant execute on function public.self_member_banking_get() to authenticated;

-- ============================================================
-- WRITE: self_member_banking_update
-- Aktualisiert Bankdaten des eingeloggten Mitglieds.
-- p_iban: wenn leer, wird IBAN nicht veraendert.
-- p_bic, p_account_holder: werden immer ueberschrieben (auch mit leer).
-- sepa_approved bleibt unveraendert (nur Admin darf das setzen).
-- ============================================================

drop function if exists public.self_member_banking_update(text, text, text);
create or replace function public.self_member_banking_update(
  p_iban           text default null,
  p_bic            text default null,
  p_account_holder text default null
)
returns table(
  iban_last4       text,
  sepa_approved    boolean,
  bic              text,
  account_holder   text
)
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_uid        uuid := auth.uid();
  v_member_id  uuid;
  v_member_no  text;
  v_club_id    uuid;
  v_iban_norm  text;
  v_iban_last4 text;
  v_iban_hash  text;
begin
  if v_uid is null then
    raise exception 'login_required';
  end if;

  -- Mitglied ueber identity ermitteln
  select cm.id, cmi.member_no, cmi.club_id
    into v_member_id, v_member_no, v_club_id
  from public.club_member_identities cmi
  join public.club_members cm
    on cm.member_no = cmi.member_no
   and cm.club_id   = cmi.club_id
  where cmi.user_id = v_uid
  order by cmi.created_at asc nulls last
  limit 1;

  if v_member_id is null then
    raise exception 'no_member_record_found';
  end if;

  -- IBAN normalisieren wenn angegeben
  if nullif(trim(coalesce(p_iban, '')), '') is not null then
    v_iban_norm  := upper(regexp_replace(trim(p_iban), '\s+', '', 'g'));
    v_iban_last4 := right(v_iban_norm, 4);
    v_iban_hash  := encode(digest(v_iban_norm, 'sha256'), 'hex');

    insert into public.member_bank_data (
      member_id,
      iban_last4,
      iban_hash,
      bic,
      account_holder,
      updated_at
    ) values (
      v_member_id,
      v_iban_last4,
      v_iban_hash,
      nullif(trim(coalesce(p_bic, '')), ''),
      nullif(trim(coalesce(p_account_holder, '')), ''),
      now()
    )
    on conflict (member_id) do update
    set
      iban_last4     = excluded.iban_last4,
      iban_hash      = excluded.iban_hash,
      bic            = excluded.bic,
      account_holder = excluded.account_holder,
      updated_at     = now();
  else
    -- Nur bic / account_holder aktualisieren, IBAN bleibt
    insert into public.member_bank_data (
      member_id,
      iban_last4,
      iban_hash,
      bic,
      account_holder,
      updated_at
    ) values (
      v_member_id,
      '',
      '',
      nullif(trim(coalesce(p_bic, '')), ''),
      nullif(trim(coalesce(p_account_holder, '')), ''),
      now()
    )
    on conflict (member_id) do update
    set
      bic            = excluded.bic,
      account_holder = excluded.account_holder,
      updated_at     = now();
  end if;

  -- Aktuellen Stand zurueckgeben
  return query select * from public.self_member_banking_get();
end;
$$;

grant execute on function public.self_member_banking_update(text, text, text) to authenticated;

commit;
