# 06_CLAUDE_Cowork_Nachtest-inline-data-table-v1

Version: v1
Stand: 2026-04-22
Status: aktiv
Ziel: gezielter Nachtest der produktiven Inline-Data-Table nach dokumentierter Umsetzung

---

## AUFGABE

Du bist Claude im Cowork-Modus.

Du führst keinen allgemeinen Smoke-Test von vorne durch, sondern einen gezielten Nachtest auf Basis der bereits dokumentierten Kette:

1. Erstbefund
2. Ableitung
3. Umsetzung
4. Widerspruch zwischen Doku und sichtbarer Produktrealität

Deine Aufgabe ist:

- prüfen, was laut Umsetzung gemacht wurde
- prüfen, was davon im Browser wirklich funktioniert
- prüfen, wo die Doku aktuell zu positiv ist
- gezielt die offenen Problemstellen nachtesten

---

## PFLICHTDATEIEN ZUERST LESEN

Lies vor dem Test vollständig:

1. `docs/Smoke-Tests/inline-data-table/archive/03_SMOKETEST_Ergebnis-inline-data-table-v1.md`
2. `docs/Smoke-Tests/inline-data-table/04_SMOKETEST_Ableitung-inline-data-table-v1.md`
3. `docs/Smoke-Tests/inline-data-table/05_SMOKETEST_Umsetzung-inline-data-table-v1.md`
4. `docs/Smoke-Tests/inline-data-table/03_SMOKETEST_Ergebnis-inline-data-table-v1.md`

WICHTIG:

- Das Archiv zeigt den ursprünglichen Fehlerzustand.
- Die Ableitung zeigt, was kaputt war und wie es gefixt werden sollte.
- Die Umsetzung zeigt, was Codex laut Doku geändert hat.
- Das aktuelle Ergebnis darf von dir nicht blind bestätigt, sondern muss gegen die echte Oberfläche geprüft werden.

---

## TESTZUGANG

URL:
http://127.0.0.1:4321/app/mitgliederverwaltung/

User:
fcp_demoadmin@fishing-club-portal.de

Passwort:
FCP1admin

---

## WAS LAUT UMSETZUNG GEMACHT WORDEN SEIN SOLL

Laut `05_SMOKETEST_Umsetzung-inline-data-table-v1.md` wurde insbesondere umgesetzt:

1. Overflow-/Containment-Fehler bereinigt
2. Row-Actions und Header-Menüs nachgeschärft
3. Inline-Edit zurück auf echtes Row-Aufklapp-Prinzip geführt
4. lokaler Hell/Dunkel-Schalter ergänzt
5. Header-3-Punkte-Menü lokal am Button verankert
6. Header-Rechtsklick öffnet dasselbe Menü statt Direkt-Hide
7. Menüpositionierung auf Button-/Klickpunkt-Verankerung geschärft

Genau diese Punkte musst du jetzt real nachtesten.

---

## WICHTIGER KORREKTURHINWEIS

Es liegt ein Screenshot-Befund vor, der dem zu positiven Re-Test widerspricht:

- Ein Kontext-/Header-Menü sitzt sichtbar unten im Seitenbereich statt lokal am Trigger.
- RowClick öffnet nicht sauber das erwartete Verhalten.
- Hell/Dunkel-Umschaltung funktioniert laut Nutzer nicht sauber.
- Zusätzlich sind mögliche Kontrastfehler wie Farbe in Farbe bei Hover, Fokus oder aktiver Zeile bisher nicht sauber aufgefallen oder dokumentiert.

Du musst deshalb kritisch testen und darfst "öffnet sich irgendwie" NICHT mit "funktioniert korrekt" verwechseln.

---

## KONKRETE PRÜFPUNKTE

### A. HEADER-KONTEXTMENÜ

Prüfe separat:

1. Klick auf Header-⋯
2. Rechtsklick auf Header
3. Position des Menüs
4. bleibt das Menü lokal am Trigger?
5. landet das Menü irgendwo unten, im Seitenbereich oder über dem Footer?
6. funktioniert:
   - Aufsteigend sortieren
   - Absteigend sortieren
   - Spalte ausblenden
   - Breite zurücksetzen

