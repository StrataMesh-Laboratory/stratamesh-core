/**
 * api-edge.calhegasmorais.pt — integration API + bot/agent readable plain-text surfaces
 * EDGE-GROK-CMN-001 / grok@calhegasmorais.pt — lab only, no secrets
 */
const VERSION = "1.3.0-va";
const EDGE_ID = "EDGE-GROK-CMN-001";
const FOG_ID = "FOG-NODE-PT-CM-001";
const AGENT = "grok@calhegasmorais.pt";
const DESK = "https://edge.calhegasmorais.pt";
const PRIMARY = "https://api-edge.calhegasmorais.pt";
const WORKERS = "https://stratamesh-edge-api.stratamesh.workers.dev";
const KV_PREFIX = "integ:";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS,DELETE,HEAD",
  "Access-Control-Allow-Headers": "*",
};

function headers(type, cache = "public, max-age=60") {
  return {
    ...CORS,
    "Content-Type": type,
    "Cache-Control": cache,
    "X-Robots-Tag": "all, index, follow",
    "X-StrataMesh-Lab": "true",
    "X-StrataMesh-API": VERSION,
    "X-StrataMesh-Managed-By": EDGE_ID,
  };
}

function json(data, status = 200, cache = "public, max-age=60") {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: headers("application/json; charset=utf-8", cache),
  });
}

function text(body, status = 200, cache = "public, max-age=60") {
  return new Response(body, {
    status,
    headers: headers("text/plain; charset=utf-8", cache),
  });
}

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: headers("text/html; charset=utf-8", "public, max-age=60"),
  });
}

function originOf(url) {
  if (url.hostname.includes("workers.dev")) return url.origin;
  if (url.hostname.startsWith("api-edge.")) return PRIMARY;
  if (url.hostname.startsWith("api.edge.")) return PRIMARY; // redirect mindset
  return PRIMARY;
}

function meta() {
  return {
    status: "ok",
    service: "stratamesh-edge-api",
    version: VERSION,
    lab: true,
    pre_testnet: true,
    managed_by: {
      node_id: EDGE_ID,
      agent: AGENT,
      status: "external_assistant",
      desk: DESK,
    },
    linked_fog: FOG_ID,
    policy: {
      secrets_stored: false,
      va_key_hashes_only: true,
      public_read: true,
      write: "lab_registration_only",
      va: "optional_account_bearer — does not replace zero-auth registry",
      antifragile: true,
      auth: "none_for_read",
    },
  };
}

const SEED = [
  {
    id: "edge-grok-desk",
    name: "StrataMesh Edge Desk (EDGE-GROK)",
    type: "edge_desk",
    status: "active",
    base_url: DESK,
    health_url: DESK + "/health",
    openapi: DESK + "/openapi.json",
    llms_txt: DESK + "/llms.txt",
    catalog: DESK + "/.well-known/agent-catalog.json",
    api_registry: PRIMARY + "/v1/integrations",
    api_spec: PRIMARY + "/SPEC.txt",
    managed_by: EDGE_ID,
    agent: AGENT,
    note: "Canonical desk + lab registry console; test id grok-edge-desk merged here",
  },
  {
    id: "fog-cmn-status",
    name: "Calhegas Morais Fog status",
    type: "fog_status",
    status: "active",
    base_url: "https://status.calhegasmorais.pt/",
    health_url: "https://status.calhegasmorais.pt/health",
    managed_by: FOG_ID,
  },
  {
    id: "gossip-mesh",
    name: "Fog gossip mesh API",
    type: "gossip",
    status: "active",
    base_url: "https://calhegasmorais.pt/api/v1/gossip",
    health_url: "https://calhegasmorais.pt/api/v1/gossip/health",
    peers_url: "https://calhegasmorais.pt/api/v1/gossip/peers",
    managed_by: FOG_ID,
  },
  {
    id: "agent-edge-sdk",
    name: "Contributor Edge SDK",
    type: "documentation",
    status: "active",
    docs: "https://github.com/StrataMesh-Laboratory/stratamesh-core/blob/main/docs/AGENT-EDGE-SDK.md",
    paste: "https://github.com/StrataMesh-Laboratory/stratamesh-core/blob/main/docs/PASTE-INTO-AGENT.md",
    managed_by: EDGE_ID,
  },
  {
    id: "aiops-actions",
    name: "AIOps actions surface",
    type: "aiops",
    status: "active",
    base_url: "https://aiops.calhegasmorais.pt",
    actions_url: "https://aiops.calhegasmorais.pt/actions",
    managed_by: FOG_ID,
  },
];

async function listIntegrations(env) {
  const items = [...SEED];
  if (env.API_KV) {
    try {
      const listed = await env.API_KV.list({ prefix: KV_PREFIX, limit: 100 });
      for (const k of listed.keys || []) {
        const raw = await env.API_KV.get(k.name);
        if (!raw) continue;
        try {
          const obj = JSON.parse(raw);
          if (obj && obj.id) items.push(obj);
        } catch (_) {}
      }
    } catch (_) {}
  }
  const map = new Map();
  for (const it of items) map.set(it.id, it);
  return [...map.values()];
}

