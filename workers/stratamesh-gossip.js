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
const VERSION = '2.3.1-inbound-edge';
const NODE_ID = 'FOG-NODE-PT-CM-001';
const EDGE_GROK_ID = 'EDGE-GROK-CMN-001';

function callerIsEdge(request) {
  if (!request || !request.headers) return false;
  const ua = String(request.headers.get('User-Agent') || '');
  const hdr = String(request.headers.get('X-StrataMesh-Caller') || '');
  return ua.includes(EDGE_GROK_ID) || hdr === EDGE_GROK_ID;
}

async function livePeers(env, request) {
  const peers = [
    { id: NODE_ID, role: 'fog', status: 'live', lab: true, endpoint: 'https://status.calhegasmorais.pt/' },
  ];
  const edgeUrl = (env.EDGE_GROK_URL && String(env.EDGE_GROK_URL)) || 'https://stratamesh-edge-grok.stratamesh.workers.dev';
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
        substrate: (data && data.substrate) || 'cloudflare-worker',
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
      return j({
        status: 'ok',
        service: 'stratamesh-gossip',
        version: VERSION, mesh: 'active',
        role: 'gossip-about-gossip',
        parallels: {
          hedera: 'event = (ts, txs[], selfParent, otherParent, sig); history = hashgraph fragment',
          iota: 'events tip-disseminate toward non-lazy tips',
        },
        endpoints: ['/health', '/peers', '/sync', '/event', '/events', '/broadcast', '/validate'],
      });
    }

    if (path === '/peers') {
      const peers = await livePeers(env, request);
      return j({
        peers,
        count: peers.length,
        protocol: 'lab_fog_edge_mesh_active',
        lab: true,
        note: 'Fog FOG-NODE-PT-CM-001 always listed. EDGE-GROK-CMN-001 listed when /health returns 200, or when the caller is EDGE itself (inbound liveness; avoids circular fetch).',
        version: VERSION, mesh: 'active',
      });
    }

    if (path === '/events') {
      const events = await listEvents(env, Math.min(100, Number(url.searchParams.get('limit') || 32)));
      return j({ count: events.length, events });
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
          const edgeUrl = (env.EDGE_GROK_URL && String(env.EDGE_GROK_URL)) || 'https://stratamesh-edge-grok.stratamesh.workers.dev';
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
        fanout: (await livePeers(env, request)).map((p) => p.id).filter((p) => p !== creator).slice(0, 4),
        note: 'Hashgraph fragment event recorded; virtual voting in stratamesh-consensus',
      });
    }

    return j({ error: 'Not found', endpoints: ['/health', '/peers', '/sync', '/events'] }, 404);
  },
};
