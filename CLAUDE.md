@AGENTS.md

## Checks

Before committing or deploying: `npx vitest run`, `npx tsc --noEmit`, `npx eslint lib components app`, `npx next build`.

## Local

- Local Supabase (Docker) uses ports 553xx: `npx supabase start` / `npx supabase stop`. Stop it when done.
- E2E: `npx playwright test` reuses a server on port 3000 — kill any stale `next dev` first.
- Never set `NEXT_PUBLIC_DEV_LOGIN` in production. Never change `AI_KEY_SECRET` on a deployed app: it decrypts the saved AI keys.

## Deploy

`bash scripts/deploy.sh` (or `--skip-db` when there is no new migration) pushes new migrations to Supabase, then deploys
to Vercel, using only the credentials in `.env.deploy` (gitignored). Machine-specific rules go in `CLAUDE.local.md`
(gitignored).
