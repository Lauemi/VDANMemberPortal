-- VDAN Template — import template for water_areas (GeoJSON from Google My Maps)
-- Run this after:
-- 20_water_areas_map.sql
--
-- Workflow:
-- 1) In Google My Maps die Layer als KML exportieren.
-- 2) KML nach GeoJSON konvertieren (externes Tool).
-- 3) Für jede Fläche/Punkt die Feature-JSON unten eintragen.

begin;

-- Optional: reset active map data before a full re-import.
-- delete from public.water_areas;

insert into public.water_areas (name, area_kind, geojson, source, is_active)
values
  (
    'Beispiel Vereinsgewässer',
    'vereins_gemeinschaftsgewaesser',
    '{
      "type": "Feature",
      "properties": {},
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[7.85,48.45],[7.90,48.45],[7.90,48.48],[7.85,48.48],[7.85,48.45]]]
      }
    }'::jsonb,
    'google_my_maps',
    true
  ),
  (
    'Beispiel Rheinlos39',
    'rheinlos39',
    '{
      "type": "Feature",
      "properties": {},
      "geometry": {
        "type": "LineString",
        "coordinates": [[7.82,48.50],[7.88,48.52],[7.93,48.55]]
      }
    }'::jsonb,
    'google_my_maps',
    true
  )
on conflict do nothing;

commit;

