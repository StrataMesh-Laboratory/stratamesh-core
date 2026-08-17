# Add-ons e integrações open-source (GitHub) — StrataMesh / CMN

Lista orientada a **custo zero** (self-host, Cloudflare Workers free, ou SaaS free tier).
Prioridade: encaixe com Workers, D1, KV, TRD/GDA, auth e portal.

## Segurança e acesso

| Projecto | Uso no CMN | Notas |
|----------|------------|--------|
| [cloudflare/turnstile](https://github.com/cloudflare/turnstile) | CAPTCHA no registo/login | Gratuito; CSP já permite challenges.cloudflare.com |
| [panva/jose](https://github.com/panva/jose) | JWT / JWS no edge | Zero deps; Workers-friendly |
| [otplib/otplib](https://github.com/otplib/otplib) | TOTP 2FA staff | Free; complementar ao 2FA email |
| [MasterKale/SimpleWebAuthn](https://github.com/MasterKale/SimpleWebAuthn) | Passkeys / WebAuthn | Login sem password (lab) |
| [OWASP/CheatSheetSeries](https://github.com/OWASP/CheatSheetSeries) | Checklists segurança | Processo, não código |

## Eficiência edge / Cloudflare

| Projecto | Uso | Notas |
|----------|-----|--------|
| [cloudflare/workers-sdk](https://github.com/cloudflare/workers-sdk) | Wrangler deploy | CLI oficial |
| [honojs/hono](https://github.com/honojs/hono) | Framework edge | Muito usado em Workers |
| [kwhitley/itty-router](https://github.com/kwhitley/itty-router) | Router leve | Menos boilerplate |
| [unjs/ofetch](https://github.com/unjs/ofetch) | HTTP client | Isomórfico |

## Identidade / OAuth (quando delegar setup)

| Projecto | Uso | Notas |
|----------|-----|--------|
| [lucia-auth/lucia](https://github.com/lucia-auth/lucia) | Sessions + D1 | Adaptável |
| [nextauthjs/next-auth](https://github.com/nextauthjs/next-auth) | OAuth Google/Apple/Microsoft | Padrões OAuth (Auth.js) |
| [supabase/auth](https://github.com/supabase/auth) | Auth + OTP | Free tier |

## IPFS / conteúdo

| Projecto | Uso | Notas |
|----------|-----|--------|
| [ipfs/helia](https://github.com/ipfs/helia) | IPFS em JS | Browser / limites no Worker |
| [ipfs/kubo](https://github.com/ipfs/kubo) | Nó IPFS completo | Fog local |
| [multiformats/multiformats](https://github.com/multiformats/js-multiformats) | CIDs | Base IPFS |

## Crypto / GDA

| Projecto | Uso | Notas |
|----------|-----|--------|
| [paulmillr/noble-hashes](https://github.com/paulmillr/noble-hashes) | Hash auditável | Edge-safe |
| [paulmillr/noble-curves](https://github.com/paulmillr/noble-curves) | Assinaturas | Edge-safe |
| [ipld/js-dag-cbor](https://github.com/ipld/js-dag-cbor) | IPLD CBOR | Vértices tipados |

## Observabilidade (free tier)

| Projecto | Uso | Notas |
|----------|-----|--------|
| [getsentry/sentry-javascript](https://github.com/getsentry/sentry-javascript) | Erros | Free tier |

## UI

| Projecto | Uso | Notas |
|----------|-----|--------|
| [tailwindlabs/tailwindcss](https://github.com/tailwindlabs/tailwindcss) | CSS | Já no CLP |
| [lucide-icons/lucide](https://github.com/lucide-icons/lucide) | Ícones SVG | Leve |

## Prioridade de integração (lab)

1. **Turnstile** no registo comum
2. **jose** + sessões D1
3. **otplib** TOTP para pessoal
4. **noble-hashes** nos vértices GDA
5. **Helia** / pinning free para CIDs reais

## Evitar no Free sem cuidado

- Rocket Loader (desactivado — parte SPA)
- Minify JS agressivo no portal
- Bot Fight em *block* sem `/erro-acesso`
- Módulos Node nativos (`fs`, `net`) em Workers

*CMN lab · medidas gratuitas de zona + catálogo GitHub.*


## Estado de integração (lab)

| Item | Estado |
|------|--------|
| Turnstile no registo | **Activo** (sitekey widget + siteverify no `stratamesh-auth`) |
| Sessões com hash SHA-256 | **Activo** (token só no cliente; D1 guarda `token_hash`) |
| Web Crypto SHA-256 nos vértices GDA | **Já em uso** no `stratamesh-dag` (equivalente funcional a noble-hashes no edge) |
| TOTP staff (RFC 6238 / estilo otplib) | **Activo** — `/staff/totp/enroll` + challenge `TOTP-{id}` |
| CIDv1 real (raw+sha2-256) | **Activo** no GDA — Helia full node continua pendente (fog) |
