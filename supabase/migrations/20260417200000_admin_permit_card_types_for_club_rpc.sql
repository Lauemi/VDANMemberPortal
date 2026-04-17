-- =============================================================
-- admin_permit_card_types_for_club(p_club_id uuid)
-- =============================================================
-- Liefert die für einen Club verfügbaren Permit-Kartentypen.
-- Verwendet in ADM als optionsBinding-Quelle für card_assignments
-- im Panel club_settings_members_registry.
--
-- Auflösung: club_id → tenant_nodes → permit_card_types
--
-- Felder:
--   card_type_key  — Wert, der in member_card_assignments gespeichert wird
--   card_title     — Anzeigelabel im Select
--   is_active      — Renderer kann inaktive Typen ausgrauen / ausblenden
--
-- Zugriff: admin / vorstand / superadmin im angefragten Club.
-- =============================================================

begin;

drop function if exists public.admin_permit_card_types_for_club(uuid);

create or replace function public.admin_permit_card_types_for_club(
  p_club_id uuid
)
returns table (
  card_type_key text,
  card_title    text,
  is_active     boolean
)
language sql
security definer
stable
set search_path = public, pg_catalog
as $$
  select
    pct.card_type_key,
    pct.title as card_title,
    pct.is_active
  from public.tenant_nodes tn
  join public.permit_card_types pct
    on  pct.tenant_id = tn.tenant_id
  where tn.legacy_club_id = p_club_id
    and (
      current_user in ('postgres', 'service_role')
      or public.is_admin_in_any_club()
      or public.is_admin_or_vorstand_in_club(p_club_id)
    )
  order by pct.title;
$$;

revoke all on function public.admin_permit_card_types_for_club(uuid) from public, anon;
grant execute on function public.admin_permit_card_types_for_club(uuid) to authenticated;
grant execute on function public.admin_permit_card_types_for_club(uuid) to service_role;

notify pgrst, 'reload schema';
commit;
