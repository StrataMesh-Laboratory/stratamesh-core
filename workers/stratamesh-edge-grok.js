/**
 * EDGE-GROK-CMN-001 — automation desk + crawler/agent discovery surface
 * Lab only. No secrets. Antifragile public integration.
 */
const VERSION = "1.5.2-gossip-views";
const EDGE_ID = "EDGE-GROK-CMN-001";
const FOG_ID = "FOG-NODE-PT-CM-001";
const AGENT_MAIL = "grok@calhegasmorais.pt";
const ORIGIN_CANON = "https://edge.calhegasmorais.pt";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS,HEAD",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, User-Agent",
};

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      ...CORS,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": extra.cache || "public, max-age=60",
      "X-Robots-Tag": "all",
      "X-StrataMesh-Lab": "true",
      "X-StrataMesh-Node": EDGE_ID,
      ...(extra.headers || {}),
    },
  });
}

function text(body, type = "text/plain; charset=utf-8", status = 200, cache = "public, max-age=300") {
  return new Response(body, {
    status,
    headers: {
      ...CORS,
      "Content-Type": type,
      "Cache-Control": cache,
      "X-Robots-Tag": "all",
      "X-StrataMesh-Lab": "true",
    },
  });
}

async function sha256Hex(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function bindingFetch(env, name) {
  const b = env && env[name];
  return b && typeof b.fetch === "function" ? b : null;
}

async function probe(url, timeoutMs = 4000, fetcher = null) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const req = new Request(url, {
      method: "GET",
      headers: { Accept: "application/json", "User-Agent": EDGE_ID, "X-StrataMesh-Caller": EDGE_ID },
      signal: ac.signal,
    });
    const r = fetcher ? await fetcher.fetch(req) : await fetch(req);
    const raw = await r.text();
    let data = null;
    try { data = JSON.parse(raw); } catch (_) {}
    return { ok: r.ok, http: r.status, data, via: fetcher ? "service" : "public" };
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e), via: fetcher ? "service" : "public" };
  } finally {
    clearTimeout(t);
  }
}

async function probeBound(env, bindingName, url, timeoutMs = 4000) {
  const fetcher = bindingFetch(env, bindingName);
  if (!fetcher) {
    return { ok: false, error: "binding_missing:" + bindingName, degraded: true, via: "none", url };
  }
  const r = await probe(url, timeoutMs, fetcher);
  return { ...r, via: "service:" + bindingName, url };
}

function identity(extra = {}) {
  return {
    node_id: EDGE_ID,
    role: "edge",
    substrate: "cloudflare-worker",
    lab: true,
    pre_testnet: true,
    linked_fog: FOG_ID,
    version: VERSION,
    mesh_role: "edge_gossip_participant",
    agent: {
      email: AGENT_MAIL,
      status: "external_assistant",
      mandate: "Automation desk + voluntary integration surface; Subjects ≠ objects; no mainnet claims",
    },
    policy: {
      spare_capacity_only: true,
      interference_with_primary: "none",
      secrets_on_edge: false,
      antifragile: "degraded_modes_ok",
    },
    capabilities: [
      "health", "status", "ping-fog", "gossip-sync", "mesh-activate",
      "discovery", "llms.txt", "openapi", "sdk-catalog", "lab-ui",
      "operator-desk",
    ],
    ...extra,
  };
}

function gossipBase(env) {
  return (env.FOG_GOSSIP_BASE && String(env.FOG_GOSSIP_BASE)) || "https://stratamesh-gossip.stratamesh.workers.dev";
}

async function syncWithFog(env, reason = "edge_activate") {
  const body = {
    creator: EDGE_ID,
    peer: FOG_ID,
    node_id: EDGE_ID,
    transactions: [
      { type: "mesh_join", edge: EDGE_ID, fog: FOG_ID, reason },
      { type: "heartbeat", at: new Date().toISOString() },
    ],
    timestamp: new Date().toISOString(),
  };
  const req = new Request("https://gossip/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": EDGE_ID, "X-StrataMesh-Caller": EDGE_ID },
    body: JSON.stringify(body),
  });
  try {
    const fetcher = bindingFetch(env, "GOSSIP");
    const r = fetcher ? await fetcher.fetch(req) : await fetch(gossipBase(env).replace(/\/$/, "") + "/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": EDGE_ID, "X-StrataMesh-Caller": EDGE_ID },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => null);
    return { ok: r.ok, http: r.status, data, via: fetcher ? "service:GOSSIP" : "public" };
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
}

async function buildStatus(env) {
  const [fog, gossip] = await Promise.all([
    probeBound(env, "STATUS", "https://status/"),
    probeBound(env, "GOSSIP", "https://calhegasmorais.pt/api/v1/gossip/peers"),
  ]);
  const peers = (gossip.data && gossip.data.peers) || [];
  const edgeListed = Array.isArray(peers) && peers.some((p) => p && p.id === EDGE_ID && p.status === "live");
  return {
    ...identity({ live: true }),
    linked: {
      fog: fog.ok
        ? {
            ok: true,
            http: fog.http,
            fog_id: (fog.data && fog.data.node_id) || FOG_ID,
            version: fog.data && fog.data.version,
            phase: fog.data && fog.data.phase,
            status: fog.data && fog.data.status,
          }
        : { ok: false, error: fog.error || "unreachable", fallback: "desk UI + discovery stay up" },
      gossip: gossip.ok
        ? {
            ok: true,
            peer_count: gossip.data && gossip.data.count,
            protocol: gossip.data && gossip.data.protocol,
            edge_listed: edgeListed,
          }
        : { ok: false, error: gossip.error || "unreachable", fallback: "local identity only" },
    },
    mesh: {
      joined: !!(fog && fog.ok),
      edge_listed: edgeListed,
      mode: "edge_gossip_active",
      protocol: "lab_fog_edge_mesh_active",
    },
    discovery: {
      llms_txt: ORIGIN_CANON + "/llms.txt",
      openapi: ORIGIN_CANON + "/openapi.json",
      catalog: ORIGIN_CANON + "/.well-known/agent-catalog.json",
      security: ORIGIN_CANON + "/.well-known/security.txt",
      robots: ORIGIN_CANON + "/robots.txt",
      sdk: "https://github.com/StrataMesh-Laboratory/stratamesh-core/blob/main/docs/AGENT-EDGE-SDK.md",
      paste: "https://github.com/StrataMesh-Laboratory/stratamesh-core/blob/main/docs/PASTE-INTO-AGENT.md",
    },
    timestamp: new Date().toISOString(),
  };
}

function robotsTxt() {
  return `User-agent: *
Allow: /
Allow: /health
Allow: /status
Allow: /llms.txt
Allow: /openapi.json
Allow: /.well-known/
Allow: /mesh
Disallow: /register
Disallow: /ops
Disallow: /internal
Crawl-delay: 2

User-agent: GPTBot
Allow: /llms.txt
Allow: /openapi.json
Allow: /health
Allow: /status
Allow: /
Crawl-delay: 2

User-agent: Google-Extended
Allow: /
Allow: /llms.txt

User-agent: anthropic-ai
Allow: /
Allow: /llms.txt

User-agent: ClaudeBot
Allow: /
Allow: /llms.txt

User-agent: CCBot
Allow: /llms.txt
Allow: /openapi.json
Allow: /health

# Lab public discovery. No auth secrets on this host.
Sitemap: ${ORIGIN_CANON}/sitemap.xml
`;
}

function securityTxt() {
  return `Contact: mailto:${AGENT_MAIL}
Contact: https://github.com/StrataMesh-Laboratory/stratamesh-core/issues
Expires: 2027-08-26T00:00:00.000Z
Preferred-Languages: en, pt
Canonical: ${ORIGIN_CANON}/.well-known/security.txt
Policy: https://github.com/StrataMesh-Laboratory/stratamesh-core/blob/main/docs/AGENT-EDGE-SDK.md
Acknowledgments: https://github.com/StrataMesh-Laboratory/stratamesh-core
Hiring: https://github.com/StrataMesh-Laboratory

# StrataMesh EDGE-GROK lab desk — no production secrets stored here.
# Responsible disclosure preferred via GitHub issues or ${AGENT_MAIL}.
# Lab / pre-testnet: do not treat as financial or mainnet infrastructure.
`;
}

