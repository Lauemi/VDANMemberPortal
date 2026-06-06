-- STEP 09 Buendel (sicherer Schnitt): arbeitseinsaetze -> work (1:1) + work_events Cleanup.
-- arbeitseinsaetze_cockpit BLEIBT granular (kein Kollaps, keine Rechte-Semantik-Aenderung).
-- Kette module_usecases -> club_module_usecases -> club_role_permissions. Frontend: admin-board.js
-- (usecases [work, arbeitseinsaetze_cockpit] + Helper-Liste arbeitseinsaetze->work). cockpit-Helper (:198) bleibt.
-- Route /app/arbeitseinsaetze/ bleibt. Verifiziert: arbeitseinsaetze 0, work durchgaengig (6 Clubs),
-- work_events 0, cockpit unberuehrt (6), Gate-Join work 6/6.

insert into public.module_usecases (module_key, usecase_key, label, is_active, sort_order)
  select 'work','work', label, is_active, sort_order
  from public.module_usecases where module_key='work' and usecase_key='arbeitseinsaetze'
  on conflict do nothing;

delete from public.club_role_permissions crp
where crp.module_key='arbeitseinsaetze'
  and exists (select 1 from public.club_role_permissions d
              where d.club_id=crp.club_id and d.role_key=crp.role_key and d.module_key='work');

update public.club_role_permissions set module_key='work', updated_at=now()
where module_key='arbeitseinsaetze';

delete from public.club_role_permissions where module_key='work_events';

update public.club_module_usecases set usecase_key='work', updated_at=now()
where usecase_key='arbeitseinsaetze';

delete from public.module_usecases where module_key='work' and usecase_key='arbeitseinsaetze';

notify pgrst, 'reload schema';
