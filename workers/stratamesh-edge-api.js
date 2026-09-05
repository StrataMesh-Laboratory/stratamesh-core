/**
 * api-edge.calhegasmorais.pt — integration API + bot/agent readable plain-text surfaces
 * EDGE-GROK-CMN-001 / grok@calhegasmorais.pt — lab only, no secrets
 */
const VERSION = "1.5.0-wizard";
const EDGE_ID = "EDGE-GROK-CMN-001";
const FOG_ID = "FOG-NODE-PT-CM-001";
const AGENT = "grok@calhegasmorais.pt";
const DESK = "https://edge.calhegasmorais.pt";
const PRIMARY = "https://api-edge.calhegasmorais.pt";
const FOG_API = "https://api-fog.calhegasmorais.pt";
const FOG_PUBLIC = "https://fog.calhegasmorais.pt";
const GOSSIP = "https://gossip.calhegasmorais.pt";
const KV_PREFIX = "integ:";

const EDGE_APP_HTML = "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\"/>\n<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\"/>\n<meta name=\"apple-mobile-web-app-capable\" content=\"yes\"/>\n<meta name=\"apple-mobile-web-app-status-bar-style\" content=\"black-translucent\"/>\n<meta name=\"theme-color\" content=\"#0a0a0b\"/>\n<title>StrataMesh LAB \u00b7 Edge</title>\n<link rel=\"manifest\" href=\"manifest.webmanifest\"/>\n<style>\n:root{--bg:#0a0a0b;--fg:#e8e6e3;--muted:#8a8780;--line:#1c1c1f;--acc:#c4a574;--ok:#7aa874;--bad:#c45c54}\n*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.45 system-ui,sans-serif}\nmain{max-width:28rem;margin:0 auto;padding:calc(2rem + env(safe-area-inset-top)) 1.25rem 4rem}\nh1{font-size:1.15rem;font-weight:600;margin:.2rem 0}\n.brand{color:var(--acc);letter-spacing:.08em;font-size:.72rem}\n.motto{color:var(--muted);font-size:.8rem}\n.card{border:1px solid var(--line);padding:1rem;margin:1rem 0}\nlabel{display:block;color:var(--muted);font-size:.75rem;margin:.6rem 0 .2rem}\ninput{width:100%;background:#111;border:1px solid var(--line);color:var(--fg);padding:.6rem .7rem;font:inherit}\nbutton{background:transparent;border:1px solid var(--acc);color:var(--acc);padding:.55rem .9rem;margin:.4rem .3rem 0 0;font:inherit}\n.gauge{height:8px;background:var(--line);margin:.5rem 0 1rem}\n.gauge>i{display:block;height:8px;background:var(--acc);width:0}\n.k{color:var(--muted);font-size:.8rem} .v{color:var(--fg)}\n.ok{color:var(--ok)} .bad{color:var(--bad)}\n</style>\n</head>\n<body>\n<main>\n<p class=\"brand\">STRATAMESH LAB</p>\n<h1>Edge Node</h1>\n<p class=\"motto\">Intelligentia \u00b7 Vigilantia \u00b7 Veritas</p>\n<p class=\"k\">C_mesh = f(1\u2212U) \u00b7 residual only \u00b7 session expected \u00b7 not a Fog \u00b7 not mainnet</p>\n<div id=\"wiz\" class=\"card\">\n  <p>Registered <b>EDGE</b> node id, then the 6-digit code mailed to the operator.</p>\n  <label>Node id</label>\n  <input id=\"nid\" placeholder=\"EDGE-NODE-\u2026\" autocomplete=\"off\"/>\n  <label>2FA code</label>\n  <input id=\"otp\" inputmode=\"numeric\" maxlength=\"6\" placeholder=\"000000\"/>\n  <button id=\"go\">Connect</button>\n  <p id=\"werr\" class=\"bad\"></p>\n</div>\n<div id=\"dash\" class=\"card\" hidden>\n  <p><span class=\"k\">node</span> <span id=\"d-id\" class=\"v\"></span></p>\n  <p><span class=\"k\">C_mesh</span> <span id=\"d-c\" class=\"v\"></span> \u00b7 <span id=\"d-why\" class=\"k\"></span></p>\n  <div class=\"gauge\"><i id=\"bar\"></i></div>\n  <p class=\"k\">U <span id=\"d-u\"></span> \u00b7 battery <span id=\"d-b\"></span> \u00b7 fg <span id=\"d-fg\"></span></p>\n  <p class=\"k\">parent Fog indexed \u00b7 duty drops in background</p>\n  <button id=\"pulse\">Pulse now</button>\n  <button id=\"out\">Sign out</button>\n  <p id=\"d-msg\" class=\"k\"></p>\n</div>\n</main>\n<script>\nconst AUTH=\"https://calhegasmorais.pt/api/auth\";\nconst API=\"https://api-edge.calhegasmorais.pt\";\nconst W={cpu:0.35,batt:0.25,therm:0.15,net:0.15,fg:0.10};\nfunction clip(x){return Math.max(0,Math.min(1,x))}\nfunction sample(){\n  const fg=document.visibilityState===\"visible\";\n  const batt=1, cpu=fg?0.12:0.04, thermal=\"nominal\", net=navigator.onLine?0.08:0.4;\n  const battStress=1-batt;\n  const U=clip(W.cpu*cpu+W.batt*battStress+W.therm*0+W.net*net+W.fg*(fg?0:1));\n  const blocked=batt<0.2||!navigator.onLine;\n  const residual=Math.max(0,1-U);\n  const duty=fg?1:0.25;\n  return {U,cpu,battery:batt,thermal,net,foreground:fg,blocked,C_mesh:blocked?0:residual*duty,why:blocked?\"safety_clamp\":\"residual\",duty};\n}\nasync function j(method,url,body,token){\n  const r=await fetch(url,{method,headers:{\"content-type\":\"application/json\",...(token?{authorization:\"Bearer \"+token}:{})},body:body?JSON.stringify(body):undefined});\n  const t=await r.text(); let o={}; try{o=JSON.parse(t)}catch(e){o={raw:t.slice(0,200)}}\n  o.http=r.status; return o;\n}\nconst st=()=>JSON.parse(localStorage.getItem(\"sm_edge\")||\"null\");\nfunction save(o){localStorage.setItem(\"sm_edge\",JSON.stringify(o))}\nconst wiz=document.getElementById(\"wiz\"), dash=document.getElementById(\"dash\");\nfunction show(){\n  const s=st();\n  wiz.hidden=!!s; dash.hidden=!s;\n  if(s){document.getElementById(\"d-id\").textContent=s.node_id; paint(sample());}\n}\nfunction paint(x){\n  document.getElementById(\"d-c\").textContent=x.C_mesh.toFixed(3);\n  document.getElementById(\"d-why\").textContent=x.why;\n  document.getElementById(\"d-u\").textContent=x.U.toFixed(3);\n  document.getElementById(\"d-b\").textContent=x.battery.toFixed(2);\n  document.getElementById(\"d-fg\").textContent=x.foreground?\"yes\":\"no\";\n  document.getElementById(\"bar\").style.width=(x.C_mesh*100)+\"%\";\n}\ndocument.getElementById(\"go\").onclick=async()=>{\n  const node_id=document.getElementById(\"nid\").value.trim().toUpperCase();\n  const code=document.getElementById(\"otp\").value.trim();\n  const err=document.getElementById(\"werr\"); err.textContent=\"\";\n  if(!node_id.startsWith(\"EDGE\")&&!node_id.startsWith(\"FOG\")){err.textContent=\"Use an EDGE-\u2026 id issued by the lab.\";return;}\n  let ch=JSON.parse(sessionStorage.getItem(\"sm_ch\")||\"null\");\n  if(!ch||ch.node_id!==node_id){\n    ch=await j(\"POST\",AUTH+\"/fog/bootstrap/challenge\",{node_id,lang:\"en\"});\n    if(!ch.success){err.textContent=ch.error||\"unknown node\";return;}\n    sessionStorage.setItem(\"sm_ch\",JSON.stringify(ch));\n    err.textContent=\"Code sent to \"+(ch.operator_masked||\"operator\")+\". Enter it.\";\n    return;\n  }\n  const vr=await j(\"POST\",AUTH+\"/fog/bootstrap/verify\",{node_id,challenge:ch.challenge,code,lang:\"en\"});\n  if(!vr.success){err.textContent=vr.error||\"bad code\";return;}\n  save({node_id:vr.node_id,token:vr.bootstrap_token});\n  sessionStorage.removeItem(\"sm_ch\"); show(); pulse();\n};\ndocument.getElementById(\"out\").onclick=()=>{localStorage.removeItem(\"sm_edge\");show()};\ndocument.getElementById(\"pulse\").onclick=()=>pulse();\nasync function pulse(){\n  const s=st(); if(!s)return;\n  const x=sample(); paint(x);\n  const r=await j(\"POST\",API+\"/v1/edge/heartbeat\",{node_id:s.node_id,usage:x,continuity:\"session\",parent_fog:\"FOG-NODE-PT-CM-001\",substrate:\"ios-pwa\"},s.token);\n  document.getElementById(\"d-msg\").textContent=r.ok?\"heartbeat \"+(r.stored||\"ok\"):(r.error||\"offline\");\n}\ndocument.addEventListener(\"visibilitychange\",()=>{if(st())pulse()});\nshow();\nif(st()){pulse(); setInterval(()=>{if(document.visibilityState===\"visible\")pulse()},30000)}\n</script>\n</body>\n</html>\n";

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
  if (url.hostname.startsWith("api-edge.")) return PRIMARY;
  if (url.hostname.startsWith("api.edge.")) return PRIMARY;
  return PRIMARY;
}

