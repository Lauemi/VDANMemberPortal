# Onboarding Execution Checklist

Diese Datei wird waehrend der verbleibenden Umsetzung fortgeschrieben.

## Heute erledigt

- [x] Onboarding-Bestand im Repo gesichtet
- [x] bestehende Onboarding-MDs operativ geschaerft
- [x] [OnboardingUmsetzung.md](/Users/michaellauenroth/Downloads/vdan-app-template/docs/project/FCP_Onboarding_Bundle_FINAL/OnboardingUmsetzung.md) angelegt
- [x] laufende Arbeits-Checkliste fuer die Restumsetzung angelegt
- [x] `profile-bootstrap` auf beide Rollenquellen erweitert: `user_roles` und `club_user_roles`
- [x] `profile-bootstrap` so angepasst, dass ein explizit bevorzugter Club bei vorhandener Berechtigung Vorrang vor altem Profil-Kontext bekommt
- [x] Aenderung in `profile-bootstrap` manuell gegengelesen
- [x] SQL-Onboarding-Basis als Migration angelegt
- [x] Audit-SQL fuer die neue Onboarding-Basis angelegt
- [x] SQL-RPCs fuer Service-Context vorbereitet, damit Edge Functions die neue Basis nutzen koennen
- [x] `club-admin-setup` an die neue Onboarding-SQL-Basis angebunden
- [x] Edge Function `club-onboarding-status` angelegt
- [x] Edge Function `club-onboarding-progress` angelegt
- [x] `/app/vereine` zu einer gegliederten internen Verwaltungsmaske fuer Onboarding, Club-Anlage und Invite umgebaut
- [x] `club-admin-setup.js` an die neue Verwaltungsmaske angepasst und um Statusladen / Progress-Updates gegen die neuen Onboarding-Edge-Functions erweitert
- [x] gefuehrten Ablauf fuer `/app/vereine` auf `Vereinsdaten -> Billing -> Gewaesser/Karten/Mitglieder` umgestellt
- [x] Superadmin-Bypass fuer Billing-Freigabe im internen Vereinssetup sichtbar und technisch beruecksichtigt
- [x] erste nutzbare Fachmasken fuer Vereinsdaten, Gewaesser, Karten und Mitglieder in `/app/vereine` angelegt
- [x] Edge Function `club-onboarding-workspace` fuer Arbeitsmasken-Daten und einfache CRUD-Aktionen angelegt
- [x] Admin-Panel und Governance-Katalog fuer `Eventplaner` und fehlende reale App-Seiten nachgezogen

## In Arbeit

- [ ] technische Verifikation der `profile-bootstrap`-Aenderung in echter Runtime
- [ ] technische Verifikation der neuen Onboarding-Migration
- [ ] technische Verifikation der neuen Onboarding-Edge-Functions
- [ ] technische Verifikation des neuen Onboarding-Dashboards in echter Browser-Session

## Offene Verifikationshinweise

- Lokaler `deno`-Check war in dieser Umgebung nicht verfuegbar.
- Die Aenderungen sind logisch und syntaktisch manuell geprueft, aber noch nicht in laufender Supabase-Function-Runtime getestet.

## Kandidaten fuer den naechsten Block

- [ ] Invite-/Claim-Flow gegen weitere Edge Cases haerten
- [ ] Auth-User ohne Erstlogin / ohne saubere Profilbindung gezielt bereinigen und fuer VDAN-Echtdaten vorbereiten
- [ ] CSV-Import fuer `club_members` konkret in Code vorbereiten
- [ ] Mitgliederdatenmodell fuer VDAN-Echtdaten und weitere Stammdatenfelder erweitern
- [ ] Stripe-Webhook und Checkout-Flow an `club_billing_subscriptions` anbinden
