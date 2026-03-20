# FCP Onboarding Implementierungsplan

Stand: 20.03.2026

## Zweck

Dieses Dokument uebersetzt die fachliche Zielrichtung fuer Registrierung, Vereinsbeitritt, Vereinsanlage, Billing-Vorbereitung und rechtliche Gates in einen technischen Umsetzungsrahmen.

Es dient als gemeinsame Arbeitsgrundlage fuer:

- Produkt
- Design
- CTO / Entwicklung
- Legal

Wichtig:

- Dieses Dokument beschreibt das Zielbild fuer den naechsten Entwicklungsschritt.
- Nicht jeder Punkt muss sofort final live gehen.
- Billing / Stripe soll in diesem Schritt vorbereitet, aber noch nicht hart erzwungen werden.

## 1. Zielbild

`/registrieren/` wird von einer einfachen Registrierungsmaske zu einem gefuehrten Onboarding-Flow.

Grundprinzip:

- zuerst nur Auth-Daten
- danach Anmeldeart
- danach fachlicher Prozess
- danach Mailverifikation als echtes Gate
- danach fachliche Bestaetigungen
- erst dann Portalzugang

Es gibt zwei getrennte Wege:

1. Mitglied tritt einem bestehenden Verein bei
2. Nutzer legt einen neuen Verein an

## 2. Sofortige UI-Anpassungen

Diese Punkte koennen kurzfristig direkt umgesetzt werden:

- CTA auf der Startseite von `Verein anfragen` auf `Jetzt Loslegen` aendern
- gut sichtbaren Hinweis `COMING SOON` am Einstiegsbereich platzieren
- Linkziel bleibt `/registrieren/`
- `#headerNotificationToggle` ohne Border und ohne Background darstellen

## 3. Architektur-Grundsatz fuer `/registrieren/`

Die Registrierungsseite wird nicht als einzelne grosse Sammelmaske umgesetzt.

Stattdessen:

- ein mehrstufiger Flow
- klar getrennte Phasen
- Statusmodell im Backend
- Gate-Logik nicht nur im Frontend

Zu trennen sind:

- Auth-Daten
- Vereinszuordnung / Invite
- Mitgliedsdaten-Bestaetigung
- Vereinsanlage
- Verantwortlichenprozess
- Billing / Pending
- Vereinssetup

## 4. Flow A: Bestehendem Verein beitreten

### A1. Phase Auth

Erste Maske nur fuer Auth-Daten:

- E-Mail
- Passwort
- Passwort-Bestaetigung

Nicht in diese Phase:

- Mitgliedsnummer
- Invite
- Vereinsdaten
- IBAN
- Telefon
- Karten

### A2. Phase Anmeldeart

Der Nutzer waehlt:

- `Ich melde mich bei einem bestehenden Verein an`

### A3. Phase Vereinszuordnung

Aktuell:

- Invite-Token / Invite-Link

Vorbereitung fuer spaeter:

- Vereinscode wie `VD01`
- Vereins-QR-Scan

UI-Hinweis:

- Bitte verwenden Sie die E-Mail-Adresse, die Ihrem Verein bereits bekannt ist.

### A4. Phase Mitgliedsnummer

Abfrage:

- Vereins-Mitgliedsnummer

### A5. Phase Rechtstexte

Pflicht:

- Nutzungsbedingungen
- Datenschutz

Optional spaeter erweiterbar:

- weitere vereinsbezogene Erklaerungen

### A6. Phase Mailverifikation

Die E-Mail-Bestaetigung ist ein hartes Gate.

Regel:

- nach der Registrierung wird die Verifikationsmail versendet
- ohne verifizierte E-Mail kein Abschluss des Flows
- kein direkter Portalzugang

### A7. Phase Datenbestaetigung im Vereinskontext

Nach Mailverifikation Weiterleitung auf eine Bestaetigungsmaske fuer die im Verein hinterlegten Daten.

Ziel:

- vorhandene Vereinsdaten pruefen
- fehlende Pflichtdaten ergaenzen
- Daten korrekt bestaetigen

Inhalte:

- Adresse
- Telefon
- IBAN-Kontrolle, falls vorhanden
- Pflichtangabe inkl. SEPA-Mandat oder alternative Zahlungsmethode, falls keine IBAN vorhanden

Nur lesbar, nicht bearbeitbar:

- Angelkarte / Angelkarten

Weitere Bestaetigungen:

