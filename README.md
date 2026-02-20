# VDAN APP — Standard Template (Astro + Supabase + RLS)

This is a reusable scaffold for apps with:
- static Astro site (shared-hosting friendly),
- public pages + member-only area,
- Supabase Auth (email/password) + Row Level Security (RLS),
- GitHub Actions deployment (IONOS-ready).

## 1) Setup
```bash
npm i
cp .env.example .env
npm run dev
```

## 2) Supabase
Run the SQL files from `/docs/supabase/` in the Supabase SQL editor (service role).

Minimal baseline:
- profiles table linked to auth.users
- roles table + helper functions
- RLS policies (member sees only their rows; admin override)

## 3) Deploy
- adjust `.github/workflows/deploy-ionos.yml` (remote path + host)
- set GitHub Secrets (see workflow file)
- set `site` in `astro.config.mjs`

## 4) Customize
- change branding in `src/config/app.ts`
- edit public pages in `src/pages/`
- build member tools under `src/pages/app/`
