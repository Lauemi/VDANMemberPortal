# Ablaufplan FCP Cutover mit Security-Baseline

Stand: 2026-03-05  
Branch-Arbeitsmodus: `prep_vercel_multienv_admin_tools`  
Produktionsschutz-Regel: `main` bleibt VDAN-Schutzlinie bis finalem Cutover.

## 0) Leitplanken (immer aktiv)
1. Keine FCP-Entwicklung auf `main`.
2. Kein Merge `prep -> main` vor formaler Freigabe.
3. Kein schema-breaking SQL ohne Rollback-Pfad.
4. Keine Secrets im Repo, nur Vercel/GitHub/Supabase Secret Stores.
5. Jede Phase endet mit Gate-Check (Go/No-Go).

## 1) Phase A - Trennung absichern (jetzt)
Ziel: VDAN darf durch FCP-Arbeit nicht beeinflusst werden.

### Aufgaben
1. Vercel-Deploy nur auf `prep_vercel_multienv_admin_tools` (bereits umgesetzt).
2. DNS `fishing-club-portal.de` auf Vercel (bereits umgesetzt).
3. Lockdown-Seite aktiv halten (`PUBLIC_SITE_LOCKDOWN=true`).
4. Alte schwere VDAN-Medien in FCP-Build entfernen (bereits umgesetzt).

### Security-Baseline Check A
- [ ] `git rev-parse --abbrev-ref HEAD` ist nicht `main` bei FCP-Arbeit.
- [ ] Vercel-Build auf `main` wird ignoriert.
- [ ] `fishing-club-portal.de` zeigt nur Lockdown-Seite.
- [ ] Keine VDAN-Domain zeigt auf FCP-Projekt.

### Exit-Kriterium A
- Trennung technisch und organisatorisch nachweisbar.

## 2) Phase B - Secrets und Environments stabilisieren
Ziel: deploybar, reproduzierbar, ohne Secret-Chaos.

### Aufgaben
1. Vercel Env-Import (siehe `env/vercel-prep-import.example.env`).
2. Pflichtwerte setzen: App-Flags + Supabase/Push/VAPID Werte.
3. Secrets-Matrix pflegen (`docs/ops/SECRETS_MATRIX.md`).
4. Env-Matrix pflegen (`docs/ops/ENV_MATRIX.md`).
5. Rotation-Runbook hinterlegen (`docs/runbooks/SECRETS_ROTATION_RUNBOOK.md`).

