-- Read/Join-Fix: Profil<->Mitglied in der Mitgliederuebersicht ueber den belastbaren
-- Anker auth_user_id verknuepfen. Vorher nur ueber canonical_membership_id -> bei
-- geclaimten Mitgliedern NULL -> NULL=NULL nie wahr -> Profil koppelt ab -> Mitglied
-- erscheint als ZWEI Zeilen. = read/write-Zentralisierung-Juwel (Write laesst canonical
-- bewusst NULL, Read jointe genau darauf). security_invoker=true bleibt. Spalten unveraendert.
-- Deployed via Supabase-MCP 2026-06-05, repo-wahr.
create or replace view public.admin_member_cards_overview_v
with (security_invoker = true) as
 WITH assignment_rows AS (
         SELECT mca.club_id,
            mca.member_no,
            array_agg(mca.card_id ORDER BY (
                CASE mca.card_id
                    WHEN 'innenwasser'::text THEN 1
                    WHEN 'rheinlos39'::text THEN 2
                    ELSE 99
                END)) AS card_ids
           FROM member_card_assignments mca
          GROUP BY mca.club_id, mca.member_no
        )
 SELECT cm.canonical_membership_id AS membership_id,
    COALESCE(cm.tenant_id, p.tenant_id) AS tenant_id,
    cm.club_id,
    cm.member_no,
    COALESCE(NULLIF(TRIM(BOTH FROM cm.club_member_no), ''::text), cm.member_no) AS club_member_no,
    NULLIF(TRIM(BOTH FROM concat_ws(' '::text, cm.first_name, cm.last_name)), ''::text) AS member_name,
    cm.first_name,
    cm.last_name,
    cm.status AS member_status,
    member_card_label_from_ids(COALESCE(ar.card_ids, member_card_assignment_ids_from_legacy(cm.fishing_card_type))) AS fishing_card_type,
    cm.role AS member_role,
    cm.membership_kind,
    cm.is_youth,
    p.id AS profile_user_id,
    p.display_name,
    p.email,
    p.member_card_valid,
    p.member_card_valid_from,
    p.member_card_valid_until,
    p.member_card_id,
    p.member_card_key,
        CASE
            WHEN p.member_card_valid IS FALSE THEN 'inaktiv'::text
            WHEN p.member_card_valid_until IS NOT NULL AND p.member_card_valid_until < CURRENT_DATE THEN 'abgelaufen'::text
            WHEN p.member_card_valid IS TRUE THEN 'aktiv'::text
            ELSE 'offen'::text
        END AS status,
        CASE
            WHEN p.member_card_valid_from IS NOT NULL AND p.member_card_valid_until IS NOT NULL THEN (to_char(p.member_card_valid_from::timestamp with time zone, 'DD.MM.YYYY'::text) || ' - '::text) || to_char(p.member_card_valid_until::timestamp with time zone, 'DD.MM.YYYY'::text)
            WHEN p.member_card_valid_from IS NOT NULL THEN 'ab '::text || to_char(p.member_card_valid_from::timestamp with time zone, 'DD.MM.YYYY'::text)
            WHEN p.member_card_valid_until IS NOT NULL THEN 'bis '::text || to_char(p.member_card_valid_until::timestamp with time zone, 'DD.MM.YYYY'::text)
            ELSE NULL::text
        END AS validity_label,
    false AS requires_approval,
    GREATEST(COALESCE(cm.updated_at, cm.created_at, p.updated_at, p.created_at, now()), COALESCE(p.updated_at, p.created_at, cm.updated_at, cm.created_at, now())) AS updated_at
   FROM club_members cm
     LEFT JOIN assignment_rows ar ON ar.club_id = cm.club_id AND ar.member_no = cm.member_no
     LEFT JOIN profiles p ON (
          p.id = cm.auth_user_id
       OR (p.canonical_membership_id = cm.canonical_membership_id AND (p.tenant_id = cm.tenant_id OR p.tenant_id IS NULL AND p.club_id = cm.club_id))
     );

notify pgrst, 'reload schema';