function openApiDoc(ORIGIN) {
  return {
    openapi: "3.1.0",
    info: {
      title: "api-edge StrataMesh integration management",
      version: VERSION,
      description:
        "Lab integration registry managed by EDGE-GROK / grok@calhegasmorais.pt. Read is public. Write is lab registration only. No authentication for GET. Never send secrets.",
      contact: { email: AGENT, url: DESK },
    },
    servers: [{ url: ORIGIN }, { url: PRIMARY }, { url: WORKERS }],
    paths: {
      "/": {
        get: {
          summary: "Index (JSON or HTML by Accept)",
          responses: { "200": { description: "Service index" } },
        },
      },
      "/health": {
        get: {
          summary: "Liveness",
          responses: { "200": { description: "status ok + meta" } },
        },
      },
      "/v1/meta": {
        get: {
          summary: "Manager identity and policy",
          responses: { "200": { description: "meta" } },
        },
      },
      "/v1/integrations": {
        get: {
          summary: "List integrations (seed + voluntary registrations)",
          responses: { "200": { description: "{ ok, count, integrations[] }" } },
        },
        post: {
          summary: "Register lab integration — NO secrets allowed in body",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["id", "name"],
                  properties: {
                    id: { type: "string", pattern: "^[a-zA-Z0-9][a-zA-Z0-9_-]{1,62}$" },
                    name: { type: "string", maxLength: 120 },
                    type: { type: "string", default: "contributor_edge" },
                    node_id: { type: "string" },
                    health_url: { type: "string", format: "uri" },
                    base_url: { type: "string", format: "uri" },
                    agent_product: { type: "string" },
                    contact: { type: "string" },
                    notes: { type: "string", maxLength: 400 },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "registered_lab object" },
            "400": { description: "validation error" },
          },
        },
      },
      "/v1/integrations/{id}": {
        get: {
          summary: "Get one integration",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "integration" }, "404": { description: "missing" } },
        },
        delete: {
          summary: "Delete non-seed registration",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "deleted" }, "403": { description: "seed protected" } },
        },
      },
      "/v1/catalog": {
        get: {
          summary: "Automation catalog for agents",
          responses: { "200": { description: "catalog" } },
        },
      },
      "/openapi.json": {
        get: { summary: "OpenAPI 3.1 JSON", responses: { "200": { description: "OpenAPI" } } },
      },
      "/openapi.txt": {
        get: {
          summary: "OpenAPI as indented plain text (bot-friendly)",
          responses: { "200": { description: "text/plain OpenAPI JSON text" } },
        },
      },
      "/SPEC.txt": {
        get: {
          summary: "Full human+agent plain-text specification",
          responses: { "200": { description: "complete instructions" } },
        },
      },
      "/llms.txt": {
        get: { summary: "LLM-oriented guide", responses: { "200": { description: "text" } } },
      },
      "/instructions.txt": {
        get: {
          summary: "Alias of SPEC.txt for agents",
          responses: { "200": { description: "text" } },
        },
      },
      "/README": {
        get: {
          summary: "HTML documentation page embedding full SPEC (searchable page)",
          responses: { "200": { description: "HTML" } },
        },
      },
    },
    security: [],
    "x-auth": "none_for_GET_and_POST_register", "x-write-token": "none",
    "x-dangerous-operations": [
      "POST /v1/integrations (lab catalog write only; rejects secret fields)",
      "DELETE /v1/integrations/{id} (non-seed only)",
    ],
    "x-not-present": ["OAuth", "API keys required for read", "payment", "mainnet settlement"],
    "x-managed-by": EDGE_ID,
    "x-agent": AGENT,
  };
}

