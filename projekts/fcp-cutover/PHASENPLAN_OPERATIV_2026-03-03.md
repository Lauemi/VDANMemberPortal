# FCP Cutover Projektplan (Operativ)

Stand: 2026-03-03
Branch: prep_vercel_multienv_admin_tools
Regel: main bleibt VDAN-Schutzlinie bis finaler Cutover.

## Projektziel
Fishing-Club-Portal parallel aufbauen, sicher betreiben und erst nach Go/No-Go kontrolliert auf main übernehmen.

## Phase 1 - Fundament (P0)
Ziel: Sicherheits- und Betriebsbasis dicht.

### Aufgaben
- [ ] Vercel/Supabase Secrets final setzen (keine Placeholder in produktiv genutzten Envs)
- [ ] RLS Audit komplett (club_id, policies, negative Zugriffstests)
- [ ] SECURITY DEFINER Review (auth.uid + club_id + search_path)
- [ ] Idempotenz-Tests für kritische Schreibpfade
- [ ] Staging Smoke-Test dokumentieren

### Exit-Kriterium
- [ ] Alle P0-Checks grün
- [ ] Kein offener kritischer Security-Blocker

## Phase 2 - Betriebsstabilität (P1)
Ziel: Reale Stabilität unter Last und Fehlern.

### Aufgaben
- [ ] Login/Session Rollenwechsel End-to-End testen
- [ ] Upload-Flow und Push-Flow mit Fehlerfällen testen
- [ ] Offline/Retry/Konfliktfälle testen
- [ ] Logs/Fehlerbilder dokumentieren

### Exit-Kriterium
- [ ] 3 Kernszenarien reproduzierbar stabil
- [ ] Keine offenen P0/P1 Incident-Risiken

## Phase 3 - Cutover-Fähigkeit
Ziel: prep -> main technisch und organisatorisch freigabefähig.

### Aufgaben
- [ ] Cutover-Checkliste final
- [ ] Rollback-Test real durchgeführt
- [ ] Freeze-Fenster und Go/No-Go Termin festgelegt
- [ ] Kommunikationsplan (Board/VDAN) final

### Exit-Kriterium
- [ ] Go/No-Go dokumentiert
- [ ] Merge prep -> main freigegeben

## Arbeitsmodus
- [ ] Jede Änderung als kontrollierter Commit-Block
- [ ] Vor Push immer Build-Check
- [ ] Keine Änderungen auf main ohne explizite Freigabe
- [ ] Statuspflege in diesem Dokument nach jedem Arbeitspaket

## Nächste 5 Schritte (jetzt)
1. [ ] Placeholder-Secrets in Vercel-Env ersetzen
2. [ ] Phase-1 RLS Audit starten
3. [ ] Definer/RPC-Inventar durchgehen
4. [ ] Idempotenz-Testfälle aufsetzen
5. [ ] Staging Smoke-Testlauf protokollieren

