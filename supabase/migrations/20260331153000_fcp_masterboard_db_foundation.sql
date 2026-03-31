begin;

create table if not exists public.system_superadmins (
  user_id uuid primary key,
  note text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid
);

create table if not exists public.system_board_nodes (
  node_id text primary key,
  title text not null,
  lane text not null,
  status text not null,
  launch_class text not null,
  risk_level text not null,
  progress_visible jsonb not null default '[]'::jsonb,
  progress_invisible jsonb not null default '[]'::jsonb,
  gaps jsonb not null default '[]'::jsonb,
  decisions_open jsonb not null default '[]'::jsonb,
  refs jsonb not null default '[]'::jsonb,
  last_verified_at date,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  check (node_id ~ '^[a-z0-9-]{2,80}$'),
  check (lane in ('marketing', 'flow', 'onboarding', 'config', 'operations', 'system', 'legal')),
  check (status in ('offen', 'teilweise', 'erfuellt')),
  check (launch_class in ('L0', 'L1', 'L2', 'L3')),
  check (risk_level in ('niedrig', 'mittel', 'hoch')),
  check (jsonb_typeof(progress_visible) = 'array'),
  check (jsonb_typeof(progress_invisible) = 'array'),
  check (jsonb_typeof(gaps) = 'array'),
  check (jsonb_typeof(decisions_open) = 'array'),
  check (jsonb_typeof(refs) = 'array')
);

create table if not exists public.system_process_controls (
  process_id text primary key,
  title text not null,
  status text not null,
  priority text not null,
  related_nodes jsonb not null default '[]'::jsonb,
  summary text not null default '',
  owner text not null default '',
  screens jsonb not null default '[]'::jsonb,
  smoke_checks jsonb not null default '[]'::jsonb,
  bugs jsonb not null default '[]'::jsonb,
  review_note text not null default '',
  last_reviewed_at date,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  check (process_id ~ '^[a-z0-9-]{2,80}$'),
  check (status in ('offen', 'teilweise', 'erfuellt')),
  check (priority in ('niedrig', 'normal', 'mittel', 'hoch', 'kritisch')),
  check (jsonb_typeof(related_nodes) = 'array'),
  check (jsonb_typeof(screens) = 'array'),
  check (jsonb_typeof(smoke_checks) = 'array'),
  check (jsonb_typeof(bugs) = 'array')
);

drop trigger if exists trg_system_board_nodes_updated_at on public.system_board_nodes;
create trigger trg_system_board_nodes_updated_at
before update on public.system_board_nodes
for each row execute function public.tg_set_updated_at();

drop trigger if exists trg_system_process_controls_updated_at on public.system_process_controls;
create trigger trg_system_process_controls_updated_at
before update on public.system_process_controls
for each row execute function public.tg_set_updated_at();

create or replace function public.fcp_is_superadmin()
returns boolean
language sql
security definer
stable
set search_path = public, auth, pg_catalog
as $$
  select
    current_user in ('postgres', 'service_role')
    or exists (
      select 1
      from public.system_superadmins s
      where s.user_id = auth.uid()
        and s.is_active
      limit 1
    )
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and lower(coalesce(ur.role, '')) = 'superadmin'
      limit 1
    )
    or exists (
      select 1
      from public.club_user_roles cur
      where cur.user_id = auth.uid()
        and lower(coalesce(cur.role_key, '')) = 'superadmin'
      limit 1
    );
$$;

grant execute on function public.fcp_is_superadmin() to authenticated;

alter table public.system_superadmins enable row level security;
alter table public.system_board_nodes enable row level security;
alter table public.system_process_controls enable row level security;

drop policy if exists "system_superadmins_select_superadmin" on public.system_superadmins;
create policy "system_superadmins_select_superadmin"
on public.system_superadmins
for select
to authenticated
using (public.fcp_is_superadmin());

drop policy if exists "system_board_nodes_select_superadmin" on public.system_board_nodes;
create policy "system_board_nodes_select_superadmin"
on public.system_board_nodes
for select
to authenticated
using (public.fcp_is_superadmin());

drop policy if exists "system_board_nodes_insert_superadmin" on public.system_board_nodes;
create policy "system_board_nodes_insert_superadmin"
on public.system_board_nodes
for insert
to authenticated
with check (public.fcp_is_superadmin());

drop policy if exists "system_board_nodes_update_superadmin" on public.system_board_nodes;
create policy "system_board_nodes_update_superadmin"
on public.system_board_nodes
for update
to authenticated
using (public.fcp_is_superadmin())
with check (public.fcp_is_superadmin());

drop policy if exists "system_board_nodes_delete_superadmin" on public.system_board_nodes;
create policy "system_board_nodes_delete_superadmin"
on public.system_board_nodes
for delete
to authenticated
using (public.fcp_is_superadmin());

