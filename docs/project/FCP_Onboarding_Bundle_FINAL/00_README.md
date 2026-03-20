# FCP Onboarding Project Bundle (FINAL)

Dieses Bundle ist die fachliche und technische Grundlage fuer das Onboarding-System des Fishing-Club-Portals.

Ziel:
- kein Neubau, sondern strukturierte Weiterentwicklung des Bestands
- ein zustandsbasiertes Onboarding-System
- saubere Multi-Tenant-Architektur
- sichere Invite-, Membership- und Billing-Logik

Leitprinzipien:
- Bestand vor Neubau
- Membership und Rollen steuern Zugriff
- Frontend zeigt Zustaende, es erzeugt keine Systemwahrheit
- Stripe aktiviert einen Club ausschliesslich serverseitig per Webhook
- im Zweifel wird verweigert, nicht geraten

## Dokumentstruktur

- `01_Narrative_Master.md`
  Beschreibt den fachlichen Gesamtfluss von Login, Invite und Club-Erstellung bis zum produktiven Portal.

- `02_CTO_Spec.md`
  Enthalt die operative Kernspezifikation inklusive Transition-Matrizen fuer die Kernobjekte.

- `03_Security_Baseline.md`
  Definiert verbindliche Sicherheitsregeln fuer Queries, Mutationen, Rollen, Tokens, Sessions und Webhooks.

- `04_State_Machine.md`
  Beschreibt das Zielmodell der Zustaende und die verbindlichen Begriffsdefinitionen.

- `05_UI_UX.md`
  Definiert das Verhalten der Onboarding-Oberflaechen und was blockierend oder optional ist.

- `06_Mapping.md`
  Mappt Zielmodell und Onboarding-Logik auf den aktuellen Bestand in Tabellen, Functions und RLS.

- `07_Deep_Dive.md`
  Konkretisiert Stripe, Invite-Flow und CSV-Import auf Umsetzungsniveau.

- `08_Checklist.md`
  Enthalt Definition of Done und die operative Delivery-Checkliste.

- `OnboardingFeedback.md`
  Externes Review und Einschaetzung des Architektur-Blueprints.

- `OnboardingUmsetzung.md`
  Kompakter Umsetzungsauftrag fuer Entwicklung und Delivery.

## Aktueller Stand

Die Architektur ist fachlich tragfaehig. Diese Version des Bundles schaerft die vorhandenen Dokumente operativ, damit sie nicht nur Zielbild, sondern konkrete Umsetzungsgrundlage sind.

Schwerpunkte dieser Schaerfung:
- Transition-Matrizen pro Kernobjekt
- Edge Cases und Endzustaende
- Definition of Done pro Onboarding-Abschnitt
- Mapping auf bestehende Tabellen, Edge Functions und RLS
- harte Begriffsdefinitionen
- operativere UI/UX-Vorgaben
- konkretisierte Security-, Invite-, Stripe- und CSV-Regeln
