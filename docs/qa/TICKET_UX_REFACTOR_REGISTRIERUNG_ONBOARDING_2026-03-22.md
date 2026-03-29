# Ticket: UX-Refactor Registrierung / Onboarding

Stand: 2026-03-22
Status: offen
Typ: UX / Flow / UI-Struktur

## Titel

Registrieren / Onboarding von gestapeltem Systemformular zu klarem, geführtem Einstieg umbauen

## Ziel

Der Screen `/registrieren/` soll von einer mehrschichtigen Systemmaske zu einem klar geführten Einstieg umgebaut werden.

Zielzustand:

> Ein neuer Nutzer versteht innerhalb von 2-3 Sekunden, was er hier tun soll,
> und kann ohne Nachdenken den nächsten Schritt ausführen.

## Problem (Ist-Zustand)

Die aktuelle Maske zeigt gleichzeitig mehrere Prozesse und Zustände:

- Intro / Onboarding
- `COMING SOON`
- Security-Hinweise
- Auth-Daten
- Moduswahl `Join / Create`
- aktiver Join-Flow
- sichtbarer, aber nicht nutzbarer Create-Flow
- Rechtstexte
- mehrere Abschlussaktionen

Ergebnis:

- kein klarer Einstieg
- keine klare Hauptaktion
- kognitive Überlastung
- widersprüchliche Signale (`Jetzt loslegen` vs. `Coming soon`)
- Flow wirkt wie technisches Systemformular statt geführter Strecke

## Scope

Dieser Task umfasst:

- nur den Screen `/registrieren/`
- keine Backend-Logikänderungen
- keine vollständige Neuentwicklung aller Flows

Fokus:

- UX
- Flow-Struktur
- visuelle Priorisierung

## Do

### 1. Hero bereinigen

- `COMING SOON` aus dem Hero entfernen
- Intro-Text auf 1-2 klare Sätze reduzieren
- Fokus: Was kann der Nutzer jetzt tun?

### 2. Security-Baseline zurücknehmen

- kein eigener prominenter Block mehr
- als sekundärer Hinweis:
  - kleiner Text
  - oder Inline unter Feldern
- darf nicht visuell mit Hauptaktion konkurrieren

### 3. Join / Create entkoppeln

- Join und Create nicht mehr gleichzeitig als gleichwertige Hauptoptionen anzeigen
- aktueller Zustand:

```text
Join sichtbar + aktiv
Create sichtbar + halb gesperrt
```

Das wird entfernt.

### 4. Öffentlichen Flow fokussieren

Da aktuell öffentlich nur Join sinnvoll nutzbar ist:

Der Screen wird auf Beitritt per Invite-Flow reduziert.

Flow:

1. Auth-Daten
2. Invite-Daten
3. Zustimmung
4. Konto anlegen

### 5. Vereinsanlage aus Primärflow entfernen

`Neuen Verein anlegen`:

- nicht mehr als Card im Hauptflow
- optional:
  - als sekundärer Link
  - oder komplett entfernen, je nach Freigabe

### 6. Eine Hauptaktion definieren

- genau ein Primärbutton:
  - `Konto anlegen`
- sekundäre Aktion:
  - visuell klar schwächer
  - keine Konkurrenz auf Augenhöhe

### 7. Vertikale Dichte auf Desktop erhöhen

Aktuell entsteht zu viel Abstand durch:

- Card-Padding
- Step-Padding
- Grid-Gap
- Label-Spacing

Anpassung:

- Abstände reduzieren
- Step-Container kompakter
- weniger `Card in Card`-Effekt

Ziel:

> weniger Scrollen, mehr direkte Interaktion

### 8. Step-System bereinigen

Aktuell:

- nummerierte Steps
- aber alles gleichzeitig sichtbar

Anpassung:

- entweder Step-Logik entfernen
- oder echte Step-Führung implementieren

Für dieses Ticket:

- Step-Optik reduzieren oder entschärfen
- keine vollständige neue Step-Engine bauen

### 9. Farb- und Fokuslogik schärfen

- Orange/Gold nur für:
  - aktive Auswahl
  - Hauptaktion
- sekundäre Blöcke visuell ruhiger
- keine gleich starke Hervorhebung mehrerer Bereiche

## Don't

- kein Redesign der gesamten App
- keine neuen Komponenten bauen, wenn nicht nötig
- keine zusätzlichen Features einbauen
- keine parallele Umsetzung des Create-Flows in diesem Ticket
- keine Geschmacksdiskussion statt Flow-Arbeit

Fokus bleibt:

- Flow
- Priorisierung
- Klarheit

## Akzeptanzkriterien

Der Screen gilt als erfolgreich umgesetzt, wenn:

1. Der Nutzer versteht innerhalb von 2-3 Sekunden:
   - `Ich kann hier einem Verein beitreten`
2. Es gibt genau eine klare Hauptaktion.
3. Es gibt keine widersprüchlichen Signale mehr:
   - kein `Coming soon` im Einstieg
   - kein halb sichtbarer Create-Flow
4. Die Maske wirkt:
   - kürzer
   - ruhiger
   - fokussierter
5. Der Nutzer kann:
   - ohne Scroll-Marathon
   - direkt Daten eingeben und abschließen

## Definition of Done (UX)

Der Screen fühlt sich nicht mehr an wie:

> Ich muss erstmal alles verstehen

sondern wie:

> Ich mache jetzt genau diesen einen Schritt

## Follow-up (nicht Teil dieses Tickets)

- eigener Flow `Verein erstellen`
- mögliche echte Step-Logik
- weitere Screens:
  - Login
  - Setup
  - Tabellen

## Einordnung

Das ist kein Design-Ticket im Sinne von reiner Optik.

Das ist ein:

> Struktur- und Fokus-Ticket

Wenn das sauber umgesetzt ist, entsteht daraus der erste wirklich produktreife Einstiegsscreen fuer den öffentlichen Beitritts-Flow.

