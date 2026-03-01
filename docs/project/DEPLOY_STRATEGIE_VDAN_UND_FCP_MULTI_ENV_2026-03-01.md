# Deploy-Strategie: VDAN + fishing-club-portal.de (Staging/Beta/Prod)

Stand: 2026-03-01
Ziel: Parallelbetrieb der bestehenden VDAN-Seite und des neuen Endprodukts auf `fishing-club-portal.de` mit klar getrennten Umgebungen.

## 1) Zielbild (Soll-Zustand)
1. `vdan` bleibt vorerst live (Bestandsbetrieb).
2. `fishing-club-portal.de` wird neues Endprodukt (`prod`).
3. Zusaetzliche Umgebungen:
   1. `staging.fishing-club-portal.de`
   2. `beta.fishing-club-portal.de`
4. Jede Umgebung hat eigene Runtime-Variablen und idealerweise eigenes Supabase-Projekt.
5. Deploys laufen reproduzierbar ueber CI/CD, nicht manuell.

## 2) Domain- und Routing-Plan
1. Behalte die VDAN-Domain aktiv, bis Abnahme fuer FCP erfolgt.
2. Richte DNS fuer neue Domain ein:
   1. `fishing-club-portal.de` -> `prod`
   2. `staging.fishing-club-portal.de` -> `staging`
   3. `beta.fishing-club-portal.de` -> `beta`
3. Nach Go-Live:
   1. `vdan` auf neue Produktdomain umleiten (301), wenn rechtlich/fachlich freigegeben.
   2. VDAN-Seiten ggf. als Legacy/Info erhalten.

## 3) Umgebungskonzept (Pflicht)
1. Definiere drei Umgebungen:
   1. `staging`
   2. `beta`
   3. `prod`
2. Nutze pro Umgebung getrennte Werte fuer:
   1. `PUBLIC_SUPABASE_URL`
   2. `PUBLIC_SUPABASE_ANON_KEY`
   3. `SUPABASE_URL`
   4. `SUPABASE_SERVICE_ROLE_KEY`
   5. `PUSH_NOTIFY_TOKEN`
   6. `PUBLIC_VAPID_PUBLIC_KEY` (und passendes Server-Keypair)
   7. `PUBLIC_APP_CHANNEL`
   8. `PUBLIC_APP_VERSION`
3. Empfehlung: eigenes Supabase-Projekt je Umgebung (mindestens `staging` und `prod`).

## 4) Branch- und Release-Strategie
1. Branch-Mapping festlegen:
   1. `develop` -> `staging`
   2. `beta` -> `beta`
   3. `main` -> `prod`
2. Merge-Regel:
   1. Feature -> `develop`
   2. Release-Kandidaten `develop` -> `beta`
   3. Freigegeben `beta` -> `main`
3. Keine Hotfixes direkt auf `main` ohne Rueckmerge nach `develop`/`beta`.

## 5) CI/CD-Setup (zwei Wege)

### 5.1 Weg A: Weiter mit IONOS (kurzfristig, geringster Umbau)
1. Erstelle je Umgebung eigene Deploy-Workflows oder Matrix-Workflow.
2. Hinterlege je Umgebung eigene Secrets:
   1. SFTP Zielhost/Pfad (`IONOS_*`)
   2. App/Public-Variablen
   3. Supabase/Push Secrets
3. Deployregeln:
   1. Push auf `develop` deployt nach staging Host/Pfad.
   2. Push auf `beta` deployt nach beta Host/Pfad.
   3. Push auf `main` deployt nach prod Host/Pfad.
4. Vorteil: schnell umsetzbar.
5. Nachteil: SFTP/Mirror-Fehlerbild bleibt hoehere Betriebslast.

### 5.2 Weg B: Wechsel auf Vercel (technisch empfohlen)
1. Verbinde Repo mit Vercel.
2. Lege Environments an:
   1. Development
   2. Preview
   3. Production
3. Mappe Domains:
   1. Production -> `fishing-club-portal.de`
   2. Preview-Projekte/Branch-Domains -> `staging`/`beta`
