# WHY — Warum FCP existiert und warum es so gebaut ist

> Dieses Dokument erklaert die Domain, die Nutzer und den Grund hinter jedem
> Feature-Cluster. Es ist kein technisches Dokument.
> Es ist die Antwort auf: "Warum hat FCP das?"
>
> Jede KI die an FCP arbeitet liest dieses Dokument zuerst.
> Nicht raten — hier nachschlagen.

---

## 1. Was ist FCP

**FCP (Fishing Club Portal)** ist ein SaaS-Produkt fuer deutsche Angelvereine.

Es digitalisiert die operative Vereinsfuehrung: Mitgliederverwaltung, Fangdokumentation,
Arbeitsstunden, Kommunikation, Ausweise, Gewaesserkarten, Dokumente.

Das Produkt laeuft unter `fishing-club-portal.de`.
Das Produktrepo ist `Lauemi/VDANMemberPortal`.
VDAN ist der erste Pilotverein.

---

## 2. Die Realitaet eines deutschen Angelvereins

Wer FCP versteht muss zuerst verstehen, wie ein deutscher Angelverein funktioniert.

### Was ein Verein verwalten muss

**Mitglieder**
Angelvereine haben aktive Mitglieder die einen Jahresbeitrag zahlen und dafuer
das Angelrecht auf den Vereinsgewaessern erhalten. Neue Mitglieder werden aufgenommen,
Alte scheiden aus. Die Mitgliederliste ist die Grundlage fuer alles.

**Gewaesser und Angelrechte**
Ein Verein pachtet Gewaesser (Seen, Flussabschnitte) von Eigentuemern oder Kommunen.
Nur Vereinsmitglieder duerfen auf diesen Gewaessern angeln.
Die Gewaesserpacht ist eine rechtliche Verpflichtung mit Auflagen.

**Fangmeldepflicht**
Mitglieder sind gesetzlich verpflichtet, ihre Faenge zu dokumentieren.
Die Daten fliessen in Hegeplae und Berichte an Gewaesserbehoerden.
Das ist keine optionale Funktion — es ist eine gesetzliche Pflicht.

**Pflichtstunden**
Viele Vereine schreiben in ihre Satzung: jedes Mitglied muss pro Jahr
eine Mindestanzahl Arbeitsstunden leisten (Gewaesserpflege, Fischbesatz, Vereinsarbeit).
Wer nicht erscheint zahlt eine Ausgleichspauschale oder riskiert den Ausschluss.
Manche Vereine haben statt Pflichtstunden eine pauschale Abgeltung — beides muss
FCP spaeter als Vereinskonfiguration abbilden koennen.

**Ausweise und Kontrolle**
Wer angelt muss beim Fischereiaufseher (Kontrolleur) drei Dinge nachweisen koennen:
1. Mitgliedschaft im Verein
2. Persoenlicher Angelschein (staatlich)
3. Berechtigung fuer das jeweilige Gewaesser

Bisher: Papierkarte oder PDF im Email-Archiv.

---

## 3. Die Nutzer von FCP

FCP hat vier Nutzerrollen mit fundamental unterschiedlichen Beduerfnissen.

### Das Mitglied

Das Mitglied ist der Dreh- und Angelpunkt.

Ein Mitglied angelt draussen — in der Natur, oft ohne Mobilnetz, mit dem Telefon in der Hand.
Es muss Faenge dokumentieren, Arbeitstermine einhalten, seinen Ausweis vorweisen koennen.
Es will keine Verwaltung. Es will angeln.

**Wichtig:** Das Mitglied bringt keinen Laptop. Es hat ein Telefon.
Alles muss auf dem Telefon funktionieren — auch ohne Netz.

### Der Vorstand

Der Vorstand fuehrt den Verein operativ. Er legt Arbeitseinsaetze an,
erfasst Anwesenheit, schreibt Vereinsnachrichten, verwaltet Mitglieder.
Er ist kein Techniker. Er braucht eine einfache Oberflaeche die funktioniert.

### Der Admin

Der Admin richtet den Verein initial ein: importiert Mitglieder per CSV,
vergibt Rollen, legt Gewaesser an, pflegt Regeln.
Er arbeitet seltener, aber tiefer in der Konfiguration.

### Der Kontrolleur

Der Kontrolleur ist kein FCP-Nutzer — er ist externer Pruefer.
Er scannt den QR-Code auf dem Mitgliedsausweis und prueft:
Ist diese Person Mitglied? Ist der Ausweis gueltig?
Er muss das ohne Internetverbindung koennen — er steht am Gewaesser.

---

## 4. Warum jedes Feature-Cluster existiert

### Fangliste (Go Fishing / Catchlist)

**Warum:** Fangmeldepflicht ist gesetzlich. Kein Feature — eine Pflicht.

**Warum Offline:** Angeln findet in der Natur statt. Netzabdeckung ist nicht
garantiert — besonders an grenznahen Gewaessern und abgelegenen Flaechen.
Der Fang muss trotzdem sofort dokumentiert werden.
Sync passiert automatisch wenn Verbindung zurueckkommt.

Offline ist kein Komfort. Offline ist Voraussetzung.

### Mitgliedsausweis mit QR-Code

**Warum:** Papierausweise gehen verloren, sind veraltet, koennen gefaelscht werden.
Das Telefon ist immer dabei.

