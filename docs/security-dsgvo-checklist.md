# Security + DSGVO Baseline Checklist (Platform vs. Verein)

## 1) Plattform-Baseline (technischer Betreiber)

- [ ] Least-Privilege Grants umgesetzt (`anon` nur explizit notwendige Rechte).
- [ ] RLS auf allen club-relevanten Tabellen aktiv und tenant-scope getestet.
- [ ] Auth-Source-of-Truth festgelegt: Login-Identifier ist Auth-E-Mail, nicht Kürzel/Anzeige-ID.
- [ ] `public_active_club_id` ist gesetzt und dokumentiert (Betriebsprozess).
- [ ] Secrets sauber verwaltet (Supabase Keys, Encryption Key, Rotation-Prozess).
- [ ] Admin-Aktionen sind nachvollziehbar (Audit/Change-Protokoll).
- [ ] Backup + Restore-Test dokumentiert (inkl. RPO/RTO Zielwerte).
- [ ] Incident-Runbook vorhanden (Security-Vorfall, Datenpanne, Kommunikation).
- [ ] Regelmäßiger Rechte-Review (monatlich/Release-basiert) etabliert.

## 2) Vereinsinhalt / Verantwortlichkeit je Verein

- [ ] Datenschutzhinweise je Verein aktuell (Verantwortlicher, Zwecke, Rechtsgrundlagen).
- [ ] Verzeichnis von Verarbeitungstätigkeiten je Verein gepflegt.
- [ ] Aufbewahrungs- und Löschfristen je Datenart definiert.
- [ ] Betroffenenrechte-Prozess umgesetzt (Auskunft, Berichtigung, Löschung, Export).
- [ ] Medien/Beiträge mit Personenbezug: Rechtsgrundlage/Einwilligung dokumentiert.
- [ ] AVV/DPA zwischen Plattform und Verein abgeschlossen und versioniert.
- [ ] TOM-Anlage abgestimmt (Plattform-TOM + vereinsseitige organisatorische TOMs).
- [ ] Supabase DPA final abgeschlossen (nicht nur angefordert).
- [ ] Supabase TIA heruntergeladen und im Compliance-Ordner archiviert.
- [ ] IONOS AVV final abgeschlossen und dokumentiert.

## 3) Konkrete Soll-Zuordnung (wichtig)

- Plattform verantwortet:
  - technische Sicherheit, Tenant-Isolation, Zugriffskontrolle, Betrieb, Logging.
- Verein verantwortet:
  - rechtliche Inhalte, Datenzwecke, Information der Betroffenen, Freigabeprozesse.

## 4) Sofort-Checks nach Security-Migration

- [ ] Public Feed sichtbar (ohne Login), `nur_mitglieder` bleibt ausgeblendet.
- [ ] Login-Bereiche funktionieren (Fangliste, Cockpits, Admin-Masken).
- [ ] `user_roles` für eingeloggte Nutzer wieder lesbar (`roles_select_own` wirksam).
- [ ] Keine unerwarteten `403/401` im Browser-Network auf Kernseiten.
- [ ] Keine unnötigen `anon` Schreibrechte mehr vorhanden.
  - Hardening-Patch verfügbar: `docs/supabase/87_anon_write_grant_hardening_member_waters.sql`

## 5) Empfohlene Governance

- [ ] Vor jedem Release: Security + DSGVO Quick-Gate (10 Minuten).
  - XSS-Guard lokal/CI ausführen: `npm run check:xss-guard`
- [ ] Nach jedem DB-RLS-Change: Smoke-Test mit anon + authenticated + admin.
- [ ] Quartalsweise: Rechte-Audit + Löschfristen-Audit + Runbook-Test.
