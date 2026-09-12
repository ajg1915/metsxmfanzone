#!/usr/bin/env bash
# Deploy ALL edge functions to your own Supabase project.
#
# One-time setup:
#   npm i -g supabase          # or: brew install supabase/tap/supabase
#   supabase login             # opens browser
#   supabase link --project-ref rdmrxeplasttewtlfetc
#
# Then just run:  bash scripts/deploy-functions.sh
#
set -u
PROJECT_REF="${PROJECT_REF:-rdmrxeplasttewtlfetc}"

cd "$(dirname "$0")/.." || exit 1

FAILED=()
for dir in supabase/functions/*/; do
  name="$(basename "$dir")"
  [[ "$name" == _* ]] && continue           # skip _shared
  [[ -f "$dir/index.ts" ]] || continue

  echo "==> deploying $name"
  if ! supabase functions deploy "$name" --project-ref "$PROJECT_REF" --no-verify-jwt; then
    FAILED+=("$name")
  fi
done

echo
if [ ${#FAILED[@]} -eq 0 ]; then
  echo "All functions deployed."
else
  echo "Failed (${#FAILED[@]}): ${FAILED[*]}"
  echo "Re-run this script to retry just those."
fi
