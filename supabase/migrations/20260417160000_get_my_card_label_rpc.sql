-- =============================================================
-- get_my_card_label()
-- =============================================================
-- Liefert die aktuelle Kartenbezeichnung des eingeloggten
-- Mitglieds aus member_card_assignments + member_card_label_from_ids().
--
-- Warum separate Funktion und keine Erweiterung von
-- get_my_water_bodies_access():
--   Die Gewässer-RPC gibt nur Zeilen zurück, wenn der Club
--   water_bodies hat (JOIN auf wb.club_id). card_label wäre bei
--   leerem Ergebnis nicht abrufbar. Diese Funktion ist davon
--   vollständig unabhängig.
--
-- Quelle der Wahrheit: member_card_assignments, NICHT profiles.fishing_card_type.
-- profiles.fishing_card_type kann stale sein (historisches Denormalisierungs-Feld).
-- =============================================================
CREATE OR REPLACE FUNCTION public.get_my_card_label()
RETURNS TABLE(card_label text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT public.member_card_label_from_ids(
    array_agg(mca.card_id ORDER BY mca.card_id)
  ) AS card_label
  FROM public.member_card_assignments mca
  JOIN public.profiles p
    ON  p.member_no = mca.member_no
    AND p.club_id   = mca.club_id
  WHERE p.id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_my_card_label() TO authenticated;