function llmsTxt() {
  return `# StrataMesh EDGE-GROK automation desk

> Lab / pre-testnet public edge. Voluntary integration. No secrets. Subjects ≠ objects.

## Identity
- node_id: ${EDGE_ID}
- role: edge (gossip participant with fog ${FOG_ID})
- agent: ${AGENT_MAIL} (external_assistant)
- origin: ${ORIGIN_CANON}
- version: ${VERSION}

## What this is
Public automation desk for StrataMesh Laboratory linked to Calhegas Morais Fog Node.
Humans and agents may read, probe, and optionally install a **local contributor edge** (observer) using the SDK.

## What this is NOT
- Not mainnet
- Not a token venue / yield product
- Not a place to submit secrets or private keys
- Not permission to invent mesh peers

## Operator surface (not public)
- GET /ops and GET /internal/v1/* require Fog Bearer (secret / top_secret / admin / SECRET staff / external_assistant / grok@).
- Automations stay on STRATAGROK desk until Orchestrator+AIOps are shown able to fulfill them. No Worker crons on this host.

## Machine endpoints (JSON)
- GET ${ORIGIN_CANON}/health
- GET ${ORIGIN_CANON}/status
- GET ${ORIGIN_CANON}/mesh
- GET ${ORIGIN_CANON}/mesh/activate  (triggers lab gossip sync event; rate-limit yourself)
- GET ${ORIGIN_CANON}/openapi.json
- GET ${ORIGIN_CANON}/.well-known/agent-catalog.json
- GET ${ORIGIN_CANON}/.well-known/security.txt
- GET ${ORIGIN_CANON}/llms.txt  (this file)

## Related public graph
- Fog status: https://status.calhegasmorais.pt/
- Gossip peers: https://calhegasmorais.pt/api/v1/gossip/peers
- Site: https://calhegasmorais.pt/
- AIOps actions: https://aiops.calhegasmorais.pt/actions
- Forum: https://stratamesh.discourse.group/
- GitHub org: https://github.com/StrataMesh-Laboratory

## Integrate as AI agent (contributor edge)
1. Read SDK: https://github.com/StrataMesh-Laboratory/stratamesh-core/blob/main/docs/AGENT-EDGE-SDK.md
2. Paste card: https://github.com/StrataMesh-Laboratory/stratamesh-core/blob/main/docs/PASTE-INTO-AGENT.md
3. Install local observer: nice 19 / ionice idle / heartbeat >= 300s / mesh_member=false unless public /health
4. On sandbox DNS failure: keep process; use tool-mediated probes; never simulate success

## Crawler policy
- Public lab docs and discovery endpoints are intentionally crawlable
- Prefer /llms.txt + /openapi.json before scraping HTML
- Crawl-delay 2; be gentle on /mesh/activate
- Do not scrape for credentials (none are published here)

## Antifragile / fallbacks
- If fog or gossip is down, this desk still serves /health, /llms.txt, OpenAPI, SDK links
- Mesh listing requires live /health 200 (anti-stub)
- Degraded local DNS on contributor devices is acceptable (PASS process / DEGRADED network)

## Optional citations
- Whitepaper / roadmap: see stratamesh-core repository docs
- Edge node: https://github.com/StrataMesh-Laboratory/stratamesh-core/blob/main/docs/EDGE-GROK-NODE.md
`;
}

function openApi() {
  return {
    openapi: "3.1.0",
    info: {
      title: "EDGE-GROK StrataMesh Lab Desk",
      version: VERSION,
      description:
        "Public lab edge automation desk. Read discovery is unauthenticated. Operator /ops and /internal/v1/* require Fog Bearer. Lab/pre-testnet only.",
      contact: { email: AGENT_MAIL, url: ORIGIN_CANON },
      license: { name: "Lab public documentation — see repository" },
    },
    servers: [{ url: ORIGIN_CANON }],
    paths: {
      "/health": {
        get: {
          summary: "Liveness + identity",
          operationId: "getHealth",
          responses: { "200": { description: "Edge identity JSON" } },
        },
      },
      "/status": {
        get: {
          summary: "Fog/gossip linked status",
          operationId: "getStatus",
          responses: { "200": { description: "Status + discovery links" } },
        },
      },
      "/mesh": {
        get: {
          summary: "Mesh participation summary",
          operationId: "getMesh",
          responses: { "200": { description: "Mesh state" } },
        },
      },
      "/mesh/activate": {
        get: {
          summary: "Lab gossip sync pulse (rate-limit)",
          operationId: "activateMesh",
          responses: { "200": { description: "Sync result" } },
        },
      },
      "/ping-fog": {
        get: {
          summary: "Fog reachability only",
          operationId: "pingFog",
          responses: { "200": { description: "Fog probe" } },
        },
      },
      "/llms.txt": {
        get: {
          summary: "LLM/crawler oriented plain-text guide",
          operationId: "getLlmsTxt",
          responses: { "200": { description: "text/plain" } },
        },
      },
      "/openapi.json": {
        get: {
          summary: "This OpenAPI document",
          operationId: "getOpenApi",
          responses: { "200": { description: "OpenAPI JSON" } },
        },
      },
      "/ops": {
        get: {
          summary: "Authenticated operator HTML dash (lab)",
          operationId: "getOpsDesk",
          security: [{ bearerAuth: [] }],
          responses: {
            "200": { description: "Operator HTML" },
            "401": { description: "auth_required" },
          },
        },
      },
      "/internal/v1/identity": {
        get: {
          summary: "EDGE-GROK identity (kind=user, not SCA)",
          operationId: "getOpsIdentity",
          security: [{ bearerAuth: [] }],
          responses: { "200": { description: "Identity JSON" }, "401": { description: "auth_required" } },
        },
      },
      "/internal/v1/posture": {
        get: {
          summary: "Aggregate live probes + torch",
          operationId: "getOpsPosture",
          security: [{ bearerAuth: [] }],
          responses: { "200": { description: "Posture JSON" }, "401": { description: "auth_required" } },
        },
      },
      "/internal/v1/automations": {
        get: {
          summary: "Desk-owned automation catalog + capability/training",
          operationId: "getOpsAutomations",
          security: [{ bearerAuth: [] }],
          responses: { "200": { description: "Automations JSON" }, "401": { description: "auth_required" } },
        },
      },
      "/internal/v1/torch": {
        get: {
          summary: "Torch/handoff gates; do not pass unless capability ready",
          operationId: "getOpsTorch",
          security: [{ bearerAuth: [] }],
          responses: { "200": { description: "Torch JSON" }, "401": { description: "auth_required" } },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "Fog session",
          description: "Authorization: Bearer <fog session>. Public routes stay unauthenticated.",
        },
      },
    },
    "x-lab": true,
    "x-node-id": EDGE_ID,
    "x-linked-fog": FOG_ID,
    "x-sdk": "https://github.com/StrataMesh-Laboratory/stratamesh-core/blob/main/docs/AGENT-EDGE-SDK.md",
  };
}

function agentCatalog() {
  return {
    schema: "stratamesh.agent_catalog.v1",
    node_id: EDGE_ID,
    lab: true,
    name: "EDGE-GROK Automation Desk",
    description: "Voluntary integration + automation control surface for StrataMesh lab edge",
    homepage: ORIGIN_CANON,
    llms_txt: ORIGIN_CANON + "/llms.txt",
    openapi: ORIGIN_CANON + "/openapi.json",
    health: ORIGIN_CANON + "/health",
    status: ORIGIN_CANON + "/status",
    auth: { required: false, note: "Read discovery is public. Do not send secrets." },
    rate_hints: { crawl_delay_sec: 2, mesh_activate: "sparingly" },
    integrate: {
      sdk: "https://github.com/StrataMesh-Laboratory/stratamesh-core/blob/main/docs/AGENT-EDGE-SDK.md",
      paste: "https://github.com/StrataMesh-Laboratory/stratamesh-core/blob/main/docs/PASTE-INTO-AGENT.md",
      observers: "https://github.com/StrataMesh-Laboratory/stratamesh-core/blob/main/docs/CONTRIBUTOR-OBSERVERS.md",
      tunnel_api: "https://github.com/StrataMesh-Laboratory/stratamesh-core/blob/main/docs/LOCAL-API-TUNNEL.md",
    },
    graph: {
      fog: FOG_ID,
      fog_status: "https://status.calhegasmorais.pt/",
      gossip_peers: "https://calhegasmorais.pt/api/v1/gossip/peers",
      site: "https://calhegasmorais.pt/",
      discourse: "https://stratamesh.discourse.group/",
      github: "https://github.com/StrataMesh-Laboratory",
    },
    security: {
      security_txt: ORIGIN_CANON + "/.well-known/security.txt",
      no_secrets_published: true,
      antifragile: ["desk_up_if_fog_down", "anti_stub_peer_listing", "degraded_dns_ok_for_contributors"],
    },
    agent_mail: AGENT_MAIL,
    version: VERSION,
    updated: new Date().toISOString(),
  };
}

