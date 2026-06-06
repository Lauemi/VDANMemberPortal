-- STEP 09 Modul 3: einstellungen -> settings (Katalog-Schema), FK-sicher + atomar. Sauberer 1:1-Fall.
-- Kette module_usecases -> club_module_usecases -> club_role_permissions. Frontend: admin-board.js (2 Stellen:
-- Modul-usecases + Default-Rechte-Helper). Route /app/einstellungen/ bleibt.
-- Verifiziert: einstellungen 0, settings durchgaengig (6 Clubs), Gate-Join 6/6.

insert into public.module_usecases (module_key, usecase_key, label, is_active, sort_order)
  select 'settings','settings', label, is_active, sort_order
  from public.module_usecases where module_key='settings' and usecase_key='einstellungen'
  on conflict do nothing;

delete from public.club_role_permissions crp
where crp.module_key='einstellungen'
  and exists (select 1 from public.club_role_permissions d
              where d.club_id=crp.club_id and d.role_key=crp.role_key and d.module_key='settings');

update public.club_role_permissions set module_key='settings', updated_at=now()
where module_key='einstellungen';

update public.club_module_usecases set usecase_key='settings', updated_at=now()
where usecase_key='einstellungen';

delete from public.module_usecases where module_key='settings' and usecase_key='einstellungen';

notify pgrst, 'reload schema';
