-- =============================================================
-- Security Hardening: search_path + system_live_board RLS
-- =============================================================
-- Behebt Advisor-Warnungen:
--   • function_search_path_mutable (10 Funktionen)
--   • rls_policy_always_true (system_live_board)
--
-- KEINE fachliche Logik verändert.
-- KEINE Parameter, Queries oder Rückgabetypen geändert.
-- Nur SET search_path ergänzt + RLS-Policy korrigiert.
-- =============================================================

begin;

-- -------------------------------------------------------------
-- 1. internal.next_member_number
--    Kein SECURITY DEFINER, aber greift auf internal-Schema zu.
--    search_path: public, internal, pg_catalog
-- -------------------------------------------------------------
create or replace function internal.next_member_number(p_club_id uuid)
returns integer
language plpgsql
set search_path = public, internal, pg_catalog
as $$
declare
  v_next integer;
begin
  insert into internal.club_member_sequences (club_id, member_number_seq)
  values (
    p_club_id,
    coalesce(
      (select max(cm.member_number)
       from public.club_members cm
       where cm.club_id = p_club_id
         and cm.member_number is not null),
      0
    )
  )
  on conflict (club_id) do nothing;

  update internal.club_member_sequences
  set member_number_seq = member_number_seq + 1
  where club_id = p_club_id
  returning member_number_seq into v_next;

  if v_next is null then
    raise exception 'Club not found: %', p_club_id;
  end if;

  return v_next;
end;
$$;

-- -------------------------------------------------------------
-- 2. public.get_next_member_number
--    SECURITY DEFINER + greift auf internal-Schema zu.
--    search_path: public, internal, pg_catalog
-- -------------------------------------------------------------
create or replace function public.get_next_member_number(p_club_id uuid)
returns integer
language sql
stable
security definer
set search_path = public, internal, pg_catalog
as $$
  with seed as (
    insert into internal.club_member_sequences (club_id, member_number_seq)
    values (
      p_club_id,
      coalesce(
        (select max(cm.member_number)
         from public.club_members cm
         where cm.club_id = p_club_id
           and cm.member_number is not null),
        0
      )
    )
    on conflict (club_id) do nothing
    returning member_number_seq
  )
  select member_number_seq + 1
  from internal.club_member_sequences
  where club_id = p_club_id;
$$;

-- -------------------------------------------------------------
-- 3. public.create_member
--    SECURITY DEFINER + ruft internal.next_member_number auf.
--    search_path: public, internal, auth, pg_catalog
-- -------------------------------------------------------------
create or replace function public.create_member(
  p_club_id         uuid,
  p_first_name      text,
  p_last_name       text,
  p_email           text,
  p_status          text    default 'active',
  p_is_youth        boolean default false,
  p_membership_kind text    default 'standard',
  p_birthdate       date    default null,
  p_phone           text    default null,
  p_city            text    default null
)
returns public.club_members
language plpgsql
security definer
set search_path = public, internal, auth, pg_catalog
as $$
declare
  v_number  integer;
  v_result  public.club_members;
begin
  if not exists (
    select 1 from public.club_members
    where club_id = p_club_id
      and auth_user_id = auth.uid()
      and role in ('admin', 'vorstand')
  ) then
    raise exception 'Unauthorized';
  end if;

  select internal.next_member_number(p_club_id) into v_number;

  insert into public.club_members (
    club_id, member_number, source,
    first_name, last_name, email,
    status, is_youth, membership_kind,
    birthdate, phone, city,
    created_at, updated_at
  ) values (
    p_club_id, v_number, 'manual',
    p_first_name, p_last_name, p_email,
    p_status, p_is_youth, p_membership_kind,
    p_birthdate, p_phone, p_city,
    now(), now()
  )
  returning * into v_result;

  return v_result;
end;
$$;

