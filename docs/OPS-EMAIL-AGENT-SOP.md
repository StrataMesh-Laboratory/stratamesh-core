# SOP — Agent mailbox & email-session recovery (`grok@` → ENI root)

**Status:** Operational (proven 2026-08-25 on Discourse Free + Cloudflare Email Routing + DeoMail)  
**Purpose:** Complete privileged setup and day-2 ops when **API tokens are unavailable, Pro-gated, rate-limited, or temporarily broken**, using the lab agent identity under the AMCM ENI mail root.

Related: [AIOPS-HANDOFF-LOOP.md](./AIOPS-HANDOFF-LOOP.md) · [OPS-24H-DEV-CRON.md](./OPS-24H-DEV-CRON.md) · [DISCOURSE-SETUP.md](./DISCOURSE-SETUP.md)

---

## 1. Identity hierarchy (do not invert)

| Address | Role |
|---------|------|
| **`geral@eni.calhegasmorais.pt`** | **Root professional mailbox** (AMCM ENI). Hosted on **DeoMail**. Human + automation read via DeoMail API. |
| **`grok@calhegasmorais.pt`** | **Agent / admin automation identity**. Not a separate legal person. Used for platform signups (Discourse staff, future SaaS). |
| Routing | Cloudflare Email Routing on apex `calhegasmorais.pt`: **`grok@` → forward → `geral@eni.calhegasmorais.pt`** (destination must stay **Verified**). |
| `amcmorais@icloud.com` | Personal — **not** for lab agent automation or org-facing staff seats. |

**Rule:** Agent acts as `grok@`; mail always lands in ENI root via DeoMail. Operator recovers everything from one inbox API.

---

## 2. When to use this SOP

Use email-session recovery when **any** of the following is true:

1. Platform has **no Admin API keys** on the current plan (e.g. Discourse Free).  
2. API key exists but returns **401/403**, is rotated, or is not in the current session secrets.  
3. Endpoint requires **interactive login** (CSRF + cookies) and cannot be called with Bearer alone.  
4. Signup / staff grant / password set only completes via **email confirmation links**.  
5. Captcha/Turnstile blocks pure browser automation — operator clicks once; agent continues from mail tokens.

**Do not** use this path as a substitute for normal CF/GitHub tokens when those tokens work (prefer direct API for speed and auditability).

---

## 3. Control plane: DeoMail API

**Base:** `https://api.deomail.com`  
**Auth header:** `X-API-Key: <DEOMAIL_GROK_API_KEY>`  
**Inbox:** messages for `geral@eni…` (includes forwards from `grok@`).

### List recent mail
```bash
curl -sS -H "X-API-Key: $DEOMAIL_KEY" \
  'https://api.deomail.com/v1/emails?limit=15'
```

### Read one message (links + body)
```bash
curl -sS -H "X-API-Key: $DEOMAIL_KEY" \
  "https://api.deomail.com/v1/emails/{id}"
```

**Parsing priorities (in order):**
1. Long **magic-link** URLs (`/session/email-login/{token}`, `/u/password-reset/{token}`, `/u/confirm-admin/{token}`, invite URLs).  
2. Subject lines with six-digit codes (secondary; often UI-only).  
3. Plain-text body before HTML.

**Known pitfall:** A **6-digit “login code”** is **not** interchangeable with the **email-login path token**. Prefer the mail subject/body link `Log in via link` → `/session/email-login/{32-hex}`.

---

## 4. Proven sequence — Discourse ID + staff forum

_Tested against Discourse Free (`stratamesh.discourse.group`) + Discourse ID (`id.discourse.com`)._

### 4.1 Ensure mailbox path
1. Cloudflare Email Routing: rule `grok@calhegasmorais.pt` → `geral@eni.calhegasmorais.pt`.  
2. Destination **Verified** (if CF sends verify mail, operator confirms once; rate limits possible).  
3. Probe: send any mail to `grok@` and confirm it appears via DeoMail list.

### 4.2 Create / accept agent account
1. Invite from owner admin **`@stratamesh`** (geral@) to **`grok@calhegasmorais.pt`**.  
2. Accept invite; username **`stratamesh-grok`**.  
3. Prefer **admin invite**; if only member, owner grants Moderator/Admin in Admin → Users.

### 4.3 Confirm admin (email to root)
When Discourse emails **“Confirm new Admin Account”** to `geral@eni…`:

```text
POST https://stratamesh.discourse.group/u/confirm-admin/{token}
Content-Type: application/json
X-CSRF-Token: <from GET /session/csrf after visiting confirm URL>
Body: {}
```

Expect `{"success":"OK"}`. GET alone may only show the button page.  
Verify: `GET /u/stratamesh-grok.json` → `admin: true` (and/or `moderator: true`).

### 4.4 Passwordless login that works (magic link)
1. Trigger email login (CSRF cookie jar on `id.discourse.com`):
   ```http
   POST https://id.discourse.com/u/email-login
   Content-Type: application/json
   {"login":"grok@calhegasmorais.pt"}
   ```
   Success body often `{"success":"OK","hide_taken":true}` — this **sends** the mail.  
