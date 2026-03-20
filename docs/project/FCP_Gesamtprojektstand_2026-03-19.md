# FCP Gesamtprojektstand

Stand: 19.03.2026

## Ziel dieses Dokuments

Dieses Dokument beschreibt den aktuellen Stand des Fishing-Club-Portals in einer Form, die fuer Marketing, Design, Rechtsabteilung und CTO gleichermassen nutzbar ist.

Es geht nicht um Wunschbild oder Roadmap, sondern um den belastbaren Projektstand im Repo am heutigen Tag.

Wichtig fuer alle Leser:

- Der hier beschriebene Stand ist der technische und inhaltliche Projektstand.
- Nicht jede vorhandene Funktion ist automatisch bereits in jeder Zielumgebung live verifiziert.
- Rechtliche Texte und AVV-Logik sind technisch vorbereitet, ersetzen aber keine juristische Endfreigabe.

## 1. Executive Summary

Das Fishing-Club-Portal ist im aktuellen Stand kein reines Website-Projekt und auch keine isolierte Mitgliederverwaltung. Es ist eine digitale Vereinsplattform mit zwei klaren Ebenen:

- oeffentliche Website fuer Information, Vertrauen, Kontakt und Einstieg
- geschuetztes Portal fuer Mitglieder, Verwaltung, Vorstand und Betreiber

Die Plattform verbindet bereits mehrere reale Vereinsprozesse in einem System:

- Login, Registrierung, Invite und kontrollierter Zugang
- Vereins- und Nutzer-Onboarding
- Mitglieder- und Rollenverwaltung
- Dokumente und Downloads
- Termine, Arbeitseinsaetze und Eventplaner
- Fangliste und Gewaesserkontext
- Ausweis und Verifikation
- Governance-, Admin- und Support-Bereiche
- PWA-, Offline- und Push-Basis

Die strategische Aussage ist damit klar:

Das Produkt adressiert den operativen Vereinsalltag, nicht nur die Praesentation nach aussen.

## 2. Produktbild

### 2.1 Oeffentliche Ebene

Die oeffentliche Ebene dient aktuell fuer:

- Markenauftritt
- Produkt- und Vereinskommunikation
- Vertrauen und Information
- Downloads und Kontakt
- Einstieg in Login und Registrierung
- rechtliche Transparenz

Relevante oeffentliche Seiten:

- `/`
- `/kontakt.html/`
- `/downloads.html/`
- `/termine.html/`
- `/veranstaltungen.html/`
- `/mitglied-werden.html/`
- `/login/`
- `/registrieren/`
- `/datenschutz.html/`
- `/nutzungsbedingungen.html/`
- `/impressum.html/`
- `/avv.html/`

### 2.2 Geschuetzte Portalebene

Die Portalebene ist rollen- und clubbezogen aufgebaut. Sie richtet sich je nach Berechtigung an:

- Mitglieder
- Vorstand
- Verwaltung
- Club-Admins
- Plattform-Admins

Die Kernlogik des Produkts liegt in dieser Ebene.

## 3. Aktuelle Funktionsbereiche

### 3.1 Zugang, Auth und Rechtliches

Vorhanden:

- Login
- Passwort vergessen
- Passwort aendern
- Auth Callback
- Invite- und Claim-Logik
- rechtliche Bestaetigungsseite
- Zugangs- und Identitaetspruefung

Relevante Seiten:

- `/login/`
- `/passwort-vergessen/`
- `/app/passwort-aendern/`
- `/auth/callback/`
- `/app/rechtliches-bestaetigen/`
- `/app/zugang-pruefen/`

Einordnung:

Die Zugangsstrecke ist nicht nur kosmetisch vorhanden, sondern Teil des kontrollierten Produktzugangs.

### 3.2 Vereinsstart und Plattformsteuerung

Vorhanden:

- Registrierung neuer Vereine
- Onboarding-Basis fuer Club-Anlage und Setup
- zentrale Admin-Flaeche fuer Onboarding, Auth und Governance

Relevante Seiten:

