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
const VERSION = '2.0.0-hashgraph-fragment';
const PEERS = ['FOG-NODE-PT-CM-001', 'node-2', 'node-3', 'edge-cmn-01', 'edge-cmn-02', 'scout'];

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
        version: VERSION,
        role: 'gossip-about-gossip',
        parallels: {
          hedera: 'event = (ts, txs[], selfParent, otherParent, sig); history = hashgraph fragment',
          iota: 'events tip-disseminate toward non-lazy tips',
        },
        endpoints: ['/health', '/peers', '/sync', '/event', '/events', '/broadcast', '/validate'],
      });
    }

    if (path === '/peers') {
      return j({
        peers: PEERS.map((id) => ({ id, role: id.startsWith('edge') ? 'edge' : id.includes('FOG') ? 'fog' : 'peer' })),
        protocol: 'random_gossip_sync',
      });
    }

    if (path === '/events') {
      const events = await listEvents(env, Math.min(100, Number(url.searchParams.get('limit') || 32)));
      return j({ count: events.length, events });
    }

    if ((path === '/sync' || path === '/event' || path === '/broadcast' || path === '/gossip' || path === '/validate') && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const creator = String(body.creator || body.node_id || 'FOG-NODE-PT-CM-001');
      const peer = String(body.peer || PEERS[Math.floor(Math.random() * PEERS.length)]);
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
      return j({
        ok: true,
        event,
        fanout: PEERS.filter((p) => p !== creator).slice(0, 4),
        note: 'Hashgraph fragment event recorded; virtual voting in stratamesh-consensus',
      });
    }

    return j({ error: 'Not found', endpoints: ['/health', '/peers', '/sync', '/events'] }, 404);
  },
};
