# AVV- Und Rollenmodell – Fishing-Club-Portal

Stand: 19. Maerz 2026

## Kurzantwort

Fuer das Fishing-Club-Portal solltet ihr mit angebundenen Vereinen grundsaetzlich mit einer Auftragsverarbeitungsvereinbarung nach Art. 28 DSGVO arbeiten.

Praktische Grundlogik:

- Verein = Verantwortlicher fuer vereinsbezogene Personen- und Mitgliederdaten
- Michael Lauenroth / Fishing-Club-Portal = Auftragsverarbeiter fuer die technische Bereitstellung und Verarbeitung im Auftrag

## Wichtige Nuance

Das gilt nicht fuer jede einzelne Verarbeitung pauschal.

Der Plattformbetreiber kann fuer bestimmte eigene Verarbeitungen auch selbst Verantwortlicher sein, zum Beispiel fuer:

- Betrieb und Sicherheit der eigenen Website
- eigene Support- und Vertragskommunikation
- eigene Abrechnung
- Missbrauchsabwehr und technische Sicherheitsprotokolle auf Plattformebene
- eigene oeffentliche Inhalte des Plattformangebots

Deshalb ist das sauberste Modell:

1. AVV fuer die Vereins- und Mandantenverarbeitung
2. zusaetzliche Nutzungs-/Leistungsunterlagen fuer Plattformbetrieb, Rechte, Exit und Support
3. Datenschutzhinweise, die Controller/Processor nicht zu grob, sondern differenziert erklaeren

## Wann Eine AVV Hier Sinnvoll Und Noetig Ist

Eine AVV ist insbesondere dann richtig, wenn ein Verein ueber Zwecke und Inhalte entscheidet und die Plattform diese Daten nur technisch fuer ihn verarbeitet, etwa bei:

- Mitgliederverwaltung
- Termin- und Eventverwaltung
- Dokumentenbereitstellung
- Fangliste
- Ausweis- und Verifikationsfunktionen
- Rollen- und Vereinszuordnungen im Mandantenkontext

## Was In Die AVV Gehoert

Die AVV sollte mindestens regeln:

- Gegenstand und Dauer der Verarbeitung
- Art und Zweck der Verarbeitung
- Kategorien betroffener Personen
- Kategorien personenbezogener Daten
- Weisungsrecht des Vereins
- Vertraulichkeit
- technische und organisatorische Massnahmen
- Unterauftragsverarbeiter
- Unterstuetzung bei Betroffenenrechten
- Unterstuetzung bei Vorfaellen / Datenschutzverletzungen
- Loeschung, Rueckgabe und Export bei Vertragsende
- Nachweis- und Kontrollrechte

## Welche Unterauftragsverarbeiter Ihr Wahrscheinlich Benennen Solltet

Nach aktuellem Repo- und Projekthinweis sind insbesondere zu pruefen:

- IONOS
- Supabase
- ggf. E-Mail-Dienste
- ggf. Vercel, falls produktiv eingesetzt

## Wie Ihr Das Praktisch Im Produkt Umsetzt

Empfohlenes Modell fuer Onboarding neuer Vereine:

1. Nutzungsbedingungen akzeptieren
2. Datenschutzhinweise zur Kenntnis nehmen
3. AVV als gesondertes Dokument akzeptieren oder ausserhalb des Produkts zeichnen
4. Acceptance-Logging revisionssicher speichern

## Was Ich Empfehle

Nicht nur Checkbox "Datenschutz / AGB" im Produkt.

Sondern:

- oeffentliche Rechtstexte fuer Website und Plattform
- separate AVV als Verein-Vertrag
- saubere Dokumentation der Unterauftragsverarbeiter
- Exit-/Loesch-/Export-Regeln schriftlich

## Entscheidung Fuer FCP

Fuer FCP ist das passende Arbeitsmodell:

- oeffentliche Rechtstexte auf Plattformebene veroeffentlichen
- Vereine fuer ihre Mandantenverarbeitung als Verantwortliche behandeln
- Plattform fuer diese Mandantenverarbeitung als Auftragsverarbeiter vertraglich absichern
- eigene Plattformverarbeitungen des Betreibers davon getrennt beschreiben
