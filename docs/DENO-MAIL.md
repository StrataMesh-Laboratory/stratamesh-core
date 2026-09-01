# Deno mail send

Primary outbound: `POST http://127.0.0.1:8792/mail/send` (Fog Deno).
CF `stratamesh-deomail` is secondary while circuit ALLOW.

Vault: `~/.config/stratamesh/deomail.key` (X-API-Key). Never git.

Inbound `grok@` remains Cloudflare Email Routing → auth-recovery Worker (MX cannot move to Deno).

```
curl -sS -X POST http://127.0.0.1:8792/mail/send \
  -H 'content-type: application/json' \
  -d '{"to":"amcmorais@icloud.com","subject":"desk","text":"ok"}'
```