2. Poll DeoMail for **“Log in via link”**.  
3. Extract `https://id.discourse.com/session/email-login/{token}`.  
4. Optional: `GET …/session/email-login/{token}.json` → `can_login: true`.  
5. `POST …/session/email-login/{token}` with CSRF → `{"success":"OK"}`.  
6. Cookies `_t` / `_forum_session` on `id.discourse.com`.

**Does not work reliably:** putting the 6-digit code in `/session/email-login/{code}` (returns “link no longer works”).

### 4.5 Durable password (recommended once per identity)
1. Trigger forgot/set password or use the **“Set Password”** mail that often accompanies email-login.  
2. Extract `https://id.discourse.com/u/password-reset/{token}`.  
3. `PUT` same path with JSON `{"password":"…","password_confirmation":"…"}` + CSRF.  
4. Store password **only** in local ops secrets (never git, never public issues).  
5. Later logins: `POST https://id.discourse.com/session` with `login=grok@…` + password.

### 4.6 SSO into the product forum
```http
GET https://stratamesh.discourse.group/auth/discourse_id
```
Follow redirects (authorize → callback → site).  
Confirm: `GET https://stratamesh.discourse.group/session/current.json` → `admin`/`staff` true for `stratamesh-grok`.

### 4.7 Privileged writes without Admin API keys
With session cookies + CSRF (`GET /session/csrf`):

- Site settings: `PUT /admin/site_settings/{key}`  
- Categories: `POST /categories.json` / `PUT /categories/{id}.json`  
- Posts/topics: `POST /posts.json`, pin via `PUT /t/{id}/status`  
- Free plan caps still apply (e.g. max categories, staff seats).

---

## 5. General pattern (any platform)

```
API Bearer works?
  YES → use API (CF, GitHub, DeoMail, AIOps)
  NO  →
    1. Ensure grok@ routes to geral@eni (DeoMail)
    2. Trigger platform "email login" / invite / confirm from agent identity
    3. Poll DeoMail; prefer long URL tokens over short OTP fields
    4. Redeem token with CSRF + cookie jar
    5. Optionally set password once for durable sessions
    6. Complete SSO into the product host
    7. Perform admin actions via session APIs
    8. Persist only non-git secrets locally; rotate if leaked in chat
```

### Cloudflare Email Routing recovery
- Destination verify expired → operator resends from CF dashboard; agent reads link in DeoMail if link is clickable without Turnstile, else operator one-click.  
- Rule missing → recreate forward `grok@` → `geral@eni` with Global/API token that can write Email Routing.

### GitHub
Prefer PAT. Email path is only for org invitation acceptance mails to `geral@` / `grok@`.

### AIOps / Workers
Prefer CF API token. This SOP does not replace Workers deploy; it only recovers human-gate email steps around the same ops identity.

---

## 6. Secrets layout (local only)

```
artifacts/.grok/secrets/
  discourse.env      # URL, username stratamesh-grok, email, staff flags
  discourse_pw.txt   # Discourse ID password if set
  grok_mailbox.env   # GROK_EMAIL, GROK_FORWARD, DISCOURSE_URL
  ops_bundle.env     # CF / GitHub / DeoMail keys for the session
```

**Never** commit these files. Automation prompts may inject session keys; still do not push them to `stratamesh-core`.

---

## 7. Failure table

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| OTP 6-digit + email-login URL fails | Token type mismatch | Use **Log in via link** long token |
| confirm-admin GET only shows button | Need POST + CSRF | POST `{}` with CSRF |
| `/admin` “private” | No session | Complete §4.4–4.6 |
| DeoMail detail errors via some HTTP clients | Client quirks | Prefer `curl` + `X-API-Key` |
| CF “sent too recently” verify | Rate limit | Wait / operator verifies destination |
| Mail to grok@ never appears | Routing or unverified destination | Fix Email Routing; confirm MX/destination |
| Staff false after invite | Invite was member-only | Owner grants admin; confirm-admin mail |

---

## 8. Acceptance checks

- [ ] Mail to `grok@calhegasmorais.pt` visible in DeoMail under ENI root  
- [ ] `stratamesh-grok` `admin` and/or `moderator` true on forum  
- [ ] Session login possible via password **or** magic link without human password typing  
- [ ] At least one privileged write (setting or pin) succeeded with session CSRF  
- [ ] No agent passwords stored in git  

**Last proven:** 2026-08-25 — Discourse admin confirm + magic link + password set + SSO + category/settings writes; mailbox `grok@` → `geral@eni` via CF + DeoMail.

---

## 9. One-line policy

**`grok@calhegasmorais.pt` is the automation admin identity; `geral@eni.calhegasmorais.pt` is the mail root of record; DeoMail is the recovery bus when platform APIs are missing or down.**
