# Install Runbook (fortlaufend)

Stand: 2026-02-25
Ziel: Erst funktional fertigstellen, danach Keys/SQL in klarer Reihenfolge ausführen.

## Phase A: Ohne SQL/Secrets (aktuell)

1. UI/UX-Standard in Login-Modulen umsetzen.
2. Mobile Runtime prüfen (iPhone/Android).
3. PWA/Portal/Favoriten stabilisieren.
4. Build muss grün bleiben (`npm run build`).

### Aktuell umgesetzt
- Card/Zeile + Suche + Detaildialog:
  - Termine
  - Arbeitseinsätze (Member)
  - Zuständigkeiten (Meine Tasks + Leitungen)
  - Sitzungstasks (im Sitzungen-Cockpit)
  - Bewerbungen (Vorstand/Admin)
  - Notes (Demo)
- Portal/Favoriten responsiver/stabiler (Haus + Leiste, weniger Flicker)

### Noch vor SQL/Secrets zu prüfen
- Feinschliff Dialog-Konsistenz in restlichen Login-Ansichten.
- Device-Tests (Touch/Überlappung/Drawer-Verhalten).

## Mobile/PWA Runtime Check (vor Phase B)

1. iPhone Safari (PWA installiert):
   - Portal-Toggle + Favoritenleiste ohne Überlappung
   - `Ansicht Zeile/Karte` in mindestens 3 Modulen testen
2. Android Chrome (PWA installiert):
   - gleiches Verhalten wie iPhone
   - Scanner nur auf HTTPS testen
3. Feed/Posts:
   - Post-Dialog via Portal-Button öffnen
   - Schließen/Outside-Click ohne UI-Flackern
4. SW-Update-Flow:
   - `App Version` in Einstellungen prüfen
   - Update-Check auslösen, Seite lädt kontrolliert neu
5. Dokumente/Downloads:
   - kein `/Downloads/` 404
   - Links öffnen korrekt

## Phase B: Finalisierung (erst auf dein Kommando)

Wenn du sagst: "Jetzt gehen wir die Keys durch" und danach "Jetzt gehen wir die SQLs durch", dann exakt so:

1. Keys/Secrets setzen (siehe `FINAL_SQL_PACK_AND_KEYS_2026-02-25.md`).
2. SQL-Migrationen in festgelegter Reihenfolge.
3. Edge Function deploy.
4. Live-Checks Push + Membership + Scanner.

### B1: Keys-Session (wenn du sagst: „Jetzt gehen wir die Keys durch“)
1. Alle benötigten Werte bereitstellen.
2. Secrets in Supabase setzen.
3. Frontend `PUBLIC_*` Werte setzen.
4. Kurztest: Einstellungen lädt ohne Konfigurationsfehler.

### B2: SQL-Session (wenn du sagst: „Jetzt gehen wir die SQLs durch“)
1. Migrationen strikt in Reihenfolge ausführen.
2. Nach jeder Migration Kurzcheck auf Fehler.
3. Abschlusscheck auf Tabellen/Funktionen/RLS.

## Fehlerleitfaden (Kurz)

### Push kommt nicht an
- `PUBLIC_VAPID_PUBLIC_KEY` passt nicht zu `VAPID_PUBLIC_KEY`.
- Subscription fehlt in `push_subscriptions`.
- `VAPID_PRIVATE_KEY`/`SUPABASE_SERVICE_ROLE_KEY` fehlt als Secret.

### Membership Encryption Fehler
- `membership_encryption_key` nicht gesetzt oder zu kurz.
- DB-Funktionen greifen auf falschen Key-Pfad zu.

### Scanner startet nicht auf Android
- Kein HTTPS (außer localhost).
- Kamera-Berechtigung blockiert.
- In-App Browser statt Chrome/Safari PWA genutzt.

### Portal/Favoriten Layout bricht mobil
- Browser-Zoom != 100%.
- Safe-Area/Viewport auf Gerät prüfen.
- Prüfen, ob mehr als 3 Favoriten aktiv sind (mobil nur max. 3 sichtbar).
