begin;

insert into public.module_catalog (module_key, label, is_active, sort_order)
values
  ('eventplaner', 'Eventplaner', true, 25)
on conflict (module_key) do update
set label = excluded.label,
    is_active = excluded.is_active,
    sort_order = excluded.sort_order;

insert into public.module_usecases (module_key, usecase_key, label, is_active, sort_order)
values
  ('eventplaner', 'eventplaner', 'Eventplaner', true, 10),
  ('eventplaner', 'eventplaner_mitmachen', 'Eventplaner Mitmachen', true, 20)
on conflict (module_key, usecase_key) do update
set label = excluded.label,
    is_active = excluded.is_active,
    sort_order = excluded.sort_order;

insert into public.club_module_usecases (club_id, module_key, usecase_key, is_enabled)
select
  c.club_id,
  mu.module_key,
  mu.usecase_key,
  true
from (
  select distinct club_id
  from public.club_roles
) c
join public.module_usecases mu
  on mu.module_key = 'eventplaner'
 and mu.is_active = true
on conflict (club_id, module_key, usecase_key) do nothing;

with defaults as (
  select * from (values
    ('member',   'eventplaner',            false, false, false, false, false),
    ('member',   'eventplaner_mitmachen',  true,  true,  true,  true,  false),
    ('vorstand', 'eventplaner',            true,  true,  true,  true,  false),
    ('vorstand', 'eventplaner_mitmachen',  true,  true,  true,  true,  false),
    ('admin',    'eventplaner',            true,  true,  true,  true,  true),
    ('admin',    'eventplaner_mitmachen',  true,  true,  true,  true,  true)
  ) as t(role_key, usecase_key, can_view, can_read, can_write, can_update, can_delete)
)
insert into public.club_role_permissions (
  club_id, role_key, module_key, can_view, can_read, can_write, can_update, can_delete
)
select
  cr.club_id,
  d.role_key,
  d.usecase_key,
  d.can_view,
  d.can_read,
  d.can_write,
  d.can_update,
  d.can_delete
from public.club_roles cr
join defaults d
  on d.role_key = cr.role_key
where cr.role_key in ('member', 'vorstand', 'admin')
on conflict (club_id, role_key, module_key) do nothing;

commit;
