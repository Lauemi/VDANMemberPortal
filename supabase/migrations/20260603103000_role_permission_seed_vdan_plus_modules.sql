-- Rechte-Modell-Seed (Michael-Spec 2026-06-03): member/vorstand/admin × Module.
-- + 2 neue Module: scanner (Ausweis-Kontrolle), feedback. Beide Vorstand-gated.
-- Seed für VDAN (736c6406...). Default für neue Vereine = Folgeschritt.
-- HINWEIS: club_role_permissions hat noch granulare Alt-Keys (siehe STEP 09 Cleanup).
-- Deployed via Supabase-MCP 2026-06-03, repo-wahr gespiegelt.

begin;

insert into public.module_catalog (module_key, label, sort_order, is_active)
values ('feedback','Feedback',35,true), ('scanner','Scanner',45,true)
on conflict (module_key) do update set label=excluded.label, is_active=true;

-- level → Booleans: none=alles false | read=view+read | edit=+write+update | full=+delete
with seed(role_key, module_key, level) as (
  values
    ('member','fishing','edit'),  ('member','work','read'),      ('member','eventplaner','read'),
    ('member','feed','read'),     ('member','documents','read'), ('member','members','none'),
    ('member','meetings','none'), ('member','settings','edit'),  ('member','scanner','none'),
    ('member','feedback','none'),
    ('vorstand','fishing','edit'),('vorstand','work','edit'),    ('vorstand','eventplaner','edit'),
    ('vorstand','feed','edit'),   ('vorstand','documents','edit'),('vorstand','members','edit'),
    ('vorstand','meetings','edit'),('vorstand','settings','edit'),('vorstand','scanner','edit'),
    ('vorstand','feedback','edit'),
    ('admin','fishing','full'),   ('admin','work','full'),       ('admin','eventplaner','full'),
    ('admin','feed','full'),      ('admin','documents','full'),  ('admin','members','full'),
    ('admin','meetings','full'),  ('admin','settings','full'),   ('admin','scanner','full'),
    ('admin','feedback','full')
)
insert into public.club_role_permissions
  (club_id, role_key, module_key, can_view, can_read, can_write, can_update, can_delete)
select
  '736c6406-e90f-46cd-b0d8-f14a4323a177',
  s.role_key, s.module_key,
  s.level <> 'none', s.level <> 'none',
  s.level in ('edit','full'), s.level in ('edit','full'), s.level = 'full'
from seed s
on conflict (club_id, role_key, module_key) do update set
  can_view=excluded.can_view, can_read=excluded.can_read,
  can_write=excluded.can_write, can_update=excluded.can_update, can_delete=excluded.can_delete;

notify pgrst, 'reload schema';
commit;
