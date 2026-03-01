# Tech Risiko Matrix - Fishing-Club-Portal

Stand: 2026-03-01
Zweck: Verbindliche Betreiber-Risikoliste fuer Betrieb, Audit und Release-Entscheidungen.

## Bewertungsmodell
- Impact: `hoch` / `mittel` / `niedrig`
- Wahrscheinlichkeit: `hoch` / `mittel` / `niedrig`
- Testzyklus: `pro release` / `monatlich` / `quartalsweise`

## Risiko-Matrix
| ID | Risiko | Impact | Wahrscheinlichkeit | Gegenmassnahme | Owner | Testzyklus |
| --- | --- | --- | --- | --- | --- | --- |
| TR-001 | RLS-Performance bricht Listen/Feeds | hoch | mittel | RLS-Policies vereinfachen, passende Indizes (`club_id`,`user_id`,`created_at`,`status`), Query-Plan regelmaessig pruefen | Backend | monatlich |
| TR-002 | SECURITY DEFINER Privilegienleck | hoch | mittel | Nur minimal einsetzen, `auth.uid()`/`club_id` in Function pruefen, `search_path` fix setzen, Code-Review Pflicht | Backend | pro release |
| TR-003 | Stale Permissions durch JWT | mittel | hoch | Kritische Rechte serverseitig pruefen, Session-Refresh bei Rollenwechsel, UI-Hinweis "neu anmelden" | Backend + Frontend | pro release |
| TR-004 | PWA Cache/Schema Drift nach Release | hoch | mittel | Version-Gate, Update-Prompt, SW `skipWaiting`, migrations rueckwaertskompatibel planen | Frontend | pro release |
| TR-005 | Offline Queue erzeugt Doppel-Submit | hoch | mittel | `client_request_id` je Aktion, DB Unique Constraint, idempotente Inserts/RPC | Backend | pro release |
| TR-006 | Offline Konflikte ueberschreiben Daten | hoch | mittel | `updated_at`/`updated_by`/`version`, Konfliktdialog oder Merge-Regeln | Produkt + Backend | pro release |
| TR-007 | Realtime verursacht Mobil-Akku/Limit-Probleme | mittel | mittel | Realtime nur wo noetig, Debounce/Throttling, Reconnect-Verhalten beobachten | Frontend | monatlich |
| TR-008 | Storage-RLS macht Dateien versehentlich oeffentlich | hoch | mittel | Private Buckets, kurze signed URLs, Pfadkonzept mit `club_id/user_id`, Policy-Tests | Backend | pro release |
| TR-009 | CORS/Redirect/CSP brechen Auth nach Domainwechsel | hoch | hoch | Env-Checkliste je Umgebung, Redirect- und Origin-Liste gepflegt, Smoke-Test vor Go-Live | DevOps | pro release |
| TR-010 | Push faellt wegen VAPID/Token-Mismatch aus | mittel | hoch | VAPID strikt pro Env, Token-Match pruefen, Device-Subscription Monitoring | DevOps + Frontend | pro release |
| TR-011 | Multi-Tenant spaeter teuer wegen fehlendem `club_id` | hoch | mittel | Jede relevante Tabelle mit `club_id`, Ownership-Konzept dokumentieren, RLS darauf ausrichten | Architektur | pro release |
| TR-012 | Fehlende Audit-Logs erschweren Vorfallaufklaerung | hoch | mittel | Audit-Log fuer kritische Aktionen, Soft-Delete/History fuer sensible Daten | Backend | monatlich |
| TR-013 | Backup vorhanden, aber Restore ungetestet | hoch | mittel | Quartalsweiser Restore-Drill in Staging mit Zeitmessung und Protokoll | DevOps | quartalsweise |
| TR-014 | Keine Key-Rotation bei Secret-Leak | hoch | mittel | Rotationsplan fuer `SERVICE_ROLE`,`VAPID`,`PUSH_NOTIFY_TOKEN`, Uebergangsfenster ohne Downtime | DevOps | quartalsweise |
| TR-015 | Abuse/Spam/Bruteforce erzeugt Kosten und Stoerungen | hoch | hoch | Rate-Limits, Captcha, Abuse-Regeln fuer Login/Upload/Kontakt/Push-Trigger, Monitoring | DevOps + Backend | pro release |

## Operative Mindest-Gates
- [ ] TR-013 Restore-Drill im letzten Quartal nachweisbar.
- [ ] TR-014 Key-Rotation-Plan dokumentiert und aktuell.
- [ ] TR-015 Abuse-Schutz fuer Kontakt, Login, Upload und Push verifiziert.
- [ ] Kritische Risiken mit Impact `hoch` haben einen benannten Owner.
