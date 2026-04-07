# FCP RLS Security Standard

Dieses Dokument ist der verbindliche Sicherheitsstandard fuer das FCP-Maskensystem.

Es definiert:
- wie Sicherheitskontext fuer Masken beschrieben wird
- wie Tenant-, Club- und Membership-Zugriff serverseitig abgeleitet wird
- welche Mindestregeln fuer RLS und RPCs gelten
- wie UI-Gating von echter Sicherheit getrennt bleibt

## 1. Grundprinzip

Die Masken-JSON erzeugt niemals selbst Sicherheit.

Die JSON beschreibt nur den Sicherheitskontext so, dass:
- SQL korrekt gebaut werden kann
- RLS korrekt gebaut werden kann
- RPCs und Edge Functions korrekt validieren muessen

Regel:
- Zugriff wird immer serverseitig geprueft
- Clientwerte wie `club_id`, `tenant_id` oder `canonical_membership_id` sind niemals allein vertrauenswuerdig

## 2. Serverseitige Ableitung

Der gueltige Zugriffskontext wird serverseitig aus mindestens einer dieser Quellen abgeleitet oder geprueft:
- `auth.uid()`
- `identity_core.auth_user_id`
- `canonical_memberships`
- `tenant_id`
- `club_id`
- `club_user_roles` oder `user_roles`

Standardregel:
- globaler Zugriff: ueber echte Identitaet
- club-scoped Zugriff: ueber Membership oder clubbezogene Rolle
- admin-scoped Zugriff: ueber serverseitig gepruefte Rolle, nie nur ueber UI

## 3. Sicherheitsklassen

### `global_user`
- Daten gehoeren dem angemeldeten Benutzer selbst
- Zugriff nur fuer die eigene Identitaet
- typische Tabellen: `profiles`, `identity_core`, `profiles_platform`

### `auth_system`
- Daten gehoeren zum Auth-/Systemsicherheitsraum
- nie als normales Formular behandeln
- typische Pfade: `auth_action`, Sicherheits-RPC, Verifikationsprozesse

### `club_scoped`
- Zugriff nur mit gueltigem Club-/Tenant-/Membership-Kontext
- serverseitig ueber Membership oder Rolle pruefen

### `club_override`
- Zugriff nur mit erweiterten Vereinsrechten
- typischerweise Vorstand, Admin oder expliziter Club-Prozess

### `billing_snapshot`
- lesender Snapshot-/Nachweisraum
- Zugriff serverseitig club- oder membershipbezogen pruefen
- keine freie Feldmutation

### `consent_append_only`
- append-only Sicherheits- und Rechtsraum
- nie ueberschreibbar
- nur neue Events, Zustimmungen oder Widerrufe

## 4. Standard-RLS-Regeln

### Fuer globale Daten
- RLS muss Zugriff auf die eigene Identitaet begrenzen
- Beispiel:
  - `identity_core.auth_user_id = auth.uid()`
  - oder Ableitung ueber `profiles.id = auth.uid()`

### Fuer club-scoped Daten
- RLS muss Club-/Tenant-Zugriff serverseitig pruefen
- Client darf `club_id` oder `tenant_id` nicht allein bestimmen
- Zugriff nur wenn:
  - Membership existiert
  - oder gueltige Clubrolle existiert
  - und der Datensatz zu diesem Kontext gehoert

### Fuer admin-scoped Daten
- RLS oder RPC muss zusaetzlich Rolle pruefen
- `admin`, `vorstand`, `superadmin` muessen serverseitig validiert werden
- UI-Rollenanzeige ersetzt nie die echte Pruefung

## 5. Standard-RPC-Regeln

Jeder RPC-/Edge-Write-Pfad muss serverseitig mindestens pruefen:
- wer schreibt (`auth.uid()`)
- welcher fachliche Kontext gemeint ist
- ob Club-/Tenant-Zugriff erlaubt ist
- ob Membership oder Rolle passend ist
- ob Feld- oder Prozessscope ueberhaupt beschreibbar ist

Regel:
- RPC validiert immer staerker als UI
- wenn der Kontext nicht sicher abgeleitet werden kann, muss der Write abgelehnt werden

