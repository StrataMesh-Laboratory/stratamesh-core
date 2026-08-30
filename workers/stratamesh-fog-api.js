/**
 * api-fog.calhegasmorais.pt — MacOS Fog Node installer API
 * FOG-NODE-PT-CM-001 · lab only · secrets never stored here
 */
const VERSION = "1.0.1-v030";
const FOG_ID = "FOG-NODE-PT-CM-001";
const EDGE_ID = "EDGE-GROK-CMN-001";
const AGENT = "grok@calhegasmorais.pt";
const PRIMARY = "https://api-fog.calhegasmorais.pt";
const EDGE_API = "https://api-edge.calhegasmorais.pt";
const FOG_PUBLIC = "https://fog.calhegasmorais.pt";
const EDGE_PUBLIC = "https://edge.calhegasmorais.pt";
const GOSSIP = "https://gossip.calhegasmorais.pt";
const AUTH_APEX = "https://calhegasmorais.pt/api/auth";
const REPO = "https://github.com/StrataMesh-Laboratory/stratamesh-core";
const TAG = "v0.3.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS,HEAD",
  "Access-Control-Allow-Headers": "*",
};

const CSS =
  ":root{--bg:#0a0a0b;--fg:#e8e6e3;--muted:#8a8780;--line:#1c1c1f;--acc:#c4a574;--ok:#7aa874;--bad:#c45c54}" +
  "body{margin:0;font:16px/1.45 system-ui,sans-serif;background:var(--bg);color:var(--fg)}" +
  "main{max-width:40rem;margin:0 auto;padding:2.5rem 1.25rem 4rem}h1{font-size:1.25rem;font-weight:600}" +
  "p,li{color:var(--muted)}a{color:var(--acc)}code{color:var(--fg)}" +
  ".badge{display:inline-block;border:1px solid var(--line);padding:.15rem .5rem;font-size:.75rem;letter-spacing:.04em}" +
  "pre{white-space:pre-wrap;word-break:break-word;font-size:13px;line-height:1.4;background:#111;color:var(--fg);padding:1rem;border:1px solid var(--line)}";

function headers(type, cache = "public, max-age=30") {
  return {
    ...CORS,
    "Content-Type": type,
    "Cache-Control": cache,
    "X-Robots-Tag": "all, index, follow",
    "X-StrataMesh-Lab": "true",
    "X-StrataMesh-API": VERSION,
    "X-StrataMesh-Node": FOG_ID,
  };
}

function json(data, status = 200, cache = "public, max-age=30") {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: headers("application/json; charset=utf-8", cache),
  });
}

function text(body, status = 200, cache = "public, max-age=30") {
  return new Response(body, { status, headers: headers("text/plain; charset=utf-8", cache) });
}

function html(body, status = 200) {
  return new Response(body, { status, headers: headers("text/html; charset=utf-8", "public, max-age=30") });
}

function wantsHtml(request) {
  const a = (request.headers.get("Accept") || "").toLowerCase();
  return a.includes("text/html") && !a.includes("application/json");
}

function meta() {
  return {
    status: "ok",
    service: "stratamesh-fog-api",
    version: VERSION,
    lab: true,
    pre_testnet: true,
    not_mainnet: true,
    node_id: FOG_ID,
    linked_edge: EDGE_ID,
    n: 2,
    mesh_member: true,
    mesh_provision: true,
    f_max: 0,
    origin: "macbook",
    continuity: "continuous",
    hop: "tunnel → workerd:8788 → fog:8787",
    oracle_live: false,
    managed_by: { node_id: FOG_ID, agent: AGENT, role: "fog" },
    policy: {
      secrets_stored: false,
      secrets_accepted: false,
      github_pat: "local ~/.config/stratamesh only",
      cloudflare_token: "local ~/.config/stratamesh only",
      tunnel_token: "local ~/.config/stratamesh only",
      public_read: true,
      installer_write: "bootstrap 2FA then progress reports (no secrets)",
      workers_dev: false,
    },
  };
}

