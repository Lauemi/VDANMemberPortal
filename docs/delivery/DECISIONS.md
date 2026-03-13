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
