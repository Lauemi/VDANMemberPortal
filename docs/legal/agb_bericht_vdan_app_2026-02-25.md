# AGB-/Nutzungsbedingungen-Bericht – VDAN Fishing-Club-Portal

Stand: 25.02.2026

Hinweis: Kein Ersatz für Rechtsberatung. Ziel dieses Berichts ist die technische/juristische Vorprüfung und die Vorbereitung der anwaltlichen Endprüfung.

Ergaenzende Unterlagen:
1. `docs/legal/nutzungsbedingungen_entwurf_vdan_app_2026-02-25.md`
2. `docs/legal/dsgvo_check_vdan_fishing_club_portal_2026-02-26.md`
3. `docs/project/PROJECT_BRIEF_PACKAGE_VDAN_2026-02-26.md`

## 1. Projektstatus (Ist-Zustand aus Repo)
Vorhanden:
1. Impressum-Seite: `src/pages/impressum.html.astro`
2. Datenschutzerklärung: `src/pages/datenschutz.html.astro` (Stand 21.02.2026)
3. Consent-Mechanismus und Datenschutz-Einstellungen
4. Rollen-/Zugriffsschutz im Mitgliederportal
5. Sicherheits- und Logging-Hinweise in `docs/privacy/*`

Fehlend/ausbaufähig:
1. Eigene Seite für Nutzungsbedingungen/AGB (derzeit nicht vorhanden)
2. Formaler Verbraucherstreitbeilegungs-Hinweis (VSBG) nicht separat/ausdrücklich erkennbar
3. Impressum verwendet noch die Überschrift "§ 5 TMG" (rechtlich überholt; seit 2024 i. d. R. DDG-Bezug)

## 2. Rechts-Check (Kurz-Ampel)

### Rot (kritisch vor Live-Betrieb nachziehen)
1. Keine veröffentlichte Nutzungsbedingungen-/AGB-Seite für das Mitgliederportal
2. Veralteter Gesetzesbezug im Impressum (TMG statt aktuellem Rechtsrahmen/DDG)

### Gelb (prüfen/ergänzen)
1. Verbraucherstreitbeilegung (VSBG § 36) klar und ausdrücklich veröffentlichen
2. Drittlandtransfer/AVV/SCC für eingesetzte Dienstleister nachvollziehbar dokumentieren (intern + ggf. externe Hinweise)
3. Externe Dienste in Datenschutz und Consent konsistent halten (insb. QR-/CDN-/Karten-Dienste)

### Grün (bereits gut umgesetzt)
1. Datenschutzseite mit Zweck, Rechtsgrundlagen, Rechten, Speicherdauer
2. Consent-Steuerung für externe Inhalte
3. Rollenbasierter Zugriff, technische Sicherheitsmaßnahmen, Bot-/Spam-Schutz im Kontaktprozess
4. Logging/Retention-Konzept dokumentiert

## 3. Konkrete To-dos für "juristisch belastbar"
1. Nutzungsbedingungen veröffentlichen (Entwurf: `docs/legal/nutzungsbedingungen_entwurf_vdan_app_2026-02-25.md`)
2. Impressum aktualisieren (Gesetzesbezug auf DDG prüfen und anpassen)
3. VSBG-Hinweis ergänzen (Teilnahme/Nichtteilnahme an Verbraucherschlichtung)
4. Optional: "Sicherheitsinformation" als eigener Abschnitt auf einer rechtlichen Seite verlinken
5. Endprüfung durch Rechtsanwalt (Vereinsrecht + Telemedien + DSGVO)

## 4. Empfohlene Kernklauseln (AGB/Nutzungsbedingungen)
1. Geltungsbereich (Website + Mitgliederportal)
2. Leistungsbeschreibung und Änderungsrecht
3. Zugangsvoraussetzungen, Konto-/Passwortpflichten
4. Zulässige Nutzung und Missbrauchsverbot
5. Verfügbarkeit/Wartung/Unterbrechung
6. Sicherheitserklärung (angemessene TOM, aber keine absolute Sicherheitsgarantie)
7. Externe Dienste und Einwilligung
8. Haftungsklausel (BGB-konform, keine unzulässige Haftungsfreizeichnung)
9. Rechte an Inhalten
10. Datenschutz-Verweis
11. Änderungen der Bedingungen
12. Verbraucherstreitbeilegung
13. Schlussbestimmungen

## 5. Formulierung für Sicherheitsaussage (rechtlich defensiv)
"Wir setzen angemessene technische und organisatorische Sicherheitsmaßnahmen ein. Ein vollständig störungs- und risikofreier Betrieb kann jedoch technisch nicht garantiert werden."

## 6. Formulierungsvorschlag Verbraucherstreitbeilegung
"Der Verein ist nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen."

## 7. Quellen (Primärquellen)
1. DDG § 5 (Allgemeine Informationspflichten): https://www.gesetze-im-internet.de/ddg/__5.html
2. BGB § 305 ff. (AGB-Recht): https://www.gesetze-im-internet.de/bgb/__305.html
3. BGB § 307 (Inhaltskontrolle): https://www.gesetze-im-internet.de/bgb/__307.html
4. BGB § 309 (Klauselverbote): https://www.gesetze-im-internet.de/bgb/__309.html
5. VSBG § 36 (Informationspflicht Unternehmer): https://www.gesetze-im-internet.de/vsbg/__36.html
6. EU-DSGVO (Verordnung (EU) 2016/679): https://eur-lex.europa.eu/eli/reg/2016/679/oj
7. TDDDG § 25 (Endeinrichtung/Einwilligung): https://www.gesetze-im-internet.de/tdddg/__25.html
8. EU ODR-Plattform eingestellt (ab 20.07.2025): https://www.evz.de/en/shopping-internet/odr-platform-ceases-to-exist.html
