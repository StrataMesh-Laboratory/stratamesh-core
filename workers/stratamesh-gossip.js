/**
 * stratamesh-gossip — Hedera-inspired gossip-about-gossip for the CMN mesh
 * Events form a local hashgraph fragment: each sync creates an event with
 * self-parent + other-parent hashes (DAG of communication history).
 * No PoW. Fan-out is opportunistic; virtual voting runs in stratamesh-consensus.
 */
const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': '*',
};
const VERSION = '2.3.11-destyle';
const NODE_ID = 'FOG-NODE-PT-CM-001';
const EDGE_GROK_ID = 'EDGE-GROK-CMN-001';
const FOG_ENDPOINT = 'https://fog.calhegasmorais.pt';
const FOG_HEALTH = FOG_ENDPOINT + '/health';
const EDGE_CUSTOM = 'https://edge.calhegasmorais.pt';

function edgeGrokUrl(env) {
  const fromEnv = env && env.EDGE_GROK_URL && String(env.EDGE_GROK_URL);
  if (fromEnv && !fromEnv.includes('workers.dev')) return fromEnv.replace(/\/$/, '');
  return EDGE_CUSTOM;
}

function callerIsEdge(request) {
  if (!request || !request.headers) return false;
  const ua = String(request.headers.get('User-Agent') || '');
  const hdr = String(request.headers.get('X-StrataMesh-Caller') || '');
  return ua.includes(EDGE_GROK_ID) || hdr === EDGE_GROK_ID;
}

async function probeFogProcess() {
  const fog = {
    id: NODE_ID,
    role: 'fog',
    lab: true,
    endpoint: FOG_ENDPOINT,
    health: FOG_HEALTH,
    substrate: 'workerd-serverless',
    oracle_vm: false,
    oracle_live: false,
    mac_live: true,
    mesh_member: true,
    n: 2,
    f_max: 0,
    note: 'Trusted Mac Fog via workerd. Public origin = macbook-server.',
  };
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 4000);
    const r = await fetch(FOG_HEALTH, {
      headers: { Accept: 'application/json', 'User-Agent': 'stratamesh-gossip' },
      signal: ac.signal,
    });
    clearTimeout(t);
    let data = null;
    try { data = await r.json(); } catch (_) {}
    fog.health_http = r.status;
    fog.health_via = 'fog_health';
    if (data) {
      if (data.node_id) fog.id = data.node_id;
      if (data.substrate) fog.substrate = data.substrate;
      if (data.version) fog.version = data.version;
      if (typeof data.oracle_live === 'boolean') fog.oracle_live = data.oracle_live;
      if (typeof data.oracle_vm === 'boolean') fog.oracle_vm = data.oracle_vm;
      if (typeof data.lab === 'boolean') fog.lab = data.lab;
      if (typeof data.mac_live === 'boolean') fog.mac_live = data.mac_live;
      if (typeof data.mesh_member === 'boolean') fog.mesh_member = data.mesh_member;
      if (typeof data.n === 'number') fog.n = data.n;
      if (data.origin) fog.origin = data.origin;
      if (data.runtime) fog.runtime = data.runtime;
      if (data.plugin) fog.plugin = data.plugin;
    }
    fog.status = r.ok ? 'live' : 'degraded';
  } catch (_) {
    fog.status = 'unreachable';
    fog.health_via = 'fog_health';
  }
  return fog;
}

async function livePeers(env, request) {
  const peers = [await probeFogProcess()];
  const edgeUrl = edgeGrokUrl(env);
  // Same /peers handler for public Host and service-binding Request URL.
  // When EDGE is the caller, fetching EDGE /health deadlocks (EDGE waits on gossip waits on EDGE).
  // Inbound request is the liveness proof — not an invented peer.
  if (callerIsEdge(request)) {
    peers.push({
      id: EDGE_GROK_ID,
      role: 'edge',
      status: 'live',
      lab: true,
      substrate: 'cloudflare-worker',
      endpoint: edgeUrl,
      health_via: 'inbound_caller',
      note: 'Caller is EDGE-GROK-CMN-001; skipped circular /health fetch.',
    });
    return peers;
  }
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 4000);
    const r = await fetch(edgeUrl.replace(/\/$/, '') + '/health', {
      headers: { Accept: 'application/json', 'User-Agent': 'stratamesh-gossip' },
      signal: ac.signal,
    });
    clearTimeout(t);
    if (r.ok) {
      let data = null;
      try { data = await r.json(); } catch (_) {}
      peers.push({
        id: (data && data.node_id) || EDGE_GROK_ID,
        role: 'edge',
        status: 'live',
        lab: true,
        n: (data && data.n) != null ? data.n : 2,
        mesh_member: (data && data.mesh_member) !== false,
        origin: data && data.origin,
        runtime: data && data.runtime,
        substrate: (data && data.origin === 'edge') ? 'workerd-serverless' : ((data && data.substrate) || 'cloudflare-worker'),
        endpoint: edgeUrl,
        version: data && data.version,
        health_http: r.status,
        health_via: 'edge_health',
      });
    }
  } catch (_) {
    // Edge down: do not list as live (anti-stub)
  }
  return peers;
}