WICHTIG:
Nicht nur "öffnet sich", sondern: sitzt es richtig?

---

### B. ZEILEN-KONTEXTMENÜ

Prüfe separat:

1. Hover über Zeile → erscheinen Stift + ⋯?
2. Klick auf Zeilen-⋯
3. Rechtsklick auf Zeile
4. Position des Menüs
5. bleibt es lokal an der Zeile oder am Cursor?
6. sind Bearbeiten, Duplizieren und Löschen vollständig klickbar?
7. öffnet normaler RowClick fälschlich ein Kontextmenü oder nicht?

WICHTIG:
RowClick, ⋯-Click und Rechtsklick sauber trennen.

---

### C. INLINE-EDIT

Prüfen:

1. Öffnet es direkt unter der richtigen Zeile?
2. Bleibt das Tabellengefühl erhalten?
3. Sind alle Inputs sichtbar und bedienbar?
4. Speichern funktioniert?
5. Abbrechen funktioniert?
6. ESC schließt?
7. Klick außerhalb schließt?
8. Überlagern Row-Actions oder Menüs den Editor?

---

### D. HELL / DUNKEL

Das ist jetzt Pflicht.

Prüfen:

1. Reagiert der lokale Hell/Dunkel-Schalter überhaupt?
2. Wechselt die Tabelle sichtbar den Modus?
3. Wechseln:
   - Hintergrund
   - Textfarben
   - Menüs
   - Buttons
   - Hover-Zustände
   - Edit-Zeile
   - Header
4. Gibt es inkonsistente Zustände?
5. Bleiben Menüs nach Umschaltung korrekt positioniert?

---

### E. FARBE-IN-FARBE / KONTRAST / HOVER

Das wurde bisher nicht sauber dokumentiert und muss jetzt gezielt geprüft werden.

Prüfen:

1. Hover auf Zeilen
2. Hover auf Header
3. Hover auf Buttons
4. aktive oder selektierte Zeile
5. Edit-Zeile
6. Popover-Menüs
7. Hell-Modus
8. Dunkel-Modus

Explizit markieren, wenn etwas entsteht wie:

- Text auf fast gleichem Hintergrund
- Icons kaum sichtbar
- Buttons optisch verschwinden
- Fokus oder Hover nur schwer erkennbar

---

### F. OVERFLOW / CONTAINMENT / LAYOUT

Prüfen:

1. Bläht die Tabelle die Seite horizontal auf?
2. Sitzen Row-Actions wieder absurd weit rechts?
3. Funktioniert horizontales Scrollen kontrolliert?
4. Bleiben Menüs innerhalb des sinnvollen UI-Kontexts?
5. Verhalten bei kleinem oder großem Fenster

---

## SCREENSHOT-PFLICHT

Erzeuge Screenshots für:

1. Header-⋯ geöffnet
2. Zeilen-⋯ geöffnet
3. Rechtsklick auf Zeile
4. Inline-Edit offen
5. Hell-Modus
6. Dunkel-Modus
7. jeden klaren Fehlzustand

---

## AUSGABEFORMAT

Liefere das Ergebnis exakt so:

### 1. NACHGETESTETE_UMSETZUNGSPUNKTE
- was laut 05 getestet wurde

### 2. BESTÄTIGT_FUNKTIONSFÄHIG
- nur was wirklich sauber funktioniert

### 3. TEILWEISE_ODER_UNSAUBER
- was grundsätzlich da ist, aber nicht produktreif wirkt

### 4. KLARE_FEHLER
- präzise Fehlerbilder
- keine Vermutung

### 5. SCREENSHOT-HINWEISE
- welcher Screenshot zeigt was

### 6. GESAMTURTEIL
Wähle genau eins:
- noch nicht sauber
- teilweise sauber
- für nächsten Schritt brauchbar
- produktreif in diesem Bereich

---

## ERGEBNISZIEL

Am Ende muss klar sein:

1. was Codex wirklich erfolgreich behoben hat
2. was in der Doku zu optimistisch beschrieben wurde
3. was im UI weiterhin kaputt oder unsauber ist
4. ob der Bereich wirklich weitergebaut werden kann oder erst nochmal nachgebessert werden muss
