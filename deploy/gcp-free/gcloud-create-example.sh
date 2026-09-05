#!/usr/bin/env bash
# EXAMPLE — edit PROJECT/ZONE. Creates Always Free–shaped e2-micro WITHOUT external IP.
# Does not run unless you pass --i-understand (safety).
set -euo pipefail

PROJECT="${GCP_PROJECT:?set GCP_PROJECT}"
ZONE="${GCP_ZONE:-us-central1-a}"   # must be us-west1 / us-central1 / us-east1
NAME="${GCP_INSTANCE:-fog-peer-e2micro}"

if [[ "${1:-}" != "--i-understand" ]]; then
  cat <<EOF
Dry view only. Will create:
  project=$PROJECT zone=$ZONE name=$NAME
  machine=e2-micro
  disk=30GB pd-standard
  NO external IP (Tailscale/IAP only)

Re-run: $0 --i-understand
EOF
  exit 0
fi

gcloud config set project "$PROJECT"
gcloud compute instances create "$NAME" \
  --zone="$ZONE" \
  --machine-type=e2-micro \
  --subnet=default \
  --no-address \
  --image-family=ubuntu-2404-lts-amd64 \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=30GB \
  --boot-disk-type=pd-standard \
  --tags=fog-peer \
  --metadata=enable-oslogin=TRUE

echo "Next: gcloud compute ssh $NAME --zone=$ZONE --tunnel-through-iap"
echo "Then: install Tailscale + run deploy/gcp-free/bootstrap.sh"