-- -------------------------------------------------------------
-- 4. public.validate_csv_rows
--    SECURITY DEFINER, kein internal-Zugriff.
--    search_path: public, auth, pg_catalog
-- -------------------------------------------------------------
create or replace function public.validate_csv_rows(
  p_club_id uuid,
  p_rows    jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_row           jsonb;
  v_idx           integer := 0;
  v_results       jsonb := '[]'::jsonb;
  v_row_result    jsonb;
  v_errors        jsonb;
  v_member_number integer;
  v_seen_numbers  integer[] := '{}';
  v_seen_emails   text[] := '{}';
begin
  if not exists (
    select 1 from public.club_members
    where club_id = p_club_id
      and auth_user_id = auth.uid()
      and role in ('admin', 'vorstand')
  ) then
    raise exception 'Unauthorized';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows) loop
    v_errors := '[]'::jsonb;

    if (v_row->>'first_name') is null or trim(v_row->>'first_name') = '' then
      v_errors := v_errors || '["first_name fehlt"]'::jsonb;
    end if;
    if (v_row->>'last_name') is null or trim(v_row->>'last_name') = '' then
      v_errors := v_errors || '["last_name fehlt"]'::jsonb;
    end if;
    if (v_row->>'email') is null or trim(v_row->>'email') = '' then
      v_errors := v_errors || '["email fehlt"]'::jsonb;
    end if;

    if (v_row->>'email') is not null and exists (
      select 1 from public.club_members
      where club_id = p_club_id
        and email = v_row->>'email'
    ) then
      v_errors := v_errors || '["email bereits vorhanden"]'::jsonb;
    end if;

    if (v_row->>'email') = any(v_seen_emails) then
      v_errors := v_errors || '["email doppelt im Import"]'::jsonb;
    end if;
    v_seen_emails := array_append(v_seen_emails, v_row->>'email');

    if (v_row->>'member_number') is not null then
      begin
        v_member_number := (v_row->>'member_number')::integer;
      exception when others then
        v_errors := v_errors || '["member_number ungültig (nicht numerisch)"]'::jsonb;
        v_member_number := null;
      end;

      if v_member_number is not null then
        if exists (
          select 1 from public.club_members
          where club_id = p_club_id
            and member_number = v_member_number
        ) then
          v_errors := v_errors || '["member_number bereits vergeben"]'::jsonb;
        end if;
        if v_member_number = any(v_seen_numbers) then
          v_errors := v_errors || '["member_number doppelt im Import"]'::jsonb;
        end if;
        v_seen_numbers := array_append(v_seen_numbers, v_member_number);
      end if;
    end if;

    v_row_result := jsonb_build_object(
      'row_index', v_idx,
      'status', case when jsonb_array_length(v_errors) = 0 then 'ok' else 'error' end,
      'errors', v_errors
    );
    v_results := v_results || jsonb_build_array(v_row_result);
    v_idx := v_idx + 1;
  end loop;

  return v_results;
end;
$$;

-- -------------------------------------------------------------
-- 5. public.accept_application
--    SECURITY DEFINER + ruft internal.next_member_number auf.
--    search_path: public, internal, auth, pg_catalog
-- -------------------------------------------------------------
create or replace function public.accept_application(
  p_application_id uuid
)
returns public.club_members
language plpgsql
security definer
set search_path = public, internal, auth, pg_catalog
as $$
declare
  v_app     public.applications;
  v_number  integer;
  v_member  public.club_members;
begin
  select * into v_app
  from public.applications
  where id = p_application_id
  for update;

  if v_app is null then
    raise exception 'Application not found: %', p_application_id;
  end if;

  if v_app.status != 'pending' then
    raise exception 'Application already processed: %', v_app.status;
  end if;

  if not exists (
    select 1 from public.club_members
    where club_id = v_app.club_id
      and auth_user_id = auth.uid()
      and role in ('admin', 'vorstand')
  ) then
    raise exception 'Unauthorized';
  end if;

  select internal.next_member_number(v_app.club_id) into v_number;

  insert into public.club_members (
    club_id, member_number, source,
    first_name, last_name, email,
    phone, birthdate, city,
    status,
    created_at, updated_at
  ) values (
    v_app.club_id, v_number, 'application',
    v_app.first_name, v_app.last_name, v_app.email,
    v_app.phone, v_app.birthdate, v_app.city,
    'active',
    now(), now()
  )
  returning * into v_member;

  update public.applications
  set status = 'accepted',
      converted_member_no = v_member.member_no,
      updated_at = now()
  where id = p_application_id;

  return v_member;
end;
$$;

