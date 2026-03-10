# Runbook Secret Sync VDAN/FCP
Stand: 2026-03-10

## Ziel
Sichere und reproduzierbare Pflege von Env-Variablen/Secrets über Local, GitHub und Vercel.

Umgebungsmodell (aktuell):
- Kein separates Staging.
- Verwendet werden `Local`, `Vercel Preview`, `Vercel Production`.

## Voraussetzungen
- Master-Datei für Zielumgebung ist lokal gepflegt.
- `SECRET_MATRIX_VDAN_FCP_2026-03-10.md` ist aktuell.
- Rollback ist vorab definiert.

## Standardablauf (verbindlich)
1. Prepare:
- Änderungsziel definieren.
- Betroffene Variablen in Matrix markieren.
- Zielsysteme festlegen (`Local`, `GitHub`, `Vercel Preview`, `Vercel Production`).
2. Apply:
- Änderungen zuerst in Master-Datei pflegen.
- Danach GitHub Secrets und/oder Vercel Env entsprechend Matrix setzen.
3. Verify:
- Drift-Check durchführen (Presence + Soll-Zuordnung + Altlasten).
- Smoke-Test ausführen.
4. Document:
- Matrix aktualisieren (`Letzter Check`, Notiz).
- Ergebnis im Projektstatus vermerken.

## One-Man-Sicherheitsregel (Ersatz für 4-Augen)
1. Zwei Phasen:
- Phase A: Prepare + Dokumentation.
- Phase B: Apply (mit zeitlichem Abstand).
2. Pflichtfragen vor Apply:
- Ist die Variable wirklich nötig?
- Ist `public_config` vs `secret` korrekt?
- Gehört sie wirklich an GitHub/Vercel/Local?
- Gibt es einen Rollback in < 5 Minuten?
3. Nachweis:
- Drift-Check und Smoke-Test dokumentieren.

## Drift-Check (Minimum)
1. Name vorhanden?
2. In richtiger Umgebung vorhanden?
3. Keine Dublette/Altlast?
4. Matrix entspricht Ist-Zustand?

## Smoke-Test (Minimum)
1. Build erfolgreich.
2. Login erfolgreich.
3. Invite/Claim erfolgreich.
4. Passwort-Reset erfolgreich.
5. Auth-Callback/Redirect korrekt.

## Incident / Leak-Procedure
1. Betroffene Secrets sofort rotieren.
2. Betroffene Systeme neu deployen.
3. Sessions/Tokens prüfen und ggf. invalidieren.
4. Incident kurz protokollieren:
- Zeitpunkt
- betroffene Secrets
- Maßnahmen
- Abschlusszeitpunkt

## Ergebnisprotokoll (Template)
- Datum:
- Umgebung:
- Änderung:
- Drift-Check: `pass/fail`
- Smoke-Test: `pass/fail`
- Abweichungen:
- Rollback nötig: `ja/nein`
