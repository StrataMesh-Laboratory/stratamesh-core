#!/bin/bash
# Idempotent desk vault ensure for Fog Mac — KeePass, then Tailscale pull. Never prints secrets.
set -euo pipefail
DEST="${HOME}/.config/stratagrok"
DEST2="${HOME}/.config/stratamesh"
MAILDIR_MAC="${HOME}/mail/automation.desk"
mkdir -p "$DEST" "$DEST2" "$MAILDIR_MAC"/{cur,new,tmp}
chmod 700 "$DEST" "$DEST2"

_ok() {
  for f in automation.desk.token automation.desk.imap automation.desk.smtp; do
    [ -s "$DEST/$f" ] || return 1
  done
  return 0
}

_rewrite_maildir() {
  local f="$1"
  [ -s "$f" ] || return 0
  if grep -q '^MAILDIR=' "$f" 2>/dev/null; then
    tmp="$f.tmp"
    sed "s|^MAILDIR=.*|MAILDIR=${MAILDIR_MAC}|" "$f" >"$tmp"
    mv "$tmp" "$f"
    chmod 600 "$f"
  fi
}

if _ok; then
  _rewrite_maildir "$DEST/automation.desk.imap"
  _rewrite_maildir "$DEST/automation.desk.smtp"
  echo "DESK_VAULT_OK already"
  exit 0
fi

if command -v stratagrok-vault >/dev/null 2>&1; then
  tok=$(stratagrok-vault get AUTOMATION_DESK_TOKEN 2>/dev/null || true)
  imap=$(stratagrok-vault get AUTOMATION_DESK_IMAP 2>/dev/null || true)
  smtp=$(stratagrok-vault get AUTOMATION_DESK_SMTP 2>/dev/null || true)
  [ -n "${tok:-}" ] && printf '%s\n' "$tok" >"$DEST/automation.desk.token" && chmod 600 "$DEST/automation.desk.token"
  if [ -n "${imap:-}" ]; then
    if printf '%s' "$imap" | grep -q '^MAIL_MODE=\|^IMAP_'; then
      printf '%s\n' "$imap" >"$DEST/automation.desk.imap"
    else
      cat >"$DEST/automation.desk.imap" <<EOF
MAIL_MODE=imap
IMAP_HOST=127.0.0.1
IMAP_PORT=143
IMAP_USER=automation.desk
IMAP_PASS=${imap}
IMAP_SSL=false
MAILDIR=${MAILDIR_MAC}
ADDRESS=automation.desk@calhegasmorais.pt
EOF
    fi
    chmod 600 "$DEST/automation.desk.imap"
  fi
  if [ -n "${smtp:-}" ]; then
    if printf '%s' "$smtp" | grep -q '^SMTP_MODE=\|^SMTP_'; then
      printf '%s\n' "$smtp" >"$DEST/automation.desk.smtp"
    else
      cat >"$DEST/automation.desk.smtp" <<EOF
SMTP_MODE=maildir_drop
SMTP_HOST=127.0.0.1
SMTP_PORT=0
SMTP_USER=automation.desk
SMTP_PASS=${smtp}
SMTP_FROM=automation.desk@calhegasmorais.pt
MAILDIR=${MAILDIR_MAC}
NOTE=outbound_is_maildir_drop_until_cf_email_sending
EOF
    fi
    chmod 600 "$DEST/automation.desk.smtp"
  fi
  [ -s "$DEST/automation.desk.token" ] && cp -f "$DEST/automation.desk.token" "$DEST/desk-mail.token" && chmod 600 "$DEST/desk-mail.token"
fi

if ! _ok; then
  BOX="${STRATAGROK_BOX_TS:-100.110.43.115}"
  PULL_TOK="${VAULT_PULL_TOKEN:-}"
  if [ -z "$PULL_TOK" ] && [ -f "$DEST/vault-pull.token" ]; then
    PULL_TOK=$(tr -d '\n' <"$DEST/vault-pull.token")
  fi
  if [ -n "$PULL_TOK" ]; then
    BASE="http://${BOX}:8765/${PULL_TOK}"
    for f in automation.desk.token automation.desk.imap automation.desk.smtp automation.desk.env desk-mail.token; do
      if curl -fsS --max-time 20 "$BASE/$f" -o "$DEST/$f.tmp"; then
        mv "$DEST/$f.tmp" "$DEST/$f"
        chmod 600 "$DEST/$f"
        echo "OK $DEST/$f bytes=$(wc -c <"$DEST/$f" | tr -d ' ')"
      else
        rm -f "$DEST/$f.tmp"
        echo "MISS $f"
      fi
    done
  fi
fi

_rewrite_maildir "$DEST/automation.desk.imap"
_rewrite_maildir "$DEST/automation.desk.smtp"
for f in automation.desk.token automation.desk.imap automation.desk.smtp automation.desk.env desk-mail.token; do
  [ -s "$DEST/$f" ] && install -m 600 "$DEST/$f" "$DEST2/$f" || true
done

if _ok; then
  echo "DESK_VAULT_OK"
  exit 0
fi
echo "DESK_VAULT_FAIL"
exit 1