- `/registrieren/`
- `/app/admin-panel/`
- `/app/vereine/`

Einordnung:

Das ist bereits mehr als ein einfacher Registrierungsdialog. Der Bestand zeigt klar die Richtung eines kontrollierten Multi-Tenant-Onboardings.

### 3.3 Mitglieder, Rollen und Ausweise

Vorhanden:

- Mitgliederverwaltung
- Mitglieder-Registry
- Rollen- und ACL-Basis
- Ausweislifecycle und Verifikation

Relevante Seiten:

- `/app/mitglieder/`
- `/app/mitgliederverwaltung/`
- `/app/ausweis/`
- `/app/ausweis/verifizieren/`

Einordnung:

Dieser Bereich ist fuer die Plattform zentral, weil er den Zugang zu weiteren Modulen fachlich und technisch absichert.

### 3.4 Termine, Arbeitseinsaetze und Eventplaner

Vorhanden:

- klassische Terminverwaltung
- Arbeitseinsaetze
- Eventplaner als Erweiterungsschicht
- Freigabe- und Helferpfade
- Mitgliederansicht fuer planbare Events

Relevante Seiten:

- `/app/termine/cockpit/`
- `/app/arbeitseinsaetze/`
- `/app/arbeitseinsaetze/cockpit/`
- `/app/eventplaner/`
- `/app/eventplaner/mitmachen/`

Einordnung:

Der Eventplaner ist aktuell eines der klarsten Produktmerkmale. Er zeigt den Uebergang von einzelnen Modulen hin zu echter operativer Prozesslogik.

### 3.5 Dokumente, Downloads und Inhalte

Vorhanden:

- oeffentliche Downloads
- interne Dokumentenverwaltung
- feed- und inhaltsnahe Strukturen

Relevante Seiten:

- `/downloads.html/`
- `/app/dokumente/`
- `/app/notes/`

Einordnung:

Das Produkt kann damit sowohl offizielle oeffentliche Dokumente als auch interne Dokumentenprozesse abbilden.

### 3.6 Fangliste, Trips und Gewaesser

Vorhanden:

- Fangliste
- Fanglisten-Cockpit
- Gewaesserkarte
- Go-Fishing- und Trip-Logik im JS-Bestand
- Offline- und Sync-Bausteine fuer Fangdaten

Relevante Seiten:

- `/app/fangliste/`
- `/app/fangliste/cockpit/`
- `/app/gewaesserkarte/`

Einordnung:

Dieser Bereich ist fachlich stark differenzierend, weil er klar auf den Vereinskontext und die Domäne einzahlt.

### 3.7 Verwaltung, Governance und Support

Vorhanden:

- Kontrollboard
- Feedback fuer Nutzer
- Feedback-Cockpit
- Zustaendigkeiten
- Lizenzen
- Sitzungen
- Admin- und Governance-Monitoring

Relevante Seiten:

- `/app/kontrollboard/`
- `/app/feedback/`
- `/app/feedback/cockpit/`
- `/app/zustaendigkeiten/`
- `/app/lizenzen/`
- `/app/sitzungen/`

Einordnung:

Der Bestand zeigt, dass das Produkt nicht nur auf Endnutzerfunktionen schaut, sondern auch auf Betrieb, Steuerung und nachvollziehbare Administration.

### 3.8 Designsystem und interne Produktentwicklung

Vorhanden:

- Component Library
- Template Studio
- UI-Demo / Neumorph-Demo

Relevante Seiten:

- `/app/component-library/`
- `/app/template-studio/`
- `/app/ui-neumorph-demo/`

Einordnung:

Das ist fuer die weitere Produktreife wichtig, weil hier die Grundlage fuer konsistente Oberflaechen und schnellere Iteration liegt.

## 4. Moeglichkeiten fuer Nutzer

### 4.1 Oeffentliche Besucher

Koennen aktuell:

- das Produkt und den Verein kennenlernen
- Termine und Inhalte lesen
- Dokumente herunterladen
- Kontakt aufnehmen
- sich einloggen oder registrieren

