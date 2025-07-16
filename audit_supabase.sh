#!/bin/bash
# Simple Supabase dashboard audit script
# Usage: bash audit_supabase.sh

set -e

echo "Checking Supabase environment variables..."
if [[ -z "$SUPABASE_URL" || -z "$SUPABASE_KEY" ]]; then
  echo "Missing SUPABASE_URL or SUPABASE_KEY."
  exit 1
fi

echo "Checking Supabase connection..."
curl -s "$SUPABASE_URL/rest/v1/" -H "apikey: $SUPABASE_KEY" | grep -q 'error' && echo "Supabase API error" || echo "Supabase API reachable."

echo "Checking dashboard for recent changes..."
# This part is manual: Please log in to Supabase dashboard and review recent activity, roles, and security settings.
echo "Manual review required: Log in to Supabase dashboard and audit roles, policies, and logs."

echo "Supabase audit script complete."
