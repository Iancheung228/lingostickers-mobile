#!/bin/bash
# Creates the Maestro QA account (pre-confirmed, so no email is sent) and saves
# its credentials to .maestro/qa.env (gitignored). Safe to re-run: an existing
# qa.env is reused and the account is not duplicated.
#   .maestro/create-qa-user.sh            # project from .env
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=.maestro/qa.env
URL=$(grep '^EXPO_PUBLIC_SUPABASE_URL=' .env | cut -d= -f2-)
REF=$(echo "$URL" | sed -E 's#https://([^.]+)\..*#\1#')

if [ -f "$OUT" ]; then echo "$OUT already exists; using it."; exit 0; fi

# The service-role key is fetched for this one call and never written to disk.
SERVICE=$(supabase projects api-keys --project-ref "$REF" -o json \
  | python3 -c 'import json,sys; print([k["api_key"] for k in json.load(sys.stdin) if k["name"]=="service_role"][0])')
EMAIL="maestro-qa@tabi.test"
PASSWORD=$(python3 -c 'import secrets; print("Qa-" + secrets.token_urlsafe(18))')

curl -fsS -X POST "$URL/auth/v1/admin/users" \
  -H "apikey: $SERVICE" -H "Authorization: Bearer $SERVICE" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"email_confirm\":true,
       \"user_metadata\":{\"username\":\"maestro_qa\",\"target_language\":\"fr\"}}" \
  | python3 -c 'import json,sys; u=json.load(sys.stdin); print("created", u["email"], u["id"])'

printf 'MAESTRO_EMAIL=%s\nMAESTRO_PASSWORD=%s\n' "$EMAIL" "$PASSWORD" > "$OUT"
chmod 600 "$OUT"
echo "saved $OUT"