- Zustimmung zur Beitragslogik / Vereinsbeitrag
- Bestaetigung der Richtigkeit der Angaben

### A8. Phase Portalfreigabe

Erst wenn alle noetigen Bestaetigungen abgeschlossen sind:

- Portalzugang freigeben

## 5. Flow B: Neuen Verein anlegen

### B1. Phase Auth

Wie in Flow A:

- E-Mail
- Passwort
- Passwort-Bestaetigung

### B2. Phase Anmeldeart

Der Nutzer waehlt:

- `Ich lege einen neuen Verein an`

### B3. Phase Vereinsbasisdaten

Nur rechtlich und organisatorisch fuer FCP relevante Pflichtdaten:

- Vereinsname
- Vereinsanschrift
- verantwortliche Person
- E-Mail-Adresse der verantwortlichen Person
- Vereinsgroesse

Noch nicht in dieser Phase:

- vollstaendige spaetere Vereinsverwaltung
- komplette Mitgliederlisten
- tiefe Vereinskonfiguration

### B4. Phase Trennung zwischen Anlegendem und Verantwortlichem

Wichtige Regel:

- der anlegende Nutzer ist nicht automatisch der rechtlich verantwortliche Ansprechpartner

Deshalb braucht das Modell:

- `creator_user_id`
- `responsible_name`
- `responsible_email`
- `responsible_status`

### B5. Phase Hinweis fuer Vereinsadministrator-Mail

Gut sichtbarer Hinweis:

- Nach Moeglichkeit ist eine offizielle Vereins-E-Mail-Adresse zu verwenden und keine private Einzeladresse.

Zusatz:

- Checkbox zur Bestaetigung
- Zustimmungsstatus speicherbar

Wichtig:

- praxistauglich bleiben, falls noch keine Funktionsadresse existiert

### B6. Phase Verantwortlichenbenachrichtigung

Nach der Vereinsanlage:

- verantwortliche Person per E-Mail informieren
- Hinweis, dass sie als Verantwortlicher fuer Verein `xyz` eingetragen wurde
- Widerspruchsmechanismus bereitstellen

### B7. Phase Widerspruchslogik

Wenn der benannte Verantwortliche widerspricht:

- Verein nicht loeschen
- Verein auf `blocked` / `responsible_disputed` setzen
- Zugang des Vereins und seiner Benutzer blockieren
- Fall zur Klaerung markieren

Ziel:

- Missbrauchsschutz
- rechtsgueltigen Ansprechpartner absichern

Wichtig:

- der anlegende Nutzer darf den Verein auch ohne unmittelbare Mitwirkung des Verantwortlichen anlegen
- bei Widerspruch greift danach die Sperrlogik

### B8. Phase Billing / Stripe Vorbereitung

In diesem Schritt:

- Billing-Maske vorbereiten
- Preislogik anhand der Vereinsgroesse vorbereiten
- Billing-Status im Flow sichtbar machen
- noch keine harte Stripe-Erzwingung

Moegliche Statuswerte:

- `billing_pending`
- `billing_ready`
- `billing_completed`

Nicht Ziel dieses Schritts:

- finale Stripe-Produktanbindung
- produktive Zahlungsdurchsetzung

### B9. Phase Erfolgs- und Statusseiten

Vorbereiten:

- Preis-/Billing-Seite
- Pending-/Warteseite
- spaetere Erfolgsseite nach Zahlung
- Hinweis, dass der Verein angelegt wurde
- Hinweis, dass nach Mailbestaetigung das Vereinssetup folgt

### B10. Phase Mailverifikation und Vereinssetup

Nach bestaetigter E-Mail:

- Weiterleitung auf `Vereinssetup`

Damit gilt:

- Verein als angelegter Mandant vorhanden
- Billing ggf. noch pending
- Setup kann vorbereitet oder fortgesetzt werden

## 6. Empfohlene Statusmodelle

### 6.1 User-Onboarding

Empfohlene States:

- `auth_created`
- `email_verification_pending`
- `email_verified`
- `join_flow_selected`
- `club_join_identification_pending`
- `member_profile_confirmation_pending`
- `member_profile_confirmation_complete`
- `portal_access_granted`

### 6.2 Club-Onboarding

Erweiterung zu bestehender Grundlage:

- `draft`
- `responsible_confirmation_pending`
- `responsible_confirmed`
- `responsible_disputed`
- `billing_pending`
- `billing_completed`
- `setup_pending`
- `setup_complete`
- `blocked`

### 6.3 Billing

