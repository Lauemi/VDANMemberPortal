# FCP AVV Status

Stand: 20.03.2026

## Kurzfazit

Der AVV-Prozess fuer das Fishing-Club-Portal ist inhaltlich und technisch weit vorbereitet.

Aktuell gilt:

- der AVV-Text liegt als eigenes FCP-Dokument vor
- ein versionierter Snapshot ist vorhanden
- ein digitaler Acceptance-Flow fuer Vereine ist implementiert
- die revisionsnahe Speicherung ist in der Datenbankmigration vorgesehen

Was noch vom Repo-Stand zur rechtlich belastbaren Live-Nutzung fehlt:

- die neue Legal-/AVV-Migration muss in der Zielumgebung ausgefuehrt werden
- der produktive Onboarding- bzw. Freigabeprozess muss diesen Flow tatsaechlich verwenden
- Unterauftragsverarbeiter und ggf. Anlagen sollten final geprueft und benannt werden

## 1. Was Bereits Als Vertragsgrundlage Vorliegt

### 1.1 Oeffentlicher AVV-Text

Der AVV ist als statische FCP-Seite vorhanden:

- `src/pages/avv.html.astro`

Die Seite beschreibt:

- Vertragsparteien
- Gegenstand und Dauer
- Art und Zweck der Verarbeitung
- Kategorien betroffener Personen
- Kategorien personenbezogener Daten
- Weisungsgebundenheit
- Vertraulichkeit
- technische und organisatorische Massnahmen
- Unterauftragsverarbeiter
- Unterstuetzung des Verantwortlichen
- Rueckgabe und Loeschung
- Nachweise und Kontrollen

### 1.2 Versionierter Dokument-Snapshot

Der AVV liegt zusaetzlich als versionierte Dokumentdatei vor:

- `docs/legal/fcp-avv-v2026-03-19-v1.md`

Das ist wichtig, weil damit nicht nur ein "aktueller Webtext", sondern eine konkrete AVV-Version mit festem Stand existiert.

### 1.3 Rollen- und Betriebsmodell

Die fachliche Einordnung ist intern dokumentiert in:

- `docs/legal/fcp-avv-betriebsmodell.md`

Dort ist sauber beschrieben:

- Verein = Verantwortlicher fuer vereinsbezogene Datenverarbeitung
- Fishing-Club-Portal / Michael Lauenroth = Auftragsverarbeiter fuer die technische Mandantenverarbeitung
- bestimmte eigene Plattformverarbeitungen bleiben beim Betreiber in eigener Verantwortlichkeit

## 2. Was Technisch Bereits Umgesetzt Ist

### 2.1 Versionierte Rechtsdokumente

Die Migration

- `supabase/migrations/20260319143000_legal_documents_and_avv_acceptance.sql`

legt eine Tabelle `legal_documents` an.

Darueber werden dokumentiert:

- `document_key`
- `applies_to`
- `version`
- `title`
- `document_url`
- `snapshot_path`
- `snapshot_sha256`
- `is_active`

Fuer den AVV ist bereits eingetragen:

- `document_key = 'avv'`
- `applies_to = 'club'`
- `version = '2026-03-19-v1'`
- `document_url = '/avv.html/'`
- `snapshot_path = 'docs/legal/fcp-avv-v2026-03-19-v1.md'`

### 2.2 Acceptance-Events

Die gleiche Migration legt `legal_acceptance_events` an.

Dort koennen fuer den AVV gespeichert werden:

- welche AVV-Version akzeptiert wurde
- welcher Verein betroffen ist (`club_id`)
- welcher Benutzer die Annahme vorgenommen hat (`accepted_by_user_id`)
- wann akzeptiert wurde (`accepted_at`)
- mit welchem User-Agent die Annahme erfolgte
- Name des Unterzeichners
- Funktion im Verein
- E-Mail des Unterzeichners
- bestaetigte Vertretungs- oder Bevollmaechtigungsrolle (`authority_confirmed`)
- Dokument-Hash / Dokumentbezug

### 2.3 AVV nur fuer berechtigte Vereinsrollen

Die RPC `legal_acceptance_state()` sieht den AVV nicht fuer jeden Nutzer vor.

Der AVV wird nur dann als erforderlich markiert, wenn:

- ein `club_id` vorhanden ist
- eine aktive AVV-Version existiert
- der Nutzer im Verein `Admin` oder `Vorstand` ist

Das ist fachlich richtig, weil der AVV nicht von beliebigen Mitgliedern bestaetigt werden soll.

### 2.4 UI-Flow ist vorhanden

