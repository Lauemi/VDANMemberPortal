# FCP Settings Config Contract

Dieses Contract definiert, wie aus `SQL + Ownership/Write-Pfad-Kontext` deterministisch eine `settingsConfig` fuer `QuickFlowPattern` entsteht.

Es ist absichtlich:
- ohne UI-Design
- ohne HTML
- ohne konkrete Maske
- nur Struktur, Regeln und Mapping
- inklusive Sicherheits- und RLS-Kontext

## 1. Settings Config Template

```js
const settingsConfig = {
  maskType: "sectioned",
  activeSectionId: "profile_clubs",
  currentRoles: [],

  currentScopes: {
    globalUser: true,
    authSystem: false,
    clubReadonly: true,
    clubOverride: false,
    billingSnapshot: false,
    consentAppendOnly: false,
  },

  header: {
    kicker: "Settings",
    title: "Einstellungen",
    description: "Zentrale Verwaltungsmaske fuer Benutzer-, Vereins-, Sicherheits- und Systemdaten.",
  },

  securityContext: {
    rlsKey: "tenant_id",
    membershipKey: "canonical_membership_id",
    requiresTenantAccess: true,
    requiresRoleCheck: false,
    allowedRoles: [],
    serverValidated: true,
  },

  load: async (ctx) => {
    return {
      sections: [
        /* normalizeSections-compatible objects */
      ],
    };
  },

  can: (action, permissions, ctx) => {
    return true;
  },

  sections: [
    {
      id: "profile_clubs",
      label: "Profil & Vereine",
      kicker: "Profil",
      title: "Profil & Vereine",
      description: "Globale Profildaten und vereinsbezogene Kontexte.",
      permissions: {
        view: true,
        write: true,
        update: true,
        delete: false,
        roles: ["member", "admin", "vorstand", "superadmin"],
      },
      securityContext: {
        rlsKey: "tenant_id",
        membershipKey: "canonical_membership_id",
        requiresTenantAccess: true,
        requiresRoleCheck: false,
        allowedRoles: [],
        serverValidated: true,
      },
      saveBinding: {
        kind: "rpc",
        target: "public.self_member_profile_update",
        entity: "profile",
      },
      load: async (ctx) => ({}),
      panels: [
        {
          id: "global_profile",
          title: "Globales Profil",
          icon: "profile",
          renderMode: "form",
          flowType: "standard",
          permissions: {
            view: true,
            write: true,
            update: true,
            delete: false,
            roles: ["member", "admin", "vorstand", "superadmin"],
          },
          securityContext: {
            rlsKey: "identity_id",
            membershipKey: null,
            requiresTenantAccess: false,
            requiresRoleCheck: false,
            allowedRoles: [],
            serverValidated: true,
          },
          saveBinding: {
            kind: "rpc",
            target: "public.self_member_profile_update",
            entity: "profile",
          },
          meta: {
            sourceTable: "public.profiles",
            sourceOfTruth: "sql",
            scope: "global_user",
          },
          content: {
            fields: [
              {
                name: "first_name",
                label: "Vorname",
                type: "text",
                scope: "global_user",
                required: false,
                readonly: false,
              },
            ],
          },
        },
      ],
    },
  ],
};
```

### Pflichtfelder pro Section
- `id`
- `label`
- `title`
- `permissions`
- `securityContext`
- `panels`

### Pflichtfelder pro Panel
- `id`
- `title`
- `renderMode`
- `permissions`
- `securityContext`
- `saveBinding`
- `meta`
- `content`

### Pflichtfelder pro Feld
- `name`
- `label`
- `type`
- `scope`

## 2. SQL -> UI Mapping Regeln

### Grundregel
- SQL ist die Source of Truth.
- UI wird nie frei erfunden.
- Jede UI-Section und jedes Panel muss auf benennbare SQL-Quellen zurueckfuehrbar sein.

