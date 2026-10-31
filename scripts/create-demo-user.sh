#!/bin/bash
# Creates the App Review demo account (pre-confirmed, so no email is sent) and
# saves its credentials to .maestro/demo.env (gitignored). Unlike the Maestro
# QA account, nothing reseeds it: it keeps the real stickers made for review
# and screenshots. Safe to re-run: an existing demo.env is reused.
#   scripts/create-demo-user.sh
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=.maestro/demo.env
URL=$(grep '^EXPO_PUBLIC_SUPABASE_URL=' .env | cut -d= -f2-)
REF=$(echo "$URL" | sed -E 's#https://([^.]+)\..*#\1#')

if [ -f "$OUT" ]; then echo "$OUT already exists; using it."; exit 0; fi

# The service-role key is fetched for this one call and never written to disk.
SERVICE=$(supabase projects api-keys --project-ref "$REF" -o json 2>/dev/null \
  | python3 -c 'import json,sys; print([k["api_key"] for k in json.load(sys.stdin) if k["name"]=="service_role"][0])')
EMAIL="appreview@tabistickers.com"
# Readable enough to paste into App Store Connect; still random.
PASSWORD=$(python3 -c 'import secrets; print("Tabi-" + secrets.token_urlsafe(9))')

curl -fsS -X POST "$URL/auth/v1/admin/users" \
  -H "apikey: $SERVICE" -H "Authorization: Bearer $SERVICE" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"email_confirm\":true,
       \"user_metadata\":{\"username\":\"tabi_demo\",\"target_language\":\"fr\"}}" \
  | python3 -c 'import json,sys; u=json.load(sys.stdin); print("created", u["email"], u["id"])'

printf 'MAESTRO_EMAIL=%s\nMAESTRO_PASSWORD=%s\n' "$EMAIL" "$PASSWORD" > "$OUT"
chmod 600 "$OUT"
echo "saved $OUT"
