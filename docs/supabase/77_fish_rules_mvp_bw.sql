-- VDAN Template - fish rules MVP (BW §1) without breaking existing fish_species
-- Safe goals:
-- - Keep existing fish_species rows/ids untouched
-- - Add rule layer for closed seasons and minimum sizes
-- - Seed BW baseline rules with source tracking
--
-- Run after:
-- - 05_catchlist_core.sql
-- - tenant/RLS baseline scripts in your current stack

begin;

-- 1) Rule table (additive only, no change on existing catch FK model)
create table if not exists public.fish_species_rules (
  id uuid primary key default gen_random_uuid(),
  fish_species_id uuid not null references public.fish_species(id) on delete cascade,
  scope_type text not null check (scope_type in (
    'state',
    'river_system',
    'special_area',
    'water_type',
    'altitude_zone',
    'sex_scope'
  )),
  scope_label text not null,
  closed_from text check (closed_from is null or closed_from ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'),
  closed_to text check (closed_to is null or closed_to ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'),
  min_size_cm numeric(5,1) check (min_size_cm is null or min_size_cm > 0),
  all_year_closed boolean not null default false,
  note text,
  source_ref text not null default 'LFischVO BW § 1',
  source_url text not null default 'https://www.landesrecht-bw.de/bsbw/document/jlr-FischVBW1998rahmen/part/X',
  source_version_checked_at date not null default current_date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (all_year_closed = true and closed_from is null and closed_to is null)
    or (all_year_closed = false)
  )
);

drop trigger if exists trg_fish_species_rules_touch on public.fish_species_rules;
create trigger trg_fish_species_rules_touch
before update on public.fish_species_rules
for each row execute function public.touch_updated_at();

create unique index if not exists uq_fish_species_rules_semantic
  on public.fish_species_rules(
    fish_species_id,
    scope_type,
    scope_label,
    coalesce(closed_from, ''),
    coalesce(closed_to, ''),
    coalesce(min_size_cm, -1),
    all_year_closed,
    coalesce(note, '')
  );

create index if not exists idx_fish_species_rules_species on public.fish_species_rules(fish_species_id);
create index if not exists idx_fish_species_rules_scope on public.fish_species_rules(scope_type, scope_label);
create index if not exists idx_fish_species_rules_active on public.fish_species_rules(is_active);

alter table public.fish_species_rules enable row level security;

grant select on public.fish_species_rules to anon, authenticated;
grant insert, update, delete on public.fish_species_rules to authenticated;

drop policy if exists "fish_rules_select_all" on public.fish_species_rules;
create policy "fish_rules_select_all"
on public.fish_species_rules for select
using (true);

drop policy if exists "fish_rules_write_manager" on public.fish_species_rules;
create policy "fish_rules_write_manager"
on public.fish_species_rules for all
using (public.is_admin_or_vorstand())
with check (public.is_admin_or_vorstand());

-- 2) Extend fish species master list (preserve existing rows)
insert into public.fish_species(name) values
  ('Seeforelle'),
  ('Bach-/Flussforelle'),
  ('Regenbogenforelle'),
  ('Huchen'),
  ('Seesaibling'),
  ('Bachsaibling'),
  ('Äsche'),
  ('Felchen'),
  ('Quappe / Trüsche'),
  ('Schneider'),
  ('Nase'),
  ('Aland'),
  ('Rapfen'),
  ('Edelkrebs'),
  ('Lachs'),
  ('Meerforelle'),
  ('Atlantischer Stör'),
  ('Wandermaräne / Nordseeschnäpel'),
  ('Maifisch'),
  ('Finte'),
  ('Frauennerfling'),
  ('Strömer'),
  ('Zährte'),
  ('Bitterling'),
  ('Schlammpeitzger'),
  ('Steinbeißer'),
  ('Schrätzer'),
  ('Streber'),
  ('Zingel'),
  ('Groppe'),
  ('Dohlenkrebs'),
  ('Steinkrebs'),
  ('Neunaugen (alle)'),
  ('Flussperl-/Fluss-/Teichmuscheln (Margaritifera, Unio, Anodonta, Pseudanodonta)')
on conflict (name) do nothing;

