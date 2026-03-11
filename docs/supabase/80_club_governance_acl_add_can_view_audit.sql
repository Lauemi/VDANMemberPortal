-- 80 Club Governance ACL - can_view Audit SQL
-- Run AFTER:
--   supabase/migrations/20260311121500_club_governance_acl_add_can_view.sql
--
-- Purpose:
-- - Verify can_view column exists
-- - Verify sanitize trigger exists
-- - Verify gate constraint exists
-- - Verify no inconsistent rows exist

-- A) Column exists
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'club_role_permissions'
  and column_name in ('can_view', 'can_read', 'can_write', 'can_update', 'can_delete')
order by column_name;

-- B) Trigger exists
select event_object_table as table_name, trigger_name, action_timing, event_manipulation
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table = 'club_role_permissions'
  and trigger_name = 'trg_club_role_permissions_sanitize';

-- C) Constraint exists
select conname, pg_get_constraintdef(c.oid) as definition
from pg_constraint c
join pg_class t on t.oid = c.conrelid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public'
  and t.relname = 'club_role_permissions'
  and conname = 'club_role_permissions_view_gate_chk';

-- D) Inconsistency check (must return 0 rows)
select *
from public.club_role_permissions p
where
  (p.can_view = false and (p.can_read or p.can_write or p.can_update or p.can_delete))
  or
  (p.can_view = true and p.can_read = false);

-- E) Snapshot summary
select
  count(*) as total_rows,
  sum(case when can_view then 1 else 0 end) as visible_rows,
  sum(case when can_write then 1 else 0 end) as write_rows,
  sum(case when can_update then 1 else 0 end) as update_rows,
  sum(case when can_delete then 1 else 0 end) as delete_rows
from public.club_role_permissions;
