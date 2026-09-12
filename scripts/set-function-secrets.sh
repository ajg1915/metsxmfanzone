#!/usr/bin/env bash
# Sets the API keys your edge functions need, on YOUR Supabase project.
# Fill in the values below, then run:  bash scripts/set-function-secrets.sh
#
# NOTE: SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are
# injected automatically by Supabase - do NOT set those here.
set -u
PROJECT_REF="${PROJECT_REF:-rdmrxeplasttewtlfetc}"

supabase secrets set --project-ref "$PROJECT_REF" \
  PAYPAL_CLIENT_ID="" \
  PAYPAL_SECRET="" \
  PAYPAL_WEBHOOK_ID="" \
  RESEND_API_KEY="" \
  CLOUDFLARE_ACCOUNT_ID="" \
  CLOUDFLARE_API_TOKEN="" \
  OPENAI_API_KEY="" \
  ELEVENLABS_API_KEY="" \
  GOOGLE_API_KEY="" \
  REPLICATE_API_KEY="" \
  LIVEKIT_API_KEY="" \
  LIVEKIT_API_SECRET="" \
  LIVEKIT_URL="" \
  PUSHER_BEAMS_INSTANCE_ID="" \
  PUSHER_BEAMS_SECRET_KEY="" \
  TWILIO_ACCOUNT_SID="" \
  TWILIO_AUTH_TOKEN="" \
  TWILIO_PHONE_NUMBER="" \
  VAPID_PRIVATE_KEY="" \
  SQUARE_ACCESS_TOKEN="" \
  SQUARE_APPLICATION_ID="" \
  SQUARE_LOCATION_ID="" \
  HELCIM_API_TOKEN="" \
  HELCIM_ACCOUNT_ID="" \
  ACTIVITY_LOGS_ENCRYPTION_KEY="" \
  LOVABLE_API_KEY=""

echo "Done. Check with: supabase secrets list --project-ref $PROJECT_REF"
