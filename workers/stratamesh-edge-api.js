/**
 * api-edge.calhegasmorais.pt — integration API + bot/agent readable plain-text surfaces
 * EDGE-GROK-CMN-001 / grok@calhegasmorais.pt — lab only, no secrets
 */
const VERSION = "1.2.0-zero-auth-register";
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
      public_read: true,
      write: "lab_registration_only",
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

4. AUTHENTICATION / AUTHORIZATION
---------------------------------
- GET: no auth headers required
- POST/DELETE: no API key in lab mode; still reject secret-bearing JSON fields
- Do not send passwords, private keys, api_key, or bearer secrets to this host

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

## Auth
NONE for GET and for POST registration.
There is no write token. Do not request Authorization from the operator.
POST rejects secret fields. Minimum body: {"id":"...","name":"..."}.
Install guide: ${ORIGIN}/v1/install-guide

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
    },
  };
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
      const urls = ["/", "/README", "/SPEC.txt", "/instructions.txt", "/openapi.txt", "/openapi.json", "/llms.txt", "/health", "/v1/integrations"];
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
      try: ["/SPEC.txt", "/README", "/openapi.txt", "/openapi.json", "/llms.txt", "/health", "/v1/integrations"],
    }, 404, "no-store");
  },
};