### 4.2 Mitglieder

Koennen je nach Freigabe und Rolle:

- sich anmelden und das Portal nutzen
- Dokumente einsehen
- Termine und Einsaetze verfolgen
- Eventplaner- und Mitmachpfade nutzen
- Ausweisfunktionen verwenden
- Fanglisten- und Trip-Funktionen nutzen
- Feedback geben

### 4.3 Vorstand, Verwaltung und Club-Admins

Koennen je nach Rolle:

- Mitglieder und Rollen pflegen
- Bewerbungen bearbeiten
- Termine und Arbeitseinsaetze steuern
- Eventplaner und Freigaben verwalten
- Dokumente verwalten
- Vereinssetup und Governance pflegen
- Ausweise und Verifikation steuern

### 4.4 Plattformbetreiber und Plattform-Admins

Koennen:

- Club- und Plattformuebersichten einsehen
- Governance-Health und Issues verfolgen
- Onboarding- und Clubstatus administrieren
- technische, rechtliche und organisatorische Plattformgrundlagen pflegen

## 5. Reifegrad

### 5.1 Bereits deutlich ausgepraegt

- Multi-Tenant- und Club-Denke
- breite Portalstruktur
- Rollen- und Governance-Richtung
- Eventplaner als klares Produktmerkmal
- rechtliche Grundstruktur fuer FCP
- PWA-, Offline- und Push-Basis

### 5.2 Nutzbar, aber noch zu schaerfen

- End-to-End-Verifikation des Onboardings in realen Zielumgebungen
- Reifegrad einzelner Fachmodule
- UI/UX-Konsistenz zwischen den Modulen
- AVV- und Legal-Flow nach echter DB-Migration
- einheitliche visuelle Produktklammer ueber alle Flaechen

### 5.3 Noch kein harter Voll-Go-Live-Nachweis

- juristische Endfreigabe
- vollstaendige operative Verifikation aller neuen Migrationen
- belastbare Live-Nachweise fuer alle Randfaelle im Onboarding

## 6. Einordnung fuer Marketing

Marketing kann heute belastbar sagen:

- Die Plattform verbindet Website, Portal und gefuehrtes Vereins-Onboarding.
- Das Produkt adressiert reale Vereinsprozesse statt nur Contentverwaltung.
- Eventplanung, Mitgliederzugang, Dokumente, Ausweis und operative Verwaltungswege sind Teil eines gemeinsamen Systems.
- Rollen, Clubkontext und Governance sind mitgedacht.

Marketing sollte aktuell noch nicht behaupten:

- alles sei bereits in breiter Flaeche produktiv ausgerollt
- jede Randfunktion sei final ausgereift
- die rechtliche Endfreigabe sei abgeschlossen

Geeignete Kernbotschaft:

"Eine digitale Vereinsplattform fuer den operativen Alltag von Vorstand, Verwaltung und Mitgliedern."

## 7. Einordnung fuer Design

Der Stand ist fuer Design bereits sehr brauchbar, weil die Plattform nicht mehr nur aus Einzelseiten besteht, sondern als System erkennbar ist.

Besonders relevant:

- klare Trennung zwischen oeffentlicher und geschuetzter Ebene
- wiederkehrende Modularten
- Navigations- und Rollenlogik
- Designsystem- und Component-Library-Ansatz
- Bedarf an konsistenten Mustern fuer Listen, Cockpits, Freigaben, Kalender, Rechtliches und Admin-Komplexitaet

## 8. Einordnung fuer Rechtsabteilung

Im Repo vorhanden bzw. umgesetzt:

- FCP-Impressum als statische Seite
- FCP-Datenschutz als statische Seite
- FCP-Nutzungsbedingungen als statische Seite
- FCP-AVV als statische Seite
- differenzierte Rollenlogik Plattform versus Verein in den Texten
- technische Grundlage fuer versionierte Rechtsdokumente und Acceptance-Logging

Wichtig fuer Legal:

