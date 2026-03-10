# Technische Spezifikation: FCP Prelaunch-Guard (Soft-Access)
Stand: 2026-03-10

## Ziel
`fishing-club-portal.de` soll live testbar sein, aber noch nicht öffentlich freigegeben werden.

Wichtig:
- Kein zweites Auth-System.
- Kein Eingriff in den bestehenden Portal-Kernfluss.
- VDAN bleibt unverändert erreichbar.

## Architekturprinzip
Es gibt zwei Ebenen:
1. Prelaunch-Guard vor dem FCP-Surface (Zugangssperre)
2. Danach normaler FCP-Login (`/login` -> `/app`)

Der Guard ersetzt niemals Rollen, RLS oder Auth.

## Ist-Zustand (relevant)
- Astro läuft aktuell als `output: "static"` in [astro.config.mjs](/Users/michaellauenroth/Downloads/vdan-app-template/astro.config.mjs).
- Damit gibt es in diesem Build keine serverseitige Secret-Prüfung pro Request.
- Ein sicherer Passwort-Guard darf nicht über `PUBLIC_*` im Frontend geprüft werden.

## Deployment-Trennung (verbindlich)
- VDAN läuft über eigenen GitHub-Deploypfad und bleibt der stabile Livepfad.
- FCP läuft über Vercel (Preview/Production dort separat steuerbar).
- Konsequenz: Ein FCP-Vercel-Deploy beeinflusst VDAN deployment-seitig nicht direkt.
- Unverändert gemeinsam sensibel bleiben nur:
  - Shared-Core-Code (`auth`, `app`, globale Layout-/Guard-Logik),
  - Shared-DB-Änderungen (Policies, RPC, Migrations).

## Betriebsregel: Ein Kern, zwei Surfaces
- VDAN und FCP sind kein Doppel-System.
- Auth-, Portal- und Berechtigungslogik bleiben ein gemeinsamer Kern.
- Unterschiede zwischen VDAN/FCP sind nur im Surface-Layer zulässig:
  - Branding, Farben, statische Seiten, öffentliche Navigation.

## Entscheidung
### Phase A (sofort, sicher, ohne Architekturumbau)
Verwende Vercel Deployment Protection für den FCP-Deploy-Pfad.

Einsatz:
- FCP-Pfad/Projekt geschützt
- VDAN bleibt auf eigenem Live-Pfad unverändert

Vorteil:
- Sofort wirksam, kein Code-Risiko im Kern.

Grenze:
- Kein feingranularer Host-/Routen-Guard aus App-Code.

#### Phase A: Konkrete Umsetzung (jetzt)
1. Vercel-Projekt `vdan-member-portal` öffnen.
2. `Settings -> Deployment Protection`:
   - Protection aktivieren.
   - Scope auf FCP-Deploypfad anwenden (Preview/Production je nach Rollout-Plan).
3. Prüfen, dass VDAN-Livepfad nicht über diesen Vercel-Kanal ausgeliefert wird.
4. Neues FCP-Deployment auslösen (damit aktuelle ENV + Protection aktiv sind).
5. Nachweis protokollieren:
   - FCP ohne Auth: blockiert.
   - FCP mit Access: erreichbar.
   - VDAN: unverändert erreichbar.

### Phase B (dauerhaft, hostbasiert, app-seitig)
Einführung eines serverseitigen Guards mit Cookie-Session für FCP-Hosts.

Voraussetzung:
- Astro auf Server-Output mit Vercel-Adapter umstellen.

## Zielverhalten (Phase B)
Wenn `host` ein FCP-Host ist und Guard aktiv:
- Erlaube nur:
  - `/_fcp-access` (Passwortseite)
  - `/_fcp-access/verify` (POST Prüfroute)
  - statische Assets (`/_astro/*`, `/css/*`, `/js/*`, Bilder, Manifest)
- Blocke alle anderen Routen ohne gültiges Guard-Cookie.
- Nach erfolgreicher Prüfung: `HttpOnly` Cookie setzen, dann normaler Zugriff.

Für VDAN-Hosts:
- Kein Prelaunch-Guard.

