#!/bin/zsh
# Start MinIO on the Fog Mac. Password from vault only.
set -e
VAULT="$HOME/.config/stratamesh"
USERF="$VAULT/minio.user"
PASSF="$VAULT/minio.pass"
mkdir -p "$VAULT"
chmod 700 "$VAULT"
if [[ ! -s "$PASSF" ]]; then
  echo "create $PASSF (umask 077; openssl rand -base64 18 > $PASSF; chmod 600 $PASSF)"
  exit 2
fi
export MINIO_ROOT_USER=$(tr -d "[:space:]" < "${USERF:-/dev/null}")
[[ -z "$MINIO_ROOT_USER" ]] && MINIO_ROOT_USER=minio
export MINIO_ROOT_PASSWORD=$(tr -d "[:space:]" < "$PASSF")
cd "$(dirname "$0")/../.."
docker compose -f deploy/mac-fog/docker-compose.minio.yml up -d
echo "S3  http://127.0.0.1:9000"
echo "UI  http://127.0.0.1:9001"
echo "TS  http://mbpv.taild31dc1.ts.net:9001  (if published; default is localhost only)"
