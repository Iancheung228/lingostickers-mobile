# Which Supabase project a script talks to. Source it from the repo root:
#   . scripts/lib/backend.sh
#
#   (default)              staging     .env             .maestro/qa.env
#   TABI_ENV=production    production  .env.production  .maestro/qa.production.env
#
# Sets ENV_FILE, QA_ENV_FILE, SUPABASE_URL and PROJECT_REF. Staging is the
# default on purpose: reaching real users' data takes saying so.
case "${TABI_ENV:-staging}" in
  staging)    ENV_FILE=.env;            QA_ENV_FILE=.maestro/qa.env ;;
  production) ENV_FILE=.env.production; QA_ENV_FILE=.maestro/qa.production.env ;;
  *) echo "TABI_ENV must be staging or production, not \"$TABI_ENV\"" >&2; exit 1 ;;
esac
[ -f "$ENV_FILE" ] || { echo "Missing $ENV_FILE (see RELEASING.md, \"Environments\")." >&2; exit 1; }
SUPABASE_URL=$(grep '^EXPO_PUBLIC_SUPABASE_URL=' "$ENV_FILE" | cut -d= -f2-)
PROJECT_REF=$(echo "$SUPABASE_URL" | sed -E 's#https://([^.]+)\..*#\1#')
PROD_REF=$( [ -f .env.production ] && grep '^EXPO_PUBLIC_SUPABASE_URL=' .env.production | cut -d= -f2- | sed -E 's#https://([^.]+)\..*#\1#' || true )
# The one mistake this file exists to stop: .env quietly pointing at production.
if [ "${TABI_ENV:-staging}" = staging ] && [ -n "$PROD_REF" ] && [ "$PROJECT_REF" = "$PROD_REF" ]; then
  echo ".env points at the PRODUCTION project ($PROD_REF). It must point at staging; use TABI_ENV=production to mean production." >&2; exit 1
fi
