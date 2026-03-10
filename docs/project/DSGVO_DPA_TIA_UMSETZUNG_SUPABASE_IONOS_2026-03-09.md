# DSGVO Umsetzungsblatt: DPA/TIA (Supabase + IONOS)

Stand: 2026-03-09  
Status: In Umsetzung (Board-relevant)  
Grundlage:
- `docs/legal/Supabase User DPA (August 5, 2025) (2).pdf`
- `docs/legal/Supabase+TIA+250314.pdf`

Artefakt-Status:
- [x] PDFs liegen im Projekt unter `docs/legal`.
- [ ] Vertragsstatus (signed/active) im Anbieter-Portal final bestaetigen.

## 1) Ziel
Formale und technische DSGVO-Absicherung fuer den Plattformbetrieb im Multi-Tenant-Modell:
- Verein = Verantwortlicher (Controller)
- Plattformbetreiber = Auftragsverarbeiter (Processor)
- Supabase/IONOS = Unterauftragsverarbeiter

## 2) Was konkret abzuschliessen ist
### 2.1 Supabase
1. DPA-Request final abschliessen (offener Vorgang vorhanden).
2. TIA herunterladen und intern archivieren.
3. Dokumentieren:
   - Abschlussdatum
   - verantwortliche Person
   - Ablageort der finalen PDFs

### 2.2 IONOS
1. AVV (Auftragsverarbeitung) pruefen und final abschliessen.
2. Dokumentieren:
   - Vertragsstatus
   - Leistungsbezug (Hosting/Mail)
   - Ablageort

## 3) Pflichtnachweise fuer Board-Freigabe
1. Supabase DPA: `abgeschlossen` (nicht nur `requested`).
2. Supabase TIA: `downloaded + archiviert` (liegt bereits unter `docs/legal`).
3. IONOS AVV: `abgeschlossen`.
4. Datenschutzdokumentation aktualisiert (Controller/Processor/Subprocessor-Kette).

## 4) Technische Umsetzungspflichten aus DPA/TIA-Kontext
1. Verarbeitung nur zweckgebunden und auf Weisung der Vereine.
2. Tenant-Isolation technisch (RLS), nicht nur per UI-Filter.
3. Betroffenenrechte-Prozess in der App/Organisation:
   - Auskunft
   - Berichtigung
   - Loeschung
   - Export
4. Account-Loeschung:
   - personenbezogene Kontodaten entfernen/pseudonymisieren
   - vereinsseitige Fachhistorie erhalten (legitimer Zweck)
5. Join-Verein nur mit bestaetigter E-Mail.
6. Sicherheitsvorfallprozess mit klarer Reaktionskette.

## 5) Datentrennungsregel (verbindlich)
1. Plattform-Identitaetsdaten:
   - Login, Auth, Session, technische Sicherheitsdaten
   - Loeschung bei Account-Delete
2. Vereinsfachdaten:
   - Fangmeldungen, Arbeitsstunden, Rollenverlaeufe, Vorgangshistorie
   - bei Austritt nicht hart loeschen, sondern Membership-Status aendern
3. Austritt:
   - nur den betroffenen Verein auf `left/inactive` setzen
   - andere Vereinszuordnungen bleiben unveraendert

## 6) Sensitive-Data-Guardrail
In Vereinsmodulen keine unnötigen besonderen Kategorien personenbezogener Daten speichern.
Beispiele fuer zu vermeidende Felder/Texte:
- Gesundheits-/medizinische Details
- biometrische oder politische Angaben
- irrelevante sensible Freitexte in Disziplinarvermerken

## 7) Offene Tasks
1. DPA-Signatur-Mail verarbeiten und Abschlussstatus screenshotten.
2. TIA in Compliance-Ordner ablegen.
3. IONOS-AVV Status erfassen.
4. Update in:
   - `docs/security-dsgvo-checklist.md`
   - Board-Protokoll Auth/Tenant P0

## 8) Abnahme (Done-Definition)
Done ist erreicht, wenn:
1. Alle drei Verträge/Nachweise abgeschlossen und dokumentiert sind.
2. Technische Guardrails in P0-Plan verankert sind.
3. Board den Status `compliance-ready for pilot` freigibt.
