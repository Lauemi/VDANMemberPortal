-- FCP Masterboard / Kontrollboard
-- Einmaliger Bootstrap fuer den System-Superadmin.
--
-- Ziel:
-- - Zugang zu public.system_board_nodes
-- - Zugang zu public.system_process_controls
-- - Lesen/Schreiben ueber die Masterboard-RPCs
--
-- Ausfuehrung:
-- 1. UUID des gewuenschten Users einsetzen
-- 2. Script gegen die Datenbank ausfuehren

begin;

insert into public.system_superadmins (user_id, note, is_active)
values (
  '00000000-0000-0000-0000-000000000000',
  'Initialer FCP System-Superadmin fuer Masterboard und Kontrollboard',
  true
)
on conflict (user_id) do update
set
  note = excluded.note,
  is_active = true;

commit;