## ENV-Definition (nicht PUBLIC)
Für Phase B:
- `FCP_PRELAUNCH_ENABLED=true|false`
- `FCP_PRELAUNCH_PASSWORD_HASH=<scrypt-hash>`
- `FCP_PRELAUNCH_COOKIE_SECRET=<random secret>`
- `FCP_PRELAUNCH_COOKIE_NAME=fcp_prelaunch`
- `FCP_PRELAUNCH_ALLOWED_HOSTS=www.fishing-club-portal.de,fishing-club-portal.de`

Hinweis:
- Kein Klartext-Passwort in ENV speichern.
- Keine Guard-Secrets in `PUBLIC_*`.

## Implementierungspfad (Phase B)
1. Adapter einführen:
   - `@astrojs/vercel`
   - `astro.config.mjs`: `output: "server"`, Adapter aktivieren.
2. Middleware:
   - `src/middleware.ts`
   - Host prüfen, Guard aktiv?
   - Cookie validieren.
   - Bei fehlender Freigabe Redirect auf `/_fcp-access`.
3. Verify-Endpoint:
   - `src/pages/_fcp-access/verify.ts` (POST)
   - Passwort gegen Hash prüfen.
   - signiertes Cookie setzen (`HttpOnly`, `Secure`, `SameSite=Lax`).
4. Access-Seite:
   - `src/pages/_fcp-access.astro` (passwortformular)
5. Ausnahme-Liste:
   - Assets/Manifest/API-Routen explizit erlauben.

### Status im Repo
- `astro.config.mjs`: konditionaler Output:
  - `static` als Default (VDAN-kompatibel),
  - `server` + Vercel Adapter bei `VERCEL=true|1` oder `FORCE_SERVER_OUTPUT=true|1`.
- `src/middleware.ts`: hostbasierter Guard aktivierbar.
- `src/pages/_fcp-access.astro`: Zugangsformular.
- `src/pages/_fcp-access/verify.ts`: Passwortprüfung + Cookie-Setzung.
- `src/lib/fcp-prelaunch.ts`: Host-, Token- und Hash-Logik.
- `scripts/fcp-prelaunch-hash.mjs`: Hash-/Secret-Generator.

## Sicherheitsregeln
- Guard gilt nur für FCP-Hosts.
- Kein clientseitiger Passwortvergleich.
- Cookie muss signiert sein.
- Fehlversuche drosseln (min. Delay oder Rate-Limit auf Verify-Route).

## Risiko-Matrix (operativ)
### Infra-getrennt (niedriges Risiko für VDAN)
- FCP Vercel-Protection
- FCP-ENV in Vercel
- FCP-Branding / statische Seiten

### Gemeinsam sensibel (prüfpflichtig)
- Shared Auth-/Callback-Flow
- `/app/*` Kernverhalten
- DB-/RLS-/Policy-Änderungen
- Invite-/Claim-/Bootstrap-Funktionen

## Go/No-Go-Gate für Änderungen
`GO` ohne zusätzliche Freigabe:
- reine FCP-Surface-Änderungen (statisch/Branding/Content/Nav)
- Vercel-Protection/Prelaunch-Konfiguration für FCP

`REVIEW PFLICHT` vor Rollout:
- Änderungen in shared JS/TS-Kerndateien
- Änderungen an Supabase-Funktionen, RPCs, Policies, Migrationen
- Änderungen an Login/Callback/Session-Flows

## Smoke-Test (Pflicht)
1. FCP-Host ohne Cookie -> nur Access-Seite erreichbar.
2. Falsches Passwort -> kein Cookie, kein Zugriff.
3. Korrektes Passwort -> Cookie gesetzt, Zugriff auf FCP-Seiten.
4. Login/Invite/Callback danach unverändert funktionsfähig.
5. VDAN-Host bleibt ohne Guard normal erreichbar.

## CTO-Freigabekriterium
Freigabe "FCP Soft-Access Ready", wenn:
- Guard serverseitig aktiv,
- Secrets nicht öffentlich,
- Cookie-Flow stabil,
- VDAN unbeeinträchtigt.
- Shared-Core/DB-Gate eingehalten und dokumentiert.