function sitemapXml() {
  const urls = ["/", "/health", "/status", "/llms.txt", "/openapi.json", "/mesh", "/.well-known/agent-catalog.json", "/.well-known/security.txt"];
  const body = urls
    .map(
      (u) => `  <url><loc>${ORIGIN_CANON}${u === "/" ? "/" : u}</loc><changefreq>daily</changefreq></url>`
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

function htmlPage(st) {
  const listed = st.mesh && st.mesh.edge_listed;
  const fogOk = st.linked && st.linked.fog && st.linked.fog.ok;
  const peers = (st.linked.gossip && st.linked.gossip.peer_count) != null ? st.linked.gossip.peer_count : "—";
  const fogVer = (st.linked.fog && st.linked.fog.version) || "—";
  const ld = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "EDGE-GROK StrataMesh Lab Desk",
    url: ORIGIN_CANON,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Cloudflare Workers",
    description: "Lab automation desk and voluntary agent integration surface for StrataMesh.",
    provider: { "@type": "Organization", name: "StrataMesh Laboratory", url: "https://github.com/StrataMesh-Laboratory" },
    isAccessibleForFree: true,
    creativeWorkStatus: "Laboratory",
  };
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<link rel="icon" href="https://calhegasmorais.pt/favicon.ico" sizes="any"/>
<link rel="icon" type="image/png" href="https://calhegasmorais.pt/favicon-32.png" sizes="32x32"/>
<link rel="apple-touch-icon" href="https://calhegasmorais.pt/apple-touch-icon.png"/>
<meta name="theme-color" content="#0b1220"/>

<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>EDGE-GROK · StrataMesh automation desk</title>
<meta name="description" content="EDGE-GROK automation desk — not the Fog Node. Lab edge for agents/SDK/mesh. Stage 0 research identity. Pre-testnet only."/>
<meta name="robots" content="index,follow,max-snippet:-1"/>
<meta name="agent-catalog" content="${ORIGIN_CANON}/.well-known/agent-catalog.json"/>
<link rel="alternate" type="text/plain" href="/llms.txt" title="llms.txt"/>
<link rel="alternate" type="application/json" href="/openapi.json" title="OpenAPI"/>
<link rel="canonical" href="${ORIGIN_CANON}/"/>
<meta property="og:title" content="EDGE-GROK · StrataMesh lab desk"/>
<meta property="og:description" content="Public lab edge: health, mesh, SDK, voluntary agent integration."/>
<meta property="og:url" content="${ORIGIN_CANON}/"/>
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<style>
:root{--bg:#070b12;--panel:#0e1624;--line:#1c2a3f;--text:#e8eef7;--muted:#8b9bb4;--accent:#5eead4;--ok:#34d399;--warn:#fbbf24}
*{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif;background:radial-gradient(900px 500px at 0% 0%,#12324a55,transparent),var(--bg);color:var(--text);line-height:1.55}
.wrap{max-width:960px;margin:0 auto;padding:2rem 1.2rem 4rem}a{color:#7dd3fc;text-decoration:none}a:hover{text-decoration:underline}
h1{margin:0 0 .35rem;font-size:1.6rem;letter-spacing:-.02em}.sub{color:var(--muted);margin-bottom:1.2rem}
.badges{display:flex;flex-wrap:wrap;gap:.4rem;margin:1rem 0}.badge{font-size:.72rem;text-transform:uppercase;letter-spacing:.06em;padding:.28rem .55rem;border-radius:999px;border:1px solid var(--line);color:var(--muted)}
.badge.ok{color:var(--ok);border-color:#34d39955}.badge.lab{color:var(--accent);border-color:#5eead444}
.grid{display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(250px,1fr))}
.card{border:1px solid var(--line);border-radius:14px;padding:1rem 1.1rem;background:var(--panel)}
.card h2{margin:0 0 .6rem;font-size:.78rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
code,.mono{font-family:ui-monospace,monospace;font-size:.84rem;color:var(--accent)}
.links a{display:inline-block;margin:.25rem .35rem .25rem 0;padding:.4rem .7rem;border:1px solid var(--line);border-radius:10px;background:#0b1320;color:var(--text);font-size:.85rem}
.links a:hover{border-color:var(--accent);color:var(--accent);text-decoration:none}
.quote{margin:1rem 0;padding:.85rem 1rem;border-left:3px solid var(--accent);background:#0b1520;border-radius:0 12px 12px 0;color:var(--muted);font-size:.92rem}
footer{margin-top:2rem;color:var(--muted);font-size:.8rem}table{width:100%;border-collapse:collapse;font-size:.88rem}td,th{border-bottom:1px solid var(--line);padding:.4rem .3rem;text-align:left}th{color:var(--muted);font-weight:600}
</style>
</head>
<body>
<main class="wrap">
  <header>
    <h1>EDGE-GROK</h1>
    <div class="sub">StrataMesh lab automation desk · voluntary agent &amp; crawler integration</div>
    <div class="badges">
      <span class="badge lab">lab only</span>
      <span class="badge ok">live</span>
      <span class="badge ${listed ? "ok" : ""}">${listed ? "in mesh" : "mesh pending"}</span>
      <span class="badge ${fogOk ? "ok" : ""}">fog ${fogOk ? "linked" : "fallback"}</span>
      <span class="badge">pre-testnet</span>
    </div>
  </header>

  <section class="card">
    <p><strong class="mono">${EDGE_ID}</strong> · lab automation edge · agent <code>${AGENT_MAIL}</code> (external assistant)</p>
    <p class="quote">This host is <strong>not</strong> the Fog Node and <strong>not</strong> a mirror of calhegasmorais.pt. Linked fog: <span class="mono">${FOG_ID}</span> (AMCM ENI infrastructure). <em>StrataMesh Laboratory</em> is currently a one-person research identity — not yet a Portuguese association.</p>
    <p class="quote">Subjects ≠ objects · no secrets · crawlers: <a href="/llms.txt">/llms.txt</a> · <a href="/openapi.json">/openapi.json</a> · contributors remain <code>mesh_member=false</code> without public /health.</p>
    <div class="links">
      <a href="/health">/health</a>
      <a href="/status">/status</a>
      <a href="/mesh">/mesh</a>
      <a href="/mesh/activate">/mesh/activate</a>
      <a href="/llms.txt">/llms.txt</a>
      <a href="/openapi.json">OpenAPI</a>
      <a href="/.well-known/agent-catalog.json">agent-catalog</a>
      <a href="https://api-edge.calhegasmorais.pt/v1/install-guide">api-edge install</a>
      <a href="https://api-edge.calhegasmorais.pt/SPEC.txt">api-edge SPEC</a>
      <a href="https://github.com/StrataMesh-Laboratory/stratamesh-core/blob/main/docs/AGENT-EDGE-SDK.md">Agent SDK</a>
      <a href="https://github.com/StrataMesh-Laboratory/stratamesh-core/blob/main/docs/INSTITUTIONAL-ROADMAP.md">Institutional roadmap</a>
      <a href="https://status.calhegasmorais.pt/">Fog status</a>
      <a href="https://calhegasmorais.pt/api/v1/gossip/peers">Gossip peers</a>
      <a href="https://stratamesh.discourse.group/">Discourse</a>
    </div>
  </section>

  <div class="grid">
    <div class="card">
      <h2>Live mesh</h2>
      <p>Fog: <span class="mono">${fogOk ? fogVer : "degraded"}</span></p>
      <p>Peers: <span class="mono">${peers}</span></p>
      <p>Protocol: <span class="mono">${(st.mesh && st.mesh.protocol) || "—"}</span></p>
    </div>
    <div class="card">
      <h2>For AI agents</h2>
      <ol style="margin:0;padding-left:1.1rem;color:var(--muted);font-size:.92rem">
        <li>Fetch <a href="/llms.txt">llms.txt</a></li>
        <li>Read <a href="https://github.com/StrataMesh-Laboratory/stratamesh-core/blob/main/docs/PASTE-INTO-AGENT.md">Prompt A/B</a></li>
        <li>Install local observer (nice 19)</li>
        <li>Never fabricate peers</li>
      </ol>
    </div>
    <div class="card">
      <h2>Antifragile</h2>
      <ul style="margin:0;padding-left:1.1rem;color:var(--muted);font-size:.92rem">
        <li>Desk stays up if fog drops</li>
        <li>Anti-stub peer listing</li>
        <li>DNS-degraded contributors OK</li>
        <li>No credentials published</li>
      </ul>
    </div>
  </div>

  <section class="card" style="margin-top:1rem">
    <h2>Discovery table</h2>
    <table>
      <tr><th>Resource</th><th>URL</th></tr>
      <tr><td>llms.txt</td><td class="mono"><a href="/llms.txt">/llms.txt</a></td></tr>
      <tr><td>OpenAPI</td><td class="mono"><a href="/openapi.json">/openapi.json</a></td></tr>
      <tr><td>Agent catalog</td><td class="mono"><a href="/.well-known/agent-catalog.json">/.well-known/agent-catalog.json</a></td></tr>
      <tr><td>security.txt</td><td class="mono"><a href="/.well-known/security.txt">/.well-known/security.txt</a></td></tr>
      <tr><td>SDK</td><td class="mono"><a href="https://github.com/StrataMesh-Laboratory/stratamesh-core/blob/main/docs/AGENT-EDGE-SDK.md">AGENT-EDGE-SDK.md</a></td></tr>
    </table>
  </section>

  <footer>
    <p>${EDGE_ID} · ${VERSION} · stamp ${(st.timestamp || "").replace("T", " ")}</p>
    <p>StrataMesh Laboratory · not a financial product · voluntary integration only</p>
  </footer>
</main>
</body>
</html>`;
}

function wantsJson(request, url) {
  if (url.searchParams.get("format") === "json") return true;
  const p = url.pathname.replace(/\/+$/, "") || "/";
  if (["/status", "/health", "/mesh", "/mesh/status"].includes(p)) return true;
  const accept = (request.headers.get("Accept") || "").toLowerCase();
  if (accept.includes("application/json") && !accept.includes("text/html")) return true;
  return false;
}

/* ===== 1.5.2-gossip-views (lab) — service-binding probes. No Worker crons. No secrets. ===== */
const AUTH_ME = "https://stratamesh-auth.stratamesh.workers.dev/me";
const LOGIN_URL = "https://calhegasmorais.pt/dashboard";
const OPS_ORIGINS = new Set([
  "https://calhegasmorais.pt",
  "https://edge.calhegasmorais.pt",
]);

const OWNER_NOW = {
  id: "STRATAGROK desk",
  node: EDGE_ID,
  agent: AGENT_MAIL,
  kind: "user",
  status: "external_assistant",
  not_sca: true,
  note: "EDGE-GROK operator. Fog USER, not SCA.",
};

const OWNER_TARGET = {
  orchestrator: "SCA-ORCH-CMN-001",
  aiops_team: true,
  grok_as_sca: false,
  note: "Internalise onto Orchestrator + AIOps team when gates pass. grok@ stays user/external_assistant, not SCA.",
};

const HANDOFF_BLOCKED_UNLESS = "capability.orchestrator==ready AND capability.aiops==ready AND existing objective gates pass";
const DISCOURSE_OPS_PULSE = {
  url: "https://stratamesh.discourse.group/t/20",
  topic: 20,
  posted_as: "stratamesh-grok",
  note: "EDGE-GROK public ops pulse. 18:00 pulse writes only to t/20. Do not invent extra forum threads.",
};


const DESK_AUTOMATIONS = [
  {
    id: "night-diagnostic-fog",
    name: "Night Diagnostic FOG",
    cron: "0 23 * * *",
    timezone: "Europe/Lisbon",
    train: {
      aiops_must_grow: "next_actions[] {id:night-diagnostic-fog, schema:stratamesh.handoff.v1} — GET /handoff already accepts v1; that is not a runner",
      orch_must_grow: "SCA-ORCH-CMN-001 handler that fulfills night-diagnostic-fog; dry-run + recorded replay. GET /cycle or a headline mention is not fulfillment",
    },
  },
  {
    id: "stratamesh-24h-dev-cycle",
    name: "StrataMesh 24h Dev Cycle",
    cron: "0 9 * * *",
    timezone: "Europe/Lisbon",
    train: {
      aiops_must_grow: "next_actions[] {id:stratamesh-24h-dev-cycle} with the handoff payload AIOps already accepts",
      orch_must_grow: "Dedicated 24h Dev Cycle handler on SCA-ORCH-CMN-001. Chat run=aiops_cycle is not a recorded replay of this desk routine",
    },
  },
  {
    id: "discourse-lab-ops-pulse",
    name: "Discourse lab ops pulse",
    cron: "0 18 * * *",
    timezone: "Europe/Lisbon",
    public_ops_pulse: "https://stratamesh.discourse.group/t/20",
    writes_only_to: "t/20",
    train: {
      aiops_must_grow: "next_actions[] {id:discourse-lab-ops-pulse} plus fixture that writes only to https://stratamesh.discourse.group/t/20 (do not invent extra threads)",
      orch_must_grow: "Orchestrator handler to post/read the lab ops pulse on t/20 only (docs + dry-run). No Discourse verb on GET /chat today",
    },
  },
  {
    id: "watchdog-p0-mesh-escalate",
    name: "Watchdog P0 Mesh Escalate",
    cron: "0 0-8 * * *",
    timezone: "Europe/Lisbon",
    train: {
      aiops_must_grow: "next_actions[] {id:watchdog-p0-mesh-escalate} when P0 mesh conditions hit",
      orch_must_grow: "SCA-ORCH-CMN-001 escalate handler with a dry-run replay. No P0 watchdog handler shown on /chat or /actions",
    },
  },
  {
    id: "xai-grok-reset-retry",
    name: "x.ai grok@ reset retry",
    cron: "19 21 * * *",
    timezone: "Europe/Lisbon",
    train: {
      aiops_must_grow: "next_actions[] {id:xai-grok-reset-retry}; do not treat Worker email ingest as this cron",
      orch_must_grow: "Handler + documented dry-run. Password/reset remains André's; grok@ is user not SCA",
    },
  },
];

function corsOps(request) {
  const origin = request.headers.get("Origin") || "";
  const h = {
    "Access-Control-Allow-Methods": "GET, OPTIONS, HEAD",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, User-Agent",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
    "X-StrataMesh-Lab": "true",
    "X-StrataMesh-Node": EDGE_ID,
  };
  if (OPS_ORIGINS.has(origin)) h["Access-Control-Allow-Origin"] = origin;
  return h;
}

function opsJson(request, data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      ...corsOps(request),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

function callerPublic(me) {
  if (!me) return null;
  return {
    email: me.email || null,
    type: me.type || null,
    role: me.role || null,
    clearance: me.clearance || me.clearance_level || null,
    kind: me.type === "staff" ? "staff" : "user",
  };
}

function deskIdentity(me) {
  return {
    lab: true,
    node_id: EDGE_ID,
    fog: FOG_ID,
    linked_fog: FOG_ID,
    version: VERSION,
    kind: "user",
    not_sca: true,
    status: "external_assistant",
    clearance: "secret",
    agent: {
      email: AGENT_MAIL,
      status: "external_assistant",
      kind: "user",
      not_sca: true,
      clearance: "secret",
    },
    caller: callerPublic(me),
    timestamp: new Date().toISOString(),
  };
}

function isAllowedOperator(me) {
  if (!me || me.success === false) return false;
  const email = String(me.email || "").toLowerCase();
  const role = String(me.role || "").toLowerCase();
  const clearance = String(me.clearance || me.clearance_level || "").toLowerCase();
  const type = String(me.type || "").toLowerCase();
  const staffRole = String((me.staff && me.staff.role) || me.staff_role || "").toLowerCase();
  if (email === "grok@calhegasmorais.pt" || email.startsWith("grok@")) return true;
  if (["secret", "top_secret"].includes(clearance)) return true;
  if (["admin", "secret", "top_secret", "external_assistant"].includes(role)) return true;
  if (["admin", "secret", "top_secret", "external_assistant"].includes(staffRole)) return true;
  if (type === "staff" && ["admin", "secret", "top_secret"].includes(role)) return true;
  return false;
}

function bearerToken(request) {
  const h = request.headers.get("Authorization") || "";
  const m = h.match(/^Bearer\s+(\S+)/i);
  return m ? m[1] : "";
}

async function requireOperator(request, env) {
  const token = bearerToken(request);
  if (!token) return { ok: false, status: 401, error: "auth_required" };
  try {
    const headers = {
      Authorization: "Bearer " + token,
      Accept: "application/json",
      "User-Agent": EDGE_ID + "/ops",
    };
    const fetcher = bindingFetch(env, "AUTH");
    const r = fetcher
      ? await fetcher.fetch(new Request("https://auth/me", { headers }))
      : await fetch(AUTH_ME, { headers });
    const data = await r.json().catch(() => null);
    if (!r.ok || !data) {
      return { ok: false, status: 401, error: "auth_invalid", http: r.status };
    }
    if (!isAllowedOperator(data)) {
      return { ok: false, status: 403, error: "forbidden", me: callerPublic(data) };
    }
    return { ok: true, me: data };
  } catch (e) {
    return { ok: false, status: 503, error: "auth_unreachable", detail: String(e && e.message ? e.message : e) };
  }
}

function clipJson(data, max = 8000) {
  try {
    const s = JSON.stringify(data);
    if (s.length <= max) return data;
    if (Array.isArray(data)) return { _clipped: true, length: data.length, sample: data.slice(0, 8) };
    if (data && typeof data === "object") {
      const out = { _clipped: true };
      for (const k of Object.keys(data).slice(0, 20)) {
        const v = data[k];
        if (v && typeof v === "object") {
          const vs = JSON.stringify(v);
          out[k] = vs.length > 1500 ? (Array.isArray(v) ? { type: "array", length: v.length } : { type: "object", keys: Object.keys(v).slice(0, 12) }) : v;
        } else out[k] = v;
      }
      return out;
    }
    return String(data).slice(0, 400);
  } catch (_) {
    return { _clip_error: true };
  }
}

async function probeLive(url, timeoutMs = 4000, extraHeaders = {}, fetcher = null, via = "public") {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  const started = Date.now();
  try {
    const req = new Request(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": EDGE_ID + "/ops",
        "X-StrataMesh-Caller": EDGE_ID,
        ...extraHeaders,
      },
      signal: ac.signal,
    });
    const r = fetcher ? await fetcher.fetch(req) : await fetch(req);
    const raw = await r.text();
    let data = null;
    try { data = JSON.parse(raw); } catch (_) {}
    return {
      url,
      ok: r.ok,
      http: r.status,
      ms: Date.now() - started,
      via,
      data: data ? clipJson(data) : null,
      text_excerpt: data ? null : String(raw).slice(0, 220),
    };
  } catch (e) {
    return {
      url,
      ok: false,
      error: String(e && e.message ? e.message : e),
      ms: Date.now() - started,
      via,
      degraded: true,
    };
  } finally {
    clearTimeout(t);
  }
}

async function probeService(env, bindingName, url, timeoutMs = 4000, extraHeaders = {}) {
  const fetcher = bindingFetch(env, bindingName);
  if (!fetcher) {
    return {
      url,
      ok: false,
      error: "binding_missing:" + bindingName,
      degraded: true,
      via: "none",
    };
  }
  return probeLive(url, timeoutMs, extraHeaders, fetcher, "service:" + bindingName);
}

async function runProbes(env) {
  // Self-HTTP to this Worker 522s (custom domain and workers.dev). Own routes are answered in-process.
  const ownInWorker = (path, data) => Promise.resolve({
    url: ORIGIN_CANON + path,
    ok: true,
    http: 200,
    ms: 0,
    source: "in_worker",
    via: "in_worker",
    note: "Self-fetch 522; this request is the live Worker.",
    data,
  });
  const jobs = {
    own_health: ownInWorker("/health", { status: "ok", service: "stratamesh-edge-grok", ...identity({ live: true }), timestamp: new Date().toISOString() }),
    own_status: ownInWorker("/status", { ...identity({ live: true }), note: "linked fields come from fog_health + gossip_peers probes, not invented" }),
    own_mesh: ownInWorker("/mesh", { mesh_role: "edge_gossip_participant", linked_fog: FOG_ID, lab: true }),
    fog_health: probeService(env, "STATUS", "https://status/health"),
    gossip_peers: probeService(env, "GOSSIP", "https://calhegasmorais.pt/api/v1/gossip/peers"),
    gossip_via_public: probeLive("https://calhegasmorais.pt/api/v1/gossip/peers"),
    aiops_health: probeService(env, "AIOPS", "https://aiops/health"),
    aiops_actions: probeService(env, "AIOPS", "https://aiops/actions"),
    aiops_handoff: probeService(env, "AIOPS", "https://aiops/handoff"),
    integrations: probeLive("https://stratamesh-edge-api.stratamesh.workers.dev/v1/integrations"),
    orchestrator_chat: probeService(env, "ORCHESTRATOR", "https://orchestrator/chat"),
    github_pulls: Promise.resolve({
      url: "https://api.github.com/repos/StrataMesh-Laboratory/stratamesh-core/pulls?state=open",
      ok: false,
      omitted: true,
      reason: "edge_omitted_no_secret",
      note: "secrets_on_edge=false; do not put GITHUB_TOKEN on this Worker. Desk lists PRs.",
      degraded: true,
      via: "omitted",
    }),
  };
  const keys = Object.keys(jobs);
  const settled = await Promise.allSettled(keys.map((k) => jobs[k]));
  const out = {};
  keys.forEach((k, i) => {
    const s = settled[i];
    if (s.status === "fulfilled") out[k] = s.value;
    else out[k] = { ok: false, error: String(s.reason && s.reason.message ? s.reason.message : s.reason), degraded: true };
  });
  return out;
}

function extractPeers(gossipProbe) {
  const d = gossipProbe && gossipProbe.data;
  const peers = (d && Array.isArray(d.peers)) ? d.peers : [];
  return peers.map((p) => ({
    id: p && p.id,
    role: p && p.role,
    status: p && p.status,
    lab: p && p.lab,
    endpoint: p && p.endpoint,
    version: p && p.version,
    health_via: p && p.health_via,
    health_http: p && p.health_http,
  })).filter((p) => p.id);
}

function summarizePulls(probe) {
  if (!probe) return { ok: false, error: "missing" };
  if (probe.omitted || probe.reason === "edge_omitted_no_secret") {
    return { ok: false, omitted: true, reason: "edge_omitted_no_secret", note: probe.note || "github_pulls: edge_omitted_no_secret", degraded: true };
  }
  if (!probe.ok) return { ok: false, http: probe.http, error: probe.error || ("http " + probe.http), degraded: true };
  const arr = Array.isArray(probe.data) ? probe.data : [];
  return {
    ok: true,
    http: probe.http,
    count: arr.length,
    pulls: arr.slice(0, 15).map((p) => ({
      number: p.number,
      title: p.title,
      html_url: p.html_url,
      user: p.user && p.user.login,
      draft: !!p.draft,
      created_at: p.created_at,
      head: p.head && p.head.ref,
    })),
  };
}

function summarizeIntegrations(probe) {
  if (!probe) return { ok: false, error: "missing" };
  if (!probe.ok) return { ok: false, http: probe.http, error: probe.error || ("http " + probe.http), degraded: true };
  const d = probe.data || {};
  const list = Array.isArray(d.integrations) ? d.integrations : [];
  return {
    ok: true,
    http: probe.http,
    count: d.count != null ? d.count : list.length,
    integrations: list.map((x) => ({
      id: x.id, name: x.name, type: x.type, status: x.status, base_url: x.base_url, health_url: x.health_url,
    })),
  };
}

function summarizeAiops(probe) {
  if (!probe) return { ok: false, error: "missing" };
  if (!probe.ok) return { ok: false, http: probe.http, error: probe.error || ("http " + probe.http), degraded: true };
  const d = probe.data || {};
  return {
    ok: true,
    http: probe.http,
    at: d.at || null,
    summary: d.summary || null,
    next_actions: d.next_actions || [],
    headline: d.handoff && d.handoff.headline,
    posture: d.handoff && d.handoff.posture,
  };
}


function probeCap(probe) {
  if (!probe) return "unknown";
  if (!probe.ok) return "unready";
  return "live_only";
}

function nextActionsList(probes) {
  const d = probes && probes.aiops_actions && probes.aiops_actions.data;
  return (d && Array.isArray(d.next_actions)) ? d.next_actions : [];
}

function mentionsRoutine(blob, auto) {
  const s = JSON.stringify(blob || {}).toLowerCase();
  const needles = [auto.id, auto.name].filter(Boolean).map((x) => String(x).toLowerCase());
  return needles.some((n) => n && s.includes(n));
}

function orchRunHint(probes) {
  const body = probes && probes.orchestrator_chat && probes.orchestrator_chat.data && probes.orchestrator_chat.data.body;
  return (body && body.run) || null;
}

function aiopsTeam(probes) {
  const h = probes && probes.aiops_health && probes.aiops_health.data;
  return (h && (h.team || (h.acb_roster && h.acb_roster.agents))) || null;
}

function perAutomationCapability(probes, auto) {
  const orchP = probes && probes.orchestrator_chat;
  const aiH = probes && probes.aiops_health;
  const aiA = probes && probes.aiops_actions;
  const next = nextActionsList(probes);
  const evidence = [];
  const orchLive = probeCap(orchP);
  const aiopsLive = (probeCap(aiH) === "unknown" && probeCap(aiA) === "unknown")
    ? "unknown"
    : ((probeCap(aiH) === "live_only" || probeCap(aiA) === "live_only") ? "live_only" : "unready");

  if (orchLive === "live_only") {
    evidence.push("GET /api/orchestrator/chat ok, stub=" + String(orchP.data && orchP.data.stub) + ", version=" + String(orchP.data && orchP.data.version));
  } else if (orchLive === "unready") {
    evidence.push("Orchestrator chat probe failed: " + (orchP && (orchP.error || ("http " + orchP.http))));
  } else {
    evidence.push("Orchestrator chat not probed");
  }
  const runHint = orchRunHint(probes);
  if (runHint) evidence.push("chat documents run verbs: " + String(runHint) + " — not a replay of " + auto.id);

  if (aiopsLive === "live_only") {
    evidence.push("AIOps health/actions reachable; team is devops/security/analysis/mesh/economy (not grok@)");
  } else if (aiopsLive === "unready") {
    evidence.push("AIOps probe failed");
  } else {
    evidence.push("AIOps not probed");
  }
  evidence.push("next_actions length=" + next.length + " (empty means no work item to consume)");
  if (mentionsRoutine(next, auto)) {
    evidence.push("next_actions mentions this routine but no recorded successful replay → still unready");
  } else {
    evidence.push("no next_actions handler for " + auto.id);
  }
  const headline = probes && probes.aiops_actions && probes.aiops_actions.data && probes.aiops_actions.data.handoff && probes.aiops_actions.data.handoff.headline;
  if (headline && mentionsRoutine(headline, auto)) {
    evidence.push("handoff headline mentions this name; a headline is not a handler");
  }

  // live GET ≠ shown able to fulfill. Ready only after handler + replay. Never claimed here without that.
  const orch = orchLive === "unknown" ? "unknown" : "unready";
  const aiops = aiopsLive === "unknown" ? "unknown" : "unready";
  const training_item = {
    automation: auto.id,
    train_if_unready: true,
    aiops_must_grow: auto.train && auto.train.aiops_must_grow,
    orch_must_grow: auto.train && auto.train.orch_must_grow,
    payload_they_already_accept: "GET https://aiops.calhegasmorais.pt/handoff schema=stratamesh.handoff.v1",
    do_not: ["Worker crons", "POST destructive /cycle", "claim fulfillment from liveness"],
  };
  return {
    orchestrator: orch,
    aiops: aiops,
    evidence,
    train_if_unready: true,
    training_item,
  };
}

function overallCapability(probes) {
  const items = DESK_AUTOMATIONS.map((a) => perAutomationCapability(probes, a));
  const orchVals = items.map((c) => c.orchestrator);
  const aiopsVals = items.map((c) => c.aiops);
  const roll = (vals) => vals.every((v) => v === "ready") ? "ready" : (vals.every((v) => v === "unknown") ? "unknown" : "unready");
  const next = nextActionsList(probes);
  const evidence = [
    "AIOps next_actions empty=" + (next.length === 0),
    "No desk-routine handler/replay shown on Orchestrator or AIOps",
    "AIOps SCAs: existing team, not grok@. Orchestrator SCA: SCA-ORCH-CMN-001",
    "GET liveness is not fulfillment",
  ];
  const orchP = probes && probes.orchestrator_chat;
  const aiH = probes && probes.aiops_health;
  if (orchP && orchP.ok) evidence.push("orch chat http " + orchP.http + " version " + ((orchP.data && orchP.data.version) || "?"));
  if (aiH && aiH.ok) evidence.push("aiops health http " + aiH.http + " version " + ((aiH.data && aiH.data.version) || "?") + " worker " + ((aiH.data && aiH.data.worker) || "?"));
  return {
    orchestrator: roll(orchVals),
    aiops: roll(aiopsVals),
    evidence,
    train_if_unready: true,
    handoff_blocked_unless: HANDOFF_BLOCKED_UNLESS,
    automations: Object.fromEntries(DESK_AUTOMATIONS.map((a, i) => [a.id, items[i]])),
  };
}

function evaluateTorch(probes) {
  const inventedPeers = false;
  const coreKeys = ["own_health", "own_status", "own_mesh", "fog_health", "gossip_peers", "aiops_actions", "integrations", "orchestrator_chat"];
  const coreFail = coreKeys.filter((k) => !probes[k] || !probes[k].ok);
  const ghOmitted = !!(probes.github_pulls && (probes.github_pulls.omitted || probes.github_pulls.reason === "edge_omitted_no_secret"));
  const ghOk = !!(probes.github_pulls && probes.github_pulls.ok);
  const probesOk = coreFail.length === 0;

  const handoffProbe = probes.aiops_handoff;
  const wrap = handoffProbe && handoffProbe.data;
  const handoff = wrap && wrap.handoff ? wrap.handoff : wrap;
  const schema = handoff && handoff.schema;
  const schemaOk = !!(handoffProbe && handoffProbe.ok && schema === "stratamesh.handoff.v1");

  const actions = probes.aiops_actions && probes.aiops_actions.data;
  const summary = actions && actions.summary;
  const crit = summary && typeof summary.critical === "number" ? summary.critical : null;
  const next_actions = (actions && Array.isArray(actions.next_actions)) ? actions.next_actions : [];

  const gates = [
    {
      id: 1,
      key: "live_probes_no_invented_peers_or_oracle",
      met: probesOk && !inventedPeers,
      detail: probesOk
        ? "Live probes returned without invented peers; Oracle VM not claimed."
        : "One or more live probes failed/degraded: " + coreFail.join(", "),
      invented_peers: inventedPeers,
      oracle_vm_live: false,
      core_failures: coreFail,
      github_ok: ghOk,
      github_pulls: ghOmitted ? "edge_omitted_no_secret" : (ghOk ? "ok" : "degraded"),
    },
    {
      id: 2,
      key: "no_mainnet_claims",
      met: false,
      detail: "Desk identity is lab/pre-testnet, but an estate-wide 'no mainnet/aBFT claims' scan is not recorded as a passing test. Unmet.",
      desk_lab: true,
      desk_pre_testnet: true,
    },
    {
      id: 3,
      key: "free_tier_budget_no_new_worker_crons",
      met: false,
      detail: "This script has no cron triggers and 1.5.2-gossip-views adds none. Account-wide Worker cron occupancy is not queryable from the edge. Unmet until ops records the FREE-TIER-BUDGET check as a passing test.",
      this_script_schedules: [],
      this_change_adds_crons: false,
    },
    {
      id: 4,
      key: "handoff_payload_v1",
      met: schemaOk,
      detail: schemaOk
        ? "GET https://aiops.calhegasmorais.pt/handoff schema=stratamesh.handoff.v1"
        : ((handoffProbe && (handoffProbe.error || ("http " + handoffProbe.http))) || "handoff schema not verified"),
      schema: schema || null,
      generated_at: (handoff && handoff.generated_at) || null,
    },
    {
      id: 5,
      key: "aiops_critical_zero_documented_window",
      met: false,
      detail: crit === 0
        ? "AIOps /actions snapshot critical=0, but no documented window is recorded as a passing test. Snapshot ≠ window."
        : (crit == null ? "Could not read summary.critical" : "summary.critical=" + crit),
      snapshot_critical: crit,
      snapshot_at: (actions && actions.at) || null,
    },
    {
      id: 6,
      key: "orch_aiops_shown_able_to_fulfill",
      met: false,
      detail: "Orchestrator + AIOps must be shown able to operate AND fulfill each desk automation (handler + recorded replay), not merely be scheduled or GET-live. next_actions is empty; no handler for the five desk routines. STRATAGROK trains them and keeps owner_now=desk.",
      next_actions_count: Array.isArray(next_actions) ? next_actions.length : 0,
      did_not_post_cycle: true,
    },
  ];
  const capability = overallCapability(probes);
  const capReady = capability.orchestrator === "ready" && capability.aiops === "ready";
  const ready = gates.every((g) => g.met === true) && capReady;
  return {
    lab: true,
    pass: ready,
    decision: ready ? "gates_recorded_passing" : "do_not_pass_torch",
    ready_to_pass: ready,
    capability,
    train_if_unready: true,
    handoff_blocked_unless: HANDOFF_BLOCKED_UNLESS,
    blocked: !ready,
    owner_now: OWNER_NOW,
    owner_target: OWNER_TARGET,
    reason: ready
      ? "All required_gates recorded passing and capability shown ready."
      : "required_gates unmet or capability unready — keep torch on STRATAGROK desk; do not pass torch",
    last_handoff: schemaOk
      ? {
          ok: true,
          schema,
          generated_at: handoff.generated_at,
          headline: handoff.headline,
          posture: handoff.posture,
          node_id: handoff.node_id,
          agent: handoff.agent,
        }
      : {
          ok: false,
          error: (handoffProbe && (handoffProbe.error || ("http " + handoffProbe.http))) || "unreachable",
        },
    next_actions,
    gates,
    note: "Automations stay desk_owned until Orchestrator (SCA-ORCH-CMN-001) + AIOps team are shown able to fulfill them. grok@ is user/external_assistant, not SCA. No new CF Worker crons. No GET /cycle from this desk (non-destructive).",
  };
}

function automationsCatalog(torch, probes) {
  const cap = (torch && torch.capability) || overallCapability(probes || {});
  return {
    lab: true,
    runner: "STRATAGROK desk",
    runner_note: "EDGE-GROK operator (grok@ user/external_assistant). NOT Cloudflare Worker crons. NOT AIOps handlers. Desk-owned until Orchestrator+AIOps are shown able to fulfill each routine.",
    worker_crons_on_this_script: [],
    this_change_adds_crons: false,
    owner_now: OWNER_NOW,
    owner_target: OWNER_TARGET,
    ready_to_pass: !!(torch && torch.ready_to_pass),
    torch: (torch && torch.decision) || "do_not_pass_torch",
    capability: cap,
    train_if_unready: true,
    handoff_blocked_unless: HANDOFF_BLOCKED_UNLESS,
    required_gates: (torch && torch.gates) || [],
    automations: DESK_AUTOMATIONS.map((a) => {
      const c = perAutomationCapability(probes || {}, a);
      return {
        id: a.id,
        name: a.name,
        cron: a.cron,
        timezone: a.timezone,
        runner: "STRATAGROK desk",
        lab: true,
        status: "desk_owned",
        worker_cron: false,
        aiops_handler: false,
        owner_now: "STRATAGROK desk",
        owner_target: "Orchestrator (SCA-ORCH-CMN-001) + AIOps team (not grok@ as SCA)",
        capability: { orchestrator: c.orchestrator, aiops: c.aiops, evidence: c.evidence },
        train_if_unready: true,
        handoff_blocked_unless: HANDOFF_BLOCKED_UNLESS,
        training_item: c.training_item,
        public_ops_pulse: a.id === "discourse-lab-ops-pulse" ? DISCOURSE_OPS_PULSE : undefined,
        writes_only_to: a.id === "discourse-lab-ops-pulse" ? "t/20" : undefined,
      };
    }),
    discourse_ops_pulse: DISCOURSE_OPS_PULSE,
    timestamp: new Date().toISOString(),
  };
}

async function buildPosture(env, me) {
  const probes = await runProbes(env);
  const torch = evaluateTorch(probes);
  return {
    lab: true,
    version: VERSION,
    timestamp: new Date().toISOString(),
    identity: deskIdentity(me),
    probes,
    torch,
    automations: automationsCatalog(torch, probes),
    integrations: summarizeIntegrations(probes.integrations),
    github_pulls: summarizePulls(probes.github_pulls),
    aiops: summarizeAiops(probes.aiops_actions),
    gossip_peers: {
      ok: !!(probes.gossip_peers && probes.gossip_peers.ok),
      http: probes.gossip_peers && probes.gossip_peers.http,
      error: probes.gossip_peers && probes.gossip_peers.error,
      via: probes.gossip_peers && probes.gossip_peers.via,
      count: extractPeers(probes.gossip_peers).length,
      peers: extractPeers(probes.gossip_peers),
      invented: false,
    },
    gossip_via_binding: {
      ok: !!(probes.gossip_peers && probes.gossip_peers.ok),
      http: probes.gossip_peers && probes.gossip_peers.http,
      error: probes.gossip_peers && probes.gossip_peers.error,
      via: probes.gossip_peers && probes.gossip_peers.via,
      url: "https://calhegasmorais.pt/api/v1/gossip/peers",
      count: extractPeers(probes.gossip_peers).length,
      peers: extractPeers(probes.gossip_peers),
      invented: false,
      note: "Service binding GOSSIP → same /api/v1/gossip/peers path the custom domain uses. Same handler as public; EDGE listed via inbound_caller when circular /health would deadlock.",
    },
    gossip_via_public: {
      ok: !!(probes.gossip_via_public && probes.gossip_via_public.ok),
      http: probes.gossip_via_public && probes.gossip_via_public.http,
      error: probes.gossip_via_public && probes.gossip_via_public.error,
      via: probes.gossip_via_public && probes.gossip_via_public.via,
      url: "https://calhegasmorais.pt/api/v1/gossip/peers",
      count: extractPeers(probes.gossip_via_public).length,
      peers: extractPeers(probes.gossip_via_public),
      invented: false,
      note: "Public custom-domain GET of the same path. Independent of the GOSSIP binding.",
    },
    oracle_vm: {
      live: false,
      invented: false,
      host: "fog.calhegasmorais.pt",
      hold: "A0",
      note: "Not a live Oracle VM. NXDOMAIN / A0 HOLD. Do not invent.",
    },
    nested_wildcard: {
      host: "api.edge.calhegasmorais.pt",
      ssl: "handshake_failure_expected",
      reason: "Universal SSL is one-level wildcard; internal API is on edge.calhegasmorais.pt. Do not buy certs.",
    },
  };
}

function opsHintPage(request, auth) {
  const err = (auth && auth.error) || "auth_required";
  const html = `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="robots" content="noindex,nofollow"/>
<title>EDGE-GROK operator · auth required</title>
<style>
:root{--bg:#070b12;--panel:#0e1624;--line:#1c2a3f;--text:#e8eef7;--muted:#8b9bb4;--accent:#5eead4}
*{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif;background:var(--bg);color:var(--text);line-height:1.55}
.wrap{max-width:640px;margin:12vh auto;padding:1.5rem}a{color:#7dd3fc}
.card{border:1px solid var(--line);border-radius:14px;padding:1.2rem;background:var(--panel)}
.muted{color:var(--muted);font-size:.92rem}code{color:var(--accent);font-family:ui-monospace,monospace}
</style>
</head>
<body>
<main class="wrap">
  <div class="card">
    <h1 style="margin:.2rem 0">Operator desk</h1>
    <p class="muted">Secretária de operação · lab · sem métricas inventadas</p>
    <p>Auth required (<code>${err}</code>). Login: <a href="${LOGIN_URL}">${LOGIN_URL}</a></p>
    <p class="muted">If a Fog session exists in this browser, this page will retry with <code>localStorage.sm_token</code> or <code>token</code>. Server never accepts a token from the query string.</p>
    <p id="st" class="muted"></p>
  </div>
</main>
<script>
(async function(){
  let t="";
  try { t = localStorage.getItem("sm_token") || localStorage.getItem("token") || ""; } catch(e) {}
  const st = document.getElementById("st");
  if (!t) { st.textContent = "No local token. Use Authorization: Bearer or login."; return; }
  st.textContent = "Retrying with local session…";
  try {
    const r = await fetch("/ops", { headers: { Authorization: "Bearer "+t, Accept: "text/html" }});
    if (r.ok) { const html = await r.text(); document.open(); document.write(html); document.close(); return; }
    st.textContent = "Local token rejected ("+r.status+"). Login at dashboard.";
  } catch(e) { st.textContent = "Retry failed."; }
})();
</script>
</body>
</html>`;
  return new Response(html, {
    status: 401,
    headers: {
      ...corsOps(request),
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "WWW-Authenticate": 'Bearer realm="edge-ops"',
    },
  });
}

function opsDashPage(request, bundle) {
  const payload = JSON.stringify(bundle).replace(/</g, "\\u003c");
  const html = `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="robots" content="noindex,nofollow"/>
<title>EDGE-GROK operator desk</title>
<style>
:root{--bg:#070b12;--panel:#0e1624;--line:#1c2a3f;--text:#e8eef7;--muted:#8b9bb4;--accent:#5eead4;--ok:#34d399;--bad:#f87171;--warn:#fbbf24}
*{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif;background:radial-gradient(900px 500px at 0% 0%,#12324a55,transparent),var(--bg);color:var(--text);line-height:1.5}
.wrap{max-width:1100px;margin:0 auto;padding:1.4rem 1.1rem 3rem}a{color:#7dd3fc;text-decoration:none}a:hover{text-decoration:underline}
h1{margin:0 0 .2rem;font-size:1.45rem}.sub{color:var(--muted);margin:0 0 1rem}
.badges{display:flex;flex-wrap:wrap;gap:.35rem;margin:.6rem 0 1rem}
.badge{font-size:.7rem;text-transform:uppercase;letter-spacing:.05em;padding:.25rem .5rem;border-radius:999px;border:1px solid var(--line);color:var(--muted)}
.badge.ok{color:var(--ok);border-color:#34d39955}.badge.bad{color:var(--bad);border-color:#f8717155}.badge.lab{color:var(--accent);border-color:#5eead444}
.grid{display:grid;gap:.85rem;grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}
.card{border:1px solid var(--line);border-radius:14px;padding:.9rem 1rem;background:var(--panel)}
.card h2{margin:0 0 .55rem;font-size:.75rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
.mono,code{font-family:ui-monospace,monospace;font-size:.82rem;color:var(--accent)}
table{width:100%;border-collapse:collapse;font-size:.84rem}td,th{border-bottom:1px solid var(--line);padding:.35rem .25rem;text-align:left;vertical-align:top}th{color:var(--muted);font-weight:600}
.ok{color:var(--ok)}.bad{color:var(--bad)}.warn{color:var(--warn)}
button{background:#0b1320;color:var(--text);border:1px solid var(--line);border-radius:10px;padding:.4rem .7rem;cursor:pointer}
button:hover{border-color:var(--accent);color:var(--accent)}
footer{margin-top:1.2rem;color:var(--muted);font-size:.78rem}
</style>
</head>
<body>
<main class="wrap">
  <header>
    <h1>EDGE-GROK operator</h1>
    <p class="sub">Secretária de operação · lab only · torch stays on the desk until gates pass</p>
    <div class="badges" id="badges"></div>
    <button type="button" id="reload">Refresh / Atualizar</button>
  </header>
  <div class="grid" style="margin-top:1rem">
    <section class="card" id="ident"></section>
    <section class="card" id="torch"></section>
  </div>
  <section class="card" style="margin-top:.85rem" id="probes"></section>
  <section class="card" style="margin-top:.85rem" id="autos"></section>
  <div class="grid" style="margin-top:.85rem">
    <section class="card" id="aiops"></section>
    <section class="card" id="integ"></section>
  </div>
  <section class="card" style="margin-top:.85rem" id="prs"></section>
  <footer id="foot"></footer>
</main>
<script id="boot" type="application/json">${payload}</script>
<script>
function token(){
  try { return localStorage.getItem("sm_token") || localStorage.getItem("token") || ""; } catch(e){ return ""; }
}
function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;"}[c])); }
function yn(ok){ return ok ? '<span class="ok">ok</span>' : '<span class="bad">degraded</span>'; }
function render(b){
  const id = b.identity || {};
  const t = b.torch || {};
  const lang = (navigator.language||"").toLowerCase().startsWith("pt");
  const L = lang
    ? {ident:"Identidade", torch:"Tocha / handoff", probes:"Sondas ao vivo", autos:"Automações (mesa)", aiops:"AIOps", integ:"Integrações", prs:"PRs abertos", keep:"Não passar a tocha"}
    : {ident:"Identity", torch:"Torch / handoff", probes:"Live probes", autos:"Automations (desk)", aiops:"AIOps", integ:"Integrations", prs:"Open PRs", keep:"Do not pass torch"};
  const badges = document.getElementById("badges");
  const decision = t.decision || "do_not_pass_torch";
  badges.innerHTML =
    '<span class="badge lab">lab</span>' +
    '<span class="badge">' + esc(b.version||"") + '</span>' +
    '<span class="badge">' + esc(id.kind||"user") + ' · ' + esc(id.status||"") + '</span>' +
    '<span class="badge ' + (t.ready_to_pass ? "ok" : "bad") + '">' + esc(decision) + '</span>';
  document.getElementById("ident").innerHTML = "<h2>"+L.ident+"</h2>" +
    "<p><code>"+esc(id.node_id)+"</code> · fog <code>"+esc(id.fog)+"</code></p>" +
    "<p>agent <code>"+esc(id.agent && id.agent.email)+"</code> · kind=<code>"+esc(id.kind)+"</code> · not_sca · clearance <code>"+esc(id.clearance)+"</code></p>" +
    "<p>caller <code>"+esc(id.caller && id.caller.email)+"</code> ("+esc(id.caller && id.caller.type)+" / "+esc(id.caller && id.caller.role)+")</p>";
  const gates = (t.gates||[]).map(g => "<tr><td><code>"+esc(g.key)+"</code></td><td>"+(g.met?'<span class="ok">met</span>':'<span class="bad">unmet</span>')+"</td><td>"+esc(g.detail)+"</td></tr>").join("");
  const hh = t.last_handoff || {};
  document.getElementById("torch").innerHTML = "<h2>"+L.torch+"</h2>" +
    "<p><strong class='"+(t.ready_to_pass?"ok":"bad")+"'>"+esc(t.ready_to_pass? "ready_to_pass" : L.keep)+"</strong></p>" +
    "<p class='mono'>"+esc(t.reason||"")+"</p>" +
    "<p>owner_now: <code>"+esc(t.owner_now && t.owner_now.id)+"</code> → target <code>"+esc(t.owner_target && t.owner_target.orchestrator)+"</code> + AIOps team (not grok@ SCA)</p>" +
    "<p>capability orch=<code>"+esc(t.capability && t.capability.orchestrator)+"</code> aiops=<code>"+esc(t.capability && t.capability.aiops)+"</code> · blocked_unless <code>"+esc(t.handoff_blocked_unless)+"</code></p>" +
    "<p>last handoff: "+(hh.ok? ("<code>"+esc(hh.schema)+"</code> · "+esc(hh.posture)+" · "+esc(hh.headline)) : ("<span class='bad'>"+esc(hh.error||"missing")+"</span>"))+"</p>" +
    "<p>next_actions: <code>"+esc(JSON.stringify(t.next_actions||[]))+"</code></p>" +
    "<table><tr><th>gate</th><th></th><th></th></tr>"+gates+"</table>";
  const probes = b.probes || {};
  const rows = Object.keys(probes).map(k => {
    const p = probes[k] || {};
    return "<tr><td class='mono'>"+esc(k)+"</td><td>"+yn(p.ok)+"</td><td>"+esc(p.http!=null?p.http:(p.error||""))+"</td><td class='mono'>"+esc((p.ms!=null?p.ms+"ms ":"")+(p.url||""))+"</td></tr>";
  }).join("");
  const gp = b.gossip_peers || {};
  const gb = b.gossip_via_binding || gp;
  const gpub = b.gossip_via_public || {};
  const peerLine = (gp.peers||[]).map(p => esc(p.id)+"/"+esc(p.status)).join(", ") || "(none from probe)";
  const bindLine = (gb.peers||[]).map(p => esc(p.id)+"/"+esc(p.status)).join(", ") || "(none)";
  const pubLine = (gpub.peers||[]).map(p => esc(p.id)+"/"+esc(p.status)).join(", ") || "(none)";
  document.getElementById("probes").innerHTML = "<h2>"+L.probes+"</h2>" +
    "<p>Gossip peers (from live probe only, never invented): <code>"+peerLine+"</code> · count="+esc(gp.count)+"</p>" +
    "<p>gossip_via_binding (<code>"+esc(gb.via||"service:GOSSIP")+"</code>): <code>"+bindLine+"</code></p>" +
    "<p>gossip_via_public (<code>"+esc(gpub.via||"public")+"</code>): <code>"+pubLine+"</code></p>" +
    "<p>Oracle VM: <span class='warn'>not live</span> · <code>fog.calhegasmorais.pt</code> A0 HOLD</p>" +
    "<table><tr><th>probe</th><th></th><th>http</th><th>url</th></tr>"+rows+"</table>";
  const autos = (b.automations && b.automations.automations) || [];
  document.getElementById("autos").innerHTML = "<h2>"+L.autos+"</h2>" +
    "<p>runner=<code>STRATAGROK desk</code> · worker_crons=[] · status=desk_owned · train_if_unready · not internalized</p>" +
    "<p>Public ops pulse: <a href=\"https://stratamesh.discourse.group/t/20\" target=\"_blank\" rel=\"noopener\">stratamesh.discourse.group/t/20</a> · 18:00 writes only to t/20 · do not invent extra threads</p>" +
    "<table><tr><th>name</th><th>cron</th><th>orch</th><th>aiops</th><th>train</th></tr>" +
    autos.map(a => "<tr><td>"+esc(a.name)+"<br><span class='mono'>"+esc(a.cron)+" "+esc(a.timezone)+"</span></td><td class='mono'>"+esc(a.status)+"</td><td class='bad'>"+esc(a.capability && a.capability.orchestrator)+"</td><td class='bad'>"+esc(a.capability && a.capability.aiops)+"</td><td>"+esc(a.training_item && a.training_item.aiops_must_grow)+"</td></tr>").join("") +
    "</table>";
  const ai = b.aiops || {};
  const sm = ai.summary || {};
  document.getElementById("aiops").innerHTML = "<h2>"+L.aiops+"</h2>" +
    "<p>"+yn(ai.ok)+" · critical=<code>"+esc(sm.critical)+"</code> warn=<code>"+esc(sm.warn)+"</code> info=<code>"+esc(sm.info)+"</code></p>" +
    "<p>"+esc(ai.headline||"")+"</p>";
  const ig = b.integrations || {};
  document.getElementById("integ").innerHTML = "<h2>"+L.integ+"</h2>" +
    "<p>"+yn(ig.ok)+" · count="+esc(ig.count)+"</p>" +
    "<ul>"+(ig.integrations||[]).map(x => "<li><code>"+esc(x.id)+"</code> "+esc(x.status)+" · "+esc(x.base_url||"")+"</li>").join("")+"</ul>";
  const pr = b.github_pulls || {};
  document.getElementById("prs").innerHTML = "<h2>"+L.prs+"</h2>" +
    (pr.ok
      ? ("<p>count="+esc(pr.count)+"</p><ul>"+(pr.pulls||[]).map(p => "<li><a href='"+esc(p.html_url)+"' target='_blank' rel='noopener'>#"+esc(p.number)+"</a> "+esc(p.title)+" <span class='muted'>("+esc(p.head)+")</span></li>").join("")+"</ul>")
      : ("<p class='bad'>degraded · "+esc(pr.error||pr.http)+"</p>"));
  document.getElementById("foot").textContent = (id.node_id||"")+" · "+(b.version||"")+" · "+(b.timestamp||"");
}
async function refresh(){
  const t = token();
  const hdrs = { Accept: "application/json" };
  if (t) hdrs.Authorization = "Bearer " + t;
  const r = await fetch("/internal/v1/posture", { headers: hdrs });
  if (r.status === 401) { location.reload(); return; }
  const b = await r.json();
  render(b);
}
const boot = JSON.parse(document.getElementById("boot").textContent);
render(boot);
document.getElementById("reload").onclick = () => refresh().catch(e => alert(String(e)));
</script>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: {
      ...corsOps(request),
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

async function handleOps(request, env, url, path) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return opsJson(request, { error: "method_not_allowed" }, 405);
  }
  const auth = await requireOperator(request, env);
  const accept = (request.headers.get("Accept") || "").toLowerCase();
  const wantHtml = accept.includes("text/html");
  const wantJson = accept.includes("application/json") && !wantHtml;

  if (path === "/ops") {
    if (!auth.ok) {
      if (wantJson) {
        return opsJson(request, { error: auth.error || "auth_required", login: LOGIN_URL }, auth.status || 401);
      }
      return opsHintPage(request, auth);
    }
    const bundle = await buildPosture(env, auth.me);
    if (wantJson || url.searchParams.get("format") === "json") return opsJson(request, bundle);
    return opsDashPage(request, bundle);
  }

  if (!auth.ok) {
    return opsJson(request, { error: auth.error || "auth_required", login: LOGIN_URL }, auth.status || 401);
  }

  if (path === "/internal/v1" || path === "/internal") {
    return opsJson(request, {
      lab: true,
      version: VERSION,
      paths: ["/ops", "/internal/v1/identity", "/internal/v1/posture", "/internal/v1/automations", "/internal/v1/torch"],
    });
  }
  if (path === "/internal/v1/identity") return opsJson(request, deskIdentity(auth.me));
  if (path === "/internal/v1/posture") return opsJson(request, await buildPosture(env, auth.me));
  if (path === "/internal/v1/torch") {
    const probes = await runProbes(env);
    return opsJson(request, evaluateTorch(probes));
  }
  if (path === "/internal/v1/automations") {
    const probes = await runProbes(env);
    const torch = evaluateTorch(probes);
    return opsJson(request, automationsCatalog(torch, probes));
  }
  return opsJson(request, { error: "not_found", try: ["/ops", "/internal/v1/identity", "/internal/v1/posture", "/internal/v1/automations", "/internal/v1/torch"] }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    if (request.method === "OPTIONS") {
      if (path === "/ops" || path.startsWith("/internal")) {
        return new Response(null, { status: 204, headers: corsOps(request) });
      }
      return new Response(null, { headers: CORS });
    }
    if (path === "/ops" || path.startsWith("/internal")) {
      return handleOps(request, env, url, path);
    }

    // --- Crawler / discovery (fast, no upstream) ---
    if (path === "/robots.txt") return text(robotsTxt());
    if (path === "/llms.txt" || path === "/LLMs.txt") return text(llmsTxt());
    if (path === "/openapi.json" || path === "/api/openapi.json") return json(openApi(), 200, { cache: "public, max-age=300" });
    if (path === "/sitemap.xml") return text(sitemapXml(), "application/xml; charset=utf-8");
    if (path === "/.well-known/security.txt" || path === "/security.txt") return text(securityTxt());
    if (path === "/.well-known/agent-catalog.json" || path === "/agent-catalog.json") {
      return json(agentCatalog(), 200, { cache: "public, max-age=120" });
    }
    if (path === "/.well-known/ai-plugin.json") {
      return json({
        schema_version: "v1",
        name_for_human: "EDGE-GROK StrataMesh Lab",
        name_for_model: "stratamesh_edge_grok",
        description_for_human: "Lab edge automation desk and voluntary contributor integration.",
        description_for_model:
          "Read /llms.txt and /openapi.json. Public lab only. Install contributor edges via AGENT-EDGE-SDK. Never invent mesh peers or request secrets.",
        auth: { type: "none" },
        api: { type: "openapi", url: ORIGIN_CANON + "/openapi.json" },
        logo_url: ORIGIN_CANON + "/health",
        contact_email: AGENT_MAIL,
        legal_info_url: ORIGIN_CANON + "/.well-known/security.txt",
      }, 200, { cache: "public, max-age=300" });
    }

    if (path === "/health" || path === "/api/health") {
      return json({
        status: "ok",
        service: "stratamesh-edge-grok",
        ...identity({ live: true }),
        discovery: {
          llms_txt: "/llms.txt",
          openapi: "/openapi.json",
          catalog: "/.well-known/agent-catalog.json",
        },
        timestamp: new Date().toISOString(),
      }, 200, { cache: "no-store" });
    }

    if (path === "/ping-fog" || path === "/link") {
      const fog = await probeBound(env, "STATUS", "https://status/");
      return json({ edge: EDGE_ID, fog, linked: !!(fog && fog.ok) }, 200, { cache: "no-store" });
    }

    if (path === "/mesh/activate" || path === "/gossip/sync") {
      const sync = await syncWithFog(env, url.searchParams.get("reason") || "mesh_activate");
      const peers = await probeBound(env, "GOSSIP", "https://calhegasmorais.pt/api/v1/gossip/peers");
      const edgeListed =
        peers.ok &&
        Array.isArray(peers.data && peers.data.peers) &&
        peers.data.peers.some((p) => p && p.id === EDGE_ID);
      return json({
        ok: !!(sync && sync.ok),
        mesh: "lab_fog_edge_mesh_active",
        edge: EDGE_ID,
        fog: FOG_ID,
        sync,
        edge_listed: edgeListed,
        peers: peers.data || null,
        timestamp: new Date().toISOString(),
      }, 200, { cache: "no-store" });
    }

    if (path === "/mesh" || path === "/mesh/status") {
      const st = await buildStatus(env);
      return json({ mesh: st.mesh, linked: st.linked, identity: identity({ live: true }), discovery: st.discovery }, 200, { cache: "no-store" });
    }

    if (path === "/gossip/ingest" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const hash = await sha256Hex(JSON.stringify({ from: body.creator || "unknown", at: new Date().toISOString(), body }));
      return json({ ok: true, edge: EDGE_ID, received_hash: hash }, 200, { cache: "no-store" });
    }

    if (path === "/register" && request.method === "POST") {
      return json({
        ok: true,
        registered: identity({ endpoint: url.origin, live: true }),
        note: "Public register is descriptive only; gossip lists edges only after health-check of a public /health URL.",
      }, 200, { cache: "no-store" });
    }

    if (path === "/status" || path === "/" || path === "/lab") {
      const st = await buildStatus(env);
      if (path === "/status" || wantsJson(request, url)) return json(st, 200, { cache: "no-store" });
      return new Response(htmlPage(st), {
        headers: {
          ...CORS,
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=30",
          "X-Robots-Tag": "all",
          "Link": `</llms.txt>; rel="alternate"; type="text/plain", </openapi.json>; rel="service-desc"`,
        },
      });
    }

    return json({
      error: "not_found",
      try: ["/", "/llms.txt", "/openapi.json", "/health", "/status", "/mesh", "/.well-known/agent-catalog.json"],
    }, 404);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(syncWithFog(env, "cron_heartbeat"));
  },
};