### Security-Baseline Check B
- [ ] Secrets liegen nicht im Git-Verlauf.
- [ ] `PUBLIC_*` und Server-Secrets sauber getrennt.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` nur serverseitig.
- [ ] Readiness je Environment geprüft.

### Exit-Kriterium B
- FCP-Branch baut reproduzierbar ohne manuelle Notlösungen.

## 3) Phase C - Rechtstexte und Compliance-Basis
Ziel: Plattformbetrieb rechtlich aufgestellt.

### Aufgaben
1. Datenschutz auf Plattform-/Mandantenbetrieb angepasst (umgesetzt).
2. Nutzungsbedingungen auf Plattformmodell angepasst (umgesetzt).
3. Impressum auf Plattformbetrieb ergänzt (umgesetzt).
4. Juristische Endprüfung extern einplanen (Pflicht vor öffentlicher Freischaltung).

### Security/DSGVO Check C
- [ ] Rechtsgrundlagen je Zweck dokumentiert.
- [ ] Dienstleister (Vercel/Supabase) benannt.
- [ ] Rollen-/Mandantenlogik erwähnt.
- [ ] Kontaktweg Datenschutz klar.

### Exit-Kriterium C
- Arbeitsfassung rechtlich konsistent; finale juristische Freigabe terminiert.

## 4) Phase D - Multi-Tenant Baseline (DB/RLS)
Ziel: späterer Multi-Club-Ausbau ohne Sicherheitsbruch.

### Aufgaben
1. `club_id`-Vollständigkeit je Domaintabelle prüfen.
2. RLS-Policies auf membership-basiertes Muster härten.
3. SECURITY DEFINER Funktionen auf `auth.uid()` + `club_id` prüfen.
4. Idempotenz (`client_request_id`) in kritischen Schreibpfaden sicherstellen.
5. Rollenmodell inkl. Orga-Rollen sauber dokumentieren.

### Security-Baseline Check D
- [ ] Kein Cross-Tenant-Zugriff in Tests möglich.
- [ ] RLS auf relevanten Tabellen aktiv.
- [ ] Kritische RPCs gehärtet.
- [ ] Offline- und Retry-Doppelschreiben abgesichert.

### Exit-Kriterium D
- Multi-Tenant-Basis ist technisch belastbar (mind. Staging-Niveau).

## 5) Phase E - Staging/Beta/Prod Betriebsmodell
Ziel: kontrollierter Release-Prozess.

### Aufgaben
1. Mit Free-Plan: kontrollierter Single-DB-Übergang weiterführen.
2. Bei Umsatz/Upgrade: getrennte Supabase-Projekte (staging/beta/prod).
3. Smoke-Test je Promotion ausführen.
4. Rollback-Runbook verpflichtend pro Release.

### Security-Baseline Check E
- [ ] Pre-Release Security-Checkliste vollständig.
- [ ] Smoke-Test grün (Login, Feed, Upload, Push, Einstellungen).
- [ ] Rollback-Dry-Run dokumentiert.

### Exit-Kriterium E
- Jede Promotion ist reproduzierbar und rückrollbar.

## 6) Phase F - Finaler Cutover (`prep` wird neues `main`)
Ziel: FCP wird offizieller Hauptstand.

### Aufgaben
1. Freeze-Fenster definieren (keine parallelen Feature-Merges).
2. Letzten Go/No-Go mit Board/Owner.
3. `prep_vercel_multienv_admin_tools -> main` Merge.
4. Produktion auf neue Linie bestätigen.
5. VDAN-Redirect erst als letzter Schritt.

### Security-Baseline Check F
- [ ] Alle P0-Punkte aus Board Script geschlossen.
- [ ] Secrets konsistent (kein Drift).
- [ ] Monitoring/Logs für Go-Live aktiv.
- [ ] Kommunikationsplan für Incident vorhanden.

### Exit-Kriterium F
- Neues `main` ist stabil live; Rollback innerhalb definierter Zeit möglich.

## 7) Phase G - Nachlauf (14 Tage)
Ziel: Stabilisierung nach Go-Live.

### Aufgaben
1. Error- und Performance-Monitoring täglich prüfen.
2. Supportfälle und Security-Events triagieren.
3. Offene Legacy-Pfade per Flag entschärfen.
4. Erste Kosten-/Nutzungsanalyse (Vercel/Supabase).

### Security-Baseline Check G
- [ ] Keine kritischen ungeklärten Incidents.
- [ ] Keine offenen Secrets-Leaks.
- [ ] Audit-Spuren für kritische Aktionen vorhanden.

### Exit-Kriterium G
- Regelbetrieb erreicht.

## 8) Was ich (Codex) ab jetzt übernehme
1. Umsetzungen nur auf `prep_vercel_multienv_admin_tools`.
2. Jede Änderung in kontrollierten Commit-Blöcken.
3. Vor jedem Push: Build-Check.
4. Keine destruktiven DB-Schritte ohne explizite Freigabe.
5. Kein Eingriff in `main` ohne dein klares "jetzt Cutover".

## 9) Nächste konkrete 7 Schritte (ab jetzt)
1. Vercel Env final nach `VERCEL_ENV_SETUP_PREP_BRANCH_2026-03-03.md` setzen.
2. Rechtstext-Update deployen (aktueller Stand).
3. Lockdown-Livebild prüfen (inkl. Favicon-Cache-Check).
4. Multi-Tenant P0: RLS/club_id Audit starten.
5. Idempotenz- und Schreibdialog-Paket priorisieren.
6. Staging Smoke-Test einmal komplett fahren.
7. Cutover-Kriterienliste für späteren `prep -> main` Merge festzurren.

## 10) Demo-Verein Light (ohne komplexe Vereinsanlage)
Ziel: Schnell testen/promoten, ohne dass Tester echte Mitgliederdaten sehen.

### Vorgehen
1. Demo-Tester-Accounts als normale `member` anlegen (kein `admin`, kein `vorstand`).
2. Nur Demo-Inhalte in Feed/Terminen nutzen.
3. Admin-Bereiche (`/app/mitglieder/`, `/app/bewerbungen/`, `/app/feedback/cockpit/`) bleiben gesperrt.
4. Fehlerkanal aktivieren: `/app/feedback/` für Mitglieder, `/app/feedback/cockpit/` für Admin.

### Sicherheitsregel
- Solange noch Single-DB: keine echten sensiblen Vereinsdaten in Demo-Content verwenden.

## 11) Update 2026-03-05 - Plattform-Cutover (Security/DSGVO/Deployment)
Ziel: Das bestehende Cutover-Modell um Theme-/Domain-Betrieb, echten Key-Switch und Mitgliederauswirkung erweitern.

### 11.1 Security- und DSGVO-Baseline (verbindlich vor Go)
1. Security Gate aus `docs/board-release-gate.md` bleibt Pflicht:
   - keine aktiven `anon`-Write-Grants/Policies,
   - RLS-Leak-Test bestanden.
2. Consent Gate bleibt Pflicht:
   - externe Inhalte nur nach Einwilligung,
   - Widerruf technisch wirksam.
3. Datenschutz-Governance bleibt Pflicht:
   - juristische Endfreigabe terminiert und dokumentiert,
   - Betreiber-/Dienstleisterrollen konsistent in den Unterlagen.

### 11.2 Bedeutung fuer Mitglieder (Change-Impact)
1. Erwarteter positiver Effekt:
   - klarere Datenabgrenzung je Verein (Tenant/RLS),
   - sauberere Rechtezuordnung.
2. Moegliche kurzfristige Effekte:
   - einmaliger Re-Login bei Domain/Redirect/Cookie-Umstellung,
   - kurze Synchronisationsverzoegerung bei PWA-Cache-Umschaltung.
3. Abnahmekriterium:
   - Smoke-Test `member` ohne Datenverlust und ohne Cross-Club-Leak bestanden.

### 11.3 Umschaltung Platzhalter -> echte Keys (Vercel/Supabase)
1. Trennregel:
   - `PUBLIC_*` nur fuer oeffentliche Runtime-Werte (z. B. URL/anon/theme flags),
   - `SUPABASE_SERVICE_ROLE_KEY` nie als `PUBLIC_*`, nur serverseitig.
2. Umschaltreihenfolge:
   1. Staging-Env mit echten Keys setzen,
   2. Redirect/CORS/Auth-URLs pruefen,
   3. Staging Smoke + RLS-Leak + Consent komplett gruen,
   4. erst dann Production-Keys umstellen.
3. Pflichtnachweis:
   - dokumentierte Env-Matrix je Umgebung,
   - Rollback auf letzte stabile Vercel-Deployment-ID.

### 11.4 VDAN Deployment-Mode (Unified Product, Theme-Layer)
1. Zielbild:
   - ein Codebase/Build, kein Portal-Fork.
2. Domains:
   - `www-vdan-ottenheim.com` -> Website-Scope + VDAN Theme,
   - `portal.vdan-ottenheim.com` -> Portal-Scope + FCP/Club Theme.
3. Vercel-Rolle:
   - Frontend Delivery, Domains, Preview/Prod Promotion, optionale Hostname-Middleware.
4. Supabase-Rolle:
   - Auth, Daten, RLS, serverseitige Funktionen (inkl. spaeterer Billing-Webhooks).

### 11.5 Top-Fallstricke (vorab entschärfen)
1. Falsche Environment-Zuordnung (staging/prod keys vertauscht).
2. Subdomain-Auth-Fehler (Redirect, Cookie-Scope, Logout-Flow).
3. Half-Theming durch Hardcoded Farben statt Token-Nutzung.
4. Alte PWA-Assets nach Cutover (fehlendes Cache-Busting/Update-Prompt).
5. Unvollstaendige Rollback-Dokumentation bei Live-Switch.
6. Auth Cookie / Redirect Scope nicht vollständig getestet (www/portal).

#### 11.5.6 Auth Cookie / Redirect Scope (Subdomains `www` / `portal`)
Ziel: Sicherstellen, dass Auth/Sessions bei Domain-/Subdomain-Betrieb stabil funktionieren (Login/Logout/Refresh/Deep-Links), ohne "Phantom-Logout" oder Redirect-Loops.

##### A) Supabase Redirect URLs (Pflicht-Check)
1. In Supabase Auth Settings sicherstellen, dass alle benoetigten Redirect-URLs fuer Prod und Staging hinterlegt sind:
   - `https://www-vdan-ottenheim.com/*` (oder exakter Pfad, je nach Flow)
   - `https://portal.vdan-ottenheim.com/*`
   - falls vorhanden: `https://staging...` / Preview-Domains (nur wenn notwendig)
