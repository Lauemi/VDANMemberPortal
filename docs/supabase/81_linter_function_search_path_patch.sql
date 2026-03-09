-- VDAN Patch 81
-- Purpose:
--   Fix Supabase linter warning:
--   0011_function_search_path_mutable
--
-- Strategy:
--   Set a fixed search_path for the affected public functions, resolved
--   dynamically via pg_proc so we do not need hardcoded signatures.

do $$
declare
  fn record;
begin
  for fn in
    select
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as identity_args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array[
        'normalize_water_name',
        'enforce_whitefish_daily_limit',
        'sync_fishing_trip_from_catch_entry',
        'membership_normalize_iban',
        'membership_iban_last4',
        'member_water_match_candidates',
        'enforce_water_context_defaults',
        'meeting_agenda_items_auto_number',
        'enforce_meeting_task_agenda_scope',
        'is_passive_status',
        'enforce_meeting_attendee_is_manager',
        'enforce_feed_media_limit',
        'touch_updated_at',
        'enforce_work_participation_update',
        'touch_updated_by',
        'profile_club_id',
        'current_user_club_id',
        'is_same_club',
        'can_access_club_content',
        'is_board_or_admin'
      ])
  loop
    execute format(
      'alter function %I.%I(%s) set search_path = public, pg_temp',
      fn.schema_name,
      fn.function_name,
      fn.identity_args
    );
  end loop;
end
$$;