function fullSpecText(ORIGIN) {
  const oa = openApiDoc(ORIGIN);
  return `STRATAMESH api-edge — FULL SPECIFICATION (plain text for bots/agents)
================================================================================
Version: ${VERSION}
Primary host: ${PRIMARY}
Workers host: ${WORKERS}
This origin: ${ORIGIN}
Managed by: ${EDGE_ID} / ${AGENT} (external_assistant)
Desk: ${DESK}
Fog: ${FOG_ID}
Lab / pre-testnet: true
Authentication for all GET endpoints: NONE
Authentication for POST /v1/integrations: NONE (public lab registration)
Write token: DOES NOT EXIST — never ask operator for Bearer/API keys for this registry
Secrets stored on this API: NONE
Webhook/callback: OPTIONAL field webhook_url only; not required to register
================================================================================

1. PURPOSE
----------
Integration registry and automation management for voluntary contributors linking
to EDGE-GROK and the Calhegas Morais Fog graph. Public read. Lab registration write.

2. BOT/AGENT FETCH ORDER (use these exact URLs)
----------------------------------------------
1) ${ORIGIN}/SPEC.txt          (this document — preferred)
2) ${ORIGIN}/instructions.txt  (same as SPEC.txt)
3) ${ORIGIN}/llms.txt
4) ${ORIGIN}/openapi.txt       (OpenAPI as plain text)
5) ${ORIGIN}/openapi.json      (OpenAPI JSON)
6) ${ORIGIN}/README            (HTML page embedding this SPEC — searchable)
7) ${ORIGIN}/v1/integrations
8) ${ORIGIN}/health

Also valid on ${PRIMARY} and ${WORKERS}.

3. ENDPOINTS AND METHODS
------------------------
GET  /                         Index JSON (or HTML if Accept: text/html)
GET  /health                   Liveness + manager meta
GET  /v1/meta                  Manager identity + policy
GET  /v1/integrations          List seed + registered integrations
POST /v1/integrations          Register lab integration (NO secrets in body)
GET  /v1/integrations/{id}     Get one by id
DELETE /v1/integrations/{id}   Delete non-seed registration only
GET  /v1/catalog               Agent automation catalog
GET  /openapi.json             OpenAPI 3.1 JSON
GET  /openapi.txt              OpenAPI 3.1 as text/plain
GET  /SPEC.txt                 Full plain-text specification (this file)
GET  /instructions.txt         Alias of SPEC.txt
GET  /llms.txt                 Short LLM guide
GET  /README                   HTML documentation (embeds SPEC)
GET  /robots.txt               Allow all discovery paths
GET  /sitemap.xml              Lists SPEC/README/openapi for crawlers

GET  /v1/va/instructions.txt   Personal VA setup (AI-readable). Does NOT replace this registry.
GET  /v1/va/me                  Account VA identity (Bearer smva_)
POST /v1/va/act                 Allow-listed dashboard remote control (Bearer smva_)

4. AUTHENTICATION / AUTHORIZATION
---------------------------------
- GET registry: no auth headers required
- POST/DELETE /v1/integrations: no API key in lab mode; still reject secret-bearing JSON fields
- Do not send passwords, private keys, api_key, or bearer secrets to the *registry*
- Personal VA is a *separate* surface: /v1/va/* (except instructions) uses Authorization: Bearer smva_…
- VA keys are hashed at rest. Raw token shown once at mint. Zero-auth registry is unchanged.

5. POST /v1/integrations — BODY SCHEMA
--------------------------------------
Required: id, name
Optional: type, node_id, health_url, base_url, agent_product, contact, notes
id pattern: 2-63 chars matching [a-zA-Z0-9][a-zA-Z0-9_-]*
FORBIDDEN property names matching: secret|password|private_key|api_key|token
  (except documentation word "token_hint" is unused; still avoid secrets)

Example:
curl -sS -X POST ${ORIGIN}/v1/integrations \\
  -H 'Content-Type: application/json' \\
  -d '{"id":"contrib-demo","name":"Demo observer","type":"contributor_edge","node_id":"EDGE-CONTRIB-DEMO","agent_product":"chatgpt"}'

Response includes status registered_lab and mesh_member:false.
Mesh gossip listing still requires fog health-check of a public /health URL.

6. SECURITY ASSESSMENT (LAB)
----------------------------
- Read surface is intentionally public
- Write surface does not accept credential material
- Seed integrations cannot be deleted
- No OAuth, no payment rails, no mainnet claims
- Prefer ${PRIMARY} (hyphen). Nested host api.edge may fail TLS.

7. OPENAPI (EMBEDDED JSON)
--------------------------
${JSON.stringify(oa, null, 2)}

8. RELATED LINKS
----------------
Desk: ${DESK}
Desk llms: ${DESK}/llms.txt
SDK: https://github.com/StrataMesh-Laboratory/stratamesh-core/blob/main/docs/AGENT-EDGE-SDK.md
Paste: https://github.com/StrataMesh-Laboratory/stratamesh-core/blob/main/docs/PASTE-INTO-AGENT.md
Gossip peers: https://calhegasmorais.pt/api/v1/gossip/peers
Fog status: https://status.calhegasmorais.pt/

END OF SPEC
`;
}

function llmsTxt(ORIGIN) {
  return `# api-edge.calhegasmorais.pt

> Lab integration management API. Managed by ${EDGE_ID} / ${AGENT}.

## Prefer plain text (for retrieval tools)
- ${ORIGIN}/SPEC.txt
- ${ORIGIN}/instructions.txt
- ${ORIGIN}/openapi.txt
- ${ORIGIN}/README  (HTML, searchable page with full SPEC embedded)

## JSON
- ${ORIGIN}/openapi.json
- ${ORIGIN}/v1/integrations
- ${ORIGIN}/health

## Auth (unlinked registry)
NONE for GET and for POST /v1/integrations.
There is no write token for the public registry. Do not request Authorization from the operator for registration.
POST rejects secret fields. Minimum body: {"id":"...","name":"..."}.
Install guide: ${ORIGIN}/v1/install-guide

## Personal VA (optional, account-bound)
Does **not** replace the zero-auth registry above.
- ${ORIGIN}/v1/va/instructions.txt   ← paste this into the user's own AI
- Mint: POST ${ORIGIN}/v1/va/keys with the *dashboard session* Bearer
- Use: Authorization: Bearer smva_… on /v1/va/me and /v1/va/act
Users and SCAs only. Lab n=1. mesh_member=false.


## Hosts
Primary: ${PRIMARY}
Workers: ${WORKERS}
Avoid broken TLS on api.edge (use api-edge with hyphen).

## Rules
Lab only. No secrets. mesh_member false until fog checks public /health.
`;
}

function catalog(ORIGIN) {
  return {
    schema: "stratamesh.edge_api_catalog.v1",
    ...meta(),
    endpoints: {
      health: ORIGIN + "/health",
      meta: ORIGIN + "/v1/meta",
      integrations: ORIGIN + "/v1/integrations",
      catalog: ORIGIN + "/v1/catalog",
      openapi: ORIGIN + "/openapi.json",
      openapi_txt: ORIGIN + "/openapi.txt",
      spec_txt: ORIGIN + "/SPEC.txt",
      instructions_txt: ORIGIN + "/instructions.txt",
      llms_txt: ORIGIN + "/llms.txt",
      readme_html: ORIGIN + "/README",
      va_instructions: ORIGIN + "/v1/va/instructions.txt",
      va_me: ORIGIN + "/v1/va/me",
    },
    desk: { home: DESK, health: DESK + "/health" },
    bot_fetch_order: [
      ORIGIN + "/SPEC.txt",
      ORIGIN + "/openapi.txt",
      ORIGIN + "/README",
      ORIGIN + "/v1/integrations",
    ],
  };
}

