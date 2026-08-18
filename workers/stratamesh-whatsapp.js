/**
 * AMCM ENI — WhatsApp Business integration (Meta Cloud API)
 * Number: +44 7404 796458
 *
 * Env (set in Cloudflare secrets when Meta app is linked):
 *   WA_ACCESS_TOKEN     — permanent/system user token
 *   WA_PHONE_NUMBER_ID  — Cloud API phone number id
 *   WA_VERIFY_TOKEN     — webhook verify token (you choose)
 *   WA_BUSINESS_ID      — optional WABA id
 *   ORCH                — service binding to stratamesh-orchestrator
 *   DB / LEDGER         — optional D1 for message log
 *
 * Without tokens: health + deep-links work; send/webhook return 503 with setup hints.
 */
const VERSION = '1.0.0-eni-wa';
const E164 = '447404796458';
const DISPLAY = '+44 7404 796458';
const ENTITY = 'AMCM ENI';
const WA_ME = 'https://wa.me/' + E164;

function j(d, s = 200) {
  return new Response(JSON.stringify(d, null, 2), {
    status: s,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    },
  });
}

function configured(env) {
  return !!(env.WA_ACCESS_TOKEN && env.WA_PHONE_NUMBER_ID);
}

async function ensure(db) {
  if (!db) return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS wa_messages (
    id TEXT PRIMARY KEY,
    direction TEXT,
    wa_id TEXT,
    from_e164 TEXT,
    body TEXT,
    meta_json TEXT,
    orch_reply TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`).run();
}

async function cloudSend(env, toE164, text) {
  const token = env.WA_ACCESS_TOKEN;
  const phoneId = env.WA_PHONE_NUMBER_ID;
  if (!token || !phoneId) {
    return { ok: false, error: 'wa_not_configured', hint: 'Set WA_ACCESS_TOKEN and WA_PHONE_NUMBER_ID secrets' };
  }
  const to = String(toE164 || '').replace(/\D/g, '');
  if (!to) return { ok: false, error: 'invalid_to' };
  const url = `https://graph.facebook.com/v21.0/${phoneId}/messages`;
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { preview_url: false, body: String(text || '').slice(0, 4096) },
    }),
  });
  const body = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, body };
}

