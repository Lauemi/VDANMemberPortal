-- STEP 09 Modul 2: mitglieder -> members (Katalog-Schema), FK-sicher + atomar.
-- Kette module_usecases -> club_module_usecases -> club_role_permissions. Frontend: admin-board.js usecases.
-- mitglieder_registry bleibt unangetastet (separater granularer Usecase). Route /app/mitgliederverwaltung/ bleibt.
-- Verifiziert: mitglieder 0, members durchgaengig (cmu 6 / crp 6 Clubs / Katalog), Gate-Join 6/6, registry unberuehrt.

insert into public.module_usecases (module_key, usecase_key, label, is_active, sort_order)
  select 'members','members', label, is_active, sort_order
  from public.module_usecases where module_key='members' and usecase_key='mitglieder'
  on conflict do nothing;

delete from public.club_role_permissions crp
where crp.module_key='mitglieder'
  and exists (select 1 from public.club_role_permissions d
              where d.club_id=crp.club_id and d.role_key=crp.role_key and d.module_key='members');

update public.club_role_permissions set module_key='members', updated_at=now()
where module_key='mitglieder';

update public.club_module_usecases set usecase_key='members', updated_at=now()
where usecase_key='mitglieder';

delete from public.module_usecases where module_key='members' and usecase_key='mitglieder';

notify pgrst, 'reload schema';
