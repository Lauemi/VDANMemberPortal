UI ist:
- kompakt
- professionell
- tabellarisch
- admin-orientiert

Keine Consumer-Wizard UI.

## Operative UI/UX-Regeln

### Grundmodell

Das Onboarding ist nicht als bunter Consumer-Wizard gedacht, sondern als kompaktes Setup-Dashboard mit klaren Pflichtmodulen.

Empfohlenes Modell:
- links oder oben eine feste Fortschrittsnavigation
- in der Mitte modulare Arbeitsflaechen
- jeder Abschnitt hat klaren Status:
  - `offen`
  - `in bearbeitung`
  - `abgeschlossen`
  - `blockiert`

### Pflicht und Optional

Pflichtschritte vor Billing:
- Vereinsdaten
- Gewaesser-Basis
- Karten-Basis
- Mitgliedergrundlage

Optional vor Billing:
- erweiterte Importbereinigung
- Feinschliff von Modulen
- nicht-blockierende Komfortdaten

### Fortschritt und Blocking

- Fortschritt muss jederzeit sichtbar sein.
- Jeder Schritt muss anzeigen, warum er offen oder blockiert ist.
- Der naechste Schritt darf nur freigegeben werden, wenn fachliche Guards erfuellt sind.
- Nutzer duerfen speichern und spaeter zurueckkehren.
- Der Wechsel zu Billing ist blockiert, solange Setup-Pflichtpunkte nicht erfuellt sind.

### Verhalten der Kernoberflaechen

#### Vereinsdaten-Formular

- Zeigt Pflichtfelder deutlich markiert.
- Validiert sofort auf fehlende Mindestangaben.
- Speichert als modulare Einheit, nicht erst am Ende des Gesamtflows.
- Darf unvollstaendig zwischengespeichert werden, aber nicht als abgeschlossen gelten.

#### Gewaesser-Tabelle

- Tabellenorientierte Pflege statt Wizard-Sequenz.
- Mindestens ein aktives Gewaesser ist fuer Abschluss erforderlich.
- Fehlerhafte Zeilen muessen konkret markiert werden.
- Bulk-Erfassung ist erlaubt, aber jede Zeile braucht serverseitige Pruefung.

#### Karten-Matrix

- Muss klar zeigen, welche Karte fuer welche Logik oder Mitgliedsart gilt.
- Eine Default-Kartenlogik muss erkennbar sein.
- Fehlende Zuordnungen muessen als fachlicher Blocking-Fehler erscheinen.

#### Mitgliederboard

- Muss zwischen importierten, gemappten, fehlerhaften und noch ungeklaerten Datensaetzen unterscheiden.
- Teilgueltige Importe duerfen nicht unsichtbar verschwinden.
- Admin braucht Fehlerliste und konkrete Korrekturoptionen.

### Guidance statt Bevormundung

- Das System fuehrt stark bei Pflichtpunkten.
- Es blockiert nur dort, wo die fachliche Integritaet sonst leidet.
- Es erlaubt Parallelitaet bei nicht-blockierenden Arbeiten.
- Es zeigt immer den Grund fuer eine Sperre.

### Multi-Club UX

- Bei `MULTI` ist die Club-Auswahl verpflichtend.
- Es darf keine versteckte implizite Auswahl geben.
- Der aktive Club-Kontext muss in der UI immer sichtbar sein.