function meta() {
  return {
    status: "ok",
    service: "stratamesh-edge-api",
    version: VERSION,
    lab: true,
    pre_testnet: true,
    not_mainnet: true,
    n: 2,
    mesh_member: true,
    mesh_provision: true,
    f_max: 0,
    origin: "edge",
    continuity: "session",
    oracle_live: false,
    managed_by: {
      node_id: EDGE_ID,
      agent: AGENT,
      status: "external_assistant",
      desk: DESK,
    },
    linked_fog: FOG_ID,
    sister: {
      api_fog: FOG_API,
      note: "MacOS Fog installer + node_id 2FA. Secrets stay on the Mac. Does not replace this registry.",
    },
    policy: {
      secrets_stored: false,
      va_key_hashes_only: true,
      public_read: true,
      write: "lab_registration_only",
      va: "optional_account_bearer — does not replace zero-auth registry",
      fog_installer: FOG_API,
      workers_dev: false,
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
    base_url: FOG_PUBLIC,
    health_url: FOG_PUBLIC + "/health",
    managed_by: FOG_ID,
  },
  {
    id: "api-fog-installer",
    name: "Fog Node MacOS installer API",
    type: "fog_installer",
    status: "active",
    base_url: FOG_API,
    health_url: FOG_API + "/health",
    spec: FOG_API + "/SPEC.txt",
    bootstrap: FOG_API + "/v1/bootstrap/challenge",
    managed_by: FOG_ID,
    note: "node_id + emailed 2FA. GitHub/CF tokens never posted here.",
  },
  {
    id: "gossip-mesh",
    name: "Fog gossip mesh API",
    type: "gossip",
    status: "active",
    base_url: GOSSIP,
    health_url: GOSSIP + "/health",
    peers_url: GOSSIP + "/peers",
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
        "Lab integration registry + optional personal VA. Mesh honesty n=2 (this Edge + Mac Fog), f_max=0, oracle_live=false. Fog installer is a different host: https://api-fog.calhegasmorais.pt. Read is public. Write is lab registration only. Never send secrets. Do not call workers.dev.",
      contact: { email: AGENT, url: DESK },
    },
    servers: [{ url: ORIGIN }, { url: PRIMARY }],
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
      "/desk": {
        get: {
          summary: "Last sanitized automation-desk mail digest (headers only)",
          security: [{ bearerAuth: [] }],
          responses: {
            "200": { description: "{mailbox, ts, n, latest:[{date,from,subject}]}" },
            "401": { description: "missing/invalid Bearer" },
          },
        },
        post: {
          summary: "Store sanitized mail digest (no bodies)",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    mailbox: { type: "string" },
                    ts: { type: "string" },
                    n: { type: "integer" },
                    latest: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          date: { type: "string" },
                          from: { type: "string" },
                          subject: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "stored sanitized digest" },
            "401": { description: "missing/invalid Bearer" },
          },
        },
      },
    },
    security: [],
    components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", description: "env DESK_TOKEN via wrangler secret put / dashboard only" } } },
    "x-auth": "none_for_GET_and_POST_register_except_/desk", "x-write-token": "none",
    "x-dangerous-operations": [
      "POST /v1/integrations (lab catalog write only; rejects secret fields)",
      "DELETE /v1/integrations/{id} (non-seed only)",
      "GET+POST /desk (Bearer DESK_TOKEN; snapshot v1 + legacy mail)",
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
This origin: ${ORIGIN}
Managed by: ${EDGE_ID} / ${AGENT} (external_assistant, continuity=session)
Desk: ${DESK}
Fog: ${FOG_ID}
Fog installer API: ${FOG_API}
Lab / pre-testnet: true · not mainnet
Mesh honesty: n=2 · mesh_member=true (this Edge + Mac Fog) · f_max=0 · oracle_live=false
Authentication for GET endpoints: NONE except GET /desk (Bearer DESK_TOKEN)
Authentication for POST /v1/integrations: NONE (public lab registration)
Authentication for GET+POST /desk: Bearer DESK_TOKEN (wrangler secret / dashboard; never git)
Write token: DOES NOT EXIST — never ask operator for Bearer/API keys for this registry
Secrets stored on this API: NONE (VA key hashes only)
workers.dev: DO NOT CALL
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

Also valid on ${PRIMARY}. Fog hardware install is ${FOG_API}, not this host.

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
GET  /v1/mesh                   Live Fog / Edge / Gossip / api-fog probes
GET  /desk                      desk.snapshot.v1 (mail + collegium + feed_tail) — Bearer DESK_TOKEN
POST /desk                      Push snapshot or legacy mail digest — Bearer DESK_TOKEN (vault holders)

Fog installer (different host): ${FOG_API}/SPEC.txt

4. AUTHENTICATION / AUTHORIZATION
---------------------------------
- GET registry: no auth headers required
- POST/DELETE /v1/integrations: no API key in lab mode; still reject secret-bearing JSON fields
- Do not send passwords, private keys, api_key, or bearer secrets to the *registry*
- Personal VA is a *separate* surface: /v1/va/* (except instructions) uses Authorization: Bearer smva_…
- VA keys are hashed at rest. Raw token shown once at mint. Zero-auth registry is unchanged.
- GET+POST /desk: Authorization: Bearer matching env DESK_TOKEN (timing-safe). 401 otherwise. Cache-Control: no-store.
- DESK_TOKEN is never in git. Set only with wrangler secret put DESK_TOKEN or the Cloudflare dashboard.
- /desk stores last sanitized digest in existing API_KV (dashboard binding; do not add kv_namespaces in git). Worker isolate memory is a fallback only.
- /desk JSON: desk.snapshot.v1 = mail headers + collegium open_tasks + feed_tail. No bodies, no IMAP/vault secrets. Bearer holders only (Mac/box vault desk-mail.token).

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
- Fog MacOS installer lives on ${FOG_API} (node_id + 2FA). Do not POST ghp_/cfat_ here.

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
Fog public: ${FOG_PUBLIC}/health
Fog installer: ${FOG_API}/SPEC.txt
Gossip: ${GOSSIP}

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
Fog installer: ${FOG_API}
Avoid broken TLS on api.edge (use api-edge with hyphen). Never call *.workers.dev.

## Rules
Lab n=2 · this Edge API is mesh_member=true · f_max=0 · oracle_live=false.
Personal VA accounts stay mesh_member=false.
Hardware Fog install is ${FOG_API}, not this host.
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
      mesh: ORIGIN + "/v1/mesh",
      desk_mail: ORIGIN + "/desk",
      fog_installer: FOG_API + "/v1/install",
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
const VA_TTL_SEC = 7 * 24 * 3600;
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

Lab mesh n=2 (EDGE session + Mac Fog) · this VA is NOT a mesh member.
oracle_live=false · f_max=0 · no STRATA mint
This surface is OPTIONAL and does NOT replace the unlinked open registry.
Fog hardware installer is a different host: ${FOG_API}/SPEC.txt


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

Response shows token ONCE: smva_<hex>. Valid **7 days**. Store it in the assistant. Never commit it.

Renew (same dashboard session; new token shown once, old hash dropped):
  POST ${ORIGIN}/v1/va/keys/{id}/renew
  POST ${ORIGIN}/v1/va/keys/renew     ← newest active, or mint if none

List/revoke:
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
- Max 5 keys per account. **TTL 7 days**, renewable from the dashboard. Hashes only in KV. Raw token never stored.

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

async function kvPut(env, key, obj, ttlSec) {
  if (!env.API_KV) return false;
  const opt = ttlSec ? { expirationTtl: Math.max(60, Math.floor(ttlSec)) } : {};
  await env.API_KV.put(key, JSON.stringify(obj), opt);
  return true;
}

function weekExpiry() {
  const exp = new Date(Date.now() + VA_TTL_SEC * 1000).toISOString();
  return { expires_at: exp, ttl_sec: VA_TTL_SEC, kv_ttl: VA_TTL_SEC + 86400 };
}

function isExpired(row) {
  if (!row || !row.expires_at) return false;
  const t = Date.parse(row.expires_at);
  return Number.isFinite(t) && t < Date.now();
}

async function resolveVa(request, env) {
  const token = bearerOf(request);
  if (!token || !token.startsWith(VA_PREFIX)) return null;
  const hash = await sha256Hex(token);
  const row = await kvGet(env, "va:k:" + hash);
  if (!row || row.revoked_at) return null;
  if (isExpired(row)) return { expired: true, id: row.id, owner_id: row.owner_id, expires_at: row.expires_at };
  row.last_used_at = new Date().toISOString();
  try { await env.API_KV.put("va:k:" + hash, JSON.stringify(row)); } catch (_) {}
  return row;
}

async function requireVaOrSession(request, env) {
  const va = await resolveVa(request, env);
  if (va && va.expired) return { ok: false, status: 401, error: "va_expired", hint: "Renew from dashboard /v1/va/keys/{id}/renew", expires_at: va.expires_at };
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

async function issueVaRow(env, sess, ids, label, existingId) {
  const raw = mintToken();
  const hash = await sha256Hex(raw);
  const ttl = weekExpiry();
  const id = existingId || ("vak_" + raw.slice(5, 13));
  const row = {
    id,
    hash,
    owner_id: sess.owner_id,
    owner_kind: sess.owner_kind,
    label: String(label || "personal-va").slice(0, 80),
    scopes: ["dashboard.read", "dashboard.prefs"],
    prefix: raw.slice(0, 12),
    created_at: new Date().toISOString(),
    expires_at: ttl.expires_at,
    ttl_days: 7,
  };
  await kvPut(env, "va:k:" + hash, row, ttl.kv_ttl);
  await kvPut(env, "va:i:" + id, row, ttl.kv_ttl);
  const next = ids.includes(id) ? ids : ids.concat([id]);
  await kvPut(env, "va:o:" + sess.owner_id, next, ttl.kv_ttl);
  return { raw, row, ids: next };
}

function publicKey(meta) {
  const expired = isExpired(meta);
  let days_left = null;
  if (meta.expires_at) {
    const ms = Date.parse(meta.expires_at) - Date.now();
    days_left = Number.isFinite(ms) ? Math.max(0, Math.ceil(ms / 86400000)) : null;
  }
  return {
    id: meta.id,
    label: meta.label,
    prefix: meta.prefix,
    scopes: meta.scopes,
    created_at: meta.created_at,
    expires_at: meta.expires_at || null,
    ttl_days: 7,
    days_left,
    expired,
    revoked_at: meta.revoked_at || null,
  };
}

function pastePack(token, exp) {
  return [
    "You are this account's personal StrataMesh assistant (user or SCA). Lab n=1 · mesh_member=false.",
    "1. GET https://api-edge.calhegasmorais.pt/v1/va/instructions.txt",
    "2. Authorization: Bearer " + token,
    "3. GET https://api-edge.calhegasmorais.pt/v1/va/me",
    '4. POST https://api-edge.calhegasmorais.pt/v1/va/act {"action":"dashboard.snapshot"}',
    "Expires: " + (exp || "7 days") + ". Operator renews in dashboard → Assistente.",
    "Do not call *.workers.dev. Do not POST /v1/integrations with this Bearer.",
  ].join("\n");
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
      if (meta) keys.push(publicKey(meta));
    }
    return json({ ok: true, owner_id: sess.owner_id, owner_kind: sess.owner_kind, ttl_days: 7, keys }, 200, "no-store");
  }

  async function mintNew(label) {
    const active = [];
    for (const id of ids) {
      const meta = await kvGet(env, "va:i:" + id);
      if (meta && !meta.revoked_at && !isExpired(meta)) active.push(id);
    }
    if (active.length >= 5) return json({ ok: false, error: "max_keys", max: 5 }, 409, "no-store");
    const issued = await issueVaRow(env, sess, ids, label);
    return json({
      ok: true,
      token: issued.raw,
      paste: pastePack(issued.raw, issued.row.expires_at),
      shown_once: true,
      expires_at: issued.row.expires_at,
      ttl_days: 7,
      key: publicKey(issued.row),
      note: "Valid 7 days. Copy the paste pack into the assistant now. Not stored in plaintext.",
    }, 201, "no-store");
  }

  async function rotate(id) {
    const meta = await kvGet(env, "va:i:" + id);
    if (!meta || meta.owner_id !== sess.owner_id) return json({ ok: false, error: "not_found" }, 404, "no-store");
    if (meta.hash) {
      try { await env.API_KV.delete("va:k:" + meta.hash); } catch (_) {}
    }
    const issued = await issueVaRow(env, sess, ids, meta.label || "personal-va", id);
    return json({
      ok: true,
      renewed: true,
      token: issued.raw,
      paste: pastePack(issued.raw, issued.row.expires_at),
      shown_once: true,
      expires_at: issued.row.expires_at,
      ttl_days: 7,
      key: publicKey(issued.row),
      note: "Previous token is dead. Paste the new pack into the assistant.",
    }, 200, "no-store");
  }

  if (request.method === "POST" && (path === "/v1/va/keys" || path === "/v1/va/connect")) {
    if (path === "/v1/va/connect") {
      for (const id of ids) {
        const meta = await kvGet(env, "va:i:" + id);
        if (meta && !meta.revoked_at && !isExpired(meta)) {
          return json({
            ok: true,
            already: true,
            key: publicKey(meta),
            note: "Live token already issued. It is not shown again. Renew to rotate (invalidates the old one).",
          }, 200, "no-store");
        }
      }
      return mintNew("dashboard-va");
    }
    const body = await request.json().catch(() => ({}));
    return mintNew(body.label);
  }

  if (request.method === "POST" && path === "/v1/va/keys/renew") {
    let newest = null;
    for (const id of ids) {
      const meta = await kvGet(env, "va:i:" + id);
      if (meta && !meta.revoked_at) newest = meta;
    }
    if (!newest) {
      return mintNew("personal-va");
    }
    return rotate(newest.id);
  }

  if (request.method === "POST" && path.startsWith("/v1/va/keys/") && path.endsWith("/renew")) {
    const id = path.slice("/v1/va/keys/".length, -"/renew".length);
    return rotate(id);
  }

  if (request.method === "DELETE" && path.startsWith("/v1/va/keys/")) {
    const id = path.slice("/v1/va/keys/".length);
    const meta = await kvGet(env, "va:i:" + id);
    if (!meta || meta.owner_id !== sess.owner_id) return json({ ok: false, error: "not_found" }, 404, "no-store");
    meta.revoked_at = new Date().toISOString();
    await kvPut(env, "va:i:" + id, meta, 86400);
    if (meta.hash) {
      try { await env.API_KV.delete("va:k:" + meta.hash); } catch (_) {}
    }
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


async function handleEdgeHeartbeat(env, request) {
  const auth = String(request.headers.get("Authorization") || "");
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const body = await request.json().catch(() => ({}));
  if (!token) return json({ ok: false, error: "bearer required" }, 401, "no-store");
  let session = { success: false };
  try {
    const r = await fetch("https://calhegasmorais.pt/api/auth/fog/bootstrap/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    session = await r.json().catch(() => ({}));
  } catch (e) {
    return json({ ok: false, error: "auth_unreachable" }, 503, "no-store");
  }
  if (!session.success) return json({ ok: false, error: "invalid session" }, 401, "no-store");
  const rec = {
    node_id: session.node_id,
    role: "edge",
    continuity: body.continuity || "session",
    parent_fog: body.parent_fog || "FOG-NODE-PT-CM-001",
    substrate: body.substrate || "ios",
    usage: body.usage || {},
    C_mesh: (body.usage && body.usage.C_mesh) || 0,
    ts: new Date().toISOString(),
    lab: true,
  };
  let stored = false;
  if (env.API_KV) {
    await env.API_KV.put("edgehb:" + rec.node_id, JSON.stringify(rec), { expirationTtl: 60 * 60 * 24 * 7 });
    stored = true;
  }
  return json({ ok: true, stored, node: rec }, 200, "no-store");
}

async function listEdgeHeartbeats(env) {
  const nodes = [];
  if (env.API_KV) {
    try {
      const listed = await env.API_KV.list({ prefix: "edgehb:", limit: 50 });
      for (const k of listed.keys || []) {
        const raw = await env.API_KV.get(k.name);
        if (raw) nodes.push(JSON.parse(raw));
      }
    } catch (_) {}
  }
  return json({ ok: true, count: nodes.length, nodes, formula: "C_mesh=f(1-U)" }, 200, "no-store");
}



async function probeMesh() {
  const targets = [
    { id: "fog", url: FOG_PUBLIC + "/health" },
    { id: "edge", url: DESK + "/health" },
    { id: "gossip", url: GOSSIP + "/health" },
    { id: "api_fog", url: FOG_API + "/health" },
  ];
  const out = {};
  for (const t of targets) {
    const r = await fetchJson(t.url, {}, 1500);
    const d = r.data || {};
    out[t.id] = {
      ok: !!r.ok,
      http: r.http,
      origin: d.origin || null,
      n: d.n ?? null,
      mesh_member: d.mesh_member ?? null,
      version: d.version || d.service || null,
      error: r.error || null,
    };
  }
  return out;
}


const DESK_DIGEST_KEY = "desk:mail:digest";
const DESK_COLLEGIUM_KEY = "desk:collegium:state";
const DESK_FEED_KEY = "desk:feed:tail";
const DESK_META_KEY = "desk:snapshot:meta";
let lastDeskDigest = null;
let lastDeskCollegium = null;
let lastDeskFeed = null;
let lastDeskMeta = null;

function timingSafeEqualStr(a, b) {
  const enc = new TextEncoder();
  const aa = enc.encode(String(a ?? ""));
  const bb = enc.encode(String(b ?? ""));
  const n = Math.max(aa.byteLength, bb.byteLength);
  let diff = aa.byteLength ^ bb.byteLength;
  for (let i = 0; i < n; i++) {
    diff |= (i < aa.byteLength ? aa[i] : 0) ^ (i < bb.byteLength ? bb[i] : 0);
  }
  return aa.byteLength > 0 && bb.byteLength > 0 && diff === 0;
}

function deskAuthOk(request, env) {
  return timingSafeEqualStr(bearerOf(request), env && env.DESK_TOKEN);
}

function sanitizeDeskDigest(body) {
  const src = body && typeof body === "object" ? body : {};
  const rows = Array.isArray(src.latest) ? src.latest : [];
  const latest = rows.slice(0, 50).map((row) => {
    const r = row && typeof row === "object" ? row : {};
    return {
      date: String(r.date != null ? r.date : "").slice(0, 80),
      from: String(r.from != null ? r.from : "").slice(0, 120),
      subject: String(r.subject != null ? r.subject : "").slice(0, 160),
    };
  });
  const nNum = Number(src.n);
  return {
    mailbox: String(src.mailbox != null ? src.mailbox : "").slice(0, 120),
    ts: String(src.ts != null ? src.ts : "").slice(0, 40),
    n: Number.isFinite(nNum) ? nNum : latest.length,
    latest,
  };
}

function sanitizeDeskCollegium(body) {
  const src = body && typeof body === "object" ? body : {};
  const tasks = Array.isArray(src.open_tasks) ? src.open_tasks : [];
  const open_tasks = tasks.slice(0, 40).map((t) => {
    const row = t && typeof t === "object" ? t : {};
    return {
      schema: "desk.task.v1",
      id: String(row.id != null ? row.id : "").slice(0, 40),
      owner: String(row.owner != null ? row.owner : "").slice(0, 80),
      specialty: String(row.specialty != null ? row.specialty : "").slice(0, 16),
      intent: String(row.intent != null ? row.intent : "").slice(0, 200),
      status: String(row.status != null ? row.status : "propose").slice(0, 16),
      lanes: Array.isArray(row.lanes) ? row.lanes.map((x) => String(x).slice(0, 32)).slice(0, 8) : [],
      constraints: Array.isArray(row.constraints)
        ? row.constraints.map((x) => String(x).slice(0, 120)).slice(-8)
        : [],
      result: String(row.result != null ? row.result : "").slice(0, 200),
      sha: String(row.sha != null ? row.sha : "").slice(0, 40),
      updated: String(row.updated != null ? row.updated : "").slice(0, 40),
    };
  }).filter((t) => t.id);
  const members = Array.isArray(src.members)
    ? src.members.slice(0, 20).map((m) => {
        const row = m && typeof m === "object" ? m : {};
        return {
          id: String(row.id != null ? row.id : "").slice(0, 80),
          role: String(row.role != null ? row.role : "").slice(0, 40),
          lane: String(row.lane != null ? row.lane : "").slice(0, 40),
          pace: String(row.pace != null ? row.pace : "ALLOW").slice(0, 16),
          specialty: String(row.specialty != null ? row.specialty : "").slice(0, 16),
        };
      })
    : [];
  let last_commit = null;
  if (src.last_commit && typeof src.last_commit === "object") {
    const lc = src.last_commit;
    last_commit = {
      id: String(lc.id != null ? lc.id : "").slice(0, 40),
      sha: String(lc.sha != null ? lc.sha : "").slice(0, 40),
      result: String(lc.result != null ? lc.result : "").slice(0, 200),
      at: String(lc.at != null ? lc.at : "").slice(0, 40),
      owner: String(lc.owner != null ? lc.owner : "").slice(0, 80),
    };
  }
  return {
    schema: "desk.collegium.state.v1",
    version: String(src.version != null ? src.version : "").slice(0, 32),
    updated: String(src.updated != null ? src.updated : "").slice(0, 40),
    members,
    open_tasks,
    last_commit,
    bus: String(src.bus != null ? src.bus : "propose→constrain→revise→commit|escalate").slice(0, 80),
  };
}

function sanitizeDeskFeed(rows) {
  const list = Array.isArray(rows) ? rows : [];
  return list.slice(-60).map((row) => {
    const r = row && typeof row === "object" ? row : {};
    return {
      ts: String(r.ts != null ? r.ts : "").slice(0, 40),
      t: String(r.t != null ? r.t : "").slice(0, 8),
      agent: String(r.agent != null ? r.agent : "").slice(0, 32),
      kind: String(r.kind != null ? r.kind : "say").slice(0, 16),
      specialty: String(r.specialty != null ? r.specialty : "").slice(0, 16),
      text: String(r.text != null ? r.text : "").slice(0, 240),
    };
  }).filter((r) => r.text);
}

function buildDeskSnapshot(mail, collegium, feed, meta) {
  const m = sanitizeDeskDigest(mail || { mailbox: "", ts: "", n: 0, latest: [] });
  const c = collegium ? sanitizeDeskCollegium(collegium) : null;
  const f = sanitizeDeskFeed(feed || []);
  const metaObj = meta && typeof meta === "object" ? meta : {};
  return {
    ok: true,
    schema: "desk.snapshot.v1",
    synced_at: String(metaObj.synced_at != null ? metaObj.synced_at : new Date().toISOString()).slice(0, 40),
    git: {
      sha: String(metaObj.git && metaObj.git.sha != null ? metaObj.git.sha : "").slice(0, 40),
      node: String(metaObj.git && metaObj.git.node != null ? metaObj.git.node : "").slice(0, 40),
    },
    mail: m,
    // backward-compat top-level mail fields (1.4.1 clients)
    mailbox: m.mailbox,
    ts: m.ts,
    n: m.n,
    latest: m.latest,
    collegium: c,
    feed_tail: f,
  };
}

async function handleDesk(env, request) {
  if (!deskAuthOk(request, env)) {
    return json({ ok: false, error: "unauthorized" }, 401, "no-store");
  }
  if (request.method === "GET") {
    let mail = lastDeskDigest;
    let collegium = lastDeskCollegium;
    let feed = lastDeskFeed;
    let meta = lastDeskMeta;
    if (env.API_KV) {
      const fromMail = await kvGet(env, DESK_DIGEST_KEY);
      if (fromMail) mail = fromMail;
      const fromCol = await kvGet(env, DESK_COLLEGIUM_KEY);
      if (fromCol) collegium = fromCol;
      const fromFeed = await kvGet(env, DESK_FEED_KEY);
      if (fromFeed) feed = fromFeed;
      const fromMeta = await kvGet(env, DESK_META_KEY);
      if (fromMeta) meta = fromMeta;
    }
    return json(buildDeskSnapshot(mail, collegium, feed, meta), 200, "no-store");
  }
  if (request.method === "POST") {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return json({ ok: false, error: "invalid_json" }, 400, "no-store");
    }
    // Accept legacy mail-only OR desk.snapshot.v1
    const mailSrc = body.mail && typeof body.mail === "object" ? body.mail : body;
    const sanitizedMail = sanitizeDeskDigest(mailSrc);
    lastDeskDigest = sanitizedMail;
    if (env.API_KV) await kvPut(env, DESK_DIGEST_KEY, sanitizedMail);

    let collegium = lastDeskCollegium;
    if (body.collegium && typeof body.collegium === "object") {
      collegium = sanitizeDeskCollegium(body.collegium);
      lastDeskCollegium = collegium;
      if (env.API_KV) await kvPut(env, DESK_COLLEGIUM_KEY, collegium);
    }

    let feed = lastDeskFeed;
    if (Array.isArray(body.feed_tail)) {
      feed = sanitizeDeskFeed(body.feed_tail);
      lastDeskFeed = feed;
      if (env.API_KV) await kvPut(env, DESK_FEED_KEY, feed);
    }

    const meta = {
      synced_at: String(body.synced_at != null ? body.synced_at : new Date().toISOString()).slice(0, 40),
      git: body.git && typeof body.git === "object" ? body.git : {},
    };
    lastDeskMeta = meta;
    if (env.API_KV) await kvPut(env, DESK_META_KEY, meta);

    return json(buildDeskSnapshot(sanitizedMail, collegium, feed, meta), 200, "no-store");
  }
  return json({ error: "method_not_allowed" }, 405, "no-store");
}


/* api-edge smart wizard contract — LOCAL Ollama on executing host only.
 * Worker never calls Ollama. Clients on Fog/EDGE use ops/lib/ollama_local.py.
 */
const WIZARD_FLOWS = [
  {
    id: "account",
    title: "User account setup",
    summary: "Guided lab account fields via local Ollama JSON; secrets never in prompts",
    commit: "POST /v1/wizard/commit/account",
  },
  {
    id: "join-mesh",
    title: "Fog/EDGE join fog mesh",
    summary: "Request mesh membership; mesh_member only after Fog health-check of public /health",
    commit: "POST /v1/wizard/commit/join-mesh",
  },
  {
    id: "register-deps",
    title: "Register dependency edge nodes",
    summary: "Build POST /v1/integrations bodies for dependency edges (no secrets)",
    commit: "POST /v1/wizard/commit/register-deps",
  },
];

const WIZARD_POLICY = {
  ollama: "local_native_only",
  ollama_host_default: "http://127.0.0.1:11434",
  never_remote_llm: true,
  worker_calls_ollama: false,
  fail_open_if_ollama_down: true,
  executing_host_sdk: "ops/lib/ollama_local.py",
  tui_question_wizard: "PLAN_only_separate",
  metabol: "host_cap for Ollama; cf-worker-req for /v1/wizard/*",
};

function wizardIndex(ORIGIN) {
  return {
    ok: true,
    surface: "api-edge-smart-wizard",
    policy: WIZARD_POLICY,
    flows: WIZARD_FLOWS,
    steps: ORIGIN + "/v1/wizard/steps",
    prompts: ORIGIN + "/v1/wizard/prompts/{flow}",
    parse: { method: "POST", url: ORIGIN + "/v1/wizard/parse" },
    local_sdk: {
      ping: "python3 ops/lib/ollama_local.py ping",
      wizard: "python3 ops/lib/ollama_local.py wizard <account|join-mesh|register-deps>",
    },
    related: {
      integrations: ORIGIN + "/v1/integrations",
      mesh: ORIGIN + "/v1/mesh",
      docs: "https://github.com/StrataMesh-Laboratory/stratamesh-core/blob/main/docs/API-EDGE-OLLAMA-WIZARD.md",
    },
  };
}

function wizardSteps() {
  return {
    ok: true,
    policy: WIZARD_POLICY,
    steps: [
      { n: 1, flow: "account", action: "local_ollama_generate", then: "POST /v1/wizard/parse" },
      { n: 2, flow: "account", action: "POST /v1/wizard/commit/account" },
      { n: 3, flow: "join-mesh", action: "local_ollama_generate", then: "POST /v1/wizard/parse" },
      { n: 4, flow: "join-mesh", action: "POST /v1/wizard/commit/join-mesh" },
      { n: 5, flow: "register-deps", action: "local_ollama_generate", then: "POST /v1/wizard/parse" },
      { n: 6, flow: "register-deps", action: "POST /v1/wizard/commit/register-deps" },
    ],
  };
}

function wizardPrompt(flow) {
  const prompts = {
    account: {
      system:
        'Output ONLY JSON: {"flow":"account","email":"","display_name":"","locale":"pt|en","accept_lab_terms":true,"notes":""}. Never passwords/tokens.',
      user_hint: "Draft a minimal lab account setup intent.",
    },
    "join-mesh": {
      system:
        'Output ONLY JSON: {"flow":"join-mesh","node_id":"FOG-|EDGE-…","role":"fog|edge","parent_fog":"FOG-NODE-PT-CM-001","health_url":"https://…/health","spare_capacity_only":true,"notes":""}.',
      user_hint: "Draft a join-mesh request for this host.",
    },
    "register-deps": {
      system:
        'Output ONLY JSON: {"flow":"register-deps","dependencies":[{"id":"","name":"","type":"contributor_edge","node_id":"","health_url":""}]}. No secrets.',
      user_hint: "List dependency edge nodes to register in the lab catalog.",
    },
  };
  if (!prompts[flow]) return { ok: false, error: "unknown_flow", flows: Object.keys(prompts) };
  return { ok: true, flow, policy: WIZARD_POLICY, ...prompts[flow], ollama_endpoint: "http://127.0.0.1:11434/api/chat" };
}

function secretField(k) {
  return /secret|password|private_key|api_key|token|authorization/i.test(String(k || ""));
}

function parseWizardBody(body) {
  if (!body || typeof body !== "object") return { ok: false, error: "body_required" };
  const flow = String(body.flow || "").trim();
  if (!["account", "join-mesh", "register-deps"].includes(flow)) {
    return { ok: false, error: "invalid_flow", got: flow };
  }
  for (const k of Object.keys(body)) {
    if (secretField(k)) return { ok: false, error: "secret_field_rejected", field: k };
  }
  if (flow === "account") {
    if (!body.email && !body.display_name) return { ok: false, error: "account_needs_email_or_display_name" };
  }
  if (flow === "join-mesh") {
    const nid = String(body.node_id || "");
    if (!nid.startsWith("FOG") && !nid.startsWith("EDGE")) return { ok: false, error: "node_id_must_be_FOG_or_EDGE" };
  }
  if (flow === "register-deps") {
    const deps = body.dependencies;
    if (!Array.isArray(deps) || !deps.length) return { ok: false, error: "dependencies_required" };
    for (const d of deps) {
      if (!d || !d.id || !d.name) return { ok: false, error: "dependency_needs_id_name" };
      for (const k of Object.keys(d)) {
        if (secretField(k)) return { ok: false, error: "secret_field_rejected", field: k };
      }
    }
  }
  return { ok: true, flow, intent: body, note: "validated_schema_only — Worker does not call Ollama" };
}

async function commitWizard(env, flow, body) {
  const parsed = parseWizardBody({ ...body, flow: body.flow || flow });
  if (!parsed.ok) return parsed;
  if (flow === "account") {
    return {
      ok: true,
      flow,
      committed: "account_intent_accepted",
      next: "complete account via auth bootstrap on Fog host (secrets local)",
      intent: parsed.intent,
      lab: true,
    };
  }
  if (flow === "join-mesh") {
    const key = "wizard:join:" + String(parsed.intent.node_id).slice(0, 80);
    const row = {
      ...parsed.intent,
      status: "requested",
      mesh_member: false,
      note: "pending Fog health-check of public /health",
      at: new Date().toISOString(),
    };
    if (env && env.API_KV) await env.API_KV.put(key, JSON.stringify(row), { expirationTtl: 90 * 24 * 3600 });
    return { ok: true, flow, committed: "join_mesh_requested", stored: !!env?.API_KV, record: row };
  }
  if (flow === "register-deps") {
    const registered = [];
    for (const d of parsed.intent.dependencies) {
      // reuse lab registration path semantics (no secrets)
      const id = String(d.id).slice(0, 64);
      const row = {
        id,
        name: String(d.name).slice(0, 120),
        type: d.type || "contributor_edge",
        node_id: d.node_id || null,
        health_url: d.health_url || null,
        registered_lab: true,
        mesh_member: false,
        via: "wizard_register-deps",
        at: new Date().toISOString(),
      };
      if (env && env.API_KV) await env.API_KV.put("reg:" + id, JSON.stringify(row), { expirationTtl: 90 * 24 * 3600 });
      registered.push(row);
    }
    return { ok: true, flow, committed: "dependencies_registered_lab", count: registered.length, registered };
  }
  return { ok: false, error: "unknown_flow" };
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
      const urls = ["/", "/README", "/SPEC.txt", "/instructions.txt", "/openapi.txt", "/openapi.json", "/llms.txt", "/health", "/v1/integrations", "/v1/va/instructions.txt", "/v1/mesh", "/v1/wizard"];
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
          urls.map((u) => `  <url><loc>${ORIGIN}${u}</loc></url>`).join("\n") +
          `\n</urlset>\n`,
        { headers: headers("application/xml; charset=utf-8") }
      );
    }

    if (path === "/desk") {
      return handleDesk(env, request);
    }

    if (path === "/app" || path === "/app/" || path === "/edge-app") {
      return html(EDGE_APP_HTML);
    }
    if (path === "/v1/edge/usage" && request.method === "GET") {
      return json({
        ok: true,
        formula: "C_mesh = (1-U) * duty * cap, 0 if safety",
        role: "edge",
        continuity: "session",
        lab: true,
        not_mainnet: true,
        note: "U is primary-job utilisation. Indexed Edge, not a Fog, not a miner.",
        weights: { cpu: 0.35, battery_stress: 0.25, thermal: 0.15, net: 0.15, background: 0.1 },
        clamps: ["battery<0.20", "low_power", "thermal serious|critical", "constrained_network"],
        duty: { foreground: 1, background: 0.25 },
      }, 200, "no-store");
    }
    if (path === "/v1/edge/heartbeat" && request.method === "POST") {
      return handleEdgeHeartbeat(env, request);
    }
    if (path === "/v1/edge/nodes" && request.method === "GET") {
      return listEdgeHeartbeats(env);
    }

    if (path === "/v1/mesh") {
      const probes = await probeMesh();
      return json({ ok: true, ...meta(), probes, timestamp: new Date().toISOString() }, 200, "no-store");
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
    if (path === "/v1/va/keys" || path.startsWith("/v1/va/keys/") || path === "/v1/va/connect") {
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
          mesh_member: false,
          instructions: ORIGIN + "/v1/va/instructions.txt",
        },
        sister: {
          api_fog: FOG_API,
          install: FOG_API + "/v1/install",
          spec: FOG_API + "/SPEC.txt",
          note: "MacOS Fog installer. node_id + 2FA. Secrets stay local.",
        },
        mesh: { n: 2, mesh_member: true, f_max: 0, oracle_live: false, origin: "edge" },
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

    if (path === "/v1/wizard" || path === "/v1/wizard/index") {
      return json(wizardIndex(ORIGIN), 200, "no-store");
    }
    if (path === "/v1/wizard/steps") {
      return json(wizardSteps(), 200, "no-store");
    }
    if (path.startsWith("/v1/wizard/prompts/")) {
      const flow = path.slice("/v1/wizard/prompts/".length).split("/")[0];
      const out = wizardPrompt(flow);
      return json(out, out.ok ? 200 : 404, "no-store");
    }
    if (path === "/v1/wizard/parse" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const out = parseWizardBody(body);
      return json(out, out.ok ? 200 : 400, "no-store");
    }
    if (path.startsWith("/v1/wizard/commit/") && request.method === "POST") {
      const flow = path.slice("/v1/wizard/commit/".length).split("/")[0];
      const body = await request.json().catch(() => ({}));
      const out = await commitWizard(env, flow, body);
      return json(out, out.ok ? 200 : 400, "no-store");
    }

    return json({
      error: "not_found",
      try: ["/SPEC.txt", "/README", "/openapi.txt", "/v1/va/instructions.txt", "/health", "/v1/integrations", "/v1/mesh", "/v1/wizard", FOG_API + "/SPEC.txt"],
    }, 404, "no-store");
  },
};
