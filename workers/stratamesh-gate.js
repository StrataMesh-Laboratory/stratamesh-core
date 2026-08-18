/**
 * StrataMesh Anti-Fragility Gate (heterodox security)
 *
 * Paradigm:
 *  - Attack traffic consumes real resources (bandwidth, compute, storage pressure).
 *  - Those consumed units are absorbed into the mesh as base capacity (network gains).
 *  - Adversarial actors are NOT rewarded with STRATA mint — penalty is zero claim,
 *    not theatrical bans alone.
 *  - Network becomes richer in measured capacity from the attempt; attacker pays
 *    in work without emission.
 *
 * Endpoints:
 *  POST /observe   — classify traffic, absorb resources, flag no-mint
 *  POST /admit     — admit or absorb+deny reward
 *  GET  /absorbed  — ledger of absorbed adversarial capacity
 *  GET  /policy    — paradigm statement
 *  POST /check-mint — mint eligibility under anti-fragility
 */

const VERSION = '2.0.0-antifragile';

function j(d, s = 200) {
  return new Response(JSON.stringify(d, null, 2), {
    status: s,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' },
  });
}

async function ensure(db) {
  if (!db) return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS antifragile_events (
    id TEXT PRIMARY KEY,
    subject TEXT,
    class TEXT,
    resource_class TEXT,
    units REAL,
    absorbed INTEGER,
    strata_eligible INTEGER,
    reason TEXT,
    meta_json TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS antifragile_subjects (
    subject TEXT PRIMARY KEY,
    strikes INTEGER DEFAULT 0,
    absorbed_units REAL DEFAULT 0,
    last_class TEXT,
    no_mint_until TEXT,
    updated_at TEXT
  )`).run();
}

/** Heterodox classifiers — signals, not moral theatre */
function classify(body, headers) {
  const reasons = [];
  let score = 0; // higher = more adversarial
  const rate = Number(body.rate_per_min || body.rpm || 0);
  const fails = Number(body.failed_validates || body.auth_fails || 0);
  const size = Number(body.payload_bytes || body.size || 0);
  const pattern = String(body.pattern || body.behavior || '').toLowerCase();
  const explicit = String(body.intent || body.class || '').toLowerCase();

  if (explicit === 'attack' || explicit === 'probe' || explicit === 'exploit') {
    score += 0.5;
    reasons.push('explicit_adversarial_label');
  }
  if (rate > 120) {
    score += 0.35;
    reasons.push('high_request_rate');
  } else if (rate > 60) {
    score += 0.2;
    reasons.push('elevated_request_rate');
  }
  if (fails >= 10) {
    score += 0.3;
    reasons.push('repeated_auth_or_validate_failures');
  } else if (fails >= 3) {
    score += 0.15;
    reasons.push('auth_or_validate_failures');
  }
  if (size > 512_000) {
    score += 0.25;
    reasons.push('oversized_payload_pressure');
  }
  if (/flood|spam|sybil|bruteforce|scan|dos/.test(pattern)) {
    score += 0.4;
    reasons.push('pattern_' + pattern.slice(0, 24));
  }
  if (body.sybil_cluster || body.duplicate_identity) {
    score += 0.35;
    reasons.push('sybil_or_duplicate_identity');
  }
  if (body.forged_measurement || body.self_mint_without_receipt) {
    score += 0.45;
    reasons.push('forged_or_receiptless_mint_attempt');
  }

  const adversarial = score >= 0.35;
  // Resource conversion: attack intensity → base resource units for the mesh
  const bandwidth = Math.max(0.01, (rate || 1) * 0.02 + size / 1_000_000);
  const compute = Math.max(0.01, score * 0.5 + fails * 0.05);
  const availability = adversarial ? 0.05 : 0; // defensive observation cost absorbed as availability pressure handled

  return {
    adversarial,
    score: Math.min(1, score),
    reasons,
    absorption: {
      bandwidth: Number(bandwidth.toFixed(4)),
      compute: Number(compute.toFixed(4)),
      availability: Number(availability.toFixed(4)),
    },
  };
}

async function absorbIntoMesh(env, subject, absorption, reason) {
  const results = [];
  const poc = env.POC;
  for (const [resource_class, units] of Object.entries(absorption || {})) {
    if (!(units > 0)) continue;
    const payload = {
      resource_class,
      units,
      node_id: 'MESH-ANTIFRAGILE-ABSORB',
      meta: {
        source: 'adversarial_absorption',
        subject: subject || 'unknown',
        reason,
        note: 'Capacity pressure from adversarial traffic converted into mesh base resource — no STRATA mint to subject',
      },
    };
    try {
      let resp;
      if (poc && typeof poc.fetch === 'function') {
        resp = await poc.fetch(
          new Request('https://binding.internal/pool/contribute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        );
      } else {
        resp = await fetch('https://stratamesh-poc.stratamesh.workers.dev/pool/contribute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      const body = await resp.json().catch(() => ({}));
      results.push({ resource_class, units, ok: resp.ok, body });
    } catch (e) {
      results.push({ resource_class, units, ok: false, error: String(e.message || e).slice(0, 80) });
    }
  }
  return results;
}

async function record(db, subject, classif, absorbed_ok) {
  if (!db) return null;
  await ensure(db);
  const id = 'af_' + crypto.randomUUID().slice(0, 12);
  const units =
    (classif.absorption.bandwidth || 0) +
    (classif.absorption.compute || 0) +
    (classif.absorption.availability || 0);
  await db
    .prepare(
      `INSERT INTO antifragile_events (id, subject, class, resource_class, units, absorbed, strata_eligible, reason, meta_json, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,datetime('now'))`
    )
    .bind(
      id,
      subject || 'anonymous',
      classif.adversarial ? 'adversarial' : 'benign',
      'mixed',
      units,
      absorbed_ok ? 1 : 0,
      classif.adversarial ? 0 : 1,
      (classif.reasons || []).join(','),
      JSON.stringify(classif)
    )
    .run();

  if (classif.adversarial) {
    const until = new Date(Date.now() + 6 * 3600 * 1000).toISOString();
    await db
      .prepare(
        `INSERT INTO antifragile_subjects (subject, strikes, absorbed_units, last_class, no_mint_until, updated_at)
         VALUES (?,?,?,?,?,datetime('now'))
         ON CONFLICT(subject) DO UPDATE SET
           strikes = strikes + 1,
           absorbed_units = absorbed_units + excluded.absorbed_units,
           last_class = excluded.last_class,
           no_mint_until = excluded.no_mint_until,
           updated_at = datetime('now')`
      )
      .bind(subject || 'anonymous', 1, units, 'adversarial', until)
      .run();
  }
  return id;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const db = env.DB || env.LEDGER || env.GATE_DB;

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
          'Access-Control-Allow-Headers': '*',
        },
      });
    }

    try {
      if (path === '/health' || path === '/') {
        return j({
          status: 'ok',
          service: 'stratamesh-gate',
          role: 'antifragile-policy',
          version: VERSION,
          paradigm: 'attack_resources_absorbed_by_mesh_no_strata_to_adversary',
        });
      }

      if (path === '/policy') {
        return j({
          version: VERSION,
          paradigm: 'anti-fragility',
          principles: [
            'Adversarial traffic expends real bandwidth/compute/storage pressure',
            'Those units are converted into mesh base capacity (pool contribute under MESH-ANTIFRAGILE-ABSORB)',
            'Penalty is non-reward: no STRATA mint for adversarial subjects while flagged',
            'Network grows more resource-rich from the attempt; attacker subsidizes capacity without emission',
          ],
          not: [
            'Not pure exclusion theatre',
            'Not proof of unbreakable security',
            'Not a claim that all attacks are detectable',
          ],
        });
      }

      if ((path === '/observe' || path === '/admit') && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const subject = body.subject || body.node_id || body.account || body.ip_hash || 'anonymous';
        const classif = classify(body, request.headers);
        let absorption = [];
        if (classif.adversarial) {
          absorption = await absorbIntoMesh(env, subject, classif.absorption, classif.reasons.join(','));
        }
        const event_id = await record(db, subject, classif, absorption.some((a) => a.ok));
        return j({
          version: VERSION,
          subject,
          classification: classif,
          admitted: !classif.adversarial || body.force_observe_only,
          strata_mint_eligible: !classif.adversarial,
          mesh_absorption: absorption,
          event_id,
          penalty: classif.adversarial
            ? 'no_strata_reward_resources_absorbed_by_mesh'
            : null,
        });
      }

      if (path === '/check-mint' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const subject = body.subject || body.node_id || body.account;
        if (!subject) return j({ error: 'subject_required' }, 400);
        await ensure(db);
        let row = null;
        try {
          row = await db.prepare('SELECT * FROM antifragile_subjects WHERE subject = ?').bind(subject).first();
        } catch (_) {}
        const now = Date.now();
        const blocked =
          row &&
          row.no_mint_until &&
          new Date(row.no_mint_until).getTime() > now;
        return j({
          subject,
          eligible: !blocked,
          strikes: row ? row.strikes : 0,
          absorbed_units: row ? row.absorbed_units : 0,
          no_mint_until: row ? row.no_mint_until : null,
          policy: blocked
            ? 'Adversarial subject: resources previously absorbed by mesh; STRATA mint withheld'
            : 'eligible',
          version: VERSION,
        });
      }

      if (path === '/absorbed' || path === '/events') {
        await ensure(db);
        let events = [];
        try {
          events =
            (
              await db
                .prepare('SELECT * FROM antifragile_events ORDER BY created_at DESC LIMIT 50')
                .all()
            ).results || [];
        } catch (_) {}
        return j({ events, version: VERSION });
      }

      return j({ error: 'not_found', endpoints: ['/health', '/policy', '/observe', '/admit', '/check-mint', '/absorbed'] }, 404);
    } catch (e) {
      return j({ error: String(e.message || e), version: VERSION }, 500);
    }
  },
};
