# Process Source Of Truth
Stand: 2026-03-28

## Zweck
Diese Datei definiert, wie produktkritische Prozesse im Projekt beschrieben, umgesetzt und abgesichert werden.

Sie ist die Arbeitsregel fuer:
- Engineers
- Product / CTO
- KIs und Agenten

Ziel ist, dass ein Prozess nicht nur im Code existiert, sondern eindeutig dokumentiert, nachvollziehbar angebunden und pruefbar ist.

## Grundsatz
Bei kritischen Prozessen gilt nicht:

"Der Prozess ist das, was gerade irgendwie im Code steckt."

Sondern:

"Der Prozess ist nur dann freigegeben, wenn visuelle Beschreibung, technische Spezifikation, Code-Anbindung und Verifikation zusammenpassen."

## Was ist ein kritischer Prozess?
Dieses Muster ist verpflichtend fuer Prozesse mit mindestens einem der folgenden Merkmale:
- mehrstufige User Flows
- Routing- oder Guard-Logik
- Rollen- oder Governance-Entscheidungen
- Statuswechsel in DB oder Workflow
- Mail-, Notification- oder Freigabe-Logik
- rechtliche oder onboarding-relevante Abläufe
- Prozesse, die von mehreren Teams oder KIs angefasst werden koennen

Beispiele:
- Club-Request-Onboarding
- Invite / VereinsSignIn
- Freigabeprozesse
- Identity- oder Legal-Checks
- Billing-nahe Aktivierungsprozesse

## Pflichtartefakte pro Prozess
Jeder kritische Prozess braucht diese vier Ebenen:

### 1. Visual Flow
Typisch: `draw.io`

Zweck:
- Prozess fuer Menschen schnell lesbar machen
- Einstieg, Entscheidungen, Seitenspruenge, Guards, Mails und Endzustaende sichtbar machen

Regel:
- Das Diagramm zeigt den echten aktuellen Prozess
- keine historischen Zwischenzustaende als aktuelles IST tarnen
- wenn Legacy noch existiert, dann explizit als Legacy markieren

### 2. Technische Spezifikation
Typisch: `docs/project/<prozess>.md`

Muss enthalten:
- Zweck
- Source of Truth
- Prozessregeln
- Traceability Matrix
- Mail-/Kommunikationsmatrix, falls relevant
- Acceptance Checklist

Zweck:
- bindet Diagramm an echten Code
- verhindert, dass KIs oder Menschen den Prozess frei interpretieren

### 3. Code-Anbindung
Der Prozess muss in zentralen Laufzeitstellen klar auffindbar sein:
- Frontend-Routen
- zentrale JS-/TS-Flows
- Edge Functions
- Guards
- DB-Statuswechsel

Regel:
- Prozessschritte muessen sich gegen konkrete Dateien und Laufzeitpfade zurueckverfolgen lassen
- implizite Magie ohne Traceability ist bei kritischen Prozessen nicht akzeptabel

### 4. Verifikation
Jeder kritische Prozess braucht pruefbare Akzeptanz:
- Acceptance Checklist
- Smoke-Pfade
- wenn sinnvoll: automatische Tests oder Gate-Skripte

Regel:
- "sieht richtig aus" ist keine ausreichende Verifikation
- "lief im Einzelfall einmal" ist ebenfalls keine ausreichende Verifikation

## Minimalstandard fuer neue Prozesse
Wenn ein neuer kritischer Prozess eingefuehrt wird, muss mindestens erstellt werden:
1. `draw.io`-Flow
2. technische Begleitdatei `.md`
3. Traceability Matrix
4. Acceptance Checklist

Ohne diese vier Punkte gilt der Prozess nicht als sauber eingefuehrt.

## Aenderungsregel
Wenn ein bestehender kritischer Prozess geaendert wird, muessen gemeinsam aktualisiert werden:
1. Visual Flow
2. technische Spezifikation
3. betroffene Codepfade
4. Acceptance / Verifikation

Eine Codeaenderung allein gilt bei solchen Prozessen nicht als "fertig".

## Regel fuer KIs und Agenten
Wenn eine KI an einem kritischen Prozess arbeitet, ist die Reihenfolge:
1. Visual Flow lesen
2. technische Spezifikation lesen
3. Traceability Matrix gegen Code pruefen
4. erst dann Implementierung oder Aenderung vornehmen
5. danach Acceptance Checklist gegen den neuen Stand pruefen

Wenn Visual Flow, Spezifikation und Code nicht zusammenpassen:
- darf die KI den Prozess nicht frei raten
- sie muss den Widerspruch offen benennen
- und den Prozess wieder auf einen konsistenten Stand bringen

## Freigaberegel
Ein kritischer Prozess darf als "abgesichert" gelten, wenn:
- das Diagramm den aktuellen Laufzeitprozess korrekt zeigt
- die Spezifikation auf aktuelle Dateien verweist
- die Traceability Matrix ohne Luecken aufloesbar ist
- die Acceptance Checklist gegen den aktuellen Stand gruendlich abgearbeitet wurde

## Aktueller Referenzprozess
Das erste vollstaendig nach diesem Muster gefuehrte Beispiel ist:
- [onboarding_club_request_flow.drawio](/Users/michaellauenroth/Downloads/vdan-app-template/docs/project/onboarding_club_request_flow.drawio)
- [onboarding_club_request_flow.md](/Users/michaellauenroth/Downloads/vdan-app-template/docs/project/onboarding_club_request_flow.md)

Dieses Paar ist die Referenz dafuer, wie kuenftige kritische Prozesse im Projekt aufgebaut werden sollen.