### Uebersetzungslogik
- `eine fachlich zusammengehoerige Tabelle oder View` -> meist `ein Panel`
- `eine Tabelle mit vielen Zeilen gleicher Struktur` -> `table`
- `ein einzelner Datensatz mit editierbaren Feldern` -> `form`
- `ein einzelner Datensatz ohne editierbaren Write-Pfad` -> `readonly`
- `nur Trigger-/System-/Prozessaktionen` -> `actions`
- `Kombination aus Status + Aktionen + Liste + Teilformular` -> `mixed`

### Globale vs club-scoped Erkennung
- `global_user`
  - Daten haengen primaer an `auth.users`, `profiles`, `identity_core`, `profiles_platform`
  - kein `club_id` oder `tenant_id` als fuehrender Kontext
- `club-scoped`
  - Datensatz haengt an `club_id`, `tenant_id`, `canonical_membership_id` oder club-bezogener Rolle
  - Beispiel: `club_members`, `club_user_roles`, club-scoped billing, notifications je Verein

### Read vs Write Mapping
- SQL-Feld mit vorhandenem validem Write-Pfad -> potentiell `form`
- SQL-Feld ohne freigegebenen Write-Pfad -> `readonly`
- Snapshot-, Audit-, History- und Acceptance-Daten -> nie normales `form`

## 3. Save / Load Binding Regeln

Sicherheitszusatz:
- jeder nicht-lokale Read-/Write-Pfad braucht einen passenden `securityContext`
- UI-Sichtbarkeit ersetzt nie RLS oder RPC-Validierung

### `rpc` verwenden wenn
- fachliche Mutation kontrolliert ueber DB-Funktion laeuft
- Validierung oder Ownership in SQL steckt
- mehrere Tabellen atomar geschrieben werden
- Rollen- oder Club-Kontext serverseitig geprueft werden muss
- serverseitige Sicherheitspruefung verbindlich ist

Typische Faelle:
- Profil speichern
- mitgliedschaftsnahe Stammdaten
- billing-relevante Mutationen
- registry-/admin-Mutationen

### `auth_action` verwenden wenn
- Supabase Auth oder Login-/Security-Funktion direkt betroffen ist
- Passwort aendern
- E-Mail-Verifikation ausloesen
- MFA, Session oder Login-Schutz
- der Sicherheitskontext serverseitig aus Auth abgeleitet wird

### `edge_function` verwenden wenn
- Prozesslogik ausserhalb reiner DB-Mutation liegt
- Datei-Import
- mehrstufiges Onboarding
- externe APIs, Push, Mail oder Token-Prozesse
- serverseitige Orchestrierung mit mehreren Systemen
- serverseitiger Sicherheitskontext vor dem Write geprueft wird

### `local_only` verwenden wenn
- reiner UI-State
- temporaere Filter
- lokal persistierte Praeferenzen ohne DB-Relevanz
- noch kein freigegebener Backend-Write-Pfad existiert

### `none` verwenden wenn
- Panel ausschliesslich readonly ist
- kein Write-Pfad existiert und auch keiner stattfinden darf

### Nie generisch
- Jedes Panel braucht genau einen klaren `saveBinding.kind`
- Jedes writebare Panel braucht genau ein benanntes `target`
- Kein "wird spaeter entschieden"
- nicht-lokale Prozesse muessen `serverValidated = true` im Sicherheitskontext haben

## 3.1 Sicherheitskontext

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

Regeln:
- `requiresTenantAccess = true` bei club- oder tenant-scoped Settings
- `membershipKey` setzen, wenn Membership serverseitig Teil der Pruefung ist
- `requiresRoleCheck = true` nur mit nichtleeren `allowedRoles`
- globale Self-Service-Panels koennen `requiresTenantAccess = false` haben, brauchen aber trotzdem serverseitige Validierung

## 4. Field-Scope Mapping

### `global_user`
- Benutzer gehoert sich selbst
- typischer Write-Pfad: `rpc` oder kontrollierte self-service mutation
- UI:
  - meist `form`
  - fuer eigene Stammdaten editierbar

### `auth_system`
- durch Auth- oder Systemlogik gefuehrt
- Beispiel: Login-E-Mail-Status, MFA-Status, Session-State
- UI:
  - meist `readonly` oder `actions`
  - nie normales freies Formular