drop policy if exists "system_process_controls_select_superadmin" on public.system_process_controls;
create policy "system_process_controls_select_superadmin"
on public.system_process_controls
for select
to authenticated
using (public.fcp_is_superadmin());

drop policy if exists "system_process_controls_insert_superadmin" on public.system_process_controls;
create policy "system_process_controls_insert_superadmin"
on public.system_process_controls
for insert
to authenticated
with check (public.fcp_is_superadmin());

drop policy if exists "system_process_controls_update_superadmin" on public.system_process_controls;
create policy "system_process_controls_update_superadmin"
on public.system_process_controls
for update
to authenticated
using (public.fcp_is_superadmin())
with check (public.fcp_is_superadmin());

drop policy if exists "system_process_controls_delete_superadmin" on public.system_process_controls;
create policy "system_process_controls_delete_superadmin"
on public.system_process_controls
for delete
to authenticated
using (public.fcp_is_superadmin());

create or replace function public.fcp_masterboard_nodes_get()
returns setof public.system_board_nodes
language plpgsql
security definer
stable
set search_path = public, auth, pg_catalog
as $$
begin
  if not public.fcp_is_superadmin() then
    raise exception 'Only superadmin can read FCP masterboard state';
  end if;

  return query
  select *
  from public.system_board_nodes
  order by lane asc, title asc, node_id asc;
end;
$$;

grant execute on function public.fcp_masterboard_nodes_get() to authenticated;

create or replace function public.fcp_process_controls_get()
returns setof public.system_process_controls
language plpgsql
security definer
stable
set search_path = public, auth, pg_catalog
as $$
begin
  if not public.fcp_is_superadmin() then
    raise exception 'Only superadmin can read FCP process control state';
  end if;

  return query
  select *
  from public.system_process_controls
  order by
    case priority
      when 'kritisch' then 1
      when 'hoch' then 2
      when 'mittel' then 3
      when 'normal' then 4
      when 'niedrig' then 5
      else 99
    end,
    title asc,
    process_id asc;
end;
$$;

grant execute on function public.fcp_process_controls_get() to authenticated;

create or replace function public.fcp_masterboard_node_upsert(
  p_node_id text,
  p_title text,
  p_lane text,
  p_status text,
  p_launch_class text,
  p_risk_level text,
  p_progress_visible jsonb default '[]'::jsonb,
  p_progress_invisible jsonb default '[]'::jsonb,
  p_gaps jsonb default '[]'::jsonb,
  p_decisions_open jsonb default '[]'::jsonb,
  p_refs jsonb default '[]'::jsonb,
  p_last_verified_at date default null
)
returns public.system_board_nodes
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_row public.system_board_nodes;
begin
  if not public.fcp_is_superadmin() then
    raise exception 'Only superadmin can write FCP masterboard state';
  end if;

  insert into public.system_board_nodes (
    node_id,
    title,
    lane,
    status,
    launch_class,
    risk_level,
    progress_visible,
    progress_invisible,
    gaps,
    decisions_open,
    refs,
    last_verified_at,
    updated_by
  )
  values (
    lower(trim(p_node_id)),
    p_title,
    p_lane,
    p_status,
    p_launch_class,
    p_risk_level,
    coalesce(p_progress_visible, '[]'::jsonb),
    coalesce(p_progress_invisible, '[]'::jsonb),
    coalesce(p_gaps, '[]'::jsonb),
    coalesce(p_decisions_open, '[]'::jsonb),
    coalesce(p_refs, '[]'::jsonb),
    p_last_verified_at,
    auth.uid()
  )
  on conflict (node_id) do update
  set
    title = excluded.title,
    lane = excluded.lane,
    status = excluded.status,
    launch_class = excluded.launch_class,
    risk_level = excluded.risk_level,
    progress_visible = excluded.progress_visible,
    progress_invisible = excluded.progress_invisible,
    gaps = excluded.gaps,
    decisions_open = excluded.decisions_open,
    refs = excluded.refs,
    last_verified_at = excluded.last_verified_at,
    updated_by = auth.uid()
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.fcp_masterboard_node_upsert(
  text, text, text, text, text, text, jsonb, jsonb, jsonb, jsonb, jsonb, date
) to authenticated;