2. Fuer OAuth (falls genutzt): OAuth Redirect URLs explizit pruefen (Provider-Console + Supabase).

Go/No-Go: Wenn Redirect-URLs fehlen oder zu eng sind -> No-Go, weil Login/OAuth sonst sporadisch bricht.

##### B) Cookie-/Session-Verhalten zwischen Subdomains (E2E Tests)
Testfaelle (jeweils auf Staging, dann Prod):
1. Login auf `portal`
   - Login durchfuehren
   - Seite neu laden (Hard Reload)
   - Session bleibt aktiv, kein erneuter Login erforderlich.
2. Deep-Link Test
   - Direktlink auf eine Portal-Unterseite oeffnen (z. B. `/app/...`)
   - Wenn nicht eingeloggt: Redirect -> Login -> danach Ruecksprung auf Deep-Link.
3. Logout Test
   - Logout auf `portal`
   - anschliessend `portal` neu laden -> bleibt ausgeloggt
   - anschliessend `www` oeffnen -> keine "halbe Session", keine automatischen Redirect-Loops.
4. Session-Refresh / Token-Rotation
   - im Portal 5-10 Minuten aktiv bleiben
   - erneut eine DB-Operation ausfuehren (z. B. Liste laden)
   - keine 401/Refresh-Fehler, kein "silent logout".