## 6. Trennung von UI-Gating und echter Sicherheit

UI-Gating bedeutet:
- Panel sichtbar oder unsichtbar
- Feld readonly oder editierbar
- Buttons vorhanden oder verborgen

Echte Sicherheit bedeutet:
- RLS
- RPC-Pruefung
- Edge-Function-Pruefung
- serverseitige Rollen- und Membership-Validierung

Verbindliche Regel:
- UI-Gating ist Komfort
- serverseitige Pruefung ist Sicherheit
- eine sichtbare Maske erzeugt niemals automatisch Berechtigung

## 7. JSON Security Context

Jede echte Maske soll Sicherheitskontext strukturiert beschreiben.

Standardform:

```json
{
  "securityContext": {
    "rlsKey": "tenant_id",
    "membershipKey": "canonical_membership_id",
    "requiresTenantAccess": true,
    "requiresRoleCheck": false,
    "allowedRoles": [],
    "serverValidated": true
  }
}
```

## 8. Bedeutungen der Security-Context-Felder

### `rlsKey`
- fachlicher Hauptschluessel, ueber den RLS oder Policy-Kontext gebunden wird
- typische Werte:
  - `tenant_id`
  - `club_id`
  - `identity_id`

### `membershipKey`
- Feld fuer Membership-Ableitung
- typischerweise `canonical_membership_id`

### `requiresTenantAccess`
- true, wenn serverseitiger Tenant-/Clubzugriff geprueft werden muss

### `requiresRoleCheck`
- true, wenn serverseitige Rollenpruefung zusaetzlich noetig ist

### `allowedRoles`
- erlaubte Rollen fuer serverseitige Admin-/Clubpruefung

### `serverValidated`
- muss bei allen nicht-lokalen echten Datenprozessen `true` sein

## 9. Mindestregeln fuer JSON -> SQL/RPC Ableitung

Wenn `securityContext.requiresTenantAccess = true`, dann muss mindestens eines gelten:
- `rlsKey` ist gesetzt
- oder der Write-/Read-Pfad ist ein serverseitiger Prozess, der den Kontext selbst ableitet

Wenn `securityContext.requiresRoleCheck = true`, dann muss gelten:
- `allowedRoles` ist nicht leer

Wenn `saveBinding.kind` in (`rpc`, `edge_function`, `auth_action`) liegt, dann gilt:
- `serverValidated` muss `true` sein

Wenn `scope = consent_append_only`, dann gilt:
- kein normales Form-Overwrite
- nur append-only Prozesspfade

## 10. Muster je Datentyp

### Globales Profil
- Scope: `global_user`
- RLS ueber Identitaet
- Write typischerweise ueber Self-Service-RPC

### Vereinsbezogene Mitgliedsdaten
- Scope: `club_scoped`
- Zugriff ueber Membership oder Clubrolle
- clientseitige `club_id` allein ist nie ausreichend

### Admin-Workspace
- Scope: `club_override`
- zusaetzliche serverseitige Rollenpruefung
- ADM-Panel darf nie nur durch Sichtbarkeit abgesichert sein

### Billing
- Scope: `billing_snapshot`
- meist readonly oder prozessgesteuert
- serverseitiger Zugriffskontext Pflicht

### Consent / Rechtliches
- Scope: `consent_append_only`
- append-only
- keine generische Update-Mutation

## 11. Fehlerfaelle

Das Maskensystem muss Fehler melden, wenn:
- ein nicht-lokales Binding keinen `serverValidated`-Kontext hat
- tenant- oder clubscoped Daten keinen brauchbaren Sicherheitskontext besitzen
- Rollenpruefung verlangt wird, aber keine `allowedRoles` vorhanden sind
- auth-kritische oder append-only Prozesse als normales Formular modelliert werden

## 12. Kurzform

- JSON beschreibt Sicherheitskontext
- RLS und RPC setzen Sicherheit durch
- Client entscheidet keinen Club-/Tenant-Zugriff
- Membership und Rollen werden serverseitig abgeleitet oder geprueft
- UI-Gating ist nie echte Sicherheit
