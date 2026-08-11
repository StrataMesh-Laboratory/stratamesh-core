# Staff / Pessoal login (lab)

Separate from public users (who will use CMD/EUDI when available).

## Flow

1. `POST /staff/login` `{ email, password }` — **staff table only**
2. If OK → `{ requires_2fa: true, challenge, lab_otp? }`
3. `POST /staff/2fa` `{ challenge, code }` → session `token` (`type: staff`)

## Lab 2FA

- 6-digit code, 10 minutes, single use (`staff_otp` table)
- `LAB_OTP_ECHO` default on in lab → code returned in JSON (also shown in portal hint)
- Production: set `LAB_OTP_ECHO=0` and wire email/SMS **or** put staff routes behind **Cloudflare Access** (email OTP / TOTP) without changing app code

## Cloudflare Access (recommended production 2FA)

1. Zero Trust → Access → Application on `stratamesh-spa…/dashboard` or staff hostname  
2. Policy: allow staff emails only  
3. Identity: One-time PIN (email) or Google/OTP  

App 2FA remains for defense in depth when Access is not used.

## Accounts

`staff` table: `amcmorais@icloud.com` (root_admin / TOP_SECRET), `geral@calhegasmorais.pt` (admin / SECRET).

Clearance from staff session maps into Orchestrator account clearance.
