# Mobile Runtime Check (iPhone + Android)

Stand: 2026-02-25

## Voraussetzung (Push-Update live)
1. In Supabase Migration `46_push_subscriptions.sql` ausführen.
2. Edge Function deployen: `push-notify-update`.
3. Secrets in Supabase setzen:
   - `VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
   - `VAPID_SUBJECT` (z. B. `mailto:admin@verein.de`)
   - optional `PUSH_NOTIFY_TOKEN`
4. Frontend-Env setzen:
   - `PUBLIC_VAPID_PUBLIC_KEY` (muss zu `VAPID_PUBLIC_KEY` passen)
5. HTTPS aktiv (Pflicht für Push/Scanner außerhalb localhost).

## 5 Klicktests
1. Push-Abo speichern:
   - Login -> `/app/einstellungen/`
   - `App-Update verfügbar` aktivieren
   - `Benachrichtigung erlauben` klicken
   - Erwartung: Erfolgsmeldung, kein Fehler in Konsole

2. Push-Abo in DB:
   - In `push_subscriptions` erscheint ein Datensatz für den User
   - `enabled=true`, `notify_app_update=true`

3. Testversand:
   - POST auf `.../functions/v1/push-notify-update`
   - Payload: `{ "version": "x.y.z", "message": "Neue Version verfügbar.", "url": "/app/einstellungen/" }`
   - Erwartung: `ok=true`, `sent > 0`

4. Notification Klickziel:
   - Push öffnen/tippen
   - Erwartung: App öffnet/fokussiert sich und navigiert zur URL

5. Deaktivierung:
   - In Einstellungen `App-Update verfügbar` deaktivieren + speichern
   - Erwartung: Subscription wird gelöscht; keine weiteren Update-Pushs

## Mobile Nutzbarkeit quick check
- iPhone Safari (PWA installiert): Push erscheint, Klickziel korrekt.
- Android Chrome (PWA installiert): Push erscheint, Klickziel korrekt.
- Scanner: nur auf HTTPS und mit Kamera-Berechtigung testen.
