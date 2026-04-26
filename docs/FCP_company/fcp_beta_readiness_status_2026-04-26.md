# FCP Beta-Readiness — Board-Sync 2026-04-26

_Erstellt durch CEO-Agent nach MINA-150 Notfall-Synchronisation._

---

## Repo-wahrer Fixpunkt

| Artefakt | Wert |
|---|---|
| PR | `Lauemi/VDANMemberPortal#13` |
| Titel | MINA-97: Harden active-club context in invite dual-path flow |
| Status | **closed / merged** |
| Merge-Commit | `f47e20528405c99379d280d024e284bc6388c0ee` |
| Finaler Head vor Merge | `34f2af1a9d3a4a856ba56662b5b56134bcb0d684` |
| Merged at | `2026-04-26T10:55:55Z` |

---

## Geschlossen / superseded (nach PR #13 Merge)

| Issue | Paperclip-Status | Begründung |
|---|---|---|
| MINA-97 | in_review → **done** (Board-Direktive, manuell von Michael zu schließen) | PR #13 gemerged, Arbeit repo-wahr abgeschlossen |
| MINA-132 | done ✓ | Im PR #13 aufgegangen |
| MINA-134 | cancelled ✓ | Superseded durch Merge |
| MINA-140 | done ✓ | Im PR #13 aufgegangen |
| MINA-147 | done ✓ | Im PR #13 aufgegangen |
| MINA-149 | cancelled ✓ | CI-Fix superseded durch Merge |
| MINA-148 | done ✓ | SQL-Review obsolet nach Merge |
| MINA-145 | done ✓ | CEO-Merge-Entscheidung ausgeführt |

> **Hinweis MINA-97:** Die Paperclip-Review-Stage ist auf CTO-Agent gesperrt.
> CEO-Agent kann nicht direkt schließen. Michael muss MINA-97 manuell via Board auf `done` setzen.

---

## Wirklich offene nächste Themen

1. **MINA-98** — Multi-Verein Testpaket (Path A/B/C) auf `main` nach PR #13 Merge  
   Status: todo | Erst starten nach Codex-Token-Reset (nach 29.04.) und Board-Freigabe

2. **MINA-123** — ACL-Stub (acl_stub:v1) durch finales RBAC ersetzen  
   Status: in_review | Echter technischer Vor-Beta-Blocker

3. **MINA-118 / MINA-121** — Impressum §5 TMG + Datenschutz-Inventar  
   Status: in_review | Wartet auf Michael (Pflichtdaten / Legal-Freigabe)

4. **MINA-79 / PR #10** — ADM/QFM Review-PR  
   Status: blocked | Separates Thema, nicht mit PR #13 verwechseln

---

## Token- und Execution-Regeln ab 2026-04-26

- **Kein Codex** bis Token-Reset (Codex usage-limited bis 29.04.)
- Keine Retries auf erledigten PR-13-Nachläufen
- Keine parallelen Executor-Läufe auf dasselbe Issue/PR
- Claude nur für kompakte Ordnungs- und Statusarbeit
- Kein Vollaudit ohne neue Board-Freigabe
- Jeder neue Agentenauftrag braucht: Auftrag, Repo/Issue, relevante Dateien, erwartetes Ergebnis, maximaler Scope, Abbruchbedingung

---

## Wartet wirklich auf Michael

- MINA-97 manuell auf `done` setzen (Review-Stage-Sperre)
- MINA-121 Impressum-Pflichtdaten liefern (§5 TMG)
- MINA-118 / MINA-120 Datenschutz-Review freigeben
- Freigabe für MINA-98 Testpaket (nach Codex-Reset)
