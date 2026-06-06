-- STEP 09 Buendel (sicherer Schnitt): fangliste -> fishing (1:1) + catch_approvals Cleanup.
-- fangliste_cockpit UND go_fishing BLEIBEN granular (kein Kollaps, keine Rechte-Semantik-Aenderung).
-- Kette module_usecases -> club_module_usecases -> club_role_permissions. Frontend: admin-board.js
-- (usecases [fishing, go_fishing, fangliste_cockpit] + Helper-Liste fangliste->fishing). cockpit-Helper/Pfad bleiben.
-- Route /app/fangliste/ bleibt. Verifiziert: fangliste 0, fishing durchgaengig (6 Clubs), catch_approvals 0,
-- cockpit+go_fishing unberuehrt (je 6), Gate-Join fishing 6/6.

insert into public.module_usecases (module_key, usecase_key, label, is_active, sort_order)
  select 'fishing','fishing', label, is_active, sort_order
  from public.module_usecases where module_key='fishing' and usecase_key='fangliste'
  on conflict do nothing;

delete from public.club_role_permissions crp
where crp.module_key='fangliste'
  and exists (select 1 from public.club_role_permissions d
              where d.club_id=crp.club_id and d.role_key=crp.role_key and d.module_key='fishing');

update public.club_role_permissions set module_key='fishing', updated_at=now()
where module_key='fangliste';

delete from public.club_role_permissions where module_key='catch_approvals';

update public.club_module_usecases set usecase_key='fishing', updated_at=now()
where usecase_key='fangliste';

delete from public.module_usecases where module_key='fishing' and usecase_key='fangliste';

notify pgrst, 'reload schema';