-- 3) Seed BW §1 rules (MVP)
with rule_seed(
  species_name,
  scope_type,
  scope_label,
  closed_from,
  closed_to,
  min_size_cm,
  all_year_closed,
  note
) as (
  values
    ('Seeforelle','state','Baden-Württemberg','10-01','02-28',50,false,null),
    ('Bach-/Flussforelle','special_area','Hochrhein','10-01','02-28',35,false,null),
    ('Bach-/Flussforelle','altitude_zone','Fließgewässer oberhalb 800 m ü. N. N.','10-01','02-28',20,false,null),
    ('Bach-/Flussforelle','state','Baden-Württemberg (im Übrigen)','10-01','02-28',25,false,'Default-Fall innerhalb BW'),
    ('Regenbogenforelle','state','Baden-Württemberg','10-01','02-28',null,false,'Kein Mindestmaß'),
    ('Huchen','river_system','Donau und ihr Gewässersystem','02-01','05-31',70,false,'Gilt nur dort'),
    ('Seesaibling','state','Baden-Württemberg','10-01','02-28',25,false,null),
    ('Bachsaibling','state','Baden-Württemberg','10-01','02-28',null,false,'Kein Mindestmaß'),
    ('Äsche','state','Baden-Württemberg','02-01','04-30',30,false,null),
    ('Felchen','state','Baden-Württemberg','10-15','01-10',30,false,null),
    ('Hecht','state','Baden-Württemberg','02-15','05-15',50,false,'Default-Fall'),
    ('Zander','state','Baden-Württemberg','04-01','05-15',45,false,'Default-Fall'),
    ('Hecht','river_system','Main','02-01','04-30',50,false,'Sonderregel Main'),
    ('Zander','river_system','Main','02-01','04-30',50,false,'Sonderregel Main'),
    ('Aal','river_system','Rhein und sein Gewässersystem','09-15','03-01',50,false,'Gilt nur dort'),
    ('Quappe / Trüsche','state','Baden-Württemberg','11-01','02-28',30,false,null),
    ('Karpfen','state','Baden-Württemberg',null,null,35,false,'Keine Schonzeit'),
    ('Schleie','state','Baden-Württemberg','05-15','06-30',25,false,null),
    ('Barbe','state','Baden-Württemberg','05-01','06-15',40,false,null),
    ('Rapfen','river_system','Donau und ihr Gewässersystem','03-01','05-31',40,false,'Gilt nur dort'),
    ('Nase','state','Baden-Württemberg','03-15','05-31',35,false,null),
    ('Aland','state','Baden-Württemberg','04-01','05-31',25,false,null),
    ('Edelkrebs','sex_scope','weiblich','10-01','07-10',12,false,'Geschlechtsabhängige Regel'),
    ('Edelkrebs','sex_scope','männlich','10-01','12-31',12,false,'Geschlechtsabhängige Regel'),

    -- §1 Abs. 2: ganzjährig geschont
    ('Neunaugen (alle)','state','Baden-Württemberg',null,null,null,true,'§1 Abs. 2'),
    ('Atlantischer Stör','state','Baden-Württemberg',null,null,null,true,'§1 Abs. 2'),
    ('Lachs','state','Baden-Württemberg',null,null,null,true,'§1 Abs. 2'),
    ('Meerforelle','state','Baden-Württemberg',null,null,null,true,'§1 Abs. 2'),
    ('Wandermaräne / Nordseeschnäpel','state','Baden-Württemberg',null,null,null,true,'§1 Abs. 2'),
    ('Maifisch','state','Baden-Württemberg',null,null,null,true,'§1 Abs. 2'),
    ('Finte','state','Baden-Württemberg',null,null,null,true,'§1 Abs. 2'),
    ('Frauennerfling','state','Baden-Württemberg',null,null,null,true,'§1 Abs. 2'),
    ('Strömer','state','Baden-Württemberg',null,null,null,true,'§1 Abs. 2'),
    ('Schneider','state','Baden-Württemberg',null,null,null,true,'§1 Abs. 2'),
    ('Zährte','state','Baden-Württemberg',null,null,null,true,'§1 Abs. 2'),
    ('Bitterling','state','Baden-Württemberg',null,null,null,true,'§1 Abs. 2'),
    ('Schlammpeitzger','state','Baden-Württemberg',null,null,null,true,'§1 Abs. 2'),
    ('Steinbeißer','state','Baden-Württemberg',null,null,null,true,'§1 Abs. 2'),
    ('Schrätzer','state','Baden-Württemberg',null,null,null,true,'§1 Abs. 2'),
    ('Streber','state','Baden-Württemberg',null,null,null,true,'§1 Abs. 2'),
    ('Zingel','state','Baden-Württemberg',null,null,null,true,'§1 Abs. 2'),
    ('Groppe','state','Baden-Württemberg',null,null,null,true,'§1 Abs. 2'),
    ('Dohlenkrebs','state','Baden-Württemberg',null,null,null,true,'§1 Abs. 2'),
    ('Steinkrebs','state','Baden-Württemberg',null,null,null,true,'§1 Abs. 2'),
    ('Flussperl-/Fluss-/Teichmuscheln (Margaritifera, Unio, Anodonta, Pseudanodonta)','state','Baden-Württemberg',null,null,null,true,'§1 Abs. 2')
)
insert into public.fish_species_rules(
  fish_species_id,
  scope_type,
  scope_label,
  closed_from,
  closed_to,
  min_size_cm,
  all_year_closed,
  note,
  source_ref,
  source_url
)
select
  fs.id,
  rs.scope_type,
  rs.scope_label,
  rs.closed_from,
  rs.closed_to,
  rs.min_size_cm,
  rs.all_year_closed,
  rs.note,
  'LFischVO BW § 1',
  'https://www.landesrecht-bw.de/bsbw/document/jlr-FischVBW1998rahmen/part/X'
from rule_seed rs
join public.fish_species fs on fs.name = rs.species_name
on conflict do nothing;

commit;

-- Optional QA queries after run:
-- select name from public.fish_species order by name;
-- select fs.name, r.scope_type, r.scope_label, r.closed_from, r.closed_to, r.min_size_cm, r.all_year_closed
-- from public.fish_species_rules r
-- join public.fish_species fs on fs.id = r.fish_species_id
-- order by fs.name, r.scope_type, r.scope_label;
