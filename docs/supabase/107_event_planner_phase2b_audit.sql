-- 107 Event Planner Phase 2b Audit SQL
-- Run AFTER:
--   supabase/migrations/20260314101000_event_planner_phase2_extension.sql
--   supabase/migrations/20260314113000_event_planner_phase2_hardening.sql
--   supabase/migrations/20260314123000_member_notifications_phase2b1.sql
--
-- Purpose:
-- - Verify Phase 2 base objects, hardening and notification layer exist
-- - Verify RLS/policies for planner + notifications are active
-- - Verify write-path hardening for registrations/notifications
-- - Detect common data integrity gaps in planner configs, slots and registrations

-- A) Core objects exist
select
  to_regclass('public.event_planner_configs') as event_planner_configs,
  to_regclass('public.event_planner_slots') as event_planner_slots,
  to_regclass('public.event_planner_registrations') as event_planner_registrations,
  to_regclass('public.member_notifications') as member_notifications;

-- B) Table shape and constraints
select
  c.relname as table_name,
  a.attnum as ordinal_position,
  a.attname as column_name,
  format_type(a.atttypid, a.atttypmod) as data_type,
  a.attnotnull as not_null
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
join pg_attribute a on a.attrelid = c.oid
where n.nspname = 'public'
  and c.relname in (
    'event_planner_configs',
    'event_planner_slots',
    'event_planner_registrations',
    'member_notifications'
  )
  and a.attnum > 0
  and not a.attisdropped
order by c.relname, a.attnum;

select
  conrelid::regclass as table_name,
  conname,
  contype,
  pg_get_constraintdef(oid) as constraint_def
from pg_constraint
where conrelid in (
  'public.event_planner_configs'::regclass,
  'public.event_planner_slots'::regclass,
  'public.event_planner_registrations'::regclass,
  'public.member_notifications'::regclass
)
order by conrelid::regclass::text, conname;

-- C) RLS state
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'event_planner_configs',
    'event_planner_slots',
    'event_planner_registrations',
    'member_notifications'
  )
order by c.relname;

-- D) Policies
select
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'event_planner_configs',
    'event_planner_slots',
    'event_planner_registrations',
    'member_notifications'
  )
order by tablename, policyname;

-- E) Trigger inventory for Phase 2 / 2b
select
  c.relname as table_name,
  t.tgname as trigger_name,
  case
    when (t.tgtype & 2) = 2 then 'BEFORE'
    else 'AFTER'
  end as trigger_timing,
  array_remove(array[
    case when (t.tgtype & 4) = 4 then 'INSERT' end,
    case when (t.tgtype & 8) = 8 then 'DELETE' end,
    case when (t.tgtype & 16) = 16 then 'UPDATE' end,
    case when (t.tgtype & 32) = 32 then 'TRUNCATE' end
  ], null) as trigger_events,
  p.proname as function_name
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_proc p on p.oid = t.tgfoid
where n.nspname = 'public'
  and not t.tgisinternal
  and c.relname in (
    'event_planner_configs',
    'event_planner_slots',
    'event_planner_registrations',
    'member_notifications',
    'club_events',
    'work_events'
  )
order by c.relname, t.tgname;

-- F) Phase 2 / 2b functions exist
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as args,
  p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'event_planner_upsert_for_base',
    'event_planner_slot_upsert',
    'event_planner_slot_delete',
    'event_planner_register',
    'event_planner_unregister',
    'event_planner_registration_approve',
    'event_planner_registration_reject',
    'event_planner_block_invalid_base_window_changes',
    'create_member_notification',
    'member_notification_mark_read',
    'member_notification_mark_all_read',
    'event_planner_notify_registration_users',
    'event_planner_slot_notification_guard',
    'event_planner_base_event_notification_guard',
    'event_planner_registration_notification_guard'
  )
order by p.proname, args;

-- G) Table privileges hardening snapshot
with gr as (
  select
    table_schema,
    table_name,
    grantee,
    privilege_type
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name in (
      'event_planner_configs',
      'event_planner_slots',
      'event_planner_registrations',
      'member_notifications'
    )
    and grantee in ('authenticated', 'anon')
)
select
  table_name,
  grantee,
  array_agg(privilege_type order by privilege_type) as privileges
from gr
group by table_name, grantee
order by table_name, grantee;

-- H) Function execute privileges hardening snapshot
select
  routine_name,
  grantee,
  privilege_type
from information_schema.routine_privileges
where specific_schema = 'public'
  and routine_name in (
    'create_member_notification',
    'member_notification_mark_read',
    'member_notification_mark_all_read',
    'event_planner_notify_registration_users',
    'event_planner_slot_notification_guard',
    'event_planner_base_event_notification_guard',
    'event_planner_registration_notification_guard',
    'event_planner_registration_approve',
    'event_planner_registration_reject',
    'event_planner_register',
    'event_planner_unregister'
  )
  and grantee in ('authenticated', 'anon', 'public')
order by routine_name, grantee, privilege_type;

