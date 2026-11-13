#!/bin/bash
# Deploys the backend (Supabase migrations and/or edge functions) to ONE
# environment. Staging first, always; production only from what staging ran.
#
#   scripts/deploy.sh staging functions                 # every function
#   scripts/deploy.sh staging functions create-card     # just these
#   scripts/deploy.sh staging db                        # pending migrations
#   scripts/deploy.sh staging all
#   scripts/deploy.sh production all                    # asks you to type the project ref
#
# Production refuses unless: you're on main, the tree is clean, main is pushed,
# and this exact commit was deployed to staging first (same kind). In a
# non-interactive shell it also needs CONFIRM_PRODUCTION=<production ref>,
# which an agent must never set without the owner saying so for this deploy.
# Secrets are not handled here: `npx supabase secrets set --project-ref <ref> ...`.
set -euo pipefail
cd "$(dirname "$0")/.."
TARGET=${1:-}; KIND=${2:-}; shift 2 2>/dev/null || true
case "$TARGET" in staging|production) ;; *) sed -n 2,16p "$0"; exit 1 ;; esac
case "$KIND" in functions|db|all) ;; *) sed -n 2,16p "$0"; exit 1 ;; esac

TABI_ENV=$TARGET . scripts/lib/backend.sh
REF=$PROJECT_REF
HEAD=$(git rev-parse HEAD)
STAMP=.run/deployed-staging   # lines of "<kind> <commit>", local record only
mkdir -p .run

if [ "$TARGET" = production ]; then
  [ "$(git branch --show-current)" = main ] || { echo "Production deploys come from main." >&2; exit 1; }
  [ -z "$(git status --porcelain --untracked-files=no)" ] || { echo "Uncommitted changes: production must match a commit." >&2; exit 1; }
  git fetch -q origin main
  [ "$HEAD" = "$(git rev-parse origin/main)" ] || { echo "main isn't pushed (or is behind origin). Push first so what's live is what's in git." >&2; exit 1; }
  for k in $( [ "$KIND" = all ] && echo "db functions" || echo "$KIND" ); do
    grep -qx "$k $HEAD" "$STAMP" 2>/dev/null || { echo "This commit's $k hasn't been deployed to staging yet: scripts/deploy.sh staging $k" >&2; exit 1; }
  done
  if [ -t 0 ]; then
    read -r -p "Deploying $KIND to PRODUCTION ($REF), which every user hits immediately. Type the ref to continue: " typed
  else
    typed=${CONFIRM_PRODUCTION:-}
  fi
  [ "$typed" = "$REF" ] || { echo "Not confirmed; nothing deployed." >&2; exit 1; }
fi

# The CLI acts on the "linked" project for db commands. Link the target, and
# always put staging back afterwards so a bare `supabase` command is never
# pointed at production by accident.
STAGING_REF=$(TABI_ENV=staging; . scripts/lib/backend.sh; echo "$PROJECT_REF")
relink_staging() { npx supabase link --project-ref "$STAGING_REF" >/dev/null 2>&1 </dev/null || echo "warning: couldn't re-link staging ($STAGING_REF)" >&2; }
trap relink_staging EXIT

if [ "$KIND" = db ] || [ "$KIND" = all ]; then
  npx supabase link --project-ref "$REF" </dev/null
  echo "--- migrations that will be applied to $TARGET ($REF):"
  npx supabase db push --linked --dry-run
  npx supabase db push --linked --yes
  [ "$TARGET" = staging ] && echo "db $HEAD" >> "$STAMP"
fi

if [ "$KIND" = functions ] || [ "$KIND" = all ]; then
  npm run -s typecheck:functions
  # No names = every function directory (not _shared).
  names=("$@")
  if [ ${#names[@]} -eq 0 ]; then
    for d in supabase/functions/*/; do n=$(basename "$d"); [ "$n" = _shared ] || names+=("$n"); done
  fi
  # Default JWT verification on every function (docs/lessons.md section 4).
  npx supabase functions deploy "${names[@]}" --project-ref "$REF" --use-api
  [ "$TARGET" = staging ] && echo "functions $HEAD" >> "$STAMP"
fi
echo "Deployed $KIND to $TARGET ($REF) at $(git rev-parse --short HEAD)."