function installManifest() {
  return {
    schema: "stratamesh.fog_installer.v1",
    title: "MacOS Fog Node bootstrap",
    version: "0.3.0",
    lab: true,
    not_mainnet: true,
    node_role: "fog",
    host: PRIMARY,
    repo: REPO + ".git",
    branch: "main",
    tag: TAG,
    hop: "Internet → named tunnel → workerd :8788 → fog :8787",
    mesh: { n: 2, mesh_member: true, f_max: 0, peer: EDGE_ID, oracle_live: false },
    identity: {
      required: ["registered node_id", "email 2FA to the operator of that node"],
      endpoints: {
        challenge: PRIMARY + "/v1/bootstrap/challenge",
        verify: PRIMARY + "/v1/bootstrap/verify",
        session: PRIMARY + "/v1/bootstrap/session",
        aliases: [
          PRIMARY + "/fog/bootstrap/challenge",
          PRIMARY + "/fog/bootstrap/verify",
          PRIMARY + "/fog/bootstrap/session",
        ],
      },
    },
    local_secrets: {
      dir: "~/.config/stratamesh",
      mode: "0700 / files 0600",
      names: ["node.id", "bootstrap.token", "github.pat", "cloudflare.token", "god_api", "tunnel.token"],
      never_post_to_this_api: true,
    },
    steps: [
      "GET " + PRIMARY + "/SPEC.txt",
      "POST /v1/bootstrap/challenge {node_id, lang}",
      "Enter the 6-digit code mailed to the registered operator",
      "POST /v1/bootstrap/verify {node_id, challenge, code}",
      "Store bootstrap_token locally — never git",
      "Optional local PAT / CF token / named-tunnel token via installer pop-ups (stay on disk)",
      "Run deploy/mac-fog/FogNodeInstaller.command then FogStayAwake",
      "Runtime TUI: deploy/mac-fog/fog-tui.py (15s refresh, reboot, host stats)",
      "POST /v1/install/report {step, ok} with Authorization: Bearer <bootstrap_token>",
    ],
    apps: {
      installer: "deploy/mac-fog/apps/FogInstaller.app",
      runtime: "deploy/mac-fog/apps/FogRuntime.app",
      stay_awake: "deploy/mac-fog/apps/FogStayAwake.app",
      bootstrap_py: "deploy/mac-fog/fog-bootstrap.py",
    },
    related: {
      fog_public: FOG_PUBLIC,
      fog_health: FOG_PUBLIC + "/health",
      edge_api: EDGE_API,
      edge_public: EDGE_PUBLIC,
      gossip: GOSSIP,
      release: REPO + "/releases/tag/" + TAG,
    },
    forbidden: ["Authorization on GET", "posting ghp_/cfat_/tunnel tokens", "*.workers.dev", "claiming oracle_live or n≥3"],
  };
}

function openApiDoc(ORIGIN) {
  return {
    openapi: "3.1.0",
    info: {
      title: "api-fog StrataMesh MacOS installer",
      version: VERSION,
      description:
        "Fog Node installer API. Identity is node_id + emailed 2FA. GitHub and Cloudflare tokens stay on the Mac. Lab n=2 · mesh_member=true · f_max=0. Never send secrets.",
      contact: { email: AGENT, url: FOG_PUBLIC },
    },
    servers: [{ url: ORIGIN }, { url: PRIMARY }],
    paths: {
      "/": { get: { summary: "Index (JSON or destyle HTML by Accept)" } },
      "/health": { get: { summary: "Liveness + mesh honesty" } },
      "/v1/mesh": { get: { summary: "Live Fog / Edge / Gossip probes" } },
      "/v1/origin": { get: { summary: "Public origin lease view (from Fog /health)" } },
      "/v1/install": { get: { summary: "Installer contract / manifest" } },
      "/v1/manifest": { get: { summary: "Alias of /v1/install" } },
      "/v1/bootstrap/challenge": {
        post: {
          summary: "Mail 6-digit 2FA to the registered operator of node_id",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["node_id"],
                  properties: { node_id: { type: "string" }, lang: { type: "string", enum: ["pt", "en"] } },
                },
              },
            },
          },
        },
      },
      "/v1/bootstrap/verify": {
        post: {
          summary: "Exchange 2FA for a 24h bootstrap_token. Then GitHub/CF keys stay local.",
        },
      },
      "/v1/bootstrap/session": {
        post: { summary: "Resolve a bootstrap_token to node_id (no secrets returned)" },
      },
      "/v1/install/report": {
        post: {
          summary: "Progress ping after identity (Bearer bootstrap_token). Rejects secret fields.",
        },
      },
      "/SPEC.txt": { get: { summary: "Full plain-text spec for agents" } },
      "/llms.txt": { get: { summary: "Short LLM guide" } },
      "/openapi.json": { get: { summary: "OpenAPI 3.1" } },
    },
    security: [],
    "x-auth": "none_for_GET; bootstrap 2FA for installer; Bearer bootstrap_token for /v1/install/report",
    "x-not-present": ["OAuth", "workers.dev", "payment", "mainnet settlement", "secret storage"],
    "x-managed-by": FOG_ID,
  };
}

