# Release Smoke Test - Staging/Beta/Prod

Stand: 2026-03-01
Dauerziel: 15-20 Minuten pro Umgebung.
Zweck: Verbindliche Freigabe-Checkliste vor Promotion in die naechste Umgebung.

## 1) Vorbereitung
- [ ] Zielumgebung klar: `staging` / `beta` / `prod`.
- [ ] Passende Domain aufgerufen.
- [ ] Richtige App-Version sichtbar (`PUBLIC_APP_VERSION`, `PUBLIC_APP_CHANNEL`).
- [ ] Testkonten vorhanden (`member`, `vorstand`, `admin`).

## 2) Core Login/Session
- [ ] Login mit Member funktioniert.
- [ ] Logout funktioniert.
- [ ] "Angemeldet bleiben" Verhalten wie erwartet.
- [ ] Rollen-Guard korrekt (Member sieht keine Admin-Seiten).

## 3) Feed und Medien
- [ ] Neuer Feed-Post erstellt.
- [ ] Bild-Upload mit grossem Handybild funktioniert (automatische Verkleinerung).
- [ ] Erfolgsfeedback am Speichern-Button sichtbar.
- [ ] Bearbeiten und Loeschen eines eigenen Posts funktioniert.

## 4) Termine/Arbeitseinsaetze
- [ ] Termin anlegen und in Liste sichtbar.
- [ ] Arbeitseinsatz anlegen und sichtbar.
- [ ] Anwesenheit setzen ohne stoerendes UI-Flackern.
- [ ] Nach Aktion ist UI-Datenstand korrekt aktualisiert.

## 5) Fangliste
- [ ] Fang eintragen inklusive Bild.
- [ ] Offline-Speicherverhalten testbar (kurz offline/online).
- [ ] Sync-Hinweis/Konfliktanzeige plausibel.

## 6) Rollen- und Admin-Funktionen
- [ ] Admin kann Mitglieder/Rollen verwalten.
- [ ] Vorstand-/Admin-Cockpits laden und zeigen Daten.
- [ ] Zugriffsschutz fuer nicht berechtigte Rollen korrekt.

## 7) Push und PWA
- [ ] Push-Erlaubnis Flow funktioniert auf Testgeraet.
- [ ] Subscription wird in `push_subscriptions` angelegt.
- [ ] Push-Test trifft Geraet an.
- [ ] PWA-Update-Hinweis/Refresh funktioniert.

## 8) API-Tools (Admin `lizenzen`)
- [ ] Wetterdaten laden.
- [ ] Luftdruckreihe (Rueckblick + Vorschau + Pfeile) sichtbar.
- [ ] Mondphase visualisiert.
- [ ] Radar-Overlay und Frame-Steuerung funktionieren.

## 9) Security/Config Checks
- [ ] Build/Test sind gruen.
- [ ] Keine Secrets im Commit/Repo.
- [ ] Env-Secrets korrekt je Umgebung.
- [ ] CORS/Redirect/CSP fuer aktuelle Domain korrekt.
- [ ] Kontaktformular/Captcha entspricht Ziel-Env.

## 10) Abuse-/Rate-Limit Kurztest
- [ ] Kontaktformular reagiert korrekt auf Mehrfachsendung.
- [ ] Login zeigt bei Fehlversuchen erwartetes Verhalten.
- [ ] Upload-Fehlerfaelle liefern saubere Meldung (kein Leak).

## 11) Backup/Restore und Rotation (Gate)
- [ ] Letzter Restore-Drill protokolliert (max. 1 Quartal alt).
- [ ] Key-Rotation-Status aktuell dokumentiert.

## 12) Freigabeentscheidung
- [ ] GO fuer Promotion in naechste Umgebung.
- [ ] NO-GO mit Ticketliste und Ownern.
- [ ] Ergebnis im Release-Log dokumentiert.

## 13) Protokollblock (ausfuellen)
- Datum:
- Umgebung:
- Version:
- Durchgefuehrt von:
- Ergebnis:
- Auffaelligkeiten:
- Folgeaktionen:
