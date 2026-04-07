begin;

-- =========================================================
-- FIX: public.current_user_has_role_in_club fehlt in Migrations
-- =========================================================
-- Hintergrund:
--   Die Funktion existiert bereits produktiv in der DB.
--   Beleg: docs/Databasestructure/IST/RPC_Functions.json:165
--     { "function_name": "current_user_has_role_in_club",
--       "args": "p_club_id uuid, p_roles text[]",
--       "return_type": "boolean" }
--
--   Sie wird aufgerufen in:
--   - supabase/migrations/20260407_harden_onboarding_process_state.sql:188
--   - docs/masks/templates/VDAN_get_onboarding_process_state.sql:184
--
--   Option A gewählt (nicht Option B):
--   - Funktion ist im Bestand bereits angelegt, Migration fehlte nur.
--   - Die deployte Migration (20260407_harden_onboarding_process_state) bleibt unberührt.
--   - is_admin_or_vorstand_in_club ist ein Sonderfall davon
--     (hardcodiert auf ['admin','vorstand']); diese Funktion ist
--     der allgemeinere Vertrag mit variabler Rollenliste.
-- =========================================================

create or replace function public.current_user_has_role_in_club(
  p_club_id uuid,
  p_roles text[]
)
returns boolean
language sql
security definer
stable
set search_path = public, auth, pg_catalog
as $$
  select exists (
    select 1
    from public.club_user_roles ur
    where ur.user_id = auth.uid()
      and ur.club_id = p_club_id
      and ur.role_key = any(p_roles)
  )
$$;

grant execute on function public.current_user_has_role_in_club(uuid, text[]) to authenticated;

commit;