### `club_readonly`
- vereinsbezogener Kontext sichtbar, aber durch Benutzer nicht direkt aenderbar
- Beispiel: Mitgliedsnummer, Vereinszuordnung, Rollenstatus
- UI:
  - `readonly`
  - nie direkt editierbar

### `club_override`
- vereinsbezogene Daten mit explizitem Vereinsschreibrecht
- Beispiel: club-spezifische Praeferenzen oder Overlays
- UI:
  - `form` oder `mixed`
  - nur rendern, wenn Club-Schreibrecht vorhanden

### `billing_snapshot`
- Rechnungen, Beitraege, Zahlungsstaende, SEPA-Snapshots
- Quelle ist fachlich sensibel und oft append- oder snapshot-basiert
- UI:
  - meist `readonly`, `table` oder `mixed`
  - keine freie Feldbearbeitung im Standard-Settings-Formular

### `consent_append_only`
- Datenschutz, AGB, Akzeptanzereignisse
- nie ueberschreiben, nur neue Zustimmung oder neuer Event
- UI:
  - `actions`, `readonly`, `mixed`
  - nie klassisches `form-save`

## 5. Panel-Klassifikation

### `readonly`
- einzelner Datensatz
- lesbare Werte
- kein direkter Write-Pfad
- Beispiel:
  - Mitgliedsnummer
  - Vereinscode
  - Billing-Status
  - Consent-Historie kompakt

### `form`
- editierbare Felder eines klaren Objekts
- ein definierter Save-Pfad
- Beispiel:
  - globales Profil
  - Benachrichtigungskanaele
  - club_override Praeferenzen

### `table`
- mehrzeilige gleichartige Datensaetze
- Uebersicht statt Einzelobjekt
- Beispiel:
  - Sitzungen
  - Rechnungen
  - aktive Sessions
  - Vereine des Benutzers

### `actions`
- primaer Buttons oder Prozessaktionen
- kein klassischer Datensatz-Editor
- Beispiel:
  - Passwort aendern
  - Verifikationsmail senden
  - App neu laden
  - Datenexport starten

### `mixed`
- kombiniert Status + Readonly + Aktionen + eventuell Mini-Liste
- Beispiel:
  - Sicherheit
  - Rechtliches
  - Billing-Uebersicht mit Link oder Aktion

## 6. Permission Modell

### Permissions bestehen aus
- `view`
- `write`
- `update`
- `delete`
- `roles`

### Auswertungsreihenfolge
1. Rollenpruefung
2. Scope-Pruefung
3. Action-Pruefung
4. Write-Binding-Pruefung

### Regel
- Wenn Rollen nicht passen -> nicht rendern
- Wenn Scope nicht passt -> Feld readonly oder ganz ausblenden
- Wenn Write-Pfad fehlt -> niemals editierbar rendern
- Wenn auth- oder consent-kritisch -> niemals als normales Formular rendern

### Was niemals gerendert werden darf
- Felder ohne Leseberechtigung
- sicherheitskritische Rohdaten
- interne technische IDs ohne Nutzwert
- auth-kritische Bearbeitung als gewoehnliches Form-Panel
- append-only Daten als ueberschreibbare Form
- Felder mit unbekanntem Ownership-Modell

### Field-Level Regel
- Panel darf sichtbar sein
- einzelne Felder darin duerfen trotzdem readonly oder unsichtbar sein
- Feldrechte schlagen Panel-Bequemlichkeit

## 7. Standard-Sections fuer Settings

Diese Struktur ist fix, auch wenn einzelne Panels je Installation fehlen koennen.

### `profile_clubs`
- Globales Profil
- Vereinskontexte
- Mitgliedschaftsuebersichten je Verein
- club-readonly Stammdaten

### `security`
- Passwort / Login
- Verifizierung / MFA
- aktive Sitzungen
- auth- und identity Status

### `notifications`
- globale Kanaele
- Inhaltspraeferenzen
- gegebenenfalls club-spezifische Notification-Overlays