-- I) Hardening assertions as status rows
with checks as (
  select
    'registrations_authenticated_no_direct_write'::text as check_name,
    case
      when exists (
        select 1
        from information_schema.role_table_grants
        where table_schema = 'public'
          and table_name = 'event_planner_registrations'
          and grantee = 'authenticated'
          and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
      ) then 'FAIL'
      else 'OK'
    end as status
  union all
  select
    'notifications_authenticated_no_direct_write',
    case
      when exists (
        select 1
        from information_schema.role_table_grants
        where table_schema = 'public'
          and table_name = 'member_notifications'
          and grantee = 'authenticated'
          and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
      ) then 'FAIL'
      else 'OK'
    end
  union all
  select
    'member_notifications_select_own_policy_exists',
    case
      when exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'member_notifications'
          and policyname = 'member_notifications_select_own'
      ) then 'OK'
      else 'FAIL'
    end
  union all
  select
    'event_planner_registrations_manager_all_policy_removed',
    case
      when exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'event_planner_registrations'
          and policyname = 'event_planner_registrations_manager_all'
      ) then 'FAIL'
      else 'OK'
    end
  union all
  select
    'notification_write_functions_not_exposed_to_authenticated',
    case
      when exists (
        select 1
        from information_schema.routine_privileges
        where specific_schema = 'public'
          and grantee = 'authenticated'
          and routine_name in (
            'create_member_notification',
            'event_planner_notify_registration_users',
            'event_planner_slot_notification_guard',
            'event_planner_base_event_notification_guard',
            'event_planner_registration_notification_guard'
          )
      ) then 'FAIL'
      else 'OK'
    end
  union all
  select
    'published_helper_uses_security_definer_signature',
    case
      when exists (
        select 1
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname = 'event_planner_config_is_published'
          and pg_get_function_identity_arguments(p.oid) = 'p_base_kind public.event_planner_base_kind, p_base_club_event_id uuid, p_base_work_event_id uuid'
          and p.prosecdef = true
      ) then 'OK'
      else 'FAIL'
    end
)
select * from checks order by check_name;

-- J) Data integrity snapshot
select
  'config_invalid_base_binding' as check_name,
  count(*) as affected_rows
from public.event_planner_configs
where not (
  (base_kind = 'club_event' and base_club_event_id is not null and base_work_event_id is null)
  or
  (base_kind = 'work_event' and base_work_event_id is not null and base_club_event_id is null)
)
union all
select
  'slot_club_mismatch_to_config',
  count(*)
from public.event_planner_slots s
join public.event_planner_configs c on c.id = s.planner_config_id
where s.club_id is distinct from c.club_id
union all
select
  'registration_club_mismatch_to_config',
  count(*)
from public.event_planner_registrations r
join public.event_planner_configs c on c.id = r.planner_config_id
where r.club_id is distinct from c.club_id
union all
select
  'structured_registrations_without_slot',
  count(*)
from public.event_planner_registrations r
join public.event_planner_configs c on c.id = r.planner_config_id
where c.planning_mode = 'structured'
  and r.slot_id is null
union all
select
  'simple_registrations_with_slot',
  count(*)
from public.event_planner_registrations r
join public.event_planner_configs c on c.id = r.planner_config_id
where c.planning_mode = 'simple'
  and r.slot_id is not null
union all
select
  'registration_slot_to_other_config',
  count(*)
from public.event_planner_registrations r
join public.event_planner_slots s on s.id = r.slot_id
where r.slot_id is not null
  and r.planner_config_id is distinct from s.planner_config_id
union all
select
  'slot_outside_base_window',
  count(*)
from public.event_planner_slots s
join public.event_planner_configs c on c.id = s.planner_config_id
left join public.club_events ce
  on c.base_kind = 'club_event'
 and ce.id = c.base_club_event_id
left join public.work_events we
  on c.base_kind = 'work_event'
 and we.id = c.base_work_event_id
where (
  c.base_kind = 'club_event'
  and ce.id is not null
  and (s.starts_at < ce.starts_at or s.ends_at > ce.ends_at)
) or (
  c.base_kind = 'work_event'
  and we.id is not null
  and (s.starts_at < we.starts_at or s.ends_at > we.ends_at)
)
order by check_name;

-- K) Notification coverage snapshot
select
  type,
  severity,
  count(*) as notification_count,
  min(created_at) as first_seen_at,
  max(created_at) as last_seen_at
from public.member_notifications
group by type, severity
order by type, severity;

-- L) Pending registrations vs notifications (quick operational view)
with pending as (
  select
    r.id,
    r.club_id,
    r.auth_uid,
    r.created_at
  from public.event_planner_registrations r
  where r.status = 'pending'
),
notified as (
  select distinct
    mn.user_id,
    mn.club_id
  from public.member_notifications mn
  where mn.type in (
    'registration_approved',
    'registration_rejected',
    'event_time_changed',
    'slot_time_changed',
    'slot_deleted',
    'event_cancelled'
  )
)
select
  count(*) as pending_registration_rows,
  count(*) filter (
    where exists (
      select 1
      from notified n
      where n.user_id = p.auth_uid
        and n.club_id = p.club_id
    )
  ) as pending_users_with_any_notification_history
from pending p;