function j(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

function wantsHtml(request) {
  const a = String(request.headers.get('Accept') || '');
  return a.includes('text/html');
}

function publicPage() {
  const body = `<!DOCTYPE html>
<html lang="pt-PT">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Gossip · v${VERSION}</title>
<style>
:root { --bg:#0a0a0b; --fg:#e8e6e3; --muted:#8a8780; --line:#1c1c1f; --acc:#c4a574; }
body { margin:0; font:16px/1.45 system-ui,sans-serif; background:var(--bg); color:var(--fg); }
main { max-width:40rem; margin:0 auto; padding:2.5rem 1.25rem 4rem; }
h1 { font-size:1.25rem; font-weight:600; }
p,li { color:var(--muted); }
a { color:var(--acc); }
code { color:var(--fg); }
.badge { display:inline-block; border:1px solid var(--line); padding:.15rem .5rem; font-size:.75rem; letter-spacing:.04em; }
</style>
</head>
<body>
<main>
<p class="badge">LAB · prerelease · not mainnet</p>
<h1>Gossip</h1>
<p>v<code>${VERSION}</code> · n=2 · mesh_member=true · f_max=0</p>
<p>Hashgraph fragment. Not aBFT. Roster is JSON (<code>/peers</code>), not this page. Fog Mac continuous · EDGE session expected.</p>
<ul>
<li><a href="/health">/health</a> JSON</li>
<li><a href="/peers">/peers</a> JSON</li>
<li><a href="/have">/have</a> IHAVE digest</li>
<li><a href="https://fog.calhegasmorais.pt/health">Fog /health</a></li>
<li><a href="https://edge.calhegasmorais.pt/health">EDGE /health</a></li>
<li><a href="https://github.com/StrataMesh-Laboratory/stratamesh-core/releases/tag/v0.5.1-lab">tag v0.5.1-lab</a></li>
</ul>
</main>
</body></html>`;
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'Access-Control-Allow-Origin': '*' },
  });
}