Die Annahmeoberflaeche liegt unter:

- `src/pages/app/rechtliches-bestaetigen/index.astro`

Die zugehoerige Laufzeitlogik liegt unter:

- `public/js/legal-acceptance.js`

Fuer den AVV sind dort bereits vorgesehen:

- separate AVV-Checkbox
- Checkbox fuer Vertretungs- oder Bevollmaechtigungsrolle
- Eingabe fuer Vor- und Nachname
- Eingabe fuer Funktion im Verein

## 3. Was Schon Als Vertrag Zaehlt

Nach aktuellem Repo-Stand kann man sagen:

- Der AVV-Text als Vertragsinhalt ist vorhanden.
- Die AVV-Versionierung ist vorhanden.
- Die digitale Annahmelogik ist vorbereitet.

Das bedeutet:

- ihr habt bereits einen AVV als Vertragsdokument
- ihr habt bereits die Struktur fuer digitale Annahme und Nachweisbarkeit

## 4. Was Noch Nicht Als Vollstaendig Live Nachgewiesen Gilt

Nach dem Repo-Stand allein kann nicht sicher bestaetigt werden, dass die Migration bereits in der produktiven Supabase-Zielumgebung ausgefuehrt wurde.

Deshalb gilt aktuell:

- im Repo: AVV-Prozess vorhanden
- live: erst dann voll belastbar, wenn die Migration produktiv ausgerollt ist und echte Annahmen gespeichert werden

## 5. Was Vor Livegang Noch Geprueft Werden Sollte

### 5.1 Datenbank-Rollout

Pruefen:

- ist `20260319143000_legal_documents_and_avv_acceptance.sql` in der Zielumgebung ausgefuehrt?
- sind `legal_documents` und `legal_acceptance_events` produktiv vorhanden?
- liefert `legal_acceptance_state()` fuer FCP die erwarteten Werte?

### 5.2 Produktiver Gate-Flow

Pruefen:

- wird `rechtliches-bestaetigen` im echten Onboarding / Login-Gate erreicht?
- wird der AVV fuer Vorstand / Admin im Verein wirklich erzwungen?
- wird nach Annahme sauber weitergeleitet?

### 5.3 Vertragsanlagen / Unterauftragsverarbeiter

Fuer einen rechtlich robusten Live-Betrieb solltet ihr zusaetzlich final dokumentieren:

- IONOS
- Supabase
- ggf. E-Mail-Dienstleister
- ggf. Vercel oder weitere produktiv eingesetzte Infrastruktur

### 5.4 Exit / Loeschung / Export

Im AVV ist das bereits angeschnitten. Vor finalem Rollout sollte noch entschieden werden, wie konkret ihr folgendes dokumentiert:

- Exportformat bei Vertragsende
- Loeschfristen
- Sperrung vs. Loeschung
- Supportprozess fuer Exit-Anfragen

## 6. Einordnung Fuer Legal Und CTO

### Fuer Legal

Ihr habt nicht nur eine AVV-Idee, sondern:

- einen konkreten Vertragstext
- eine definierte Version
- eine Nachweislogik
- eine Signer-/Befugnis-Abfrage

Die letzte Meile ist jetzt weniger "Text schreiben" und mehr:

- Unterauftragsverarbeiter finalisieren
- Produktiv-Rollout bestaetigen
- Vertragsprozess operationalisieren

### Fuer CTO

Der AVV-Prozess ist architektonisch bereits gut angelegt:

- versionierte Dokumente
- aktive Versionen
- club-spezifische Annahme
- Nachweisfelder fuer Signer und Authority
- RLS / RPC-Grundlage

Der naechste harte Schritt ist kein neues Konzept, sondern:

- produktiver DB-Rollout
- E2E-Test des Flows
- Betriebsfreigabe

## 7. Ampelstatus

- Gruen: AVV-Text als Vertragsdokument vorhanden
- Gruen: Versionierung und Snapshot vorhanden
- Gruen: Club-bezogene AVV-Annahme modelliert
- Gruen: Signer-/Authority-Logging vorgesehen
- Gelb: produktiver DB-Rollout noch zu bestaetigen
- Gelb: Unterauftragsverarbeiter final benennen
- Gelb: Exit-/Loesch-/Exportprozess noch weiter konkretisieren

## 8. Kurzurteil

FCP hat aktuell bereits einen belastbaren AVV-Stand auf Dokument- und Systemebene.

Was noch fehlt, ist vor allem die operative Live-Bestaetigung des bereits gebauten Prozesses, nicht mehr die grundsaetzliche juristische oder technische Struktur.
