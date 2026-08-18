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


## Outras funcionalidades open-source (GitHub) — expansão

Além do já integrado (Turnstile, sessões hash, TOTP, CIDv1), candidatos úteis para o Nó / StrataMesh.

### Identidade, consentimento e compliance

| Projecto | Função | Encaixe CMN |
|----------|--------|-------------|
| [w3c/vc-data-model](https://github.com/w3c/vc-data-model) | Verifiable Credentials | Credenciais de clearance / PdC auditável |
| [decentralized-identity/presentation-exchange](https://github.com/decentralized-identity/presentation-exchange) | Presentation Exchange | Pedidos de prova sem revelar excesso |
| [eu-digital-identity-wallet/eudi-lib-jvm](https://github.com/eu-digital-identity-wallet) | Carteira EUDI (ref.) | CMD / EUDI quando RP estiver pronto |
| [openid/OpenID4VCI](https://github.com/openid/OpenID4VCI) | Emissão de credenciais | Atestados de nó / staff |
| [privacycg/is-logged-in](https://github.com/privacycg) | Padrões privacidade web | Portal sem tracking desnecessário |

### Pagamentos e settlement (sem custodiar chaves bancárias)

| Projecto | Função | Encaixe CMN |
|----------|--------|-------------|
| [interledger/rafiki](https://github.com/interledger/rafiki) | Interledger node | Liquidação multi-moeda futura |
| [Open-Invoice/standard](https://github.com/network-invoice) / [Invoice-Ninja](https://github.com/invoiceninja/invoiceninja) | Facturação | ENI: recibos/donativos (self-host) |
| [stripe-samples](https://github.com/stripe-samples) (só se conta Stripe) | Checkout | Opcional; ENI já usa transferência Wise |

### Tempo, calendário e dados astronómicos

| Projecto | Função | Encaixe CMN |
|----------|--------|-------------|
| [mourner/suncalc](https://github.com/mourner/suncalc) | Nascer/pôr sol | Validar / substituir motor CLP |
| [commenthol/date-holidays](https://github.com/commenthol/date-holidays) | Feriados por país | Calendário civil PT-PT |
| [moment/luxon](https://github.com/moment/luxon) | Timezones | PPC + portadora ISO |

### Grafos, CRDT e sincronização

| Projecto | Função | Encaixe CMN |
|----------|--------|-------------|
| [automerge/automerge](https://github.com/automerge/automerge) | CRDT | Bancada CGU offline-first |
| [yjs/yjs](https://github.com/yjs/yjs) | CRDT colaboração | Mundo Aberto / edição partilhada |
| [ipld/js-dag-json](https://github.com/ipld/js-dag-json) | IPLD JSON | Vértices legíveis + CID |
| [orbitdb/orbitdb](https://github.com/orbitdb/orbitdb) | DB sobre IPFS | Lab fog (não no Worker free) |
| [gun/gun](https://github.com/amark/gun) | Grafo P2P | Experiências multi-nó |

### IA no edge e orquestração de agentes

| Projecto | Função | Encaixe CMN |
|----------|--------|-------------|
| [cloudflare/ai](https://github.com/cloudflare/ai) | Workers AI bindings | Orquestrador / chat (já próximo) |
| [langchain-ai/langgraphjs](https://github.com/langchain-ai/langgraphjs) | Grafos de agentes | AIOps Dev Team (cuidado com CPU free) |
| [vercel/ai](https://github.com/vercel/ai) | SDK streaming | Chat portal |
| [guidance-ai/guidance](https://github.com/guidance-ai/guidance) | Geração estruturada | Respostas JSON do Orquestrador |

### Segurança e supply-chain

| Projecto | Função | Encaixe CMN |
|----------|--------|-------------|
| [cisagov/ScubaGear](https://github.com/cisagov/ScubaGear) | Audit configs | Processo (não runtime) |
| [google/capslock](https://github.com/google/capslock) | Capacidade Go | Se houver binários fog |
| [sigstore/cosign](https://github.com/sigstore/cosign) | Assinar artefactos | Releases do repo |
| [slsa-framework/slsa](https://github.com/slsa-framework/slsa) | Provenance builds | CI do stratamesh-core |
| [zaproxy/zaproxy](https://github.com/zaproxy/zaproxy) | Security scan | Portal / API |

### Observabilidade e fiabilidade

| Projecto | Função | Encaixe CMN |
|----------|--------|-------------|
| [open-telemetry/opentelemetry-js](https://github.com/open-telemetry/opentelemetry-js) | Traces | Amostragem baixa no free |
| [fluent/fluent-bit](https://github.com/fluent/fluent-bit) | Logs fog | Nó local |
| [grafana/loki](https://github.com/grafana/loki) | Log store | Self-host opcional |
| [healthchecks/healthchecks](https://github.com/healthchecks/healthchecks) | Cron dead-man | AIOps always-on |

### UI / acessibilidade / i18n

| Projecto | Função | Encaixe CMN |
|----------|--------|-------------|
| [formatjs/formatjs](https://github.com/formatjs/formatjs) | i18n robusto | PT-PT / EN-GB |
| [kentcdodds/mdx-bundler](https://github.com/kentcdodds/mdx-bundler) | Docs MDX | Whitepaper no portal |
| [shikijs/shiki](https://github.com/shikijs/shiki) | Syntax highlight | Docs técnicas |
| [WICG/sanitizer-api](https://github.com/WICG/sanitizer-api) | Sanitizar HTML | Bancada CGU |

### Próximas integrações recomendadas (ordem prática no Free)

1. **suncalc** — cruzar com CLP (confiança astronómica)  
2. **ipld/js-dag-json** ou **dag-cbor** — payloads GDA tipados + CID  
3. **yjs** ou **automerge** — Bancada CGU colaborativa (lab)  
4. **cosign + SLSA** no GitHub Actions do `stratamesh-core`  
5. **formatjs** — i18n portal sem strings soltas  
6. **healthchecks** — watchdog dos ciclos AIOps  

*Não é lista de compras obrigatória: cada linha deve justificar-se por PdC, PdS ou clareza institucional ENI.*


| IoT edge universal | **Activo** — `stratamesh-iot` 2.1.0 · docs/IOT-EDGE.md |
