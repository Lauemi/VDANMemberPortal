# Marketing-Paket Gesamt (VDAN / Fishing-Club-Portal)

Stand: 2026-03-09
Inhalt: Produkt-Onepager + Security/DSGVO-Kurzblatt + Demo-Skript in einem Dokument

---

## Teil 1: Produkt-Onepager

### Kurzbeschreibung
VDAN/FCP ist eine digitale Vereinsplattform, die oeffentliche Website und geschuetztes Mitgliederportal in einem System verbindet. Ziel ist ein durchgaengiger, sicherer und mobil nutzbarer Vereinsbetrieb.

### Fuer wen
- Angelvereine und vergleichbare Mitgliedsorganisationen
- Entscheider: Vorstand, Verwaltung, Admins
- Nutzer: Mitglieder und Funktionstraeger

### Kernnutzen
- weniger manueller Verwaltungsaufwand
- klare und nachvollziehbare Vereinsprozesse
- zentrale Daten statt verteilter Inselloesungen
- rollen- und mandantenbasierter Zugriff
- bessere Verbindlichkeit bei Terminen und Einsaetzen

### Abgedeckte Kernprozesse
- Website und oeffentliche Vereinskommunikation
- Login/Portalzugang
- Mitgliederverwaltung und Stammdatenpflege
- Termine/Sitzungen und Arbeitseinsaetze
- Fangliste
- Dokumente
- Ausweis/Verifikation

### Differenzierende Staerken
1. Integrierte Plattform statt Tool-Mix
2. Security-/DSGVO-orientierte Architektur
3. Rollen-/Tenant-Scoping und RLS als technisches Fundament
4. Kontrolliertes Onboarding (Invite/QR)
5. Praxisorientierte Module fuer den Vereinsalltag

### Ergebnis fuer den Verein
- strukturierter digitaler Betrieb
- klarere Verantwortlichkeiten
- bessere Datenqualitaet
- geringere Reibung zwischen Vorstand, Verwaltung und Mitgliedern

### Next Step fuer Interessenten
- 30-Minuten-Vorstandsdemo
- 45-Minuten-Admin-/Prozessdemo
- Pilotverein mit klaren Erfolgskriterien

---

## Teil 2: Security- und DSGVO-Kurzblatt (Vertrieb)

### Security-Basis (technisch)
- Rollen- und mandantenbasierte Zugriffslogik
- Row Level Security (RLS) auf relevanten Tabellen
- Security-Hardening und Release-Gates dokumentiert
- kontrollierte Auth- und Onboarding-Flows (inkl. Invite/QR)
- Security-Audit und Follow-up-Fixes im Projektprozess verankert

### DSGVO-Basis (technisch-organisatorisch)
- Datenverarbeitung entlang definierter Vereinszwecke
- Zugriffsbeschraenkung ueber Rollen-/Mandantenkontext
- Trennung von Plattform- und Vereinskontext
- technische Nachvollziehbarkeit durch Audit-/Dokupfade
- Datenschutzseiten und technische Datenschutzdokumente vorhanden

### Was wir aktiv sagen koennen
- "Die Plattform ist Security- und DSGVO-orientiert konzipiert und umgesetzt."
- "Zugriffe werden rollen- und mandantenbasiert kontrolliert."
- "Es existieren dokumentierte Sicherheits- und Datenschutz-Checks."

### Was wir nicht versprechen
- keine absoluten Sicherheitszusagen (z. B. "100% sicher")
- keine Rechtsberatung
- keine pauschalen Aussagen ohne juristische Endfreigabe der finalen Rechtstexte

### Typische Einwaende
Einwand: "Datenschutz ist bei Vereinssoftware kritisch."
Antwort: "Genau deshalb arbeiten wir mit rollen-/tenant-spezifischem Zugriff, RLS und dokumentierten Security-/DSGVO-Baselines."

