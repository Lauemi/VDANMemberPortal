-- VDAN Template — seed catch list master data
-- Run this after:
-- 05_catchlist_core.sql

begin;

-- === Fish species (example baseline, extend as needed) ===
insert into public.fish_species(name) values
  ('Aal'),
  ('Barsch'),
  ('Brasse'),
  ('Hecht'),
  ('Karpfen'),
  ('Rotauge'),
  ('Schleie'),
  ('Wels'),
  ('Zander')
on conflict (name) do nothing;

-- === Water bodies ===
-- Categories:
-- - vereins_gemeinschaftsgewaesser
-- - rheinlos39

insert into public.water_bodies(name, area_kind) values
  ('Vogel-Baggersee', 'vereins_gemeinschaftsgewaesser'),
  ('Rhein', 'vereins_gemeinschaftsgewaesser'),
  ('Druckwasser-Kanal', 'vereins_gemeinschaftsgewaesser'),
  ('Schutterentlastungskanal', 'vereins_gemeinschaftsgewaesser'),
  ('Absatzbecken', 'vereins_gemeinschaftsgewaesser'),
  ('Angelweiher', 'vereins_gemeinschaftsgewaesser'),
  ('Altes Baggerloch', 'vereins_gemeinschaftsgewaesser'),
  ('Eisweiher', 'vereins_gemeinschaftsgewaesser'),
  ('Elzkanal', 'vereins_gemeinschaftsgewaesser'),
  ('Kehl', 'vereins_gemeinschaftsgewaesser'),
  ('Krottenloch', 'vereins_gemeinschaftsgewaesser'),
  ('Mühlbach', 'vereins_gemeinschaftsgewaesser'),
  ('Oberer und Unterer Holzplatz', 'vereins_gemeinschaftsgewaesser'),
  ('Sandkehl', 'vereins_gemeinschaftsgewaesser'),
  ('Unterer Bann', 'vereins_gemeinschaftsgewaesser')
on conflict (name, area_kind) do nothing;

-- Sonderfall: Angelweiher auch in Rheinlos39
insert into public.water_bodies(name, area_kind) values
  ('Angelweiher', 'rheinlos39')
on conflict (name, area_kind) do nothing;

commit;