async function routeToOrchestrator(env, text, from) {
  const msg = String(text || '').trim();
  if (!msg) return null;
  const payload = {
    message: msg,
    channel: 'whatsapp',
    from_e164: from,
    lang: 'pt',
    clearance: 'public',
  };
  try {
    if (env.ORCH && typeof env.ORCH.fetch === 'function') {
      const r = await env.ORCH.fetch(
        new Request('https://orch.internal/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      );
      if (r.ok) return await r.json();
    }
  } catch (_) {}
  try {
    const r = await fetch('https://stratamesh-orchestrator.stratamesh.workers.dev/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (r.ok) return await r.json();
  } catch (_) {}
  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const db = env.DB || env.LEDGER;

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
          service: 'stratamesh-whatsapp',
          entity: ENTITY,
          display_number: DISPLAY,
          e164: E164,
          wa_me: WA_ME,
          cloud_api_configured: configured(env),
          version: VERSION,
          endpoints: ['/health', '/link', '/send', '/webhook', '/status'],
        });
      }

      if (path === '/link' || path === '/deeplink') {
        const text = url.searchParams.get('text') || url.searchParams.get('msg') || '';
        const link = text ? WA_ME + '?text=' + encodeURIComponent(text) : WA_ME;
        return j({
          entity: ENTITY,
          display_number: DISPLAY,
          e164: E164,
          url: link,
          qr_hint: 'Open URL on mobile or generate QR from this link',
          version: VERSION,
        });
      }

      if (path === '/status') {
        return j({
          entity: ENTITY,
          display_number: DISPLAY,
          cloud_api_configured: configured(env),
          phone_number_id_set: !!env.WA_PHONE_NUMBER_ID,
          verify_token_set: !!env.WA_VERIFY_TOKEN,
          orchestration: 'inbound webhook → orchestrator /chat → optional auto-reply',
          setup: {
            meta: 'https://developers.facebook.com/docs/whatsapp/cloud-api',
            secrets: ['WA_ACCESS_TOKEN', 'WA_PHONE_NUMBER_ID', 'WA_VERIFY_TOKEN'],
            webhook_url: 'https://stratamesh-whatsapp.stratamesh.workers.dev/webhook',
          },
          version: VERSION,
        });
      }

      // Meta webhook verification (GET)
      if (path === '/webhook' && request.method === 'GET') {
        const mode = url.searchParams.get('hub.mode');
        const token = url.searchParams.get('hub.verify_token');
        const challenge = url.searchParams.get('hub.challenge');
        const expected = env.WA_VERIFY_TOKEN || 'amcm-eni-wa-verify';
        if (mode === 'subscribe' && token === expected && challenge) {
          return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
        }
        return j({ error: 'webhook_verify_failed' }, 403);
      }

      // Inbound messages (POST)
      if (path === '/webhook' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const entries = body.entry || [];
        const results = [];
        for (const entry of entries) {
          const changes = entry.changes || [];
          for (const ch of changes) {
            const value = ch.value || {};
            const messages = value.messages || [];
            for (const m of messages) {
              const from = m.from;
              const text = (m.text && m.text.body) || m.button?.text || m.interactive?.button_reply?.title || '';
              const mid = m.id || crypto.randomUUID();
              let orch = null;
              let reply = null;
              if (text) {
                orch = await routeToOrchestrator(env, text, from);
                const replyText =
                  (orch && (orch.reply || orch.message || orch.text)) ||
                  null;
                if (replyText && configured(env)) {
                  reply = await cloudSend(env, from, replyText);
                }
              }
              try {
                await ensure(db);
                if (db) {
                  await db
                    .prepare(
                      `INSERT INTO wa_messages (id, direction, wa_id, from_e164, body, meta_json, orch_reply, created_at)
                       VALUES (?,?,?,?,?,?,?,datetime('now'))`
                    )
                    .bind(
                      mid,
                      'in',
                      mid,
                      from,
                      text,
                      JSON.stringify(m).slice(0, 4000),
                      replyText || null
                    )
                    .run();
                }
              } catch (_) {}
              results.push({ from, text, orch: !!orch, reply_sent: !!(reply && reply.ok) });
            }
          }
        }
        return j({ ok: true, processed: results.length, results, version: VERSION });
      }

      // Outbound send (orchestrator / staff)
      if (path === '/send' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const to = body.to || body.e164 || body.phone;
        const text = body.text || body.message || body.body;
        if (!text) return j({ error: 'text_required' }, 400);
        if (!configured(env)) {
          return j(
            {
              ok: false,
              error: 'wa_not_configured',
              deeplink: WA_ME + '?text=' + encodeURIComponent(text),
              hint: 'Configure Meta Cloud API secrets to send server-side',
            },
            503
          );
        }
        const r = await cloudSend(env, to || E164, text);
        try {
          await ensure(db);
          if (db && r.ok) {
            await db
              .prepare(
                `INSERT INTO wa_messages (id, direction, wa_id, from_e164, body, meta_json, created_at)
                 VALUES (?,?,?,?,?,?,datetime('now'))`
              )
              .bind(crypto.randomUUID(), 'out', null, String(to || E164).replace(/\D/g, ''), text, JSON.stringify(r.body || {}).slice(0, 2000))
              .run();
          }
        } catch (_) {}
        return j({ ...r, version: VERSION }, r.ok ? 200 : 502);
      }

      return j({ error: 'not_found', version: VERSION }, 404);
    } catch (e) {
      return j({ error: String(e.message || e), version: VERSION }, 500);
    }
  },
};