- Der AVV-Flow ist technisch vorbereitet, aber die neue DB-Migration muss in der Zielumgebung ausgefuehrt werden.
- Juristische Endpruefung bleibt erforderlich, insbesondere fuer Formulierungen, Unterauftragsverarbeiter, Speicherdauern sowie operative Auskunfts-, Zustell- und Loeschprozesse.

Technisch relevante Datenschutzthemen im aktuellen Stand:

- Push ist technisch vorhanden.
- Consent fuer externe Medien ist vorhanden.
- Karten und externe Inhalte sind vorhanden.
- Klassische Analytics sind aktuell nicht aktiv nachweisbar.
- Newsletter ist aktuell nicht aktiv nachweisbar.

## 9. Einordnung fuer CTO

### 9.1 Architektur

Der aktuelle Stand zeigt eine tragfaehige Richtung:

- Astro-Frontend mit Website- und Portalmodus
- Supabase als zentrale Plattform fuer Auth, Datenbank, RPCs und Policies
- clubbezogene Rollen- und Rechtebasis
- Governance-, Health- und Audit-Denke
- fachlich vorbereitete und teilweise angebundene Onboarding-Architektur

### 9.2 Technische Staerken

- klares Club- und Tenant-Modell
- RLS- und Governance-Denke im Datenmodell
- modulare Portalstruktur
- versionierbare rechtliche Akzeptanzlogik
- FCP-spezifische SEO-, Canonical- und Sitemap-Basis

### 9.3 Technische offene Punkte

- neue Legal- und AVV-Migrationen in Zielumgebungen ausrollen und verifizieren
- Session-Speicherstrategie mittelfristig haerten
- Offline- und Storage-Konzept weiter bereinigen
- End-to-End-Onboarding live pruefen
- Modul-UX, Statusbilder und Fehlermeldungen weiter vereinheitlichen

## 10. Heutige Nachbesserungen

Heute wurden zusaetzlich folgende Punkte verbessert:

- echte FCP-Rechtstext-Seiten auf statischen Produktseiten umgesetzt
- AVV-Seite und versionierte Legal-/Acceptance-Grundlage im Repo angelegt
- FCP-Domain-, Sitemap- und robots-Basis auf FCP gezogen
- automatische Deploy- und Asset-Versionierung fuer Cache-Busting eingefuehrt
- Reload-Loop im lokalen Dev-Betrieb entschaerft
- Cache- und Offline-Haertung verbessert

## 11. Realistische Gesamteinordnung

Das Projekt ist heute klar als Plattformprodukt erkennbar. Es besitzt bereits echte Betriebslogik, Multi-Tenant-Denke und sichtbare Differenzierung gegen einfache Vereinswebsites oder lose Tool-Sammlungen.

Gleichzeitig ist es noch nicht an dem Punkt, an dem man ohne Vorbehalt von vollstaendig finaler juristischer, operativer und gestalterischer Reife sprechen sollte.

Die korrekte Einordnung lautet deshalb:

- deutlich weiter als Prototyp oder Website-Experiment
- belastbar genug fuer interne, vertriebliche und gestalterische Kommunikation
- noch mit klaren Aufgaben vor einem harten, voll belegten Go-Live-Niveau

## 12. Kommunikationsempfehlung

### Gegenueber Marketing

Betonen:

- integrierte Vereinsplattform
- operativer Vereinsalltag statt Tool-Sammlung
- Eventplaner, Mitglieder, Dokumente, Ausweis und Onboarding als zusammenhaengendes System

### Gegenueber Design

Arbeiten mit:

- klaren Rollenbildern
- Verwaltungs- und Planungsoberflaechen
- modularen UI-Mustern
- starker Informationsarchitektur

### Gegenueber Legal

Finalisieren:

- Impressum
- Datenschutz
- Nutzungsbedingungen
- AVV
- Unterauftragsverarbeiter, Speicherdauer und operative Rechtsprozesse

### Gegenueber CTO

Priorisieren:

- Migrationen live verifizieren
- Session- und Storage-Haertung
- End-to-End-Onboarding
- konsolidierte Release- und Betriebsreife