**Warum QR:** Der QR-Code ist fuer den Kontrolleur — nicht fuer das Mitglied.
Er enthaelt ein kryptographisch signiertes Token (ES256, 7-Tage-TTL) das
offline verifiziert werden kann. Kein Netz am Gewaesser — kein Problem.

Das Token enthaelt: Mitgliedsnummer, Name, Angelkartentyp, Gueltigkeitsdaten.

**Warum offline-verifizierbar:** Kontrolleure stehen am Gewaesser.
Dort gibt es oft kein Netz. Die Pruefung muss ohne API-Call moeglich sein.

### Arbeitseinsaetze (Work Events)

**Warum:** Pflichtstunden sind Satzungspflicht in vielen Vereinen.
Wer nicht erscheint zahlt oder verliert Rechte.

**Warum digital:** Heute laeuft das ueber Papierlisten, Excel, persoenliche Erinnerungen.
Das erzeugt Streit ("ich war da", "ich hab dich nicht gesehen"), Datenverlust und Aufwand.

FCP ersetzt das: Einsatz anlegen → Mitglied meldet sich an → checkt ein → checkt aus →
Admin genehmigt Stunden → alles dokumentiert, kein Streit.

**Status-Kette:** `registered` → `submitted` → `approved` / `rejected`

### Scanner / Kontrollfunktion

**Warum:** Vorstand muss Mitglieder bei Anlass auf ihre Angelberechtigung pruefen koennen.
Nicht jederzeit — aber wenn es Anlass gibt (Kontrolle am Gewaesser, Konflikt).

Der Scanner liest den QR vom Mitgliedsausweis und protokolliert:
wann wurde kontrolliert, von wem, mit welchem Ergebnis.

### Gewaesserkarte

**Warum:** Mitglieder muessen wissen welche Gewaesser sie beangeln duerfen.
Das Angelrecht gilt nur fuer die Vereinsgewaesser.
Die Karte zeigt: hier darfst du angeln, hier nicht.

### Feed / Vereinsnachrichten

**Warum:** Vereine kommunizieren heute per Email-Verteiler, Aushang oder
WhatsApp-Gruppe. Das ist unkontrolliert, nicht archiviert, nicht rollenbasiert.

Der Feed ist der offizielle Vereinskanal in der App.

### Dokumente

**Warum:** Vereinsordnung, Gewaesserregeln, Angelerlaubnisse — diese Dokumente
muessen Mitglieder einsehen koennen, manche nur bestimmte Rollen.

Rollenbasierter Zugriff: Mitglied sieht Vereinsordnung,
Vorstand sieht interne Protokolle.

### Push-Benachrichtigungen

**Warum:** Wichtige Vereinsmitteilungen (Arbeitseinsatz, Notfall am Gewaesser,
neue Regelung) muessen das Mitglied erreichen — auch wenn es die App nicht offen hat.

**Aktueller Stand:** Nur Update-Kanal gebaut (`push-notify-update` Edge Function).
Allgemeine Push-Funktion (Feed, Events, Arbeitseinsatz) steht noch aus.

### PWA / Offline

**Warum:** FCP ist keine native App — der Aufwand waere zu gross.
Eine PWA (Progressive Web App) ist installierbar auf iOS und Android,
laeuft offline, benoetigt keinen App Store.

Offline-Verhalten ist nicht optional — es ist Kernfunktion.

### Mitgliederverwaltung / CSV-Import

**Warum:** Vereine haben bereits Mitgliederlisten — in Excel, in alter Software.
CSV-Import bedeutet: kein manuelles Eintippen von 200 Mitgliedern.

### Invite / Claim Flow

**Warum:** Mitglieder werden vom Admin eingeladen — sie registrieren sich nicht selbst.
Ein Verein entscheidet wer Mitglied ist, nicht die App.

### Billing (SaaS)

**Warum FCP Geld kostet:** FCP ist ein Produkt, kein Hobby. Vereine zahlen einen
Jahresbetrag abhaengig von Mitgliederzahl (Staffelmodell: 50er-Stufen, 2 EUR/Einheit/Jahr).

**Geplant — Vereinsinterne Abrechnung:**
Vereine muessen spaeter ihre eigenen Mitgliedsbeitraege abrechnen und an ihre Bank
uebergeben koennen. Standard ist SEPA XML. DB-Inventarvorbereitung laeuft bereits.
Das ist nach First Money — aber es ist Teil der Produktvision.

---

## 5. Was FCP nicht ist

- FCP ist kein Angelsport-Social-Network
- FCP ist keine Buchungs-App fuer Angelplaetze (kein Open-Access)
- FCP ist keine Vereinsbuchhaltung (nur Mitgliedsbeitrags-Abrechnung geplant)
- FCP ist kein nativer App-Store-Produkt (PWA)
- FCP ist nicht fuer Vereine ohne digitale Grundbereitschaft

---

## 6. Der Grundsatz

> Das Mitglied steht am Gewaesser. Kein Netz. Telefon in der Hand.
> Alles muss in diesem Moment funktionieren.

Jede Produktentscheidung wird an diesem Bild gemessen.

---

*Stand: 2026-05-22 — Quelle: Michael Lauenroth (Produktentscheidungen) + Code-Verifikation*
*Dieses Dokument wird nicht von Codex gepflegt. Nur Michael oder Claude Code duerfen es aendern.*
