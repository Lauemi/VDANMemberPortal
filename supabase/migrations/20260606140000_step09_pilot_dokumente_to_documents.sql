-- STEP 09 Pilot-Modul: Vokabular dokumente -> documents (Katalog-Schema), FK-sicher + atomar.
-- Live-Gate has_usecase_access prueft cmu.usecase_key gegen crp.module_key.
-- Kette: module_usecases (Katalog) -> club_module_usecases -> club_role_permissions.
-- Frontend-Pendant: admin-board.js Modul documents -> usecases ["documents"].
-- Deployed via Supabase-MCP 2026-06-06, repo-wahr. Verifiziert: dokumente 0, documents durchgaengig, Gate-Join 6/6.

insert into public.module_usecases (module_key, usecase_key, label, is_active, sort_order)
values ('documents','documents','Dokumente', true, 10)
on conflict do nothing;

delete from public.club_role_permissions crp
where crp.module_key='dokumente'
  and exists (select 1 from public.club_role_permissions d
              where d.club_id=crp.club_id and d.role_key=crp.role_key and d.module_key='documents');

update public.club_role_permissions set module_key='documents', updated_at=now()
where module_key='dokumente';

update public.club_module_usecases set usecase_key='documents', updated_at=now()
where usecase_key='dokumente';

delete from public.module_usecases where module_key='documents' and usecase_key='dokumente';

notify pgrst, 'reload schema';
