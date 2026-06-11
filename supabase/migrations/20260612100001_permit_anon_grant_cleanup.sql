-- Diese drei Funktionen hatten sowohl PUBLIC als auch einen expliziten anon-Grant.
-- REVOKE FROM PUBLIC (Migration 100000) hat den PUBLIC-Grant entfernt,
-- aber den expliziten anon-Grant nicht — daher zusätzlich FROM anon nötig.

begin;

REVOKE EXECUTE ON FUNCTION public.admin_permit_card_types_for_rules(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_permit_rule_delete(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_permit_rules_for_club(uuid) FROM anon;

notify pgrst, 'reload schema';
commit;
