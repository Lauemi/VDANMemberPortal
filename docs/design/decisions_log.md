# Design Decisions Log

## Vorlage

- Datum:
- Thema:
- Entscheidung:
- Grund:
- Betroffene Dateien:
- Offene Punkte:

---

## 2026-03-05

- Thema: Theme Default
- Entscheidung: Default auf `vdan_default`; `fcp_tactical` nur explizit.
- Grund: FCP-Theme darf nicht unbeabsichtigt global laufen.
- Betroffene Dateien: `src/config/app.ts`, `.env.example`
- Offene Punkte: Deployment-Env in allen Zielumgebungen konsistent prüfen.
