# SQL Contracts

SQL ist im FCP-Maskensystem der Datenvertrag.
JSON ist der Sichtvertrag.

Diese Ordnerstruktur macht bestehende oder geplante SQL-Wahrheiten fuer ADM/QFM-Bereiche sichtbar, ohne die produktive Runtime neu zu bauen.

## Grundsatz

- Produktive Wahrheit bleibt in Supabase/Postgres:
  - Tabellen
  - Views
  - RPCs
  - Edge-Reads/-Writes
  - Migrationen
- Diese Dateien sind lesbare Referenzvertraege im Repo.
- JSON-Masken koppeln sich ueber `meta.sqlContract` explizit an diese Dateien.

## Aufbau

- Primaere Ablage ist pro Prozess unter:
  - `docs/sql-contracts/processes/<prozess>/...`
- Dort liegen die SQL-Vertraege in den fachlichen Kanaelen des Prozesses.
- Aeltere bereichsorientierte Ordner koennen als Uebergangs-/Legacy-Ablage bestehen bleiben, sind aber nicht die bevorzugte Einstiegsstruktur.
- Pro Bereich liegt mindestens eine `READ_*.sql`-Datei vor.
- Wenn die produktive Wahrheit schon bekannt ist, referenziert die Datei den echten Source-Vertrag.
- Wenn die Businesslogik noch nicht final ist, bleibt ein strukturierter Platzhalter mit erwarteten Alias-Namen bestehen.

## Koppelung in JSON

Jeder datengetriebene Panelblock kann in `meta.sqlContract` enthalten:

```json
"sqlContract": {
  "sqlFile": "docs/sql-contracts/<bereich>/READ_<name>.sql",
  "expectedColumns": ["..."]
}
```

Dabei gilt:

- `expectedColumns` kommen aus bestehenden `columns[].key`
- oder aus bestehenden `fieldDefs[].name` / `content.fields[].valuePath`
- bestehende `loadBinding`, `saveBinding`, Actions und Dialoge werden nicht ersetzt

## Neue Bereiche anlegen

1. Fachbereich in der bestehenden Maske identifizieren
2. Live-Read/Write/Delete/Action-Vertrag pruefen
3. SQL-Wahrheit bestimmen:
   - Tabelle
   - View
   - RPC
   - Edge Function
   - oder noch offen
4. Passende `READ_*.sql`-Datei anlegen
5. `meta.sqlContract` in der JSON-Maske ergaenzen
6. Nur Inkonsistenzen dokumentieren, keine funktionierende Runtime still umbauen

## Empfohlene Prozesskanaele

- `docs/sql-contracts/processes/club-settings/`
- weitere Prozesse nach demselben Muster, z. B. `verein-anfragen`, `fangliste`, `eventplaner`

Jeder Prozesskanal sollte enthalten:

- eine eigene README mit:
  - betroffenen Masken
  - betroffenen Panels
  - zugehoerigen SQL-Dateien
  - offenen Vertragsluecken
- Unterordner pro Fachbereich innerhalb des Prozesses

## Was nicht veraendert werden darf

- bestehende `loadBinding`
- bestehende `saveBinding`
- bestehende Delete-/Action-Pfade
- bestehende Dialog-Mechanik
- bestehendes Inline-Table-Verhalten
- bestehende Runtime-Resolver

## Ziel

Diese Struktur soll:

- SQL-Wahrheit sichtbar machen
- JSON-Wahrheit pruefbar koppeln
- spaetere SQL-Anpassungen erleichtern
- KI-/Team-Zusammenarbeit vereinheitlichen
