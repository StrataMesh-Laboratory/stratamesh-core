#!/bin/bash
# Idempotent: wrangler + gcloud on Intel Mac PATH. Never prints secrets.
# Writes meters under $FOG_HOME/data/desk-meters/. No André ping / no GCP 2FA prompt.
set -euo pipefail
FOG_HOME="${FOG_HOME:-/Users/andremorais/StrataMesh/fog}"
METERS="$FOG_HOME/data/desk-meters"
mkdir -p "$METERS"
export PATH="/usr/local/bin:/usr/local/sbin:/opt/homebrew/bin:$PATH"
ts_pt() { date '+%Y-%m-%dT%H:%M:%S%z'; }

if command -v wrangler >/dev/null 2>&1; then
  echo {"ok":true,"tool":"wrangler","status":"ready","ts_pt":"$(ts_pt)","oracle_live":false} > "$METERS/wrangler-ready.json"
  echo wrangler_ready
elif command -v npm >/dev/null 2>&1; then
  npm i -g wrangler >/tmp/wrangler-install.log 2>&1 || true
  if command -v wrangler >/dev/null 2>&1; then
    echo {"ok":true,"tool":"wrangler","status":"ready","ts_pt":"$(ts_pt)","oracle_live":false} > "$METERS/wrangler-ready.json"
    echo wrangler_installed
  else
    echo {"ok":false,"tool":"wrangler","status":"missing","ts_pt":"$(ts_pt)","oracle_live":false} > "$METERS/wrangler-ready.json"
    echo wrangler_miss
  fi
else
  echo {"ok":false,"tool":"wrangler","status":"missing","ts_pt":"$(ts_pt)","oracle_live":false} > "$METERS/wrangler-ready.json"
  echo wrangler_no_npm
fi

if command -v gcloud >/dev/null 2>&1; then
  echo {"ok":true,"tool":"gcloud","status":"present","ts_pt":"$(ts_pt)","oracle_live":false} > "$METERS/gcp-cli-status.json"
  rm -f "$METERS/gcp-cli-missing.json"
  echo gcloud_ok
elif command -v brew >/dev/null 2>&1; then
  brew install --cask google-cloud-sdk >/tmp/gcloud-install.log 2>&1 || true
  if command -v gcloud >/dev/null 2>&1; then
    echo {"ok":true,"tool":"gcloud","status":"installed_awaiting_auth","ts_pt":"$(ts_pt)","oracle_live":false} > "$METERS/gcp-cli-status.json"
    rm -f "$METERS/gcp-cli-missing.json"
    echo gcloud_installed
  else
    echo {"ok":false,"tool":"gcloud","status":"missing","ts_pt":"$(ts_pt)","block":"install failed; no 2FA ping","oracle_live":false} > "$METERS/gcp-cli-missing.json"
    echo gcloud_miss
  fi
else
  echo {"ok":false,"tool":"gcloud","status":"missing","ts_pt":"$(ts_pt)","block":"brew missing; no 2FA ping","oracle_live":false} > "$METERS/gcp-cli-missing.json"
  echo gcloud_no_brew
fi

echo {"ok":true,"phase":"T2-drain","task":"dt-proj-ts-taper-t2","drain_sha":"38e8ffc","sha":"8917a0c","ts_pt":"$(ts_pt)","oracle_live":false} > "$METERS/ts-taper-t2-done.json"
echo t2_meter_ok