Bestehende Tabellen koennen erweitert oder fachlich gemappt werden:

- `none`
- `preview_pending`
- `checkout_open`
- `completed`
- `blocked`

## 7. Datenmodell-Erweiterungen

### 7.1 Nutzerseitig

Noetige Felder / Events:

- Onboarding-Pfad
- aktueller User-Onboarding-Status
- verknuepfter `club_id`, falls vorhanden
- Invite-/Join-Kontext
- Zeitstempel fuer Mailverifikation
- Datenbestaetigung abgeschlossen ja/nein

### 7.2 Vereinsseitig

Noetige Felder / Events:

- `creator_user_id`
- `responsible_name`
- `responsible_email`
- `responsible_status`
- `responsible_notified_at`
- `responsible_confirmed_at`
- `responsible_disputed_at`
- `blocked_reason`
- `club_size`
- `billing_preview_tier`

### 7.3 Zustimmungen / Nachweise

Speicherbar vorbereiten:

- Vereinsadmin-Mail-Hinweis bestaetigt
- Vereinsbeitrag bestaetigt
- Richtigkeit der Angaben bestaetigt
- ggf. SEPA / alternative Zahlungsweise bestaetigt

Wichtig:

- versionierbar speichern
- Zeitstempel speichern
- Benutzer- und Clubbezug speichern

## 8. Rechtliche Einordnung

### 8.1 Authentifizierung

Der geplante Flow ist rechtlich deutlich sauberer als eine einfache offene Registrierung.

Gruende:

- E-Mail-Bestaetigung als Gate
- Invite-/Mitgliedsnummer-/Vereinskontext bei Beitritt
- Trennung zwischen Plattform-Auth und Vereinsfachdaten
- spaetere Bestaetigung bereits bekannter Vereinsdaten

### 8.2 Verantwortlichenlogik

Die Widerspruchs- und Sperrlogik ist rechtlich sinnvoll, wenn sie sauber dokumentiert wird.

Noetig:

- Audit-Ereignis
- Sperrstatus
- nachvollziehbarer Grund
- definierter Entsperrprozess

### 8.3 Billing

Billing jetzt nur vorbereiten ist rechtlich in Ordnung, solange:

- klar ist, ob bereits ein kostenpflichtiger Vertrag geschlossen wird
- Pending-/Teststatus nicht irrefuehrend dargestellt wird
- Preis- und Vertragslogik vor echtem Go-Live final geprueft wird

## 9. Was Im Naechsten Schritt Echt Gebaut Werden Soll

### Sofort

- CTA `Jetzt Loslegen`
- `COMING SOON`-Hinweis
- Glocke ohne Border und Background
- `/registrieren/` als neue Flow-Struktur statt Sammelmaske

### In diesem Entwicklungsschritt

- Auth-Phase
- Auswahl der Anmeldeart
- Join-Flow-Maske
- Club-Create-Maske
- vorbereitete Billing-Maske
- Weiterleitungs- und Gate-Logik
- Statusmodell im Backend vorbereiten

### Noch nicht final

- echte Stripe-Abwicklung
- finale produktive Billing-Erzwingung
- kompletter Verantwortlichen-Widerspruch per Live-Mailprozess

## 10. Offene Entscheidungen

Diese Punkte muessen vor oder waehrend der Umsetzung geklaert werden:

- welche Daten im Mitgliedsflow wirklich Pflicht sind und welche erst spaeter ergaenzt werden koennen
- welche alternative Zahlungsmethode neben SEPA vorgesehen ist
- wie lange `responsible_confirmation_pending` offen bleiben darf
- ob blockierte Vereine nur keinen Portalzugang oder auch keinen Login mehr erhalten
- welche Rollen den Entsperrprozess bearbeiten duerfen
- ob Vereinscode `VD01` nur Anzeige oder spaeter echte Join-Option wird

## 11. Kurzurteil

Der geplante Weg ist fachlich, technisch und rechtlich sinnvoll.

Er ist deutlich sauberer als die bisherige einfache Registrierungsmaske und bildet das Fishing-Club-Portal eher als echtes Plattformprodukt ab.

Die richtige Reihenfolge fuer den naechsten Schritt lautet:

1. Flow-Struktur und States sauber modellieren
2. Registrierungs-UI neu aufbauen
3. Gates und Redirects korrekt verdrahten
4. Billing und Verantwortlichenprozess vorbereiten
5. Stripe und finale Live-Erzwingung spaeter anschliessen
