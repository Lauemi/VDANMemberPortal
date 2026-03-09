# Umsetzungsprotokoll Board: Auth + Tenant-Mehrfachzuordnung (P0)

Stand: 2026-03-09  
Status: Zur Board-Freigabe  
Prioritaet: P0 (Go-Live-relevant)

## 1) Ausgangslage
- Login-Mechanik ist aktuell auf `Mitgliedsnummer + Passwort` ausgerichtet.
- Auth-Identitaet (`auth.users.email`) und App-Kontaktmail (`profiles.email`) koennen auseinanderlaufen.
- Rollout muss ohne laengeren Live-Ausfall erfolgen.
- Zielbild wurde erweitert: User ohne Verein, spaetere Vereinszuordnung (1:n), pro Verein selektiver Austritt, datenschutzkonforme Account-Loeschung ohne Vereinsdatenverlust.

## 2) Board-Entscheidungen (verbindlich)
1. Globaler User-Account ist vereinsunabhaengig moeglich.
2. Vereinszuordnung wird als separate Membership gefuehrt (`1:n`).
3. Vereinsbeitritt durch User selbst ist nur mit bestaetigter E-Mail erlaubt.
4. Austritt betrifft nur den ausgewaehlten Verein, nicht andere Vereinszuordnungen.
5. Account-Loeschung darf keine vereinsseitige Historie/Prozessdaten vernichten.
6. Bis zur finalen Umstellung bleibt Live-Login stabil auf `Mitgliedsnummer + Passwort`.

## 3) Technisches Zielbild
### 3.1 Account-Ebene (global)
- `auth.users`: technische Identitaet und Session.
- `public.profiles`: nutzerseitige Profil-/Kontaktdaten.
- Registrierung ohne Verein ist erlaubt (Membership-Liste leer).

### 3.2 Vereins-Ebene (mehrfach)
- Neue zentrale Membership-Struktur (1:n je User zu Vereinen).
- Kernattribute: `user_id`, `club_id`, `member_no`, `status`, `valid_from`, `valid_until`, `joined_at`, `left_at`, `left_reason`.
- Eindeutigkeit je Verein: `unique(club_id, member_no)`.

### 3.3 Tenant-Kontext
- Berechtigungen/Scope laufen ueber aktive Membership im gewaehlten Club-Kontext.
- Keine implizite Einzel-Club-Wahrheit im Profil als langfristige Quelle.

## 4) Guardrails (Security/Operativ)
1. Join Verein nur bei bestaetigter E-Mail (`email_confirmed_at` vorhanden).
2. Invite/Join ist immer token- oder nachweisgebunden, zeitlich befristet und club-gebunden.
3. Membership-Dubletten pro Verein sind ausgeschlossen.
4. Re-Join ist nur als neuer Statusverlauf erlaubt (auditierbar).
5. Austritt setzt Membership-Status fuer genau einen Verein auf `left/inactive`.
6. Loeschung des Users fuehrt zu Datenschutz-Operation, nicht zu Verlust vereinsseitiger Fachdaten.
7. Kritische Auth-/Membership-Aktionen sind revisionsfaehig zu protokollieren.

## 5) Bereits umgesetzt (Stand 2026-03-09)
1. Auth-Callback-Route fuer E-Mail-/Passwort-Links vorhanden.
2. Account-Self-Service fuer Stammdaten im Portal umgesetzt.
3. SMTP/Email-Fehlerursache identifiziert und behoben.
4. Invite-Registrierung gehaertet:
   - Mitgliedsnummer muss zur Einladung passen (falls im Invite vorgegeben).
   - Einladung ohne gueltigen Vereinsbezug wird abgewiesen.
5. Live-Stabilisierung vorbereitet:
   - Schalter fuer Auth-E-Mail-Aenderung im Frontend.
   - Rollout-/Rollback-SQL und Runbook angelegt.

## 6) Offene P0-Arbeitspakete
### P0-A: Membership-Modell einfuehren
- Schema + Indizes + Constraints fuer Mehrfachvereinszuordnung.
- Backfill aus bestehender Einzel-Club-Struktur.

### P0-B: Join/Leave-Prozesse
- Self-Join (nur mit bestaetigter Mail) ueber `club_code` + Nachweis.
- Pro-Verein Leave inkl. Geltigkeits-/Statusregeln.

### P0-C: Rechte-/RLS-Umstellung
- Zugriff auf Club-Daten nur bei aktiver Membership im Ziel-Club.
- Aktiver Club-Kontext explizit im UI/API.

### P0-D: Datenschutz-Loeschkonzept
- User-Delete als DSGVO-konformer Prozess.
- Vereins-/Vorgangsdaten werden erhalten (pseudonymisierte Referenzen falls noetig).

## 7) Rollout-Strategie (ohne Live-Beeinflussung)
1. Pilot-/Testverein als Schalter verwenden.
2. Additive Migrationen, keine harten Breaking Changes im ersten Schritt.
3. Smoke-Test nach jedem Teilschritt:
   - Superadmin-Login
   - Mitgliedslogin
   - Passwort-Reset
   - Join/Leave im Pilot
4. Rollback jederzeit ueber vorbereitete SQL/Restore-Batches.

## 8) Risiko-Matrix
1. Risiko: Login-Ausfall durch falsche Auth-E-Mail.
   - Massnahme: deterministische Auth-Email-Reparatur + Backup vor Update.
2. Risiko: Cross-Tenant-Zugriff.
   - Massnahme: Membership-basierte RLS-Gates + Club-Kontextpflicht.
3. Risiko: Datenverlust bei User-Loeschung.
   - Massnahme: Trennung User-Daten vs Vereins-Fachhistorie.
4. Risiko: Invite-Missbrauch.
   - Massnahme: Expiry, One-Time-Use, Club-Bindung, Member-No-Match-Check.

## 9) Abnahmekriterien (Board-Go)
1. Registrierung ohne Verein funktioniert.
2. Join Verein funktioniert nur mit bestaetigter E-Mail.
3. Ein User kann mehrere Vereine halten (1:n).
4. Leave betrifft nur den ausgewaehlten Verein.
5. Login bleibt stabil fuer Live-Bestand.
6. Account-Loeschung entfernt Userdaten, ohne Vereinsprozessdaten zu verlieren.
7. Auditierbarkeit fuer kritische Aktionen ist nachweisbar.

## 10) Naechster Schritt nach Board-Freigabe
1. P0-SQL-Paket fuer Membership-Basismodell erstellen.
2. Join/Leave-RPCs mit Guardrails implementieren.
3. Pilotverein-End-to-End testen.
4. Kontrollierte Erweiterung auf weitere Vereine.

## 11) Compliance-Ergaenzung (DPA/TIA)
Verbindliche Begleitdoku:
- `docs/project/DSGVO_DPA_TIA_UMSETZUNG_SUPABASE_IONOS_2026-03-09.md`

Kernpunkt fuer Board:
1. Supabase DPA final abschliessen (offener Request reicht nicht).
2. Supabase TIA archivieren.
3. IONOS AVV final abschliessen.
4. Controller/Processor/Subprocessor-Kette dokumentiert halten.
