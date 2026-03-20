# Onboarding Umsetzung

Ziel dieser Datei ist nicht, die Architektur neu zu beschreiben, sondern die operative Umsetzung zu fokussieren.

## Umsetzungsziel

Das Onboarding soll auf dem bestehenden System aufbauen und die vorhandenen Tabellen, Rollenmodelle und Edge Functions weiterverwenden. Neue Logik wird nur dort geschaffen, wo der Bestand noch keine belastbare Struktur bietet, vor allem im Billing.

## Was bereits im Bestand tragfaehig ist

- `profiles` plus `profile-bootstrap` fuer User-Basis und initiale Club-Aufloesung
- `user_roles` und `club_user_roles` fuer Rollen und Club-Scoping
- `club_member_identities` fuer die saubere Zuordnung `user <-> club <-> member_no`
- `club_members` als Vereinsverzeichnis
- `club-invite-create`, `club-invite-verify`, `club-invite-claim` als belastbarer Invite-Kern
- `club-admin-setup` fuer Club-Anlage, Rollen, Module und optionale Gewaesserbasis
- RLS- und Multi-Tenant-Hardening im aktuellen Supabase-Bestand

## Was jetzt konkret umgesetzt oder nachgeschaerft werden muss

### 1. Zustandswechsel explizit serverseitig machen

- die in `02_CTO_Spec.md` definierten Transitionen muessen als echte Guards in Backend-Logik oder Datenmodell nachvollziehbar sein
- kein UI-only Fortschritt

### 2. Setup-Fortschritt serverseitig ableitbar machen

- Pflichtmodule muessen als abgeschlossen oder offen bestimmbar sein
- Billing darf erst freigegeben werden, wenn diese Ableitung `true` ergibt

### 3. Invite-Flow nur verfeinern, nicht neu bauen

- bestehende Edge Functions bleiben Grundlage
- Auditierung, Widerruf und Fehlerpfade koennen darauf aufsetzen

### 4. CSV-Import konservativ und transparent bauen

- primaeres Ziel ist `club_members`
- Teilimport ist erlaubt
- Fehler muessen explizit reportet werden

### 5. Billing als klaren fehlenden Baustein nachziehen

- Stripe-Persistenz fuer Club-Billing aufbauen
- Webhook-Verifikation, Dedupe und Club-Referenzierung fest einplanen
- Aktivierung nur durch verifizierte Events

## Empfohlene Reihenfolge

1. Setup-Completion-Logik definieren und persistierbar machen
2. Invite- und Membership-Flow gegen Edge Cases absichern
3. CSV-Import fuer `club_members` spezifizieren und implementieren
4. Billing-Datenmodell und Stripe-Webhooks ergaenzen
5. Abschluss mit RLS-, Multi-Club- und Suspendierungs-Tests

## Nicht tun

- keine neue parallele Rollenlogik
- keine zweite Membership-Wahrheit ohne Migrationsstrategie
- keine Frontend-Aktivierung von Clubs
- keine implizite Club-Auswahl bei Multi-Club
- kein kompletter Neubau der vorhandenen Invite- oder Setup-Bausteine

## Lieferergebnis

Wenn die Punkte aus diesem Bundle umgesetzt sind, liegt kein loses Architekturpapier mehr vor, sondern eine belastbare Onboarding-Spezifikation mit direkter Anschlussfaehigkeit an den aktuellen Bestand.