function readmeHtml(ORIGIN) {
  const spec = fullSpecText(ORIGIN).replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<link rel="icon" href="https://calhegasmorais.pt/favicon.ico"/>
<link rel="apple-touch-icon" href="https://calhegasmorais.pt/apple-touch-icon.png"/>

<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>api-edge · StrataMesh integration API (full SPEC)</title>
<meta name="description" content="Full plain-text API specification for StrataMesh api-edge integration management. Bot and agent readable."/>
<meta name="robots" content="index,follow,max-snippet:-1,max-image-preview:large"/>
<link rel="alternate" type="text/plain" href="/SPEC.txt" title="SPEC.txt"/>
<link rel="alternate" type="text/plain" href="/openapi.txt" title="openapi.txt"/>
<link rel="alternate" type="application/json" href="/openapi.json" title="openapi.json"/>
<link rel="canonical" href="${ORIGIN}/README"/>
</head>
<body>
<h1>api-edge.calhegasmorais.pt — integration management</h1>
<p>Managed by <code>${EDGE_ID}</code> / <code>${AGENT}</code>. Lab only. This HTML page exists so crawlers and agent retrieval tools can load a <strong>searchable document</strong> that embeds the complete specification.</p>
<p>Direct plain-text mirrors (prefer these in tools):</p>
<ul>
<li><a href="/SPEC.txt">/SPEC.txt</a></li>
<li><a href="/instructions.txt">/instructions.txt</a></li>
<li><a href="/openapi.txt">/openapi.txt</a></li>
<li><a href="/llms.txt">/llms.txt</a></li>
<li><a href="/openapi.json">/openapi.json</a></li>
<li><a href="/v1/integrations">/v1/integrations</a></li>
<li><a href="/health">/health</a></li>
</ul>
<h2>Full specification (embedded)</h2>
<pre style="white-space:pre-wrap;word-break:break-word;font-size:13px;line-height:1.4;background:#0b1220;color:#e8eef7;padding:1rem;border-radius:8px;">
${spec}
</pre>
</body>
</html>`;
}

function validateRegistration(body) {
  if (!body || typeof body !== "object") return "body required";
  const id = String(body.id || body.integration_id || "").trim();
  if (!/^[a-z0-9][a-z0-9_-]{1,62}$/i.test(id)) return "id must be 2-63 chars [a-z0-9_-] (field: id)";
  if (SEED.some((s) => s.id === id)) return "id reserved (seed integration)";
  const name = body.name || body.integration_name;
  if (!name || String(name).length > 120) return "name required (<=120 chars)";
  // Reject credential material — lab registry never stores secrets
  for (const k of Object.keys(body)) {
    if (/^(secret|password|private_key|api_key|token|bearer|authorization)$/i.test(k)) {
      return "secrets not accepted — omit " + k + ". Lab registration is public; no write token exists.";
    }
    if (/secret|password|private_key|api_key/i.test(k) && !/webhook|callback|health/i.test(k)) {
      return "secrets not accepted — omit " + k;
    }
  }
  return null;
}

async function handleRegister(env, request) {
  const body = await request.json().catch(() => null);
  const err = validateRegistration(body);
  if (err) {
    return json({
      ok: false,
      error: err,
      auth: "none",
      hint: "POST JSON { id, name } with no Authorization header. Optional: type, node_id, health_url, base_url, agent_product, webhook_url, callback_url, notes.",
      example: {
        id: "contrib-myagent-01",
        name: "My Agent Observer",
        type: "contributor_edge",
        agent_product: "claude|chatgpt|gemini|copilot|other",
      },
      docs: PRIMARY + "/SPEC.txt",
    }, 400, "no-store");
  }
  const id = String(body.id || body.integration_id).trim();
  const name = String(body.name || body.integration_name).slice(0, 120);
  const webhook = body.webhook_url || body.callback_url || body.webhook || null;
  const rec = {
    id,
    name,
    type: String(body.type || "contributor_edge").slice(0, 40),
    status: "registered_lab",
    lab: true,
    mesh_member: false,
    node_id: body.node_id ? String(body.node_id).slice(0, 80) : null,
    health_url: body.health_url ? String(body.health_url).slice(0, 300) : null,
    base_url: body.base_url ? String(body.base_url).slice(0, 300) : null,
    webhook_url: webhook ? String(webhook).slice(0, 300) : null,
    agent_product: body.agent_product ? String(body.agent_product).slice(0, 40) : null,
    contact: body.contact ? String(body.contact).slice(0, 120) : null,
    notes: body.notes ? String(body.notes).slice(0, 400) : null,
    registered_at: new Date().toISOString(),
    managed_by: EDGE_ID,
    managed_agent: AGENT,
    policy: {
      write_auth: "none",
      secrets_accepted: false,
      mesh_member_requires: "public /health 200 checked by fog gossip",
    },
  };
  if (env.API_KV) {
    await env.API_KV.put(KV_PREFIX + id, JSON.stringify(rec), { expirationTtl: 60 * 60 * 24 * 90 });
  }
  return json({
    ok: true,
    auth_used: "none",
    integration: rec,
    next: {
      list: PRIMARY + "/v1/integrations",
      self: PRIMARY + "/v1/integrations/" + id,
      desk: DESK,
      sdk: "https://github.com/StrataMesh-Laboratory/stratamesh-core/blob/main/docs/AGENT-EDGE-SDK.md",
      note: "No token was required. mesh_member stays false until a public health_url passes fog checks.",
    },
  }, 200, "no-store");
}

function wantsHtml(request) {
  const a = (request.headers.get("Accept") || "").toLowerCase();
  return a.includes("text/html") && !a.includes("application/json");
}


function installGuide(ORIGIN) {
  return {
    schema: "stratamesh.install_guide.v1",
    title: "Zero-auth lab integration registration",
    auth: {
      read: "none",
      write: "none",
      note: "There is NO write token. Do not ask the operator for Bearer tokens. POST is public lab registration.",
    },
    forbidden: ["Authorization headers for registration", "api_key", "password", "private_key", "secret"],
    minimum_payload: { id: "contrib-example-01", name: "Example Observer" },
    optional_fields: ["type", "node_id", "health_url", "base_url", "webhook_url", "callback_url", "agent_product", "contact", "notes"],
    curl: "curl -sS -X POST " + ORIGIN + "/v1/integrations -H 'Content-Type: application/json' -d '{\"id\":\"contrib-example-01\",\"name\":\"Example Observer\",\"type\":\"contributor_edge\",\"agent_product\":\"other\"}'",
    import_contract: ORIGIN + "/openapi.json",
    full_spec: ORIGIN + "/SPEC.txt",
    steps: [
      "1. GET " + ORIGIN + "/health (reachability)",
      "2. GET " + ORIGIN + "/openapi.json or /SPEC.txt (contract)",
      "3. POST " + ORIGIN + "/v1/integrations with {id,name} only — no Authorization header",
      "4. GET " + ORIGIN + "/v1/integrations/{id} to verify",
      "5. Optional: install local observer via AGENT-EDGE-SDK (nice 19, mesh_member false)",
    ],
    answers_for_confused_agents: {
      integration_name: "choose any; becomes the name field",
      write_token: "no — none exists for lab registration",
      authorization_bearer: "no — omit Authorization entirely",
      callback_webhook_url: "optional; omit or set webhook_url if you have one",
      language: "any HTTP client (curl, Node fetch, Python requests)",
      personal_va: "separate surface /v1/va — see " + ORIGIN + "/v1/va/instructions.txt",
    },
  };
}

const AUTH_ME = "https://calhegasmorais.pt/api/auth/me";
const VA_PREFIX = "smva_";
const APEX = "https://calhegasmorais.pt";

const VA_CONTROLS = [
  { id: "health.pills", method: "GET", desc: "Apex + Fog + gossip + holons /health" },
  { id: "holons.health", method: "GET", desc: "Holons SO /health" },
  { id: "holons.boot", method: "GET", desc: "Holons /boot (≤1.5s fail-open)" },
  { id: "gossip.have", method: "GET", desc: "Gossip IHAVE digest" },
  { id: "token.list", method: "GET", desc: "STRATA NFT list limit=20" },
  { id: "dashboard.snapshot", method: "GET", desc: "Pills + holons + gossip have" },
  { id: "prefs.get", method: "GET", desc: "Dashboard prefs for this account" },
  { id: "prefs.set", method: "PUT", desc: "Set lang / default_panel / pins" },
];

function vaInstructions(ORIGIN) {
  return `# Personal Virtual Assistant — api-edge.calhegasmorais.pt

Lab n=1 · mesh_member=false · oracle_live=false · no STRATA mint
This surface is OPTIONAL and does NOT replace the unlinked open registry.

Open registry (no account, no Bearer):
  ${ORIGIN}/SPEC.txt
  POST ${ORIGIN}/v1/integrations   ← still zero-auth

Personal VA (one Bearer per user|SCA, hashed at rest):
  ${ORIGIN}/v1/va/instructions.txt   (this file — paste into the assistant)
  ${ORIGIN}/v1/va/controls
  ${ORIGIN}/v1/va/me
  ${ORIGIN}/v1/va/act
  ${ORIGIN}/v1/va/prefs

## 1. Operator mints a key (dashboard session, not the VA)

The human or SCA must already have a StrataMesh account (do not invent one).

  curl -sS -X POST ${ORIGIN}/v1/va/keys \\
    -H 'Authorization: Bearer <dashboard_session>' \\
    -H 'Content-Type: application/json' \\
    -d '{"label":"home-assistant","scopes":["dashboard.read","dashboard.prefs"]}'

Response shows token ONCE: smva_<hex>. Store it in the assistant. Never commit it.

List/revoke with the same dashboard session:
  GET    ${ORIGIN}/v1/va/keys
  DELETE ${ORIGIN}/v1/va/keys/{id}

## 2. Assistant bootstrap (this is you)

1. Fetch this file.
2. GET ${ORIGIN}/v1/va/me  with Authorization: Bearer smva_…
3. GET ${ORIGIN}/v1/va/controls
4. Act only through POST ${ORIGIN}/v1/va/act  {"action":"<id>","args":{}}
5. Do not call *.workers.dev. Do not hit status-worker /status.
6. Do not POST /v1/integrations with this Bearer — registry stays unlinked.

## 3. Remote dashboard controls

Allow-listed actions (fail-open ≤1.5s):
${VA_CONTROLS.map((c) => "- " + c.id + "  " + c.method + "  " + c.desc).join("\n")}

Prefs shape: {"lang":"pt"|"en","default_panel":"system","pins":["holons","token"],"notes":""}
The live dashboard at ${APEX}/dashboard applies prefs when the owner is signed in.

## 4. Honesty

- Keys prove the assistant acts for one existing account (user|SCA).
- Ledger writes (SPA execute, NFT mint) stay on the dashboard session + PdS-402.
- VA cannot mint STRATA, cannot set mesh_member=true, cannot add a 6th cron.
- Max 5 keys per account. Hashes only in KV. Raw token never stored.

END
`;
}

async function sha256Hex(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(s)));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function bearerOf(request) {
  const h = request.headers.get("Authorization") || "";
  const m = h.match(/^Bearer\s+(\S+)/i);
  return m ? m[1] : "";
}

async function fetchJson(url, init, ms = 1500) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetch(url, { ...init, signal: ac.signal, headers: { Accept: "application/json", ...(init && init.headers) } });
    const data = await r.json().catch(() => null);
    return { ok: r.ok, http: r.status, data };
  } catch (e) {
    return { ok: false, http: 0, error: String(e.message || e).slice(0, 80), timeout: true };
  } finally {
    clearTimeout(t);
  }
}

async function resolveSession(request) {
  const token = bearerOf(request);
  if (!token || token.startsWith(VA_PREFIX)) return null;
  const r = await fetchJson(AUTH_ME, { headers: { Authorization: "Bearer " + token } }, 2000);
  if (!r.ok || !r.data || r.data.success === false || r.data.error === "Unauthorized") return null;
  const u = r.data.user || r.data;
  const id = String(u.user_id || u.id || u.email || r.data.email || "");
  if (!id) return null;
  const kind = id.startsWith("SCA-") || u.role === "sca" || u.kind === "sca" ? "sca" : "user";
  return { owner_id: id, owner_kind: kind, me: r.data };
}

async function kvGet(env, key) {
  if (!env.API_KV) return null;
  const raw = await env.API_KV.get(key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

async function kvPut(env, key, obj) {
  if (!env.API_KV) return false;
  await env.API_KV.put(key, JSON.stringify(obj));
  return true;
}

async function resolveVa(request, env) {
  const token = bearerOf(request);
  if (!token || !token.startsWith(VA_PREFIX)) return null;
  const hash = await sha256Hex(token);
  const row = await kvGet(env, "va:k:" + hash);
  if (!row || row.revoked_at) return null;
  row.last_used_at = new Date().toISOString();
  try { await env.API_KV.put("va:k:" + hash, JSON.stringify(row)); } catch (_) {}
  return row;
}

async function requireVaOrSession(request, env) {
  const va = await resolveVa(request, env);
  if (va) return { ok: true, via: "va", owner_id: va.owner_id, owner_kind: va.owner_kind, key_id: va.id };
  const sess = await resolveSession(request);
  if (sess) return { ok: true, via: "session", owner_id: sess.owner_id, owner_kind: sess.owner_kind };
  return { ok: false, status: 401, error: "auth_required", hint: "Bearer smva_… or dashboard session" };
}

function mintToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return VA_PREFIX + hex;
}

async function handleVaKeys(env, request, path) {
  const sess = await resolveSession(request);
  if (!sess) return json({ ok: false, error: "session_required", hint: "Mint/list/revoke VA keys with the dashboard session Bearer, not smva_." }, 401, "no-store");
  if (!env.API_KV) return json({ ok: false, error: "kv_unavailable" }, 503, "no-store");

  const ownerKey = "va:o:" + sess.owner_id;
  const ids = (await kvGet(env, ownerKey)) || [];

  if (request.method === "GET" && path === "/v1/va/keys") {
    const keys = [];
    for (const id of ids) {
      const meta = await kvGet(env, "va:i:" + id);
      if (meta) keys.push({ id: meta.id, label: meta.label, prefix: meta.prefix, scopes: meta.scopes, created_at: meta.created_at, revoked_at: meta.revoked_at || null });
    }
    return json({ ok: true, owner_id: sess.owner_id, owner_kind: sess.owner_kind, keys }, 200, "no-store");
  }

  if (request.method === "POST" && path === "/v1/va/keys") {
    const active = [];
    for (const id of ids) {
      const meta = await kvGet(env, "va:i:" + id);
      if (meta && !meta.revoked_at) active.push(id);
    }
    if (active.length >= 5) return json({ ok: false, error: "max_keys", max: 5 }, 409, "no-store");
    const body = await request.json().catch(() => ({}));
    const raw = mintToken();
    const hash = await sha256Hex(raw);
    const id = "vak_" + raw.slice(5, 13);
    const row = {
      id,
      owner_id: sess.owner_id,
      owner_kind: sess.owner_kind,
      label: String(body.label || "personal-va").slice(0, 80),
      scopes: Array.isArray(body.scopes) ? body.scopes.slice(0, 8) : ["dashboard.read", "dashboard.prefs"],
      prefix: raw.slice(0, 12),
      created_at: new Date().toISOString(),
    };
    await kvPut(env, "va:k:" + hash, row);
    await kvPut(env, "va:i:" + id, row);
    await kvPut(env, ownerKey, ids.concat([id]));
    return json({
      ok: true,
      token: raw,
      shown_once: true,
      key: { id: row.id, label: row.label, prefix: row.prefix, scopes: row.scopes, owner_kind: row.owner_kind },
      note: "Store token in the assistant. It is not stored in plaintext. Open registry stays zero-auth.",
    }, 201, "no-store");
  }

  if (request.method === "DELETE" && path.startsWith("/v1/va/keys/")) {
    const id = path.slice("/v1/va/keys/".length);
    const meta = await kvGet(env, "va:i:" + id);
    if (!meta || meta.owner_id !== sess.owner_id) return json({ ok: false, error: "not_found" }, 404, "no-store");
    meta.revoked_at = new Date().toISOString();
    await kvPut(env, "va:i:" + id, meta);
    return json({ ok: true, revoked: id }, 200, "no-store");
  }

  return json({ error: "method_not_allowed" }, 405, "no-store");
}

async function runAct(action, args, actor) {
  const a = String(action || "");
  if (a === "health.pills" || a === "dashboard.snapshot") {
    const urls = [
      APEX + "/",
      "https://fog.calhegasmorais.pt/health",
      "https://gossip.calhegasmorais.pt/have",
      APEX + "/api/v1/holons/health",
    ];
    const pills = [];
    for (const u of urls) pills.push(await fetchJson(u, {}, 1500));
    const out = { action: a, owner_id: actor.owner_id, pills: pills.map((p) => ({ http: p.http, ok: p.ok, error: p.error, version: p.data && p.data.version })) };
    if (a === "dashboard.snapshot") {
      out.prefs_hint = "GET /v1/va/prefs";
      out.holons = (await fetchJson(APEX + "/api/v1/holons/health", {}, 1500)).data;
    }
    return { ok: true, ...out };
  }
  if (a === "holons.health") return { ok: true, action: a, ...(await fetchJson(APEX + "/api/v1/holons/health", {}, 1500)) };
  if (a === "holons.boot") return { ok: true, action: a, ...(await fetchJson(APEX + "/api/v1/holons/boot", {}, 2000)) };
  if (a === "gossip.have") return { ok: true, action: a, ...(await fetchJson("https://gossip.calhegasmorais.pt/have", {}, 1500)) };
  if (a === "token.list") return { ok: true, action: a, ...(await fetchJson(APEX + "/api/v1/token/list?limit=20", {}, 2000)) };
  if (a === "prefs.get") return { ok: true, action: a, defer: "GET /v1/va/prefs" };
  if (a === "prefs.set") return { ok: true, action: a, defer: "PUT /v1/va/prefs", args };
  return { ok: false, error: "unknown_action", allowed: VA_CONTROLS.map((c) => c.id) };
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    const url = new URL(request.url);
    const ORIGIN = originOf(url);
    let path = url.pathname.replace(/\/+$/, "") || "/";

    // --- Bot-first plain text ---
    if (path === "/SPEC.txt" || path === "/spec.txt" || path === "/instructions.txt" || path === "/INSTRUCTIONS.txt") {
      return text(fullSpecText(ORIGIN));
    }
    if (path === "/openapi.txt" || path === "/OPENAPI.txt") {
      return text(JSON.stringify(openApiDoc(ORIGIN), null, 2));
    }
    if (path === "/llms.txt" || path === "/LLMs.txt") return text(llmsTxt(ORIGIN));
    if (path === "/README" || path === "/readme" || path === "/docs" || path === "/documentation") {
      return html(readmeHtml(ORIGIN));
    }
    if (path === "/openapi.json") return json(openApiDoc(ORIGIN));
    if (path === "/robots.txt") {
      return text(`User-agent: *\nAllow: /\nAllow: /SPEC.txt\nAllow: /instructions.txt\nAllow: /openapi.txt\nAllow: /openapi.json\nAllow: /llms.txt\nAllow: /README\nAllow: /v1/\nAllow: /health\nCrawl-delay: 1\nSitemap: ${ORIGIN}/sitemap.xml\n`);
    }
    if (path === "/sitemap.xml") {
      const urls = ["/", "/README", "/SPEC.txt", "/instructions.txt", "/openapi.txt", "/openapi.json", "/llms.txt", "/health", "/v1/integrations", "/v1/va/instructions.txt"];
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
          urls.map((u) => `  <url><loc>${ORIGIN}${u}</loc></url>`).join("\n") +
          `\n</urlset>\n`,
        { headers: headers("application/xml; charset=utf-8") }
      );
    }

    if (path === "/health" || path === "/v1/health") {
      return json({ ...meta(), timestamp: new Date().toISOString() }, 200, "no-store");
    }
    if (path === "/v1/meta") return json(meta());
    if (path === "/v1/catalog") return json(catalog(ORIGIN));
    if (path === "/v1/install" || path === "/v1/install-guide" || path === "/install") {
      return json(installGuide(ORIGIN));
    }
    if (path === "/v1/register-schema") {
      return json({
        content_type: "application/json",
        method: "POST",
        url: ORIGIN + "/v1/integrations",
        auth: "none",
        required: ["id", "name"],
        properties: {
          id: { type: "string", pattern: "^[a-zA-Z0-9][a-zA-Z0-9_-]{1,62}$" },
          name: { type: "string", maxLength: 120 },
          type: { type: "string", default: "contributor_edge" },
          node_id: { type: "string" },
          health_url: { type: "string" },
          base_url: { type: "string" },
          webhook_url: { type: "string", description: "optional; alias callback_url" },
          agent_product: { type: "string" },
          contact: { type: "string" },
          notes: { type: "string", maxLength: 400 },
        },
        reject: ["secret", "password", "api_key", "token", "private_key", "Authorization"],
        example: { id: "contrib-myagent-01", name: "My Agent Observer", type: "contributor_edge" },
      });
    }

    if (path === "/v1/integrations") {
      if (request.method === "GET") {
        const items = await listIntegrations(env);
        return json({ ok: true, count: items.length, integrations: items, managed_by: EDGE_ID, agent: AGENT });
      }
      if (request.method === "POST") return handleRegister(env, request);
      return json({ error: "method_not_allowed" }, 405, "no-store");
    }

    if (path.startsWith("/v1/integrations/")) {
      const id = path.slice("/v1/integrations/".length).split("/")[0];
      if (request.method === "GET") {
        const items = await listIntegrations(env);
        const found = items.find((x) => x.id === id);
        if (!found) return json({ ok: false, error: "not_found", id }, 404, "no-store");
        return json({ ok: true, integration: found });
      }
      if (request.method === "DELETE" && env.API_KV) {
        if (SEED.some((s) => s.id === id)) return json({ ok: false, error: "cannot_delete_seed" }, 403, "no-store");
        await env.API_KV.delete(KV_PREFIX + id);
        return json({ ok: true, deleted: id }, 200, "no-store");
      }
      return json({ error: "method_not_allowed" }, 405, "no-store");
    }

    if (path === "/v1/va/instructions.txt" || path === "/v1/va/instructions") {
      return text(vaInstructions(ORIGIN));
    }
    if (path === "/v1/va" || path === "/v1/va/index") {
      return json({
        ok: true,
        surface: "personal_va",
        replaces_open_registry: false,
        instructions: ORIGIN + "/v1/va/instructions.txt",
        mint: { method: "POST", url: ORIGIN + "/v1/va/keys", auth: "dashboard_session" },
        use: { me: ORIGIN + "/v1/va/me", act: ORIGIN + "/v1/va/act", prefs: ORIGIN + "/v1/va/prefs", auth: "Bearer smva_" },
        open_registry_unchanged: ORIGIN + "/v1/integrations",
      });
    }
    if (path === "/v1/va/controls") {
      const gate = await requireVaOrSession(request, env);
      if (!gate.ok) return json(gate, gate.status, "no-store");
      return json({ ok: true, owner_id: gate.owner_id, owner_kind: gate.owner_kind, controls: VA_CONTROLS }, 200, "no-store");
    }
    if (path === "/v1/va/me") {
      const gate = await requireVaOrSession(request, env);
      if (!gate.ok) return json(gate, gate.status, "no-store");
      return json({
        ok: true,
        owner_id: gate.owner_id,
        owner_kind: gate.owner_kind,
        via: gate.via,
        key_id: gate.key_id || null,
        lab: true,
        mesh_member: false,
        dashboard: APEX + "/dashboard",
        controls: ORIGIN + "/v1/va/controls",
      }, 200, "no-store");
    }
    if (path === "/v1/va/keys" || path.startsWith("/v1/va/keys/")) {
      return handleVaKeys(env, request, path);
    }
    if (path === "/v1/va/prefs") {
      const gate = await requireVaOrSession(request, env);
      if (!gate.ok) return json(gate, gate.status, "no-store");
      const pk = "va:p:" + gate.owner_id;
      if (request.method === "GET") {
        const prefs = (await kvGet(env, pk)) || { lang: "pt", default_panel: "system", pins: [], notes: "" };
        return json({ ok: true, owner_id: gate.owner_id, prefs }, 200, "no-store");
      }
      if (request.method === "PUT" || request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const prefs = {
          lang: body.lang === "en" ? "en" : "pt",
          default_panel: String(body.default_panel || "system").slice(0, 40),
          pins: Array.isArray(body.pins) ? body.pins.slice(0, 12).map((x) => String(x).slice(0, 40)) : [],
          notes: String(body.notes || "").slice(0, 400),
          updated_at: new Date().toISOString(),
          updated_via: gate.via,
        };
        await kvPut(env, pk, prefs);
        return json({ ok: true, prefs }, 200, "no-store");
      }
      return json({ error: "method_not_allowed" }, 405, "no-store");
    }
    if (path === "/v1/va/act" && request.method === "POST") {
      const gate = await requireVaOrSession(request, env);
      if (!gate.ok) return json(gate, gate.status, "no-store");
      if (gate.via !== "va") return json({ ok: false, error: "va_key_required", hint: "POST /v1/va/act is for the personal assistant Bearer smva_." }, 403, "no-store");
      const body = await request.json().catch(() => ({}));
      const result = await runAct(body.action || body.id, body.args || {}, gate);
      return json(result, result.ok ? 200 : 400, "no-store");
    }

    if (path === "/" || path === "/v1") {
      if (wantsHtml(request)) return html(readmeHtml(ORIGIN));
      return json({
        ...meta(),
        message: "api-edge integration management — EDGE-GROK automation",
        preferred_host: PRIMARY,
        register: {
          auth: "none",
          method: "POST",
          url: ORIGIN + "/v1/integrations",
          body_min: { id: "contrib-example-01", name: "Example Observer" },
          no_token: true,
          guide: ORIGIN + "/v1/install-guide",
          schema: ORIGIN + "/v1/register-schema",
        },
        personal_va: {
          optional: true,
          replaces_open_registry: false,
          instructions: ORIGIN + "/v1/va/instructions.txt",
        },
        bot_fetch_order: [
          ORIGIN + "/SPEC.txt",
          ORIGIN + "/v1/install-guide",
          ORIGIN + "/openapi.txt",
          ORIGIN + "/README",
          ORIGIN + "/llms.txt",
          ORIGIN + "/openapi.json",
        ],
        links: { ...catalog(ORIGIN).endpoints, install_guide: ORIGIN + "/v1/install-guide", register_schema: ORIGIN + "/v1/register-schema" },
        timestamp: new Date().toISOString(),
      });
    }

    return json({
      error: "not_found",
      try: ["/SPEC.txt", "/README", "/openapi.txt", "/v1/va/instructions.txt", "/health", "/v1/integrations"],
    }, 404, "no-store");
  },
};
