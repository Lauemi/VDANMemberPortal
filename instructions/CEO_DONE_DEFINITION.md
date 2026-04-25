# CEO Done-Definition – Repo-Wahrheit und Abschlussstatus

## Zweck

Diese Instruction verhindert, dass Agenten oder der CEO einen Task zu früh als `Done` melden.

Ein Task gilt im FCP / VDANMemberPortal erst dann als abgeschlossen, wenn der relevante Stand fuer Michael sichtbar, repo-reproduzierbar und im vorgesehenen Zielzustand angekommen ist.

## Grundregel

Branch ist nicht Done.
Lokaler Workspace ist nicht Done.
Review approved ist nicht Done.
Smoke-Test bestanden ist nicht automatisch Done.

Done entsteht erst, wenn der Zielzustand erreicht ist.

## Statusbegriffe

### 1. Local implementation complete

Code wurde lokal erzeugt, aber noch nicht nach GitHub gepusht.

Status:
`local implementation complete`

Nicht erlaubt:
`done`

Pflichtangaben:
- lokaler Commit, falls vorhanden
- Workspace/Agent
- Push-Blocker, falls vorhanden

### 2. Branch pushed

Code wurde nach GitHub gepusht, aber liegt nur auf Feature-Branch.

Status:
`branch pushed`

Nicht erlaubt:
`done`

Pflichtangaben:
- Branch
- Remote-Commit-SHA
- GitHub-Branch-Link
- Vergleich zu `main`
- PR-Status

### 3. PR open

Ein Pull Request gegen `main` existiert.

Status:
`PR open`

Nicht erlaubt:
`done`

Pflichtangaben:
- PR-Link
- Head-SHA
- Base-Branch
- CI-/Check-Status
- Review-Status
- Merge-Blocker

### 4. Ready to merge

PR ist reviewed, CI gruen und mergefaehig.

Status:
`ready to merge`

Nicht erlaubt:
`done`, ausser Merge ist explizit nicht Ziel des Tasks und wurde so vorher definiert.

Pflichtangaben:
- PR-Link
- finaler Head-SHA
- CI gruen / nicht vorhanden / blockiert
- Review approved
- offene Risiken

### 5. Done

Ein Task darf erst als `Done` gemeldet werden, wenn mindestens eine der folgenden Bedingungen erfuellt ist:

1. Der Code ist nach `main` gemerged.
2. Oder: Der Task war ausdruecklich nur als PR-Erstellung definiert und der PR ist offen, reviewed oder ready-to-merge.
3. Oder: Es handelt sich um reine Dokumentation/Instruction und der Commit liegt direkt auf dem vorgesehenen Zielbranch.

Fuer normale Implementierungsaufgaben gilt:

> Done = Zielbranch erreicht, in der Regel `main`.

## Pflicht-Check vor Done-Meldung

Vor jeder Done-Meldung muss der CEO oder verantwortliche Agent pruefen:

- Ist der Stand in GitHub sichtbar?
- Liegt er auf dem Zielbranch oder nur auf einem Feature-Branch?
- Gibt es einen PR?
- Ist der PR gemerged?
- Wurde der richtige Commit/SHA genannt?
- Wurde der passende Testbefehl genannt?
- Wurde der Test tatsaechlich ausgefuehrt oder nur vorbereitet?
- Gibt es offene Blocker?

## Pflichtformat fuer Abschlussberichte

Jeder technische Abschlussbericht muss enthalten:

```md
Status: [local implementation complete | branch pushed | PR open | ready to merge | done]

Repo: `Lauemi/VDANMemberPortal`
Branch:
Commit-SHA:
PR:
Main integriert: ja/nein
CI/Tests:
Review:
Offene Blocker:
Naechster Schritt:
```

## Verbotene Formulierungen

Nicht verwenden, solange der Stand nicht wirklich abgeschlossen ist:

- `done`
- `abgeschlossen`
- `fertig`
- `geliefert`
- `QA abgeschlossen`
- `ready`, wenn eigentlich nur lokal oder nur Branch

Bessere Formulierungen:

- `Implementation complete, push pending`
- `Branch pushed, PR pending`
- `PR open, merge pending`
- `Review approved, merge pending`
- `Merged to main, done`

## Beispiel MINA-66 Learning

Fehler:
Ein Agent meldete `MINA-66 done`, obwohl der Commit nur auf einem Feature-Branch lag und kein PR nach `main` existierte.

Korrekte Bewertung:

```txt
Implementierung: ja
Branch gepusht: ja
PR: nein
main integriert: nein
Done: nein
```

Erst nach PR-Erstellung und Merge nach `main` darf ein normaler Implementierungsauftrag als Done gewertet werden.

## CEO-Regel

Der CEO muss kuenftig zwischen Arbeitsfortschritt und Projektwahrheit unterscheiden:

- Paperclip-Status zeigt Fortschritt.
- GitHub-Branch zeigt reproduzierbare Arbeit.
- Pull Request zeigt Integrationsabsicht.
- `main` zeigt Produktwahrheit.

Wenn unklar ist, welcher Status gilt, muss der CEO `blocked / clarification required` melden, nicht `done`.

## Merksatz

> Branch ist Fortschritt. PR ist Uebergabe. Main ist Wahrheit. Done ist erst nach Zielzustand.
