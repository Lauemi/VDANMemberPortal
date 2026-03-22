# FCP/VDAN Deploy Gate

Stand: 2026-03-21

## Ziel

Vor jedem Release muss pruefbar sichergestellt sein:

- VDAN- und FCP-Static-Web bleiben strikt getrennt
- App-Masken-Branding bleibt pro Deploy-Ziel getrennt steuerbar
- Vereinsanlage und Onboarding-Workspace sind technisch abgesichert
- der aktuelle Build ist lokal gruen

## Pflichtkommando

```bash
npm run check:deploy-gate
```

## Was der Gate aktuell prueft

1. Pflichtdateien fuer Trennung, Branding und Onboarding sind vorhanden.
2. VDAN-Spezialseiten bleiben im FCP-Deploy gesperrt.
3. versteckte statische Seiten liefern `404` und `noindex,nofollow`.
4. serverseitige Web-/App-Config ist nach `scope` getrennt.
5. Vereinsanlage validiert Verantwortlichen-Mail und rate-limited Benachrichtigungen.
6. `club-onboarding-workspace` beantwortet CORS-Preflight robust.
7. `npm run build` ist gruen.
8. Kern-Regressionen laufen gruen:
   - `tests/site-mode-separation.test.js`
   - `tests/static-web-separation.test.js`
   - `tests/onboarding-security-regressions.test.js`
   - `tests/smoke.test.js`

## Remote-Pflicht nach lokal grünem Gate

Die folgenden Functions muessen nach Codeaenderungen jeweils mit dem aktuellen Stand deployed werden:

- `admin-web-config`
- `club-admin-setup`
- `club-onboarding-workspace`

Function-Deploy ist insbesondere Pflicht bei Aenderungen in diesen Bereichen:

- Onboarding
- Club-Setup
- Admin-Config / Brand-Overrides
- CORS / Request-Handling
- serverseitige Runtime-Config

## Release-Regel

Kein Deploy ohne:

- grünes `npm run check:deploy-gate`
- anschliessenden Function-Deploy fuer betroffene Edge Functions
- anschliessenden Remote-Function-Smoke: `npm run check:remote-function-smoke`
- kurzen Smoke-Test in der Zielumgebung

## Empfohlener Smoke-Test

1. `VDAN`-Startseite pruefen: Feed sichtbar, keine FCP-Spezialseiten.
2. `FCP`-Startseite pruefen: FCP-Landingpage sichtbar, keine VDAN-Spezialseiten.
3. falsche statische Zielseite pruefen: liefert wirklich `404`.
4. Response der falschen Zielseite pruefen: enthaelt `noindex,nofollow`.
5. Superadmin-Flow pruefen: neuen Verein ueber bestehende Session anlegen.
6. Vereinsdaten im neuen Verein speichern.
7. App-Masken-Brand-Override im Admin-Board speichern und auf einer Zielmaske sichtbar pruefen.

## Remote-Function-Smoke

Pflichtkommando nach dem Function-Deploy:

```bash
npm run check:remote-function-smoke
```

Der Check prueft:

- `OPTIONS`/Preflight fuer `admin-web-config`
- `OPTIONS`/Preflight fuer `club-admin-setup`
- `OPTIONS`/Preflight fuer `club-onboarding-workspace`
- erwartbare POST-Antworten in der Zielumgebung
