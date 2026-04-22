# 09_CODEX_Fixauftrag-inline-data-table-v1

Version: v1
Stand: 2026-04-22
Status: offen
Projekt: `Lauemi/VDANMemberPortal`
Bezug:
- `docs/Smoke-Tests/inline-data-table/07_SMOKETEST_Ergebnis-inline-data-table-v1.md`
- `docs/Smoke-Tests/inline-data-table/08_SMOKETEST_Ableitung-inline-data-table-v1.md`
- `docs/Smoke-Tests/inline-data-table/05_SMOKETEST_Umsetzung-inline-data-table-v1.md`

---

## AUFGABE

Du bist Codex als technischer Umsetzungsagent.

Deine Aufgabe ist es, die nach dem gezielten Nachtest weiterhin offenen Produktfehler der Inline-Data-Table v2 im Bereich Mitgliederverwaltung repo-wahr zu beheben.

WICHTIG:
- keine neue Tabellenarchitektur bauen
- keine Parallel-Komponente einführen
- keine UI-Neuerfindung
- keine Vermischung mit Eventplaner oder anderen Tabellen
- nur die bestehende produktive Inline-Data-Table v2 gezielt nachschärfen

Repo ist Wahrheit.

---

## PFLICHTDATEIEN ZUERST LESEN

1. `docs/Smoke-Tests/inline-data-table/07_SMOKETEST_Ergebnis-inline-data-table-v1.md`
2. `docs/Smoke-Tests/inline-data-table/08_SMOKETEST_Ableitung-inline-data-table-v1.md`
3. `docs/Smoke-Tests/inline-data-table/05_SMOKETEST_Umsetzung-inline-data-table-v1.md`
4. `public/js/fcp-inline-data-table-v2.js`
5. `public/js/redesign.js`
6. `public/css/redesign.css`
7. `public/js/member-registry-admin.js`

---

## AUSGANGSLAGE

Laut `07_SMOKETEST_Ergebnis-inline-data-table-v1.md` wurden reale Teilfortschritte bestätigt:

- Overflow/Containment funktioniert
- RowClick öffnet Inline-Edit korrekt
- Abbrechen funktioniert
- Custom-Rechtsklick-Handler ist vorhanden

Aber die Fläche ist weiterhin **nicht sauber**.

Der gezielte Nachtest bestätigt folgende offene Kernprobleme:

1. `rd-popover` ist weiterhin falsch positioniert und landet mit `position: static` im normalen DOM-Fluss am Seitenende.
2. Der Hell/Dunkel-Schalter ändert zwar das Attribut, hat aber keine sichtbare CSS-Wirkung.
3. ESC und Klick-außen schließen den offenen Editor nicht.
4. Row-Actions sind in voller Spaltenansicht weiterhin außerhalb des Viewports.
5. Hover-Kontrast der Datenzeilen ist zu schwach (helle Schrift auf hellem Hover-Hintergrund).

---

## ZIEL

Die produktive Inline-Data-Table v2 soll nach diesem Fixstand in den offenen Kernpunkten real verbessert werden.

Wichtig:
Nicht „irgendwie vorhanden“, sondern produktreif im Verhalten der betroffenen Punkte.

---

## KONKRETE FIXAUFGABEN

### 1. Popover-Verankerung real reparieren

Behebe den weiterhin offenen Primärfehler:

- Header-Menü darf nicht am Seitenende landen
- Zeilen-Menü darf nicht am Seitenende landen
- Rechtsklick-Menü darf nicht am Seitenende landen
- `rd-popover` darf nicht effektiv als `position: static` im Dokumentfluss enden

Zielzustand:
- Header-⋯ öffnet lokal am Header-Trigger
- Zeilen-⋯ öffnet lokal an der Zeile
- Rechtsklick-Menüs öffnen lokal am Klickpunkt oder stabil am sinnvollen Trigger
- Menü bleibt sichtbar und korrekt verankert bei Scroll, Footer-Nähe und Container-Kontext

### 2. Hell/Dunkel-Schalter wirklich wirksam machen

Der lokale Theme-Schalter ist aktuell funktional nur als Attributwechsel sichtbar, nicht als echte UI-Änderung.

Zielzustand:
- sichtbarer Unterschied zwischen Hell und Dunkel
- Header, Zeilen, Menüs, Buttons, Hover-Zustände und Editor reagieren visuell konsistent
- keine Attrappen-Umschaltung

Falls die CSS-Wirkung aktuell nicht sauber hergestellt werden kann, ist ein sauberer Rückbau besser als ein scheinbar vorhandener, aber toter Schalter.

### 3. Editor-Dismiss vervollständigen

Aktuell funktioniert nur der Abbrechen-Button.

Zielzustand:
- ESC schließt den offenen Editor sauber
- Klick außerhalb schließt den Editor definiert und ohne Seiteneffekte
- kein unbeabsichtigtes Schließen bei legitimer Interaktion innerhalb des Editors

### 4. Row-Actions stabil im sichtbaren Bereich halten

In voller Spaltenansicht liegen Row-Actions weiterhin außerhalb des Viewports.

Zielzustand:
- Action-Buttons bleiben auch in breiten Tabellen erreichbar
- keine absurden Left-Werte außerhalb des sichtbaren Nutzbereichs
- keine Kollision mit Editor oder Menüs

### 5. Hover-Kontrast lesbar machen

Der Nachtest bestätigt unzureichenden Kontrast bei Hover-Zuständen.

Zielzustand:
- Text bleibt bei Hover klar lesbar
- keine hell-auf-hell oder dunkel-auf-dunkel-Probleme
- Fokus-/Hover-/aktive Zustände optisch erkennbar und produktiv nutzbar

---

## ARBEITSREGELN

- repo-wahr arbeiten
- vorhandene produktive Struktur reparieren, nicht ersetzen
- keine zusätzliche experimentelle Theme-Logik einführen
- keine neue Menükomponente einführen, wenn der vorhandene Popover-Pfad reparierbar ist
- keine kosmetische Scheinlösung, wenn die Kernursache offen bleibt

---

## ERWARTETES ERGEBNIS

Nach diesem Fixauftrag muss ein erneuter Nachtest mindestens belastbar prüfen können:

1. Header-Menü sitzt lokal am Trigger
2. Zeilen-Menü sitzt lokal an Zeile/Klickpunkt
3. Hell/Dunkel zeigt sichtbare Unterschiede
4. ESC und Klick-außen schließen den Editor
5. Row-Actions bleiben im sichtbaren Bereich
6. Hover-Kontrast ist lesbar

---

## UMSETZUNGSDOKU

Lege die umgesetzten Änderungen danach in dieser Datei ab:

`docs/Smoke-Tests/inline-data-table/10_SMOKETEST_Umsetzung-inline-data-table-v1.md`

Mit mindestens:
- relevante Commits
- konkret umgesetzte Punkte
- was real behoben werden sollte
- was bewusst noch offen blieb, falls etwas nicht abgeschlossen werden konnte