-- -------------------------------------------------------------
-- 6. public.invite_member
--    SECURITY DEFINER, nutzt gen_random_bytes (pgcrypto).
--    search_path: public, extensions, auth, pg_catalog
--    (extensions für gen_random_bytes falls pgcrypto dort liegt)
-- -------------------------------------------------------------
create or replace function public.invite_member(
  p_member_no    text,
  p_expires_days integer default 14
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, auth, pg_catalog
as $$
declare
  v_token   text;
  v_member  public.club_members;
begin
  select * into v_member
  from public.club_members
  where member_no = p_member_no;

  if v_member is null then
    raise exception 'Member not found: %', p_member_no;
  end if;

  if not exists (
    select 1 from public.club_members
    where club_id = v_member.club_id
      and auth_user_id = auth.uid()
      and role in ('admin', 'vorstand')
  ) then
    raise exception 'Unauthorized';
  end if;

  if v_member.auth_user_id is not null then
    raise exception 'Member already claimed';
  end if;

  v_token := encode(gen_random_bytes(32), 'hex');

  update public.club_members
  set invite_token      = v_token,
      invite_sent_at    = now(),
      invite_expires_at = now() + (p_expires_days || ' days')::interval,
      invite_claimed_at = null,
      updated_at        = now()
  where member_no = p_member_no;

  return jsonb_build_object(
    'invite_token', v_token,
    'invite_expires_at', (now() + (p_expires_days || ' days')::interval)
  );
end;
$$;

-- -------------------------------------------------------------
-- 7. public.claim_invite
--    SECURITY DEFINER, kein internal/extensions-Zugriff.
--    search_path: public, pg_catalog
-- -------------------------------------------------------------
create or replace function public.claim_invite(
  p_token        text,
  p_auth_user_id uuid
)
returns public.club_members
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_member public.club_members;
begin
  select * into v_member
  from public.club_members
  where invite_token = p_token
  for update;

  if v_member is null then
    raise exception 'Invalid invite token';
  end if;

  if v_member.invite_claimed_at is not null then
    raise exception 'Invite already claimed';
  end if;

  if v_member.invite_expires_at is not null and v_member.invite_expires_at < now() then
    raise exception 'Invite expired';
  end if;

  if v_member.auth_user_id is not null then
    raise exception 'Member already has account';
  end if;

  update public.club_members
  set auth_user_id      = p_auth_user_id,
      invite_claimed_at = now(),
      updated_at        = now()
  where member_no = v_member.member_no
  returning * into v_member;

  return v_member;
end;
$$;

-- -------------------------------------------------------------
-- 8–10. IMMUTABLE-Funktionen (kein SECURITY DEFINER)
--       Advisor-Hygiene: search_path trotzdem fixieren.
--       search_path: public, pg_catalog
-- -------------------------------------------------------------
create or replace function public.member_card_assignment_ids_from_legacy(
  p_legacy text
)
returns text[]
language plpgsql
immutable
set search_path = public, pg_catalog
as $$
declare
  v_raw text := lower(coalesce(p_legacy, ''));
  v_ids text[] := array[]::text[];
begin
  if position('innenwasser' in v_raw) > 0 or position('innewasser' in v_raw) > 0 then
    v_ids := array_append(v_ids, 'innenwasser');
  end if;

  if position('rheinlos' in v_raw) > 0 or position('rhein' in v_raw) > 0 then
    v_ids := array_append(v_ids, 'rheinlos39');
  end if;

  return (
    select coalesce(array_agg(distinct entry order by entry), array[]::text[])
    from unnest(v_ids) as entry
  );
end;
$$;

create or replace function public.member_card_label_from_ids(
  p_card_ids text[]
)
returns text
language sql
immutable
set search_path = public, pg_catalog
as $$
  with normalized as (
    select array_remove(array_agg(distinct lower(trim(entry)) order by lower(trim(entry))), null) as ids
    from unnest(coalesce(p_card_ids, array[]::text[])) as entry
    where nullif(trim(entry), '') is not null
  )
  select case
    when ids @> array['innenwasser']::text[] and ids @> array['rheinlos39']::text[] then 'Innenwasser + Rheinlos'
    when ids @> array['innenwasser']::text[] then 'Innenwasser'
    when ids @> array['rheinlos39']::text[] then 'Rheinlos'
    else '-'
  end
  from normalized;
$$;

create or replace function public.member_card_assignment_labels_from_ids(
  p_card_ids text[]
)
returns jsonb
language sql
immutable
set search_path = public, pg_catalog
as $$
  with normalized as (
    select array_remove(array_agg(distinct lower(trim(entry)) order by lower(trim(entry))), null) as ids
    from unnest(coalesce(p_card_ids, array[]::text[])) as entry
    where nullif(trim(entry), '') is not null
  )
  select coalesce(
    jsonb_agg(
      case entry
        when 'innenwasser' then jsonb_build_object('id', entry, 'label', 'Innenwasser')
        when 'rheinlos39'  then jsonb_build_object('id', entry, 'label', 'Rheinlos')
        else jsonb_build_object('id', entry, 'label', initcap(entry))
      end
      order by case entry when 'innenwasser' then 1 when 'rheinlos39' then 2 else 99 end
    ),
    '[]'::jsonb
  )
  from normalized,
  lateral unnest(coalesce(ids, array[]::text[])) as entry;
$$;

-- -------------------------------------------------------------
-- 11. system_live_board RLS
--     Bisher: USING (true) → alle authenticated User haben vollen Zugriff
--     Fix:    USING (false) → authenticated geblockt; service_role bypassed RLS
-- -------------------------------------------------------------
drop policy if exists "live_board_service_role_only" on public.system_live_board;

create policy "live_board_service_role_only"
  on public.system_live_board
  for all
  using (false)
  with check (false);

notify pgrst, 'reload schema';
commit;
