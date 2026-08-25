# SOP — Agent mailbox `grok@calhegasmorais.pt` (when API automation fails)

**Purpose:** Recover session / complete privileged actions when direct platform APIs are missing, rate-limited, Pro-gated, or blocked by interactive UI (CSRF, captcha, Discourse ID forms).

**Mailbox**
| Field | Value |
|-------|--------|
| Address | `grok@calhegasmorais.pt` |
| Routing | Cloudflare Email Routing → `geral@eni.calhegasmorais.pt` (DeoMail) |
| Read API | DeoMail Grok API (`X-API-Key`) · `GET /v1/emails` · `GET /v1/emails/{id}` |
| Staff user (Discourse) | `@stratamesh-grok` |
| Legal contact (human) | `geral@eni.calhegasmorais.pt` |

Do **not** use personal iCloud for agent automation. Do **not** commit passwords or API keys to git.

---

## 1. Decision tree

```
Need privileged action on a platform?
  ├─ Official Admin/API key available and allowed? → use API
  ├─ API missing / 403 / Free-plan gated / captcha?
  │     └─ Use this SOP (email + session)
  └─ Human-only (Turnstile that blocks automation)?
        └─ Document one human click; resume with mail/session
```

---

## 2. Standard sequence (Discourse ID / similar passwordless)

1. **Trigger email login** (not the 6-digit UI-only code as primary):
   - Prefer `POST /u/email-login` with `{ "login": "grok@calhegasmorais.pt" }` + CSRF cookie jar.
   - Fallback: password login if a password was previously set via reset link.
2. **Poll DeoMail** (≤ 2 min, interval ~3–5 s):
   - Match subject: `Log in via link`, `Set Password`, `login code`, platform name.
   - Prefer **magic link** tokens (`/session/email-login/{long_token}`) over 6-digit codes.
3. **Redeem token**:
   - `GET …/session/email-login/{token}.json` → expect `can_login: true`.
   - `POST …/session/email-login/{token}` → `{"success":"OK"}`.
4. **Persist session** (cookie jar: `_t`, `_forum_session`) for the target host.
5. **SSO into product** if needed (e.g. `GET https://stratamesh.discourse.group/auth/discourse_id` following redirects).
6. **Optional durability:** if a `Set Password` / reset mail arrives, set a strong password once and store **only** in local ops secrets (`artifacts/.grok/secrets/`), never in the repo.
7. **Verify:** `GET /session/current.json` → username + `admin`/`staff` flags.

### Known failure modes
| Symptom | Cause | Fix |
|---------|--------|-----|
| 6-digit code + `/session/email-login/{code}` → “link no longer works” | Code ≠ email-login token | Request **Log in via link** flow (`/u/email-login`) |
| 403 on confirm-admin | Need `POST` + CSRF, not GET alone | POST empty JSON with CSRF |
| Admin page “private” | No session cookies | Complete steps 1–5 |
| DeoMail detail 403 via urllib | Client quirks | Use `curl -H "X-API-Key: …"` |
| CF destination verify Turnstile | Human challenge | One browser click by operator; then automation continues |

---

## 3. Cloudflare Email Routing (mailbox hygiene)

- Destination `geral@eni…` must stay **verified**.
- Rule: `grok@calhegasmorais.pt` → forward → `geral@eni.calhegasmorais.pt`.
- Apex MX is CF Email Routing; `eni.calhegasmorais.pt` MX is DeoMail.
- If forward broken: check CF Email Routing rules + destination status before blaming DeoMail.

---

## 4. Secrets layout (local only)

```
artifacts/.grok/secrets/
  discourse.env      # URL, username, email, password, staff flags
  discourse_pw.txt   # optional plain password file
  grok_mailbox.env   # GROK_EMAIL, GROK_FORWARD, invites
```

Rotate password if exposed in chat logs. Never paste live passwords into public issues.

---

## 5. After session is up

- Prefer **session + CSRF** write APIs over asking the human operator to click admin UI.
- For Free Discourse: no Admin API keys — session is the automation surface.
- Log outcomes in ops notes / this SOP’s “Last exercised” line.

**Last exercised:** 2026-08-25 — Discourse ID magic link + password set + SSO admin session + site settings/categories/pins.

---

## 6. Template: poll DeoMail for login mail

```bash
KEY=…  # DeoMail Grok API key (session secret)
curl -sS -H "X-API-Key: $KEY" 'https://api.deomail.com/v1/emails?limit=10'
# For hits: curl -sS -H "X-API-Key: $KEY" "https://api.deomail.com/v1/emails/{id}"
# Extract https://…/session/email-login/{token} or 6-digit codes from subject/body
```

## Related

Daily development execution: [OPS-24H-DEV-CRON.md](./OPS-24H-DEV-CRON.md).
