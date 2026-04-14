begin;
do $$
begin
  if not exists (select 1 from pg_type where typname = 'event_planner_base_kind') then
    create type public.event_planner_base_kind as enum ('club_event', 'work_event');
  end if;
end $$;
do $$
begin
  if not exists (select 1 from pg_type where typname = 'event_planner_approval_mode') then
    create type public.event_planner_approval_mode as enum ('auto', 'manual');
  end if;
end $$;
do $$
begin
  if not exists (select 1 from pg_type where typname = 'event_planner_mode') then
    create type public.event_planner_mode as enum ('simple', 'structured');
  end if;
end $$;
do $$
begin
  if not exists (select 1 from pg_type where typname = 'event_planner_registration_status') then
    create type public.event_planner_registration_status as enum ('pending', 'approved', 'rejected', 'cancelled');
  end if;
end $$;
create table if not exists public.event_planner_configs (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null,
  base_kind public.event_planner_base_kind not null,
  base_club_event_id uuid unique references public.club_events(id) on delete cascade,
  base_work_event_id uuid unique references public.work_events(id) on delete cascade,
  approval_mode public.event_planner_approval_mode not null default 'manual',
  planning_mode public.event_planner_mode not null default 'simple',
  required_people integer check (required_people is null or required_people > 0),
  repeat_rule text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (base_kind = 'club_event' and base_club_event_id is not null and base_work_event_id is null)
    or
    (base_kind = 'work_event' and base_work_event_id is not null and base_club_event_id is null)
  )
);
create index if not exists idx_event_planner_configs_club_id
  on public.event_planner_configs(club_id);
create index if not exists idx_event_planner_configs_kind
  on public.event_planner_configs(base_kind, created_at desc);