async function sha256Hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** In-memory ring buffer when D1 unavailable; durable when AUTH_DB / DAG_DB present */
async function storeEvent(env, event) {
  const key = `gossip:event:${event.hash}`;
  if (env.VAULT && env.VAULT.put) {
    await env.VAULT.put(key, JSON.stringify(event), { expirationTtl: 86400 * 7 });
  }
  if (env.AUTH_DB) {
    try {
      await env.AUTH_DB.prepare(
        `CREATE TABLE IF NOT EXISTS gossip_events (
          hash TEXT PRIMARY KEY, creator TEXT, self_parent TEXT, other_parent TEXT,
          txs TEXT, ts TEXT, round INTEGER, payload TEXT
        )`
      ).run();
      await env.AUTH_DB.prepare(
        `INSERT OR REPLACE INTO gossip_events (hash, creator, self_parent, other_parent, txs, ts, round, payload)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          event.hash,
          event.creator,
          event.self_parent,
          event.other_parent,
          JSON.stringify(event.transactions || []),
          event.timestamp,
          event.round || 0,
          JSON.stringify(event)
        )
        .run();
    } catch (_) {}
  }
  return event;
}

async function listIhave(env, limit = 64) {
  if (env.AUTH_DB) {
    try {
      const r = await env.AUTH_DB.prepare(
        `SELECT hash, creator, ts, round FROM gossip_events ORDER BY ts DESC LIMIT ?`
      )
        .bind(limit)
        .all();
      return (r.results || []).map((row) => ({
        hash: row.hash,
        creator: row.creator,
        ts: row.ts,
        round: row.round,
      })).filter((x) => x.hash);
    } catch (_) {}
  }
  return [];
}

async function eventsByHashes(env, hashes) {
  if (!hashes.length || !env.AUTH_DB) return [];
  const out = [];
  for (const h of hashes.slice(0, 8)) {
    try {
      const r = await env.AUTH_DB.prepare(
        `SELECT payload FROM gossip_events WHERE hash = ?`
      )
        .bind(h)
        .first();
      if (r && r.payload) out.push(JSON.parse(r.payload));
    } catch (_) {}
  }
  return out;
}

async function cachedPeersPayload(env, request) {
  const edgeCaller = callerIsEdge(request);
  const cache = caches.default;
  const cacheKey = new Request(
    'https://stratamesh-gossip.cache/peers?edge=' + (edgeCaller ? '1' : '0'),
    { method: 'GET' },
  );
  const hit = await cache.match(cacheKey);
  if (hit) {
    try {
      const data = await hit.clone().json();
      return { data, resp: hit, hit: true };
    } catch (_) {}
  }
  const peers = await livePeers(env, request);
  const data = {
    peers,
    count: peers.length,
    protocol: 'lab_fog_edge_mesh_active',
    lab: true,
    cached_sec: 60,
    note: 'Fog FOG-NODE-PT-CM-001 listed from live GET https://fog.calhegasmorais.pt/health (local-process; not status Worker; not Oracle VM). EDGE-GROK-CMN-001 listed when /health returns 200, or when the caller is EDGE itself (inbound liveness; avoids circular fetch). Local :8788 is same-host EDGE, not a second peer. /peers is cached 60s so a probe loop cannot 2× edge-grok. IHAVE is GET /have — not full /events.',
    version: VERSION,
    mesh: 'active',
  };
  const resp = j(data);
  resp.headers.set('Cache-Control', 'public, max-age=60');
  try { await cache.put(cacheKey, resp.clone()); } catch (_) {}
  return { data, resp, hit: false };
}

async function listEvents(env, limit = 32) {
  if (env.AUTH_DB) {
    try {
      const r = await env.AUTH_DB.prepare(
        `SELECT payload FROM gossip_events ORDER BY ts DESC LIMIT ?`
      )
        .bind(limit)
        .all();
      return (r.results || []).map((row) => {
        try {
          return JSON.parse(row.payload);
        } catch {
          return null;
        }
      }).filter(Boolean);
    } catch (_) {}
  }
  return [];
}

async function latestByCreator(env, creator) {
  if (env.AUTH_DB) {
    try {
      const r = await env.AUTH_DB.prepare(
        `SELECT payload FROM gossip_events WHERE creator = ? ORDER BY ts DESC LIMIT 1`
      )
        .bind(creator)
        .first();
      if (r && r.payload) return JSON.parse(r.payload);
    } catch (_) {}
  }
  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let path = url.pathname.replace(/\/+$/, '') || '/';
    const prefixes = ['/api/v1/gossip', '/gossip'];
    for (const pfx of prefixes) {
      if (path === pfx) { path = '/'; break; }
      if (path.startsWith(pfx + '/')) { path = path.slice(pfx.length) || '/'; break; }
    }
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    if (path === '/' || path === '/health') {
      if (path === '/' && wantsHtml(request)) return publicPage();
      return j({
        status: 'ok',
        service: 'stratamesh-gossip',
        version: VERSION,
        mesh: 'active',
        n: 2,
        mesh_member: true,
        f_max: 0,
        lab: true,
        pre_release: true,
        role: 'gossip-about-gossip',
        host: 'gossip.calhegasmorais.pt',
        metabolic: 'health cheap; /peers 60s cache; /have IHAVE digest (no full graph on probe)',
        parallels: {
          hedera: 'event = (ts, txs[], selfParent, otherParent, sig); history = hashgraph fragment',
          iota: 'events tip-disseminate toward non-lazy tips',
          gossipsub: 'IHAVE = hashes only; IWANT = missing payloads; D_lab=2',
        },
        endpoints: ['/health', '/peers', '/have', '/sync', '/event', '/events', '/broadcast', '/validate'],
      });
    }

    if (path === '/peers') {
      const { resp, hit } = await cachedPeersPayload(env, request);
      if (hit) {
        const h = new Headers(resp.headers);
        h.set('X-Gossip-Cache', 'HIT');
        return new Response(resp.body, { status: resp.status, headers: h });
      }
      return resp;
    }

    if (path === '/have' || (path === '/events' && (url.searchParams.has('have') || url.searchParams.get('digest') === '1'))) {
      const cache = caches.default;
      const haveRaw = String(url.searchParams.get('have') || '');
      const cacheKey = new Request(
        'https://stratamesh-gossip.cache/have?h=' + encodeURIComponent(haveRaw.slice(0, 200)),
        { method: 'GET' },
      );
      if (!haveRaw) {
        const hit = await cache.match(cacheKey);
        if (hit) {
          const h = new Headers(hit.headers);
          h.set('X-Gossip-Cache', 'HIT');
          return new Response(hit.body, { status: hit.status, headers: h });
        }
      }
      const ihave = await listIhave(env, 64);
      const known = new Set(ihave.map((x) => x.hash));
      const clientHave = haveRaw.split(',').map((s) => s.trim()).filter(Boolean);
      const want = ihave.map((x) => x.hash).filter((h) => !clientHave.includes(h)).slice(0, 8);
      const payload = {
        protocol: 'ihave',
        gossipsub: 'IHAVE/IWANT lab',
        count: ihave.length,
        ihave,
        want,
        events: haveRaw ? await eventsByHashes(env, want) : [],
        note: 'Digest only unless ?have= lists hashes to IWANT. Probe loops should hit /have not /events.',
        version: VERSION,
        lab: true,
      };
      const resp = j(payload);
      resp.headers.set('Cache-Control', 'public, max-age=60');
      if (!haveRaw) {
        try { await cache.put(cacheKey, resp.clone()); } catch (_) {}
      }
      return resp;
    }

    if (path === '/events') {
      const events = await listEvents(env, Math.min(32, Number(url.searchParams.get('limit') || 16)));
      return j({ count: events.length, events, hint: 'prefer GET /have for probes' });
    }

    if ((path === '/sync' || path === '/event' || path === '/broadcast' || path === '/gossip' || path === '/validate') && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const creator = String(body.creator || body.node_id || 'FOG-NODE-PT-CM-001');
      const peer = String(body.peer || NODE_ID);
      const selfParentEv = await latestByCreator(env, creator);
      const otherParentEv = await latestByCreator(env, peer);
      const self_parent = body.self_parent || (selfParentEv && selfParentEv.hash) || 'genesis';
      const other_parent = body.other_parent || (otherParentEv && otherParentEv.hash) || 'genesis';
      const transactions = Array.isArray(body.transactions)
        ? body.transactions
        : body.tip || body.hash || body.cid
          ? [{ type: 'tip', ref: body.tip || body.hash || body.cid }]
          : [];
      const timestamp = body.timestamp || new Date().toISOString();
      const round = Number(body.round != null ? body.round : (selfParentEv && selfParentEv.round != null ? selfParentEv.round + 1 : 0));
      const material = JSON.stringify({ creator, self_parent, other_parent, transactions, timestamp, round });
      const hash = await sha256Hex(material);
      const event = {
        hash,
        creator,
        peer_synced: peer,
        self_parent,
        other_parent,
        transactions,
        timestamp,
        round,
        signature: 'lab:' + hash.slice(0, 16),
        model: 'gossip_about_gossip',
      };
      await storeEvent(env, event);
      // Notify live edge (best-effort mesh push)
      let edge_push = null;
      if (callerIsEdge(request)) {
        edge_push = { ok: true, skipped: 'inbound_caller', note: 'Caller is EDGE; skipped circular /gossip/ingest' };
      } else {
        try {
          const edgeUrl = edgeGrokUrl(env);
          const pr = await fetch(edgeUrl.replace(/\/$/, '') + '/gossip/ingest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'User-Agent': 'stratamesh-gossip' },
            body: JSON.stringify({ creator: NODE_ID, event, mesh: 'lab_fog_edge_mesh_active' }),
          });
          edge_push = { ok: pr.ok, http: pr.status };
        } catch (e) {
          edge_push = { ok: false, error: String(e) };
        }
      }
      return j({
        ok: true,
        event,
        edge_push,
        fanout: (await cachedPeersPayload(env, request)).data.peers.map((p) => p.id).filter((p) => p !== creator).slice(0, 4),
        note: 'Hashgraph fragment event recorded; virtual voting in stratamesh-consensus',
      });
    }

    return j({ error: 'Not found', endpoints: ['/health', '/peers', '/have', '/sync', '/events'] }, 404);
  },
};