### `billing`
- globale Zahlungsdaten
- Beitraege und Rechnungen je Verein
- billing snapshots, Forderungen, Dokumente

### `legal`
- Datenschutz
- AGB
- Einwilligungen
- Datenexport / Account-Loeschung
- append-only consent actions

### `app_system`
- App-Version
- Update
- Reload
- Geraete- und Push-Status
- lokale technische Praeferenzen

## 8. Deterministische Ableitungsregeln

Wenn Architektur liefert:
- SQL-Tabelle, View oder RPC
- Feldliste
- Scope
- Ownership
- Write-Pfad
- Rollen

Dann muss Codex deterministisch ableiten:

### Section
- nach fachlicher Domaene

### Panel
- nach Datenobjekt oder Prozessblock

### `renderMode`
- nach Datentyp und Write-Charakter

### Permissions
- aus Rolle, Scope und Prozess

### `saveBinding`
- direkt aus freigegebenem Write-Pfad

### Field config
- aus SQL-Feld, Scope und Editierbarkeit

## 9. Entscheidungsbaum

### Frage 1: Ist das Objekt global oder club-scoped?
- global -> eher `profile_clubs`, `security`, `app_system`
- club-scoped -> `profile_clubs`, `notifications`, `billing`

### Frage 2: Gibt es genau einen Datensatz und einen legitimen Write-Pfad?
- ja -> `form`
- nein -> weiter

### Frage 3: Ist es append-only, snapshot, history oder consent?
- ja -> `readonly`, `table` oder `actions`
- nein -> weiter

### Frage 4: Besteht der Bereich primaer aus Prozessaktionen?
- ja -> `actions`
- nein -> weiter

### Frage 5: Sind es mehrere gleichartige Zeilen?
- ja -> `table`
- nein -> `readonly` oder `mixed`

## 10. Minimaler Input fuer zukuenftige Generierung

Damit Codex ohne Rueckfragen eine `settingsConfig` erzeugen darf, muss Architektur pro Panel liefern:

```js
{
  section: "billing",
  panel_id: "club_invoices",
  source_table: "public.financial_documents",
  source_kind: "table",
  fields: [
    { name: "document_no", type: "text", scope: "billing_snapshot" },
    { name: "status", type: "text", scope: "billing_snapshot" },
    { name: "amount_gross", type: "numeric", scope: "billing_snapshot" }
  ],
  ownership: "club_scoped",
  roles: ["member", "admin", "vorstand"],
  write_path: null,
  load_path: "rpc:public.get_member_billing_overview",
  process_type: "snapshot_read"
}
```

Daraus folgt deterministisch:
- Section = `billing`
- Panel = `club_invoices`
- `renderMode` = `table`
- permissions = view only
- `saveBinding` = `none`
- field scopes = `billing_snapshot`

## 11. Normierte Werte

### `source_kind`
Nur diese Werte sind erlaubt:
- `record`
- `table`
- `process`
- `snapshot`
- `append_only`

### `ownership`
Nur diese Werte sind erlaubt:
- `global_user`
- `auth_system`
- `club_scoped`
- `club_override`
- `billing_snapshot`
- `consent_append_only`

### `load_path`
Format:
- `rpc:public.function_name`
- `edge:function-name`
- `auth:action_name`
- `local:key_name`

### `write_path`
Format:
- `rpc:public.function_name`
- `edge:function-name`
- `auth:action_name`
- `local:key_name`
- `none`

## Kurzform

Fuer FCP gilt kuenftig:

- SQL + Prozesskontext definieren Wahrheit
- `QuickFlowPattern` definiert Maskenstruktur
- `settingsConfig` ist die deterministische Uebersetzungsschicht
- kein Panel ohne klaren Scope
- kein editierbares Feld ohne klaren Write-Pfad
- kein auth- oder consent-kritischer Flow als normales Form-Panel
- Rollen + Scopes filtern Sichtbarkeit und Editierbarkeit
- Settings bestehen immer aus fixen Standard-Sections und klar klassifizierten Panels
