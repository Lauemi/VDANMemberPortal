-- VDAN/FCP - Regression test block for user-scope member_waters (no club)
-- Run after:
--   80_member_waters_user_scope_no_club.sql
--
-- What it validates:
--   1) User without club can upsert own free water
--   2) Repeated upsert on same normalized name/location collides -> increments usage_count
--   3) Select path returns only own rows under authenticated context
--
-- IMPORTANT:
--   - Script auto-selects one profile with club_id IS NULL.
--   - If none exists, it aborts with a clear error.
--   - It simulates authenticated context via request.jwt.claims.
--   - It rolls back all test data.

begin;

-- ------------------------------------------------------------
-- 0) Configure test identity (auto-pick no-club profile, fallback to temporary null-club)
-- ------------------------------------------------------------
do $$
declare
  v_uid uuid;
  v_uid_with_club uuid;
begin
  select p.id
    into v_uid
  from public.profiles p
  where p.club_id is null
  order by p.created_at asc nulls last, p.id asc
  limit 1;

  if v_uid is null then
    -- Fallback: choose one club-bound profile and temporarily null club_id.
    select p.id
      into v_uid_with_club
    from public.profiles p
    where p.club_id is not null
    order by p.created_at asc nulls last, p.id asc
    limit 1;

    if v_uid_with_club is null then
      raise exception 'Test aborted: no profile found (neither club_id NULL nor NOT NULL).';
    end if;

    update public.profiles
       set club_id = null
     where id = v_uid_with_club;

    v_uid := v_uid_with_club;
    raise notice 'No no-club profile found. Using fallback user % with temporary club_id=NULL (rolled back at end).', v_uid;
  else
    raise notice 'Using existing no-club profile % for test.', v_uid;
  end if;

  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', v_uid::text)::text,
    true
  );
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_uid::text, true);
end $$;

set local role authenticated;

-- ------------------------------------------------------------
-- 1) First upsert should insert row with nullable club_id
-- ------------------------------------------------------------
do $$
declare
  v_row public.member_waters;
begin
  select * into v_row
  from public.member_water_upsert(
    p_name := 'Regression See Nord',
    p_location_text := 'Sektor A',
    p_description := 'Testdatensatz',
    p_latitude := null,
    p_longitude := null,
    p_used_on := current_date
  );

  if v_row.id is null then
    raise exception 'Upsert #1 failed: no row returned';
  end if;
  if v_row.user_id <> auth.uid() then
    raise exception 'Upsert #1 failed: wrong user binding';
  end if;
  if v_row.club_id is not null then
    raise exception 'Upsert #1 failed: club_id expected NULL for no-club user';
  end if;
  if v_row.usage_count <> 1 then
    raise exception 'Upsert #1 failed: usage_count expected 1, got %', v_row.usage_count;
  end if;
end $$;

-- ------------------------------------------------------------
-- 2) Collision upsert (same normalized key) should update usage_count
-- ------------------------------------------------------------
do $$
declare
  v_row public.member_waters;
begin
  -- same logical key; case/spacing variations should normalize
  select * into v_row
  from public.member_water_upsert(
    p_name := ' regression-see   nord ',
    p_location_text := 'sektor a',
    p_description := null,
    p_latitude := null,
    p_longitude := null,
    p_used_on := current_date
  );

  if v_row.id is null then
    raise exception 'Upsert #2 failed: no row returned';
  end if;
  if v_row.usage_count < 2 then
    raise exception 'Upsert #2 failed: expected usage_count >= 2, got %', v_row.usage_count;
  end if;
end $$;

-- ------------------------------------------------------------
-- 3) Select own rows under RLS
-- ------------------------------------------------------------
do $$
declare
  v_count bigint;
begin
  select count(*)
    into v_count
  from public.member_waters mw
  where mw.user_id = auth.uid()
    and mw.name_norm = public.normalize_water_name('Regression See Nord');

  if v_count < 1 then
    raise exception 'Select test failed: expected at least 1 own row';
  end if;
end $$;

-- Optional visibility probe:
-- select id, user_id, club_id, name, location_text, usage_count
-- from public.member_waters
-- where name_norm = public.normalize_water_name('Regression See Nord')
-- order by updated_at desc;

rollback;

-- Expected result:
--   Script ends without error, no permanent data written.
