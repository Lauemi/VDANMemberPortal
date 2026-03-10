# AVV + Controller/Processor Checklist
Stand: 2026-03-10

## Ziel
Diese Checkliste stellt sicher, dass die Rollenaufteilung zwischen Verein (Controller) und Plattformbetrieb (Processor) vertraglich, organisatorisch und technisch konsistent umgesetzt ist.

## 1) Rollenfestlegung
- [ ] Verein als `Verantwortlicher (Controller)` schriftlich festgelegt.
- [ ] Plattformbetrieb als `Auftragsverarbeiter (Processor)` schriftlich festgelegt.
- [ ] Sub-Processor-Liste gepflegt (z. B. Supabase, IONOS, E-Mail-Dienst).
- [ ] Verantwortlichkeiten für Betroffenenanfragen dokumentiert (wer antwortet fachlich, wer unterstützt technisch).

## 2) Vertragsunterlagen
- [ ] AVV/DPA zwischen Verein und Plattformbetrieb abgeschlossen.
- [ ] TOM-Anlage zur AVV beigefügt und versioniert.
- [ ] Vereinbarungen zu Unterauftragsverarbeitern enthalten (inkl. Informationspflichten bei Änderungen).
- [ ] Exit-/Lösch-/Export-Regelungen verbindlich dokumentiert.
- [ ] IP-/Nutzungsrechte konsistent mit Nutzungsbedingungen geregelt.

## 3) Datenschutz-Dokumentation
- [ ] Verzeichnis von Verarbeitungstätigkeiten (VVT) für den Verein aktualisiert.
- [ ] Datenschutzerklärung auf aktuelle Dienstleister und Datenflüsse geprüft.
- [ ] Löschfristen pro Datenkategorie definiert und technisch abbildbar.
- [ ] Verfahren für Auskunft, Berichtigung, Löschung, Export dokumentiert.

## 4) Technische Kontrollen (Multi-Tenant)
- [ ] Mandantentrennung über `club_id` durchgängig umgesetzt.
- [ ] RLS-Policies verhindern Cross-Club-Zugriffe.
- [ ] Club-Auflösung ist deterministisch (kein `member_no + limit 1` ohne Club-Kontext).
- [ ] Security-Logs und Audit-Events sind nachvollziehbar und aufbewahrt.
- [ ] Rollen-/Rechte-Review mindestens quartalsweise durchgeführt.

## 5) Release-Gate (vor Rollout neuer Vereine)
- [ ] AVV + TOM unterschrieben.
- [ ] Sub-Processor-Liste an Verein kommuniziert.
- [ ] Callback-/Redirect-URLs korrekt konfiguriert.
- [ ] Incident-Runbook und Meldeprozess vorhanden.
- [ ] Abnahme durch Vorstand/Datenschutzverantwortliche erfolgt.