function fullSpecText(ORIGIN) {
  return `STRATAMESH api-fog — FULL SPECIFICATION (MacOS Fog installer)
================================================================================
Version: ${VERSION}
Primary host: ${PRIMARY}
This origin: ${ORIGIN}
Fog node: ${FOG_ID}
Linked edge: ${EDGE_ID} (${EDGE_API})
Lab / pre-testnet: true · not mainnet
Mesh honesty: n=2 · mesh_member=true · f_max=0 until n≥3 · oracle_live=false
Origin: macbook (continuous). Session EDGE is expected non-continuous.
Hop: Internet → named tunnel → workerd :8788 → fog :8787
Secrets stored here: NONE. GitHub PAT / Cloudflare API / tunnel token never leave the Mac.
workers.dev: DO NOT CALL
================================================================================

1. PURPOSE
----------
Public installer API for a hardware Fog Node (currently macOS). The operator
proves they own a lab-registered node_id via emailed 2FA, then the local
FogInstaller.app clones stratamesh-core, writes secrets to
~/.config/stratamesh (0700), installs workerd+tunnel+TUI.

This does NOT replace:
  - ${EDGE_API}  unlinked open registry + optional personal VA
  - ${AUTH_APEX} account login / KYC / staff 2FA

2. BOT/AGENT FETCH ORDER
------------------------
1) ${ORIGIN}/SPEC.txt
2) ${ORIGIN}/v1/install
3) ${ORIGIN}/llms.txt
4) ${ORIGIN}/openapi.json
5) ${ORIGIN}/health
6) ${ORIGIN}/v1/mesh

3. ENDPOINTS
------------
GET  /                         Index JSON (HTML if Accept: text/html)
GET  /health                   Liveness + mesh flags
GET  /v1/meta                  Same as health without live probes
GET  /v1/mesh                  Fog / Edge / Gossip /health probes (≤1.5s fail-open)
GET  /v1/origin                Public origin view from Fog /health
GET  /v1/install               Installer manifest
GET  /v1/manifest              Alias of /v1/install
GET  /v1/install-guide         Alias of /v1/install
POST /v1/bootstrap/challenge   {node_id, lang?} → emails 6-digit code
POST /v1/bootstrap/verify      {node_id, challenge, code} → bootstrap_token (24h)
POST /v1/bootstrap/session     {token} → {node_id, role}
POST /v1/install/report        Bearer bootstrap_token · {step, ok, note} · NO secrets
GET  /openapi.json  /SPEC.txt  /llms.txt  /README  /robots.txt

Aliases (same handlers):
  /fog/bootstrap/challenge|verify|session
  so FogInstaller / fog-bootstrap.py can set FOG_AUTH_BASE=${PRIMARY}

4. IDENTITY FLOW
----------------
curl -sS -X POST ${ORIGIN}/v1/bootstrap/challenge \\
  -H 'Content-Type: application/json' \\
  -d '{"node_id":"FOG-NODE-PT-CM-001","lang":"pt"}'

Response: {success, challenge, operator_masked, email_sent}
Unknown node_id → 404. Code is mailed via DeoMail to the registered operator.
Never returned in the JSON body.

curl -sS -X POST ${ORIGIN}/v1/bootstrap/verify \\
  -H 'Content-Type: application/json' \\
  -d '{"node_id":"FOG-NODE-PT-CM-001","challenge":"<uuid>","code":"123456"}'

Response: {success, bootstrap_token, node_id, expires_in:86400}
Store token in ~/.config/stratamesh/bootstrap.token mode 0600.

Then the installer asks (locally, osascript/getpass) for optional:
  GitHub PAT ghp_…     → ~/.config/stratamesh/github.pat
  Cloudflare API token → ~/.config/stratamesh/cloudflare.token
  Named-tunnel token   → ~/.config/stratamesh/tunnel.token
Those three are NEVER posted to ${PRIMARY}.

5. SECURITY
-----------
- GET is public
- Challenge/verify proxy to the auth worker (D1 fog_nodes + email_otp)
- Report endpoint rejects property names matching secret|password|token|api_key|pat|cfat|ghp
- Seed node FOG-NODE-PT-CM-001 is lab hardware; new node_ids are staff-issued
- Personal VA keys (smva_) belong on ${EDGE_API}, not here

6. MESH HONESTY
---------------
Lab mesh is n=2 (Mac Fog continuous + EDGE session). f_max remains 0.
Do not advertise Byzantine tolerance. Do not claim oracle_live.
Personal accounts connecting a VA stay mesh_member=false on api-edge.

7. RELATED
----------
Fog public: ${FOG_PUBLIC}
Edge API:   ${EDGE_API}
Gossip:     ${GOSSIP}
Repo:       ${REPO}
Tag:        ${TAG}

END OF SPEC
`;
}

function llmsTxt(ORIGIN) {
  return `# api-fog.calhegasmorais.pt

> MacOS Fog Node installer API. ${FOG_ID}. Lab n=2 · mesh_member=true · f_max=0.

## Prefer
- ${ORIGIN}/SPEC.txt
- ${ORIGIN}/v1/install
- ${ORIGIN}/health
- ${ORIGIN}/v1/mesh

## Identity
POST ${ORIGIN}/v1/bootstrap/challenge  {"node_id":"FOG-NODE-…","lang":"pt"}
POST ${ORIGIN}/v1/bootstrap/verify     {"node_id","challenge","code"}
GitHub PAT / Cloudflare / tunnel tokens stay on the Mac. Do not POST them.

## Not this host
Open registry + personal VA: ${EDGE_API}
Account login / KYC: ${AUTH_APEX}

## Rules
Lab only. No secrets. No *.workers.dev. oracle_live=false. n=2.
`;
}

function landingHtml(ORIGIN) {
  const spec = fullSpecText(ORIGIN).replace(/</g, "<").replace(/>/g, ">");
  return `<!DOCTYPE html>
<html lang="pt-PT">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>api-fog · Fog installer · ${VERSION}</title>
<meta name="robots" content="index,follow"/>
<link rel="canonical" href="${ORIGIN}/"/>
<style>${CSS}</style>
</head>
<body>
<main>
<p class="badge">LAB · prerelease · not mainnet</p>
<h1>FOG-NODE-PT-CM-001 · installer API</h1>
<p>v<code>${VERSION}</code> · origin=<code>macbook</code> · n=2 · mesh_member=true · f_max=0</p>
<p>MacOS FogInstaller talks here. Identity is registered <code>node_id</code> + emailed 2FA. GitHub and Cloudflare keys stay in <code>~/.config/stratamesh</code>.</p>
<ul>
<li><a href="/SPEC.txt">/SPEC.txt</a></li>
<li><a href="/v1/install">/v1/install</a></li>
<li><a href="/health">/health</a></li>
<li><a href="/v1/mesh">/v1/mesh</a></li>
<li><a href="${EDGE_API}/SPEC.txt">api-edge SPEC</a> (registry + personal VA — different host)</li>
<li><a href="${FOG_PUBLIC}/health">Fog /health</a></li>
<li><a href="${REPO}/releases/tag/${TAG}">tag ${TAG}</a></li>
</ul>
<h2>Full specification</h2>
<pre>${spec}</pre>
</main>
</body>
</html>`;
}

async function fetchJson(url, init, ms = 1500) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetch(url, {
      ...init,
      signal: ac.signal,
      headers: { Accept: "application/json", ...(init && init.headers) },
    });
    const data = await r.json().catch(() => null);
    return { ok: r.ok, http: r.status, data };
  } catch (e) {
    return { ok: false, http: 0, error: String(e.message || e).slice(0, 80), timeout: true };
  } finally {
    clearTimeout(t);
  }
}

async function probeMesh() {
  const targets = [
    { id: "fog", url: FOG_PUBLIC + "/health" },
    { id: "edge", url: EDGE_PUBLIC + "/health" },
    { id: "gossip", url: GOSSIP + "/health" },
    { id: "edge_api", url: EDGE_API + "/health" },
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

async function proxyAuth(env, request, authPath) {
  const body = await request.text();
  const headers = {
    "content-type": request.headers.get("content-type") || "application/json",
    accept: "application/json",
    "user-agent": request.headers.get("user-agent") || "stratamesh-fog-api/1",
  };
  const authz = request.headers.get("authorization");
  if (authz) headers.authorization = authz;

  async function forward(url, fetcher) {
    const r = await fetcher(url, { method: request.method, headers, body: body || undefined });
    const textBody = await r.text();
    return new Response(textBody, {
      status: r.status,
      headers: {
        ...CORS,
        "content-type": r.headers.get("content-type") || "application/json; charset=utf-8",
        "cache-control": "no-store",
        "x-stratamesh-api": VERSION,
        "x-stratamesh-auth-via": url.startsWith("https://calhegasmorais.pt") ? "apex" : "service",
      },
    });
  }

  if (env.AUTH && typeof env.AUTH.fetch === "function") {
    try {
      return await forward("https://auth.internal" + authPath, (u, init) => env.AUTH.fetch(new Request(u, init)));
    } catch (_) {}
  }
  return forward(AUTH_APEX + authPath, fetch);
}

function secretFieldError(body) {
  if (!body || typeof body !== "object") return null;
  for (const k of Object.keys(body)) {
    if (/secret|password|private_key|api_key|bearer|authorization|ghp_|cfat_|github_pat|tunnel.token|god_api/i.test(k)) {
      return "secrets not accepted — omit " + k + ". Keep GitHub/CF/tunnel tokens in ~/.config/stratamesh.";
    }
    const v = body[k];
    if (typeof v === "string" && /^(ghp_|github_pat_|cfat_|deo_live_|smva_)/i.test(v.trim())) {
      return "secret-looking value in " + k + " rejected";
    }
  }
  return null;
}

async function handleReport(env, request) {
  const authz = request.headers.get("Authorization") || "";
  const token = authz.toLowerCase().startsWith("bearer ") ? authz.slice(7).trim() : "";
  if (!token) return json({ ok: false, error: "bearer bootstrap_token required" }, 401, "no-store");

  const sessionResp = await proxyAuth(
    env,
    new Request(PRIMARY + "/v1/bootstrap/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    }),
    "/fog/bootstrap/session"
  );
  const session = await sessionResp.json().catch(() => ({}));
  if (!session.success) return json({ ok: false, error: "invalid or expired bootstrap_token" }, 401, "no-store");

  const body = await request.json().catch(() => ({}));
  const bad = secretFieldError(body);
  if (bad) return json({ ok: false, error: bad }, 400, "no-store");

  const rec = {
    node_id: session.node_id,
    role: session.role || "fog",
    step: String(body.step || body.stage || "unknown").slice(0, 80),
    ok: body.ok !== false,
    note: String(body.note || "").slice(0, 240),
    platform: String(body.platform || "macos").slice(0, 40),
    ts: new Date().toISOString(),
    lab: true,
  };
  let stored = false;
  if (env.OPS) {
    await env.OPS.put("foginst:" + rec.node_id, JSON.stringify(rec), { expirationTtl: 60 * 60 * 24 * 14 });
    stored = true;
  }
  return json({ ok: true, stored, report: rec, next: installManifest().steps }, 200, "no-store");
}

function bootstrapPath(path) {
  const map = {
    "/v1/bootstrap/challenge": "/fog/bootstrap/challenge",
    "/v1/bootstrap/verify": "/fog/bootstrap/verify",
    "/v1/bootstrap/session": "/fog/bootstrap/session",
    "/fog/bootstrap/challenge": "/fog/bootstrap/challenge",
    "/fog/bootstrap/verify": "/fog/bootstrap/verify",
    "/fog/bootstrap/session": "/fog/bootstrap/session",
    "/fog-bootstrap-challenge": "/fog/bootstrap/challenge",
    "/fog-bootstrap-verify": "/fog/bootstrap/verify",
    "/fog-bootstrap-session": "/fog/bootstrap/session",
  };
  return map[path] || null;
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    const url = new URL(request.url);
    const ORIGIN = url.hostname.startsWith("api-fog.") ? PRIMARY : PRIMARY;
    let path = url.pathname.replace(/\/+$/, "") || "/";

    if (path === "/SPEC.txt" || path === "/spec.txt" || path === "/instructions.txt") return text(fullSpecText(ORIGIN));
    if (path === "/llms.txt" || path === "/LLMs.txt") return text(llmsTxt(ORIGIN));
    if (path === "/openapi.json") return json(openApiDoc(ORIGIN));
    if (path === "/openapi.txt") return text(JSON.stringify(openApiDoc(ORIGIN), null, 2));
    if (path === "/README" || path === "/docs") return html(landingHtml(ORIGIN));
    if (path === "/robots.txt") {
      return text(`User-agent: *\nAllow: /\nAllow: /SPEC.txt\nAllow: /v1/\nAllow: /health\nSitemap: ${ORIGIN}/sitemap.xml\n`);
    }
    if (path === "/sitemap.xml") {
      const urls = ["/", "/README", "/SPEC.txt", "/llms.txt", "/openapi.json", "/health", "/v1/install", "/v1/mesh"];
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
    if (path === "/v1/install" || path === "/v1/manifest" || path === "/v1/install-guide" || path === "/install") {
      return json(installManifest());
    }
    if (path === "/v1/mesh") {
      const probes = await probeMesh();
      return json({ ok: true, ...meta(), probes, timestamp: new Date().toISOString() }, 200, "no-store");
    }
    if (path === "/v1/origin") {
      const fog = await fetchJson(FOG_PUBLIC + "/health", {}, 1500);
      const d = fog.data || {};
      return json(
        {
          ok: !!fog.ok,
          origin: d.origin || "unknown",
          mac_live: d.mac_live ?? null,
          edge_live: d.edge_live ?? null,
          n: d.n ?? 2,
          mesh_member: d.mesh_member ?? true,
          hop: d.layer || meta().hop,
          source: FOG_PUBLIC + "/health",
          fallback: "session fog-lab after 30min mac_down — reclaim via origin-take.command",
        },
        200,
        "no-store"
      );
    }

    const authPath = bootstrapPath(path);
    if (authPath && request.method === "POST") {
      if (path.includes("verify") || path.includes("challenge")) {
        const preview = await request.clone().json().catch(() => ({}));
        const bad = secretFieldError(preview);
        if (bad) return json({ ok: false, success: false, error: bad }, 400, "no-store");
      }
      return proxyAuth(env, request, authPath);
    }

    if (path === "/v1/install/report" && request.method === "POST") {
      return handleReport(env, request);
    }

    if (path === "/" || path === "/v1") {
      if (wantsHtml(request)) return html(landingHtml(ORIGIN));
      return json({
        ...meta(),
        message: "api-fog MacOS Fog Node installer — identity here, secrets stay local",
        preferred_host: PRIMARY,
        sister: { api_edge: EDGE_API, note: "open registry + personal VA; does not replace this installer" },
        installer: installManifest().identity.endpoints,
        bot_fetch_order: [ORIGIN + "/SPEC.txt", ORIGIN + "/v1/install", ORIGIN + "/health"],
        links: {
          health: ORIGIN + "/health",
          spec: ORIGIN + "/SPEC.txt",
          install: ORIGIN + "/v1/install",
          mesh: ORIGIN + "/v1/mesh",
          origin: ORIGIN + "/v1/origin",
          openapi: ORIGIN + "/openapi.json",
        },
        timestamp: new Date().toISOString(),
      });
    }

    return json(
      { error: "not_found", try: ["/SPEC.txt", "/v1/install", "/health", "/v1/bootstrap/challenge", "/v1/mesh"] },
      404,
      "no-store"
    );
  },
};
