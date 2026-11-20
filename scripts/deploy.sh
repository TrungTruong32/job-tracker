#!/usr/bin/env bash
# Production deploy: new Supabase migrations (if any) then Vercel, with the credentials in .env.deploy.
# Usage: bash scripts/deploy.sh [--skip-db]
#
# Every CLI call uses only the tokens in .env.deploy, never whatever account the CLIs are logged in
# with, so a machine with other Vercel/Supabase logins cannot deploy to the wrong place.
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env.deploy ] || { echo "Missing .env.deploy (gitignored), see README > Deploy." >&2; exit 1; }
set -a
. ./.env.deploy
set +a
unset SUPABASE_ACCESS_TOKEN # ignore any global Supabase login; only this script's environment is affected

for v in SUPABASE_PROJECT_REF SUPABASE_DB_PASSWORD VERCEL_TOKEN; do
  [ -n "${!v:-}" ] || { echo "Missing $v in .env.deploy" >&2; exit 1; }
done

if [ "${1:-}" != "--skip-db" ]; then
  # session pooler (IPv4): the direct db host is IPv6-only
  pooler="${SUPABASE_POOLER_HOST:-aws-0-ap-southeast-1.pooler.supabase.com}"
  enc=$(python -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1],safe=''))" "$SUPABASE_DB_PASSWORD")
  npx supabase db push --yes --db-url "postgresql://postgres.$SUPABASE_PROJECT_REF:$enc@$pooler:5432/postgres"
fi

# .vercel/project.json (gitignored) picks the project; the token makes the CLI act as its owner
npx vercel deploy --prod --yes --token "$VERCEL_TOKEN"