5. Wechsel `www` <-> `portal`
   - von `www` ins Portal wechseln (CTA "Portal/Login")
   - erwartetes Verhalten: entweder sauberer Redirect oder sauberer Login-Start
   - keine Endlosschleifen, kein "mixed state".

Go/No-Go: Wenn einer dieser Tests sporadisch fehlschlaegt (Loop, Logout, 401 nach kurzer Zeit) -> No-Go, weil Support-/Mitgliederimpact hoch.

##### C) Konfiguration pruefen (falls vorhanden)
1. Site URL / Redirect Base (falls ihr das nutzt) korrekt je Umgebung.
2. CORS / Allowed Origins (Supabase + ggf. Edge Functions) enthalten:
   - `https://www-vdan-ottenheim.com`
   - `https://portal.vdan-ottenheim.com`
3. SameSite / Secure Cookie-Constraints beachten (insb. bei OAuth / externen Redirects).

Hinweis: iFrame wird bewusst vermieden, um Cookie-/SameSite-Probleme zu reduzieren.

##### D) Dokumentationspflicht
- Ergebnis der Tests als kurzer Runlog dokumentieren:
  - Datum/Uhrzeit
  - Umgebung (staging/prod)
  - Tester
  - Ergebnis je Testfall (OK/FAIL) + ggf. Screenshot/Log-Auszug

### 11.6 Erweiterte Phasenlogik (A-G bleibt, neue H-Phase)
1. Phase H - Theme/Domain/Key Cutover (neu)
   - H1: Token-/Theme-Loader stabil (kein FOUC/kein Hardcode).
   - H2: Hostname-Scope (`www` vs `portal`) stabil.
   - H3: echte Staging-Keys + End-to-End Test.
   - H4: Production Key-Switch im Freeze-Fenster.
   - H5: 48h Hypercare mit Incident-Triage.

### 11.7 Go/No-Go Zusatzkriterien fuer finalen Cutover
1. Security Gate + Functional Gate + Consent Gate: vollstaendig abgehakt.
2. Env-/Secret-Drift-Check: kein Drift zwischen dokumentierter Matrix und Laufzeit.
3. Auth-Flow auf `www` und `portal`: Login, Logout, Session-Refresh, Deep-Link getestet.
4. Rollback-Plan praktisch testbar (nicht nur theoretisch dokumentiert).
