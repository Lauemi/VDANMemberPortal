# Security- und DSGVO-Kurzblatt (Vertrieb)

Stand: 2026-03-18
Zweck: Kompakte, belastbare Aussagen fuer Vertrieb und Erstgespraeche

## Security-Basis (technisch)
- Rollen- und mandantenbasierte Zugriffslogik
- Row Level Security (RLS) auf relevanten Tabellen
- Security-Hardening und Release-Gates dokumentiert
- kontrollierte Auth- und Onboarding-Flows inkl. Invite, Registrierung und Vereinssetup
- Security-Audit und Follow-up-Fixes im Projektprozess verankert
- Governance- und ACL-Modell fuer Modulrechte vorhanden
- technische Governance-Health-Checks fuer Rollen-, Rechte- und Identitaetskonsistenz vorhanden

## DSGVO-Basis (technisch-organisatorisch)
- Datenverarbeitung entlang definierter Vereinszwecke
- Zugriffsbeschraenkung ueber Rollen-/Mandantenkontext
- Trennung von Plattform- und Vereinskontext
- technische Nachvollziehbarkeit durch Audit-/Dokupfade
- Datenschutzseiten und technische Datenschutzdokumente vorhanden
- kontrollierter Invite-/Registrierungsprozess statt offener, ungebremster Freischaltung

## Was wir aktiv sagen koennen
- "Die Plattform ist Security- und DSGVO-orientiert konzipiert und umgesetzt."
- "Zugriffe werden rollen- und mandantenbasiert kontrolliert."
- "Es existieren dokumentierte Sicherheits- und Datenschutz-Checks."
- "Onboarding, Freischaltung und Modulzugriffe sind kontrolliert und nachvollziehbar angelegt."

## Was wir nicht versprechen
- keine absoluten Sicherheitszusagen (z. B. "100% sicher")
- keine Rechtsberatung
- keine pauschalen Aussagen ohne juristische Endfreigabe der finalen Rechtstexte

## Typische Einwaende
Einwand: "Datenschutz ist bei Vereinssoftware kritisch."
Antwort: "Genau deshalb arbeiten wir mit rollen-/tenant-spezifischem Zugriff, RLS und dokumentierten Security-/DSGVO-Baselines."

Einwand: "Wer sieht welche Daten?"
Antwort: "Die Plattform ist rollenbasiert aufgebaut, und Datenzugriffe sind je Mandant/Club eingeschraenkt."

Einwand: "Wie verhindert ihr Wildwuchs beim Start neuer Vereine?"
Antwort: "Neue Vereine und Nutzer laufen ueber kontrollierte Invite-, Registrierungs- und Setup-Pfade statt ueber unstrukturierte Freischaltung."

## Vertriebs-Checkliste vor externem Versand
1. Aktuellen Security-Status aus den Projektdokumenten gegenpruefen.
2. Keine nicht-freigegebenen Roadmap-Features kommunizieren.
3. Rechts-/Datenschutzhinweis im Angebot/Deckblatt fuehren.
4. Zwischen aktuellem Produktstand und geplanter Rollout-Stufe klar trennen.

## Quellen (intern)
- docs/security-audit-2026-03-07.md
- docs/security-dsgvo-checklist.md
- docs/anwendungsdokumentation_gesamtstand_2026-03-08.md
- docs/security-baseline-review-2026-03-16.md
- docs/legal/*
- docs/privacy/*