Einwand: "Wer sieht welche Daten?"
Antwort: "Die Plattform ist rollenbasiert aufgebaut, und Datenzugriffe sind je Mandant/Club eingeschraenkt."

### Vertriebs-Checkliste vor externem Versand
1. Aktuellen Security-Status aus den Projektdokumenten gegenpruefen.
2. Keine nicht-freigegebenen Roadmap-Features kommunizieren.
3. Rechts-/Datenschutzhinweis im Angebot/Deckblatt fuehren.

---

## Teil 3: Demo-Skript (30/45 Minuten)

### Ziel der Demo
- Nutzen im Vereinsalltag sichtbar machen
- Vertrauen in Sicherheit/Struktur erzeugen
- naechsten Schritt (Pilot) vorbereiten

### Variante A: 30 Minuten (Vorstand)
#### Agenda
1. Ausgangslage und Problem (3 Min)
2. Plattformueberblick Website + Portal (5 Min)
3. Drei Kern-Use-Cases (15 Min)
4. Security/DSGVO-Kurzblick (4 Min)
5. Naechste Schritte/Pilot (3 Min)

#### Fokusbotschaft
"Weniger Verwaltungsaufwand, klare Prozesse, ein System fuer den gesamten Vereinsbetrieb."

#### Drei Kern-Use-Cases
1. Termin- und Einsatzorganisation
- Termin anlegen, Status sehen, Beteiligung nachvollziehen

2. Mitglieder- und Kontothematik
- Rollen-/Portalzugang, Account-/Stammdatenbezug, klare Verantwortung

3. Operative Vereinsarbeit
- Fangliste, Dokumente, Ausweis/Verifikation als zusammenhaengender Ablauf

### Variante B: 45 Minuten (Admin/Verwaltung)
#### Agenda
1. Kurzintro und Zielbild (5 Min)
2. Live-Flow Login -> Portal -> Module (10 Min)
3. Admin-/Pflegepfade im Detail (15 Min)
4. Security-/Rollen-/Tenant-Konzept (10 Min)
5. Cutover/Pilotvorgehen (5 Min)

#### Deep-Dive Punkte
- Portalnavigation und Modul-Logik
- Mitgliederverwaltung vs. Rollenverwaltung
- kontrolliertes Onboarding (Invite/QR)
- Dokumentation/Auditfaehigkeit

### Demo-Regeln
- keine unreifen Features als "fertig" verkaufen
- keine absoluten Sicherheitsversprechen
- bei Rechtsfragen auf juristische Endfreigabe verweisen

### Discovery-Fragen (vor/waehrend der Demo)
1. Welche 3 Prozesse kosten aktuell am meisten Zeit?
2. Wo treten Medienbrueche auf?
3. Wer braucht welche Zugriffe im Verein?
4. Was waere in 60 Tagen ein messbarer Erfolg?

### Erfolgsmetriken fuer Pilotverein
- aktive Nutzerquote im Portal
- Anzahl digital abgewickelter Kernprozesse
- Zeitersparnis in Verwaltung/Vorstand
- Reduktion von Rueckfragen/Abstimmungschaos

### Abschlussformel
"Wenn wir in 60 Tagen Ihre drei wichtigsten Verwaltungsprozesse messbar vereinfachen, ist der Pilot erfolgreich."

### Follow-up nach Demo (innerhalb 24h)
1. Zusammenfassung mit identifizierten Pain Points
2. Vorschlag Pilotumfang (Scope + Zeitplan)
3. Verantwortlichkeiten und naechster Termin

---

## Referenzen intern
- docs/marketing/MARKETING_STRATEGIE_MARKTSTAERKEN_VDAN_FCP_2026-03-09.md
- docs/anwendungsdokumentation_gesamtstand_2026-03-08.md
- docs/project/PROJECT_BRIEF_PACKAGE_VDAN_2026-02-26.md
- docs/security-audit-2026-03-07.md
- docs/security-dsgvo-checklist.md
