# EU / national digital identity for StrataMesh Auth

**Goal:** prefer **passwordless registration/login** via EU digital identity and national homologues (e.g. Portugal **CMD**) when available; keep email/password as fallback.

## Hierarchy of means

| Means | Status for CMN | Notes |
|-------|----------------|--------|
| **Email + password** | **Live** | Fallback; `POST /register`, `POST /login` |
| **Portugal CMD (Autenticação.gov)** | **Scaffold — needs AMA onboarding** | OAuth 2.0 and/or SAML as **Service Provider** |
| **EUDI Wallet / eIDAS 2** | **Scaffold — evolving EU specs** | OpenID4VP presentation to relying party |
| Other national eID (IT SPID, DE …) | Future | Same SP pattern per country |

Clearance remains an **account attribute** after identity is proven — eID does not by itself grant `top_secret`.

## Portugal — Chave Móvel Digital (CMD)

Official technical docs: [amagovpt/doc-AUTENTICACAO](https://github.com/amagovpt/doc-AUTENTICACAO)

- Protocols: **OAuth 2.0** and **SAML**
- Operator: Autenticação.gov / ARTE (Agência para a Reforma Tecnológica do Estado)
- Environments: **pré-produção** then **produção**
- Requires: SP registration forms, entity certificates, attribute agreement, logos policy

### Flow (target)

1. User clicks **Entrar com CMD** on portal  
2. Redirect to Autenticação.gov authorize URL (client_id, redirect_uri, scope)  
3. User authenticates (PIN + OTP/SMS/app/biometrics)  
4. Callback to `https://…/api/auth/cmd/callback` with code  
5. Exchange code → tokens/attributes (NIC, name, email if released)  
6. Upsert `users` row: link `doc_hash`/`uid` to national id hash, `verification_status=verified` (or pending policy), `clearance_level=basic` until staff elevates  
7. Issue StrataMesh **session** token (same as password login)

### Blockers (honest)

- Private/lab projects must **apply** as relying party; not a public free API key  
- Legal/DPA review for attributes received  
- Production certs and redirect URI allow-list on calhegasmorais.pt / workers.dev  

Until AMA credentials exist, `/auth/cmd` returns **501** with setup instructions.

## EU — EUDI Wallet (eIDAS 2)

References: [eu-digital-identity-wallet](https://github.com/eu-digital-identity-wallet), OpenID4VP / OpenID4VCI, national RP registration.

### Flow (target)

1. **Entrar com EUDI Wallet**  
2. RP creates OpenID4VP request (PID / attributes needed)  
3. User presents from wallet (same-device or cross-device QR)  
4. Verify presentation + trust lists  
5. Map claims → user upsert + session  

### Blockers

- Relying Party registration / access certificates (member-state specific)  
- Conformance to ARF; selective disclosure policy  
- Still rolling out across member states in 2025–2026  

## Account model after eID login

| Field | Behaviour |
|-------|-----------|
| `email` | From eID if released; else synthetic `nic_<hash>@id.calhegasmorais.pt` |
| `doc_hash` | Stable hash of national identifier (not raw NIC in plaintext) |
| `verification_status` | `verified` if LoA high + policy allows |
| `clearance_level` | Default `basic` / `public` — **not** inferred from eID alone |
| `password_hash` | Nullable for passwordless accounts |

## Operator checklist (Portugal CMD)

1. Read OAuth quick guide + SP forms in `doc-AUTENTICACAO`  
2. Contact ARTE / Autenticação.gov for SP onboarding  
3. Obtain client_id, secrets, pré-prod endpoints  
4. Set Worker secrets: `CMD_CLIENT_ID`, `CMD_CLIENT_SECRET`, `CMD_REDIRECT_URI`, `CMD_AUTH_URL`, `CMD_TOKEN_URL`  
5. Enable feature flag `AUTH_CMD_ENABLED=1`  
6. Test pré-prod → production  

## Related endpoints (scaffold)

| Path | Purpose |
|------|---------|
| `GET /auth/cmd/start` | Begin CMD OAuth (or 501) |
| `GET /auth/cmd/callback` | OAuth callback |
| `GET /auth/eudi/start` | Begin EUDI presentation (or 501) |
| `GET /auth/methods` | List enabled auth methods for UI |

Email/password remains available until eID is enabled in production.
