-- STEP 09 Modul 4: sitzungen -> meetings (Katalog-Schema), FK-sicher + atomar. Sauberer 1:1-Fall.
-- Kette module_usecases -> club_module_usecases -> club_role_permissions. Frontend: admin-board.js usecases.
-- Route /app/sitzungen/ bleibt. Verifiziert: sitzungen 0, meetings durchgaengig (6 Clubs), Gate-Join 6/6.

insert into public.module_usecases (module_key, usecase_key, label, is_active, sort_order)
  select 'meetings','meetings', label, is_active, sort_order
  from public.module_usecases where module_key='meetings' and usecase_key='sitzungen'
  on conflict do nothing;

delete from public.club_role_permissions crp
where crp.module_key='sitzungen'
  and exists (select 1 from public.club_role_permissions d
              where d.club_id=crp.club_id and d.role_key=crp.role_key and d.module_key='meetings');

update public.club_role_permissions set module_key='meetings', updated_at=now()
where module_key='sitzungen';

update public.club_module_usecases set usecase_key='meetings', updated_at=now()
where usecase_key='sitzungen';

delete from public.module_usecases where module_key='meetings' and usecase_key='sitzungen';

notify pgrst, 'reload schema';