drop trigger if exists trg_event_planner_configs_touch on public.event_planner_configs;
create trigger trg_event_planner_configs_touch
before update on public.event_planner_configs
for each row execute function public.touch_updated_at();
create table if not exists public.event_planner_slots (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null,
  planner_config_id uuid not null references public.event_planner_configs(id) on delete cascade,
  title text not null check (char_length(trim(title)) >= 2),
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  required_people integer not null check (required_people > 0),
  sort_order integer not null default 100,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists idx_event_planner_slots_planner
  on public.event_planner_slots(planner_config_id, starts_at);
create index if not exists idx_event_planner_slots_club
  on public.event_planner_slots(club_id, starts_at);
drop trigger if exists trg_event_planner_slots_touch on public.event_planner_slots;
create trigger trg_event_planner_slots_touch
before update on public.event_planner_slots
for each row execute function public.touch_updated_at();
create table if not exists public.event_planner_registrations (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null,
  planner_config_id uuid not null references public.event_planner_configs(id) on delete cascade,
  slot_id uuid references public.event_planner_slots(id) on delete cascade,
  auth_uid uuid not null references auth.users(id) on delete cascade,
  status public.event_planner_registration_status not null default 'pending',
  note_member text,
  note_admin text,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_event_planner_registrations_planner
  on public.event_planner_registrations(planner_config_id, status, created_at desc);
create index if not exists idx_event_planner_registrations_slot
  on public.event_planner_registrations(slot_id, status);
create index if not exists idx_event_planner_registrations_auth
  on public.event_planner_registrations(auth_uid, created_at desc);
create unique index if not exists uq_event_planner_registrations_simple
  on public.event_planner_registrations(planner_config_id, auth_uid)
  where slot_id is null;
create unique index if not exists uq_event_planner_registrations_slot
  on public.event_planner_registrations(slot_id, auth_uid)
  where slot_id is not null;
drop trigger if exists trg_event_planner_registrations_touch on public.event_planner_registrations;
create trigger trg_event_planner_registrations_touch
before update on public.event_planner_registrations
for each row execute function public.touch_updated_at();
create or replace function public.event_planner_config_guard()
returns trigger
language plpgsql
set search_path = public, auth, pg_catalog
as $$
declare
  v_club_id uuid;
begin
  if new.base_kind = 'club_event' then
    if new.base_club_event_id is null or new.base_work_event_id is not null then
      raise exception 'Planner config must reference exactly one club_event';
    end if;

    select club_id into v_club_id
    from public.club_events
    where id = new.base_club_event_id;
  elsif new.base_kind = 'work_event' then
    if new.base_work_event_id is null or new.base_club_event_id is not null then
      raise exception 'Planner config must reference exactly one work_event';
    end if;

    select club_id into v_club_id
    from public.work_events
    where id = new.base_work_event_id;
  else
    raise exception 'Unsupported base kind';
  end if;

  if v_club_id is null then
    raise exception 'Planner config base object not found';
  end if;

  new.club_id := v_club_id;
  return new;
end;
$$;
drop trigger if exists trg_event_planner_config_guard on public.event_planner_configs;
create trigger trg_event_planner_config_guard
before insert or update on public.event_planner_configs
for each row execute function public.event_planner_config_guard();
create or replace function public.event_planner_slot_guard()
returns trigger
language plpgsql
set search_path = public, auth, pg_catalog
as $$
declare
  v_config public.event_planner_configs;
  v_base_start timestamptz;
  v_base_end timestamptz;
begin
  select * into v_config
  from public.event_planner_configs
  where id = new.planner_config_id;

  if v_config.id is null then
    raise exception 'Planner config not found';
  end if;

  new.club_id := v_config.club_id;

  if v_config.base_kind = 'club_event' then
    select starts_at, ends_at into v_base_start, v_base_end
    from public.club_events
    where id = v_config.base_club_event_id;
  else
    select starts_at, ends_at into v_base_start, v_base_end
    from public.work_events
    where id = v_config.base_work_event_id;
  end if;

  if v_base_start is null or v_base_end is null then
    raise exception 'Planner slot base object not found';
  end if;

  if new.starts_at < v_base_start or new.ends_at > v_base_end then
    raise exception 'Slot must stay within the time range of its base object';
  end if;

  return new;
end;
$$;
drop trigger if exists trg_event_planner_slot_guard on public.event_planner_slots;
create trigger trg_event_planner_slot_guard
before insert or update on public.event_planner_slots
for each row execute function public.event_planner_slot_guard();
create or replace function public.event_planner_registration_guard()
returns trigger
language plpgsql
set search_path = public, auth, pg_catalog
as $$
declare
  v_config public.event_planner_configs;
  v_slot public.event_planner_slots;
begin
  select * into v_config
  from public.event_planner_configs
  where id = new.planner_config_id;

  if v_config.id is null then
    raise exception 'Planner config not found';
  end if;

  new.club_id := v_config.club_id;

  if v_config.planning_mode = 'structured' and new.slot_id is null then
    raise exception 'Structured planner registrations require a slot';
  end if;

  if v_config.planning_mode = 'simple' and new.slot_id is not null then
    raise exception 'Simple planner registrations may not reference a slot';
  end if;

  if new.slot_id is not null then
    select * into v_slot
    from public.event_planner_slots
    where id = new.slot_id;

    if v_slot.id is null then
      raise exception 'Planner slot not found';
    end if;

    if v_slot.planner_config_id <> new.planner_config_id then
      raise exception 'Planner slot must belong to the same planner config';
    end if;
  end if;

  if new.status = 'approved' and new.approved_at is null then
    new.approved_at := now();
  end if;

  if new.status <> 'approved' then
    new.approved_by := null;
    if new.status <> 'pending' then
      new.approved_at := null;
    end if;
  end if;

  return new;
end;
$$;
drop trigger if exists trg_event_planner_registration_guard on public.event_planner_registrations;
create trigger trg_event_planner_registration_guard
before insert or update on public.event_planner_registrations
for each row execute function public.event_planner_registration_guard();
create or replace function public.event_planner_config_is_published(p_config_id uuid)
returns boolean
language sql
stable
set search_path = public, auth, pg_catalog
as $$
  select case c.base_kind
    when 'club_event' then exists (
      select 1
      from public.club_events ce
      where ce.id = c.base_club_event_id
        and ce.status = 'published'
    )
    when 'work_event' then exists (
      select 1
      from public.work_events we
      where we.id = c.base_work_event_id
        and we.status = 'published'
    )
    else false
  end
  from public.event_planner_configs c
  where c.id = p_config_id
$$;
alter table public.event_planner_configs enable row level security;
alter table public.event_planner_slots enable row level security;
alter table public.event_planner_registrations enable row level security;
grant select on public.event_planner_configs to authenticated;
grant select on public.event_planner_slots to authenticated;
grant select on public.event_planner_registrations to authenticated;
grant insert, update, delete on public.event_planner_configs to authenticated;
grant insert, update, delete on public.event_planner_slots to authenticated;
grant insert, update, delete on public.event_planner_registrations to authenticated;
drop policy if exists "event_planner_configs_select_same_club_or_manager" on public.event_planner_configs;
create policy "event_planner_configs_select_same_club_or_manager"
on public.event_planner_configs
for select
to authenticated
using (
  (
    public.can_access_club_content(club_id)
    and public.event_planner_config_is_published(id)
  )
  or public.is_admin_or_vorstand_in_club(club_id)
);
drop policy if exists "event_planner_configs_manager_all" on public.event_planner_configs;
create policy "event_planner_configs_manager_all"
on public.event_planner_configs
for all
to authenticated
using (public.is_admin_or_vorstand_in_club(club_id))
with check (public.is_admin_or_vorstand_in_club(club_id));
drop policy if exists "event_planner_slots_select_same_club_or_manager" on public.event_planner_slots;
create policy "event_planner_slots_select_same_club_or_manager"
on public.event_planner_slots
for select
to authenticated
using (
  exists (
    select 1
    from public.event_planner_configs c
    where c.id = planner_config_id
      and (
        (
          public.can_access_club_content(c.club_id)
          and public.event_planner_config_is_published(c.id)
        )
        or public.is_admin_or_vorstand_in_club(c.club_id)
      )
  )
);
drop policy if exists "event_planner_slots_manager_all" on public.event_planner_slots;
create policy "event_planner_slots_manager_all"
on public.event_planner_slots
for all
to authenticated
using (public.is_admin_or_vorstand_in_club(club_id))
with check (public.is_admin_or_vorstand_in_club(club_id));
drop policy if exists "event_planner_registrations_select_own_or_manager" on public.event_planner_registrations;
create policy "event_planner_registrations_select_own_or_manager"
on public.event_planner_registrations
for select
to authenticated
using (
  auth_uid = auth.uid()
  or public.is_admin_or_vorstand_in_club(club_id)
);
drop policy if exists "event_planner_registrations_manager_all" on public.event_planner_registrations;
create policy "event_planner_registrations_manager_all"
on public.event_planner_registrations
for all
to authenticated
using (public.is_admin_or_vorstand_in_club(club_id))
with check (public.is_admin_or_vorstand_in_club(club_id));
create or replace function public.event_planner_upsert_for_base(
  p_base_kind public.event_planner_base_kind,
  p_base_id uuid,
  p_approval_mode public.event_planner_approval_mode default 'manual',
  p_planning_mode public.event_planner_mode default 'simple',
  p_required_people integer default null,
  p_repeat_rule text default null
)
returns public.event_planner_configs
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_club_id uuid;
  v_row public.event_planner_configs;
begin
  if p_base_kind = 'club_event' then
    select club_id into v_club_id
    from public.club_events
    where id = p_base_id;
  else
    select club_id into v_club_id
    from public.work_events
    where id = p_base_id;
  end if;

  if v_club_id is null then
    raise exception 'Base object not found';
  end if;

  if not public.is_admin_or_vorstand_in_club(v_club_id) then
    raise exception 'Only vorstand/admin can configure planner settings for this club';
  end if;

  if p_base_kind = 'club_event' then
    insert into public.event_planner_configs (
      club_id,
      base_kind,
      base_club_event_id,
      approval_mode,
      planning_mode,
      required_people,
      repeat_rule,
      created_by
    )
    values (
      v_club_id,
      p_base_kind,
      p_base_id,
      p_approval_mode,
      p_planning_mode,
      p_required_people,
      nullif(trim(coalesce(p_repeat_rule, '')), ''),
      auth.uid()
    )
    on conflict (base_club_event_id) do update
      set approval_mode = excluded.approval_mode,
          planning_mode = excluded.planning_mode,
          required_people = excluded.required_people,
          repeat_rule = excluded.repeat_rule,
          updated_at = now()
    returning * into v_row;
  else
    insert into public.event_planner_configs (
      club_id,
      base_kind,
      base_work_event_id,
      approval_mode,
      planning_mode,
      required_people,
      repeat_rule,
      created_by
    )
    values (
      v_club_id,
      p_base_kind,
      p_base_id,
      p_approval_mode,
      p_planning_mode,
      p_required_people,
      nullif(trim(coalesce(p_repeat_rule, '')), ''),
      auth.uid()
    )
    on conflict (base_work_event_id) do update
      set approval_mode = excluded.approval_mode,
          planning_mode = excluded.planning_mode,
          required_people = excluded.required_people,
          repeat_rule = excluded.repeat_rule,
          updated_at = now()
    returning * into v_row;
  end if;

  return v_row;
end;
$$;
create or replace function public.event_planner_slot_upsert(
  p_planner_config_id uuid,
  p_slot_id uuid default null,
  p_title text default null,
  p_description text default null,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_required_people integer default null,
  p_sort_order integer default 100
)
returns public.event_planner_slots
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_config public.event_planner_configs;
  v_row public.event_planner_slots;
begin
  select * into v_config
  from public.event_planner_configs
  where id = p_planner_config_id;

  if v_config.id is null then
    raise exception 'Planner config not found';
  end if;

  if not public.is_admin_or_vorstand_in_club(v_config.club_id) then
    raise exception 'Only vorstand/admin can manage planner slots for this club';
  end if;

  update public.event_planner_configs
  set planning_mode = 'structured',
      updated_at = now()
  where id = v_config.id;

  if p_slot_id is null then
    insert into public.event_planner_slots (
      club_id,
      planner_config_id,
      title,
      description,
      starts_at,
      ends_at,
      required_people,
      sort_order,
      created_by
    )
    values (
      v_config.club_id,
      v_config.id,
      p_title,
      nullif(trim(coalesce(p_description, '')), ''),
      p_starts_at,
      p_ends_at,
      p_required_people,
      coalesce(p_sort_order, 100),
      auth.uid()
    )
    returning * into v_row;
  else
    update public.event_planner_slots
    set title = coalesce(nullif(trim(coalesce(p_title, '')), ''), title),
        description = case
          when p_description is null then description
          else nullif(trim(coalesce(p_description, '')), '')
        end,
        starts_at = coalesce(p_starts_at, starts_at),
        ends_at = coalesce(p_ends_at, ends_at),
        required_people = coalesce(p_required_people, required_people),
        sort_order = coalesce(p_sort_order, sort_order),
        updated_at = now()
    where id = p_slot_id
      and planner_config_id = v_config.id
    returning * into v_row;
  end if;

  if v_row.id is null then
    raise exception 'Planner slot could not be saved';
  end if;

  return v_row;
end;
$$;
create or replace function public.event_planner_slot_delete(p_slot_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_club_id uuid;
begin
  select s.club_id into v_club_id
  from public.event_planner_slots s
  where s.id = p_slot_id;

  if v_club_id is null then
    raise exception 'Planner slot not found';
  end if;

  if not public.is_admin_or_vorstand_in_club(v_club_id) then
    raise exception 'Only vorstand/admin can delete planner slots for this club';
  end if;

  delete from public.event_planner_slots
  where id = p_slot_id;
end;
$$;
create or replace function public.event_planner_register(
  p_planner_config_id uuid,
  p_slot_id uuid default null,
  p_note_member text default null
)
returns public.event_planner_registrations
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_config public.event_planner_configs;
  v_slot public.event_planner_slots;
  v_existing public.event_planner_registrations;
  v_row public.event_planner_registrations;
  v_capacity integer;
  v_taken integer;
  v_status public.event_planner_registration_status;
  v_base_status public.work_event_status;
begin
  select * into v_config
  from public.event_planner_configs
  where id = p_planner_config_id;

  if v_config.id is null then
    raise exception 'Planner config not found';
  end if;

  if public.current_user_club_id() is distinct from v_config.club_id and not public.is_admin_or_vorstand_in_club(v_config.club_id) then
    raise exception 'Planner config is not accessible in this club context';
  end if;

  if v_config.base_kind = 'club_event' then
    select status into v_base_status
    from public.club_events
    where id = v_config.base_club_event_id;
  else
    select status into v_base_status
    from public.work_events
    where id = v_config.base_work_event_id;
  end if;

  if v_base_status is null then
    raise exception 'Base event not found';
  end if;

  if v_base_status <> 'published' and not public.is_admin_or_vorstand_in_club(v_config.club_id) then
    raise exception 'Registration is only allowed for published base events';
  end if;

  if v_config.planning_mode = 'structured' then
    if p_slot_id is null then
      raise exception 'Structured planner registrations require a slot';
    end if;

    select * into v_slot
    from public.event_planner_slots
    where id = p_slot_id
      and planner_config_id = v_config.id;

    if v_slot.id is null then
      raise exception 'Planner slot not found';
    end if;

    v_capacity := v_slot.required_people;
    select count(*) into v_taken
    from public.event_planner_registrations r
    where r.slot_id = v_slot.id
      and r.status in ('pending', 'approved');

    select * into v_existing
    from public.event_planner_registrations r
    where r.slot_id = v_slot.id
      and r.auth_uid = auth.uid();
  else
    if p_slot_id is not null then
      raise exception 'Simple planner registrations may not reference a slot';
    end if;

    v_capacity := coalesce(
      v_config.required_people,
      (select we.max_participants from public.work_events we where we.id = v_config.base_work_event_id)
    );

    select count(*) into v_taken
    from public.event_planner_registrations r
    where r.planner_config_id = v_config.id
      and r.slot_id is null
      and r.status in ('pending', 'approved');

    select * into v_existing
    from public.event_planner_registrations r
    where r.planner_config_id = v_config.id
      and r.slot_id is null
      and r.auth_uid = auth.uid();
  end if;

  if v_existing.id is null and v_capacity is not null and v_taken >= v_capacity then
    raise exception 'No free helper slots available';
  end if;

  v_status := case
    when v_config.approval_mode = 'auto' then 'approved'::public.event_planner_registration_status
    else 'pending'::public.event_planner_registration_status
  end;

  if v_existing.id is null then
    insert into public.event_planner_registrations (
      club_id,
      planner_config_id,
      slot_id,
      auth_uid,
      status,
      note_member,
      approved_by,
      approved_at
    )
    values (
      v_config.club_id,
      v_config.id,
      p_slot_id,
      auth.uid(),
      v_status,
      nullif(trim(coalesce(p_note_member, '')), ''),
      case when v_status = 'approved' then auth.uid() else null end,
      case when v_status = 'approved' then now() else null end
    )
    returning * into v_row;
  else
    update public.event_planner_registrations
    set status = case
          when v_existing.status = 'approved' and v_status = 'pending' then v_existing.status
          else v_status
        end,
        note_member = coalesce(nullif(trim(coalesce(p_note_member, '')), ''), v_existing.note_member),
        approved_by = case
          when v_status = 'approved' then coalesce(v_existing.approved_by, auth.uid())
          else v_existing.approved_by
        end,
        approved_at = case
          when v_status = 'approved' then coalesce(v_existing.approved_at, now())
          else v_existing.approved_at
        end,
        updated_at = now()
    where id = v_existing.id
    returning * into v_row;
  end if;

  return v_row;
end;
$$;
create or replace function public.event_planner_unregister(p_registration_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_row public.event_planner_registrations;
begin
  select * into v_row
  from public.event_planner_registrations
  where id = p_registration_id;

  if v_row.id is null then
    raise exception 'Planner registration not found';
  end if;

  if v_row.auth_uid <> auth.uid() and not public.is_admin_or_vorstand_in_club(v_row.club_id) then
    raise exception 'Only the member or a manager may remove this registration';
  end if;

  delete from public.event_planner_registrations
  where id = p_registration_id;
end;
$$;
create or replace function public.event_planner_registration_approve(
  p_registration_id uuid,
  p_note_admin text default null
)
returns public.event_planner_registrations
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_row public.event_planner_registrations;
begin
  select * into v_row
  from public.event_planner_registrations
  where id = p_registration_id;

  if v_row.id is null then
    raise exception 'Planner registration not found';
  end if;

  if not public.is_admin_or_vorstand_in_club(v_row.club_id) then
    raise exception 'Only vorstand/admin can approve planner registrations';
  end if;

  update public.event_planner_registrations
  set status = 'approved',
      note_admin = coalesce(nullif(trim(coalesce(p_note_admin, '')), ''), note_admin),
      approved_by = auth.uid(),
      approved_at = now(),
      updated_at = now()
  where id = p_registration_id
  returning * into v_row;

  return v_row;
end;
$$;
create or replace function public.event_planner_registration_reject(
  p_registration_id uuid,
  p_note_admin text default null
)
returns public.event_planner_registrations
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_row public.event_planner_registrations;
begin
  select * into v_row
  from public.event_planner_registrations
  where id = p_registration_id;

  if v_row.id is null then
    raise exception 'Planner registration not found';
  end if;

  if not public.is_admin_or_vorstand_in_club(v_row.club_id) then
    raise exception 'Only vorstand/admin can reject planner registrations';
  end if;

  update public.event_planner_registrations
  set status = 'rejected',
      note_admin = coalesce(nullif(trim(coalesce(p_note_admin, '')), ''), note_admin),
      approved_by = null,
      approved_at = null,
      updated_at = now()
  where id = p_registration_id
  returning * into v_row;

  return v_row;
end;
$$;
grant execute on function public.event_planner_upsert_for_base(public.event_planner_base_kind, uuid, public.event_planner_approval_mode, public.event_planner_mode, integer, text) to authenticated;
grant execute on function public.event_planner_slot_upsert(uuid, uuid, text, text, timestamptz, timestamptz, integer, integer) to authenticated;
grant execute on function public.event_planner_slot_delete(uuid) to authenticated;
grant execute on function public.event_planner_register(uuid, uuid, text) to authenticated;
grant execute on function public.event_planner_unregister(uuid) to authenticated;
grant execute on function public.event_planner_registration_approve(uuid, text) to authenticated;
grant execute on function public.event_planner_registration_reject(uuid, text) to authenticated;
commit;
