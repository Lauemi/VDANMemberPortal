# Decisions

## Vorlage

### DEC-XXX - Kurztitel

- Datum: YYYY-MM-DD
- Status: proposed / accepted / superseded
- Kontext: Warum die Entscheidung noetig ist
- Entscheidung: Was gilt
- Auswirkung: Was dadurch einfacher, haerter oder ausgeschlossen wird

## Offene Entscheidungsfelder

### DEC-001 - Mitglieder-Registry Strategie

- Datum: 2026-03-13
- Status: proposed
- Kontext: Das Vereins-Board zeigt mehrere fehlende Teilbereiche.
- Entscheidung: Noch offen. Entweder Bereich fuer Bereich produktiv bauen oder fehlende Menues vorerst ausblenden.
- Auswirkung: Bestimmt Umfang und Reihenfolge der Admin-Umsetzung.

### DEC-002 - Admin-Board Platzhalter

- Datum: 2026-03-13
- Status: proposed
- Kontext: Bugs, Finanzen, DSGVO und Security sind sichtbar, aber nicht gebaut.
- Entscheidung: Noch offen. Entweder echte Minimalversion bauen oder aus Navigation entfernen, bis Backend/Prozess dafuer steht.
- Auswirkung: Reduziert Fehlleitung im UI und schaerft den echten MVP.

### DEC-003 - Auth/Identity Cutover

- Datum: 2026-03-13
- Status: proposed
- Kontext: Account-RPC und Identitaetspruefung haben noch Preview-/Fallback-Charakter.
- Entscheidung: Noch offen. Finalen Gate-Zustand, Reset-Strategie und Rollout-Reihenfolge festlegen.
- Auswirkung: Schaltet Auth von Pilot auf belastbaren Betrieb.

### DEC-004 - Doppelter Audit je Maske

- Datum: 2026-03-13
- Status: accepted
- Kontext: Reine Workflow-Pruefung reicht nicht; fuer Wartbarkeit und Standardisierung muss jede Maske auch komponentenseitig geprueft werden.
- Entscheidung: Jede kuenftige Maskenpruefung besteht aus zwei Kanaelen:
  - Workflow-Audit
  - Komponenten-Audit gegen die kanonische Standardbibliothek
- Auswirkung: Umbauentscheidungen basieren kuenftig nicht nur auf Fachlogik, sondern auch auf Standard-Match, Abweichung und Spezialkomponenten-Entscheidung.

### DEC-005 - Studio-Sync fuer Standard-Matches

- Datum: 2026-03-13
- Status: accepted
- Kontext: Ein Audit ist wertlos, wenn reale Fundstelle, Studio-Erkennung und Komponentenklassifikation unterschiedliche Aussagen treffen.
- Entscheidung: Jeder akzeptierte Standard-Match wird direkt an der Fundstelle mit Studio-Attributen markiert. Ein `standard` ohne `data-studio-library-id` gilt kuenftig als unvollstaendig.
- Auswirkung: Komponenten-Audit, Studio und reale Maske bleiben synchron und pruefbar.

### DEC-006 - FCP Preisreferenz und Einstiegsmodell

- Datum: 2026-03-21
- Status: accepted
- Kontext: Fuer Landingpages, Flyer, Vertrieb und Onboarding fehlte bisher ein verbindlicher Preis- und Funnel-Referenzstand. Dadurch bestand das Risiko, dass Preislogik, Vertragsmodell oder Einstiegsangebot zwischen Dokumenten auseinanderlaufen.
- Entscheidung: Fuer das Fishing Club Portal gilt ab sofort als Referenzmodell:
  - 2 EUR pro Mitglied pro Jahr
  - lineares Modell ohne Preisstaffeln
  - Jahresvertrag als Standard
  - 3 Monate kostenlos testen als Einstiegsmodell
  - kuenftige Rabatte, Add-ons, Premium- oder Verbandsmodelle muessen sich gegen diese Baseline vergleichen lassen
- Auswirkung: Marketing, Vertrieb, Landingpages und Onboarding arbeiten kuenftig mit derselben Preisbasis. Zufallsabweichungen und entwertende Preisexperimente sind ausgeschlossen, solange keine neue Grundsatzentscheidung getroffen wird.

### DEC-007 - DB-Driven Runtime nur innerhalb harter Guard-Grenzen

- Datum: 2026-03-21
- Status: accepted
- Kontext: FCP und VDAN sollen mittelfristig staerker aus der DB steuerbar werden, etwa fuer App-Masken, Module, Theme-Tokens und spaetere Template-Definitionen. Gleichzeitig duerfen die harte Trennung von VDAN/FCP, Sicherheitsgrenzen und rechtliche Kernpfade nicht konfigurierbar weich werden.
- Entscheidung:
  - Die Software folgt kuenftig einem Drei-Ebenen-Modell:
    - `Deploy Guard Layer`
    - `Runtime Config Layer`
    - `Template Content Layer`
  - Die Override-Reihenfolge ist verbindlich:
    - `global -> site_mode -> club -> finaler guard filter`
  - Guard-Regeln bleiben im Code und in Policies und duerfen nicht aus der DB ueberschrieben werden.
  - Runtime-Keys werden namespaced gefuehrt, z. B. `branding.app_mask_matrix`, `modules.visibility`, `branding.theme_tokens`.
  - Routenbindungen laufen nur ueber kanonische `route_key`-Definitionen.
  - Templates werden nur als validierte JSON-Strukturen aus freigegebenen Komponenten gerendert, nicht als freies HTML.
  - Runtime-Aenderungen und Freigaben muessen versioniert, auditierbar und rollback-faehig sein.
- Auswirkung:
  - Das System kann spaeter kontrolliert DB-driven wachsen, ohne Deploy-, Marken- und Sicherheitsgrenzen zu verlieren.
  - App-Masken und Theme-Tokens koennen dynamischer werden.
  - Statische VDAN-Spezialseiten, rechtliche Kernrouten und Tenant-/Rechte-Enforcement bleiben harte Systemgrenzen.
