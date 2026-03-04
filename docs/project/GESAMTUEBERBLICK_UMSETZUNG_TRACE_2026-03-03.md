# Gesamtüberblick Umsetzung (Trace)

Stand: 2026-03-03  
Arbeitsbranch: `prep_vercel_multienv_admin_tools`  
Schutzregel: `main` bleibt VDAN-Sicherung bis finaler Cutover.

## 1) Statuslegende
- `[x]` erledigt
- `[ ]` offen
- `[~]` geändert/in Arbeit (noch nicht final deployt)
- `~~alt~~ -> neu` = bewusst ersetzter Stand

## 2) Harte Leitplanken (Branch/Deploy)
- [x] Vercel-Workflow auf Prep-Branch begrenzt
  - `~~push: develop,beta,main~~ -> push: prep_vercel_multienv_admin_tools`
  - Airbag-Guard ergänzt: `if github.ref == refs/heads/prep_vercel_multienv_admin_tools`
  - Nachweis: `.github/workflows/deploy-vercel.yml`
  - Commit: `823a315`
- [x] Verifiziert: `main`-Push wird in Vercel ignoriert (Test-Commits durchgeführt)
  - Commits: `116b5b9`, `b00d1ce`
- [x] DNS für FCP-Domain auf Vercel validiert
  - `fishing-club-portal.de` / `www.fishing-club-portal.de` = Valid Configuration

## 3) FCP Lockdown / Public Surface
- [x] Startseite auf Lockdown-/Teaser-Betrieb umgestellt
  - Kein aktives Navigieren auf FCP-Produktionsseite
  - Nachweis: `src/layouts/Site.astro`, `src/pages/index.astro`
  - Commit: `53f343c`
- [x] Lockdown per Env-Flag steuerbar
  - `PUBLIC_SITE_LOCKDOWN=true` (deploy)
  - Lokal dev ausgenommen: `import.meta.env.DEV` -> Lockdown aus
  - Nachweis: `src/layouts/Site.astro`, `env/.env.example`
- [~] Logo-Feinjustierung im Header und Startseite (>=100px ohne Header-Wachstum)
  - Nachweis: `public/css/main.css`, `src/pages/index.astro`, `src/layouts/Site.astro`
  - Hinweis: aktuell lokal geändert, noch nicht separat committet

## 4) Branding / Icons / Assets
- [x] Neues Branding eingebunden (WEBPNG/WEBSVG)
  - Nachweis: `public/Branding/*`, `src/layouts/Site.astro`, `src/pages/index.astro`
  - Commit: `53f343c`
- [x] Favicon-/App-Icons auf neues Set umgestellt
  - `icon.png`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `favicon.svg`
  - Commit: `7494650`
- [x] Große VDAN-Bildlast für FCP-Deploy entfernt
  - `~~public/Bilder~~ -> entfernt`
  - `~~public/galery~~ -> entfernt`
  - `~~public/Angelfest.png, public/Flammlachs2023.jpg~~ -> entfernt`
  - Commit: `7494650`

## 5) Ops / Secrets / Runbooks
- [x] Ops-Struktur ergänzt
  - `docs/ops/ENV_MATRIX.md`
  - `docs/ops/SECRETS_MATRIX.md`
  - `docs/ops/VERCEL_ENV_SETUP_PREP_BRANCH_2026-03-03.md`
  - `docs/runbooks/SECRETS_ROTATION_RUNBOOK.md`
  - Commit: `8a6e81d`
- [x] Secrets-Tooling ergänzt
  - `scripts/secrets-generate.sh`
  - `scripts/secrets-apply.sh`
  - `scripts/key-change-secrets.sh`
  - Commit: `8a6e81d`
- [x] Vercel Import-Template angelegt
  - `env/vercel-prep-import.example.env`
  - Commit: `8a6e81d`

## 6) DB / Security-Baseline Vorbereitung
- [x] Staging-Hardening SQL-Paket ergänzt
  - `docs/supabase/60_staging_full_setup_schema.sql`
  - `docs/supabase/61_staging_multitenant_hardening.sql`
  - `docs/supabase/61_STAGING_HARDENING_RUNBOOK_2026-03-02.md`
  - `docs/supabase/62_roles_extension_orga_roles.sql`
  - Commit: `c3435ba`
- [x] Rollenmodell erweitert (Orga-Rollen)
  - `webmaster`, `gewaesserwart`, `kassenwart`, `schriftfuehrer`, `jugendwart`
  - Nachweis: SQL + Mitgliederverwaltung UI
  - Commit: `c3435ba`

## 7) Recht / Compliance (Plattformsetup)
- [~] Datenschutz auf Plattformbetrieb angepasst
  - Nachweis: `src/pages/datenschutz.html.astro`
- [~] Nutzungsbedingungen auf Plattform-/Mandantenmodell angepasst
  - Nachweis: `src/pages/nutzungsbedingungen.html.astro`
- [~] Impressum auf Plattformbetrieb aktualisiert
  - Nachweis: `src/pages/impressum.html.astro`
- Hinweis: Änderungen lokal vorhanden, noch nicht als eigener Commit gepusht.

## 8) Board-/Plan-Dokumente
- [x] Ablaufplan mit Security-Phasen erstellt
  - `docs/project/ABLAUFPLAN_FCP_CUTOVER_SECURITY_2026-03-03.md`
- [x] Board-/Cutover-/Strategie-Dokumente fortgeschrieben
  - `docs/project/BOARD_SCRIPT_PLATFORM_EXECUTION_2026-03-01.md`
  - `docs/project/VERCEL_CUTOVER_RUNBOOK_2026-03-01.md`
  - `docs/project/DEPLOY_STRATEGIE_VDAN_UND_FCP_MULTI_ENV_2026-03-01.md`
  - Commit: `8a6e81d`

## 9) Noch offen (priorisiert)
- [ ] Vercel Envs final mit echten Secrets statt Placeholder befüllen
- [ ] Staging-Smoketest protokollieren
- [ ] Rechtstexte juristisch final prüfen/freigeben
- [ ] Multi-Tenant P0-Audits (RLS/club_id/definer) operativ abhaken
- [ ] Excel-Artefakte optional committen oder bewusst außen vor halten

## 10) Änderungsprotokoll (kompakt)
1. `~~main/develop/beta Vercel Auto-Deploy~~ -> `prep`-only Vercel Deploy
2. `~~öffentliche Website mit Menüs/Modulen~~ -> geschlossene Lockdown-Landing
3. `~~alte VDAN-Medien im FCP-Build~~ -> entfernt (Deploy-Last reduziert)
4. `~~altes Favicon-Set~~ -> neues Branding-Icon-Set
5. `~~VDAN-zentrierte Rechtstexte~~ -> Plattform-/Mandantenorientierte Arbeitsfassung

## 11) Referenz-Commits (chronologisch, neu -> alt)
- `7494650` chore(assets): remove legacy vdan media and switch to new favicon set
- `c3435ba` feat(db): add staging hardening pack and extend org roles model
- `8a6e81d` docs(ops): add env/secrets runbooks and vercel prep setup
- `53f343c` feat(fcp): add full lockdown landing with new branding assets
- `823a315` ci(vercel): deploy only prep branch with hard ref guard
- `b00d1ce` test: main should be ignored by vercel
- `116b5b9` test: vercel prep build