create or replace function public.fcp_process_control_upsert(
  p_process_id text,
  p_title text,
  p_status text,
  p_priority text,
  p_related_nodes jsonb default '[]'::jsonb,
  p_summary text default '',
  p_owner text default '',
  p_screens jsonb default '[]'::jsonb,
  p_smoke_checks jsonb default '[]'::jsonb,
  p_bugs jsonb default '[]'::jsonb,
  p_review_note text default '',
  p_last_reviewed_at date default null
)
returns public.system_process_controls
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_row public.system_process_controls;
begin
  if not public.fcp_is_superadmin() then
    raise exception 'Only superadmin can write FCP process control state';
  end if;

  insert into public.system_process_controls (
    process_id,
    title,
    status,
    priority,
    related_nodes,
    summary,
    owner,
    screens,
    smoke_checks,
    bugs,
    review_note,
    last_reviewed_at,
    updated_by
  )
  values (
    lower(trim(p_process_id)),
    p_title,
    p_status,
    p_priority,
    coalesce(p_related_nodes, '[]'::jsonb),
    coalesce(p_summary, ''),
    coalesce(p_owner, ''),
    coalesce(p_screens, '[]'::jsonb),
    coalesce(p_smoke_checks, '[]'::jsonb),
    coalesce(p_bugs, '[]'::jsonb),
    coalesce(p_review_note, ''),
    p_last_reviewed_at,
    auth.uid()
  )
  on conflict (process_id) do update
  set
    title = excluded.title,
    status = excluded.status,
    priority = excluded.priority,
    related_nodes = excluded.related_nodes,
    summary = excluded.summary,
    owner = excluded.owner,
    screens = excluded.screens,
    smoke_checks = excluded.smoke_checks,
    bugs = excluded.bugs,
    review_note = excluded.review_note,
    last_reviewed_at = excluded.last_reviewed_at,
    updated_by = auth.uid()
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.fcp_process_control_upsert(
  text, text, text, text, jsonb, text, text, jsonb, jsonb, jsonb, text, date
) to authenticated;

create or replace function public.fcp_masterboard_seed(
  p_nodes jsonb default '[]'::jsonb,
  p_processes jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_nodes_count integer := 0;
  v_process_count integer := 0;
begin
  if not public.fcp_is_superadmin() then
    raise exception 'Only superadmin can seed FCP board state';
  end if;

  insert into public.system_board_nodes (
    node_id, title, lane, status, launch_class, risk_level,
    progress_visible, progress_invisible, gaps, decisions_open, refs,
    last_verified_at, updated_by
  )
  select
    lower(trim(item->>'id')),
    item->>'title',
    item->>'lane',
    item->>'status',
    item->>'launch_class',
    item->>'risk_level',
    coalesce(item->'progress_visible', '[]'::jsonb),
    coalesce(item->'progress_invisible', '[]'::jsonb),
    coalesce(item->'gaps', '[]'::jsonb),
    coalesce(item->'decisions_open', '[]'::jsonb),
    coalesce(item->'refs', '[]'::jsonb),
    nullif(item->>'last_verified_at', '')::date,
    auth.uid()
  from jsonb_array_elements(coalesce(p_nodes, '[]'::jsonb)) item
  on conflict (node_id) do update
  set
    title = excluded.title,
    lane = excluded.lane,
    status = excluded.status,
    launch_class = excluded.launch_class,
    risk_level = excluded.risk_level,
    progress_visible = excluded.progress_visible,
    progress_invisible = excluded.progress_invisible,
    gaps = excluded.gaps,
    decisions_open = excluded.decisions_open,
    refs = excluded.refs,
    last_verified_at = excluded.last_verified_at,
    updated_by = auth.uid();

  get diagnostics v_nodes_count = row_count;

  insert into public.system_process_controls (
    process_id, title, status, priority, related_nodes, summary, owner,
    screens, smoke_checks, bugs, review_note, last_reviewed_at, updated_by
  )
  select
    lower(trim(item->>'id')),
    item->>'title',
    item->>'status',
    item->>'priority',
    coalesce(item->'related_nodes', '[]'::jsonb),
    coalesce(item->>'summary', ''),
    coalesce(item->>'owner', ''),
    coalesce(item->'screens', '[]'::jsonb),
    coalesce(item->'smoke_checks', '[]'::jsonb),
    coalesce(item->'bugs', '[]'::jsonb),
    coalesce(item->>'review_note', ''),
    nullif(item->>'last_reviewed_at', '')::date,
    auth.uid()
  from jsonb_array_elements(coalesce(p_processes, '[]'::jsonb)) item
  on conflict (process_id) do update
  set
    title = excluded.title,
    status = excluded.status,
    priority = excluded.priority,
    related_nodes = excluded.related_nodes,
    summary = excluded.summary,
    owner = excluded.owner,
    screens = excluded.screens,
    smoke_checks = excluded.smoke_checks,
    bugs = excluded.bugs,
    review_note = excluded.review_note,
    last_reviewed_at = excluded.last_reviewed_at,
    updated_by = auth.uid();

  get diagnostics v_process_count = row_count;

  return jsonb_build_object(
    'nodes_upserted', v_nodes_count,
    'processes_upserted', v_process_count
  );
end;
$$;

grant execute on function public.fcp_masterboard_seed(jsonb, jsonb) to authenticated;

notify pgrst, 'reload schema';

commit;
