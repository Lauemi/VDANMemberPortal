-- VDAN Template — portal quick settings (handedness + favorites)
-- Run after 42_user_settings_notifications.sql

begin;

alter table public.user_settings
  add column if not exists nav_handedness text not null default 'right',
  add column if not exists portal_favorites jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_settings_nav_handedness_chk'
  ) then
    alter table public.user_settings
      add constraint user_settings_nav_handedness_chk
      check (nav_handedness in ('left', 'right', 'auto'));
  end if;
end $$;

commit;
