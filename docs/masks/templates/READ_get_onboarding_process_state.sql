-- =========================================================
-- READ FUNCTION BODY: public.get_onboarding_process_state
-- =========================================================
-- Zweck:
-- - liest die echte Function-Definition direkt aus Postgres
-- - dient nur fuer Audit / Review / Abgleich mit dem Contract
-- - veraendert nichts
--
-- Verwendung:
-- 1) gegen die Ziel-DB ausfuehren
-- 2) Ausgabe sichern
-- 3) gegen folgende Dateien pruefen:
--    - docs/contracts/VDAN_GET_ONBOARDING_PROCESS_STATE_SPEC.md
--    - docs/contracts/VDAN_GET_ONBOARDING_PROCESS_STATE_DELTA.md
--    - docs/contracts/VDAN_GET_ONBOARDING_PROCESS_STATE_REVIEW_CHECKLIST.md
-- =========================================================

select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  pg_get_function_result(p.oid) as result_type,
  l.lanname as language_name,
  p.prosecdef as security_definer,
  pg_get_functiondef(p.oid) as function_definition
from pg_proc p
join pg_namespace n
  on n.oid = p.pronamespace
join pg_language l
  on l.oid = p.prolang
where n.nspname = 'public'
  and p.proname = 'get_onboarding_process_state';

-- Optional:
-- Nur die Signatur und Metadaten, falls der ganze Body zu lang ist.

select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  pg_get_function_result(p.oid) as result_type,
  l.lanname as language_name,
  p.prosecdef as security_definer
from pg_proc p
join pg_namespace n
  on n.oid = p.pronamespace
join pg_language l
  on l.oid = p.prolang
where n.nspname = 'public'
  and p.proname = 'get_onboarding_process_state';