4. Hinterlege Variablen je Environment in Vercel.
5. Vorteil: Preview-Deploys, einfache Rollbacks, sauberer Multi-Env Betrieb.
6. Nachteil: einmalige Migration und Umstellung von IONOS-Deployprozess.

## 6) Secrets-Matrix (Minimum)
1. GitHub/Vercel Build-Secrets:
   1. `PUBLIC_SUPABASE_URL`
   2. `PUBLIC_SUPABASE_ANON_KEY`
   3. `PUBLIC_VAPID_PUBLIC_KEY`
   4. `PUBLIC_MEMBER_CARD_VERIFY_PUBKEY`
   5. `PUBLIC_APP_NAME`
   6. `PUBLIC_APP_BRAND`
   7. `PUBLIC_APP_CHANNEL`
   8. `PUBLIC_APP_VERSION`
   9. optional `PUBLIC_TURNSTILE_SITE_KEY`
2. Runtime/Server-Secrets:
   1. `SUPABASE_URL`
   2. `SUPABASE_SERVICE_ROLE_KEY`
   3. `PUSH_NOTIFY_TOKEN`
   4. `VAPID_PUBLIC_KEY`
   5. `VAPID_PRIVATE_KEY`
   6. `VAPID_SUBJECT`
   7. optional `TURNSTILE_SECRET_KEY`

## 7) Rebranding-Schritte fuer neue Domain
1. Brandtexte aktualisieren (`VDAN` -> neues Branding, wo noetig).
2. Logo ersetzen.
3. Rechtstexte fuer neuen Betreiber/Domain pruefen:
   1. Impressum
   2. Datenschutz
   3. Nutzungsbedingungen
4. Mailadressen/Supportkontakte auf neue Domain stellen.
5. Falls VDAN im Bestand bleiben muss: Mandantentrennung/Brandtrennung klar dokumentieren.

## 8) Supabase-Migrationsplan pro Umgebung
1. Neues Supabase-Projekt pro Umgebung anlegen.
2. SQL-Migrationen in definierter Reihenfolge ausrollen.
3. Seed-Daten nur wo noetig (staging/beta).
4. Functions deployen (`push-notify-update` etc.).
5. Secrets setzen und pruefen (`supabase secrets list`).
6. Smoke-Test gegen jeweilige Umgebung.

## 9) Sicherheits- und Audit-Gates vor Produktivfreigabe
1. Build/Test gruen.
2. Keine Secrets im Repo.
3. RLS/Policy-Stichproben auf kritischen Tabellen.
4. Auth-Flow Test:
   1. Login
   2. Session Refresh
   3. Logout
5. Datei-/Bild-Upload Test mit grossen Mobile-Bildern.
6. Push-Ende-zu-Ende Test mit realem Geraet.
7. PWA Update-Flow Test (alte Version -> neue Version).
8. Deploy-/Rollback-Protokoll abgelegt.

## 10) Konkreter Startplan (nacheinander ausfuehren)
1. Entscheiden: Weg A (IONOS) oder Weg B (Vercel).
2. Umgebungsnamen und Domains final festlegen.
3. Branch-Strategie (`develop/beta/main`) aktivieren.
4. Secrets je Umgebung setzen.
5. Staging zuerst deployen und testen.
6. Beta deployen und fachlich abnehmen.
7. Prod deployen auf `fishing-club-portal.de`.
8. VDAN-Domain erst nach Freigabe umleiten.

## 11) Was du mich als naechstes fragen kannst (Punkt-fuer-Punkt)
1. "Mach Punkt 1: Entscheidungsvorlage IONOS vs Vercel fuer unser Setup."
2. "Mach Punkt 3: Branch-Strategie und Schutzregeln konkret im Repo."
3. "Mach Punkt 4: Secrets-Set je Umgebung als konkrete Liste zum Abhaken."
4. "Mach Punkt 5: Staging-Deploy-Workflow erstellen."
5. "Mach Punkt 9: Sicherheits-/Audit-Checkliste als Release-Template."
