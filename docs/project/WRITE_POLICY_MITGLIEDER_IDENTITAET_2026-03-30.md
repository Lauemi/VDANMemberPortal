# Write Policy: Mitglieder und Identität

Stand: 2026-03-30

## Zweck

Diese Policy definiert die erlaubten Schreibpfade für Vereins-, Mitglieder- und Identitätsdaten.

Ziel:

- einheitliche Datenanlage
- keine stillen Architekturabweichungen
- keine Umgehung der definierten Schlüsselkette

## Verbindliche Schlüsselkette

- `club_id` = technischer Tenant-Anker
- `club_code` = sichtbarer Kurzcode, Lookup und Kommunikation
- `member_no` = interne System-ID
- `club_member_no` = sichtbare Vereinsnummer

## Grundregel

Alle fachlichen Relationen und alle tenantbezogenen Zugriffe laufen über `club_id`.

Nicht zulässig:

- `club_code` als Tenant-Anker
- `club_member_no` als Rechte- oder Isolationsanker
- `profiles` als Ersatz für Mitgliedsanlage

## Erlaubte Write-Pfade

### Tabelle `club_members`

Erlaubt nur über:

- `admin_member_registry_create`
- `admin_member_registry_update`

### Tabelle `members`

Erlaubt nur über:

- `admin_member_registry_create`
- `admin_member_registry_update`
- `self_member_profile_update`

Hinweis:

- `self_member_profile_update` darf nur fachliche Mitgliedsdaten des bereits zugeordneten Mitglieds aktualisieren
- `self_member_profile_update` ist kein Anlagepfad

### Tabelle `club_member_identities`

Erlaubt nur über:

- `club-invite-claim`
- `club-admin-setup`

### Tabelle `profiles`

Erlaubt nur für:

- User-Kontext
- Anzeige-/Account-Kontext
- Karten-/Token-/Self-Service-Kontext
- technische Ergänzungen wie `profile-bootstrap`

Nicht zulässig:

- `profiles` als Quelle für echte Mitgliedsanlage
- `profiles` als Ersatz für `club_members` oder `members`

## Verbotene Direktpfade

Direkte Inserts oder Updates außerhalb der erlaubten Pfade gelten als Architekturverstoß, insbesondere bei:

- `club_members`
- `members`
- `club_member_identities`

Nicht zulässig sind:

- neue operative Direkt-Inserts in SQL, Edge Functions oder Frontend-Code
- neue Schreibpfade, die die Registry-Funktionen umgehen
- neue Join- oder Claim-Logik, die `club_code` oder `club_member_no` zum technischen Primäranker macht

## Technische Leitlinie

### `club_id`

- steuert RLS
- steuert Tenant-Isolation
- steuert Relationen

### `club_code`

- dient nur für Lookup
- dient für Anzeige
- dient für Kommunikation
- darf geändert werden, ohne technische Relationen zu brechen

### `member_no`

- ist interne System-ID
- wird nicht fachlich manuell vergeben
- wird nicht als sichtbare Vereinsnummer verwendet

### `club_member_no`

- ist sichtbare Vereinsnummer
- ist im Verein eindeutig
- darf für Eingabe und Auflösung verwendet werden
- darf nie Tenant-Anker oder Rechteanker sein

## Review-Regel

Jede neue Funktion, RPC, Migration oder UI mit Schreibzugriff auf Mitglieder- oder Identitätsdaten muss gegen diese Policy geprüft werden.

Prüffragen:

1. Schreibt der Pfad in eine erlaubte Tabelle?
2. Nutzt er den dafür freigegebenen kanonischen Write-Pfad?
3. Bleibt `club_id` der technische Anker?
4. Bleiben `club_code` und `club_member_no` rein fachlich bzw. kommunikativ?

Wenn eine dieser Fragen mit Nein beantwortet wird, ist der Pfad vor Merge anzupassen.
