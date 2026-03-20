begin;

alter table public.event_planner_configs
  add column if not exists max_participants_enabled boolean not null default false;

alter table public.event_planner_slots
  add column if not exists leaders_count_towards_capacity boolean not null default false;

drop function if exists public.event_planner_upsert_for_base(
  public.event_planner_base_kind,
  uuid,
  public.event_planner_approval_mode,
  public.event_planner_mode,
  integer,
  text
);

create function public.event_planner_upsert_for_base(
  p_base_kind public.event_planner_base_kind,
  p_base_id uuid,
  p_approval_mode public.event_planner_approval_mode default 'manual',
  p_planning_mode public.event_planner_mode default 'simple',
  p_required_people integer default null,
  p_repeat_rule text default null,
  p_max_participants_enabled boolean default false
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
      max_participants_enabled,
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
      coalesce(p_max_participants_enabled, false),
      auth.uid()
    )
    on conflict (base_club_event_id) do update
      set approval_mode = excluded.approval_mode,
          planning_mode = excluded.planning_mode,
          required_people = excluded.required_people,
          repeat_rule = excluded.repeat_rule,
          max_participants_enabled = excluded.max_participants_enabled,
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
      max_participants_enabled,
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
      coalesce(p_max_participants_enabled, false),
      auth.uid()
    )
    on conflict (base_work_event_id) do update
      set approval_mode = excluded.approval_mode,
          planning_mode = excluded.planning_mode,
          required_people = excluded.required_people,
          repeat_rule = excluded.repeat_rule,
          max_participants_enabled = excluded.max_participants_enabled,
          updated_at = now()
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

drop function if exists public.event_planner_slot_upsert(
  uuid,
  uuid,
  text,
  text,
  timestamptz,
  timestamptz,
  integer,
  integer
);

create function public.event_planner_slot_upsert(
  p_planner_config_id uuid,
  p_slot_id uuid default null,
  p_title text default null,
  p_description text default null,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_required_people integer default null,
  p_sort_order integer default 100,
  p_leaders_count_towards_capacity boolean default false
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
      leaders_count_towards_capacity,
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
      coalesce(p_leaders_count_towards_capacity, false),
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
        leaders_count_towards_capacity = coalesce(p_leaders_count_towards_capacity, false),
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
      and r.status in ('pending', 'approved')
      and (
        v_slot.leaders_count_towards_capacity
        or not exists (
          select 1
          from public.club_user_roles cur
          where cur.club_id = v_config.club_id
            and cur.user_id = r.auth_uid
            and cur.role_key in ('admin', 'vorstand')
        )
      );

    select * into v_existing
    from public.event_planner_registrations r
    where r.slot_id = v_slot.id
      and r.auth_uid = auth.uid();
  else
    if p_slot_id is not null then
      raise exception 'Simple planner registrations may not reference a slot';
    end if;

    if coalesce(v_config.max_participants_enabled, false) then
      v_capacity := coalesce(
        v_config.required_people,
        (select we.max_participants from public.work_events we where we.id = v_config.base_work_event_id)
      );
    else
      v_capacity := null;
    end if;

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
    raise exception 'No more free capacity';
  end if;

  v_status := case
    when v_config.approval_mode = 'auto' then 'approved'
    else 'pending'
  end;

  if v_existing.id is not null then
    update public.event_planner_registrations
    set status = v_status,
        note_member = nullif(trim(coalesce(p_note_member, '')), ''),
        note_admin = null,
        approved_at = case when v_status = 'approved' then now() else null end,
        approved_by = case when v_status = 'approved' then auth.uid() else null end,
        updated_at = now()
    where id = v_existing.id
    returning * into v_row;
  else
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
  end if;

  return v_row;
end;
$$;

grant execute on function public.event_planner_upsert_for_base(
  public.event_planner_base_kind,
  uuid,
  public.event_planner_approval_mode,
  public.event_planner_mode,
  integer,
  text,
  boolean
) to authenticated;

grant execute on function public.event_planner_slot_upsert(
  uuid,
  uuid,
  text,
  text,
  timestamptz,
  timestamptz,
  integer,
  integer,
  boolean
) to authenticated;

commit;
