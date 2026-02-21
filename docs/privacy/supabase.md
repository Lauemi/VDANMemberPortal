# VDAN Supabase Privacy Notes

Stand: 21.02.2026

## Supabase Projekt
- Zweck: Authentifizierung, Datenbank, RLS-gesicherter Datenzugriff für Mitgliederportal
- Produktiv-Projekt: `peujhdrqnbvhllxpfavo`
- Region: dokumentieren (im Supabase Dashboard prüfen und hier eintragen)

## Drittlandtransfer
- Prüfen und dokumentieren:
  - AVV/DPA Status
  - SCC/Transfermechanismus
  - relevante Subprozessoren laut Supabase-Dokumentation

## Technische Vorgaben VDAN
- RLS auf allen personenbezogenen Tabellen aktiv.
- Service-Role-Key ausschließlich serverseitig/administrativ.
- Frontend verwendet nur Publishable/Anon Key.
- Sensible Daten (z. B. IBAN) nur verschlüsselt.

## Operativer Check (quartalsweise)
- RLS-Pflichten geprüft
- aktive Policies überprüft
- SQL-Migrationsstand vollständig im Repo
- Retention-Einstellungen im Hosting/Supabase gegengeprüft
