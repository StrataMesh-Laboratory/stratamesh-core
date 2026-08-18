/**
 * AMCM ENI — DeoMail full integration (Cloudflare Worker)
 * Upstream: https://api.deomail.com/v1  · Auth: X-API-Key
 */
const VERSION = "1.2.2-i18n";
const API_BASE = "https://api.deomail.com/v1";
const DEFAULT_FROM = "noreply@eni.calhegasmorais.pt";

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formalHtml(text, subject, lang) {
  const en = String(lang || '').toLowerCase().startsWith('en');
  const body = escapeHtml(text).replace(/\n/g, '<br/>');
  const headerSub = en ? 'Calhegas Morais Node' : 'Nó Calhegas Morais';
  const headerBrand = en ? 'AMCM ENI · StrataMesh' : 'AMCM ENI · StrataMesh';
  const sigTitle = en
    ? '<strong style="color:#18181b;">Calhegas Morais Node</strong> · FOG-NODE-PT-CM-001<br/><strong style="color:#18181b;">Orchestrator</strong> (SCA · orchestration role on the Node)<br/>Automated system communications · AMCM ENI<br/>'
    : '<strong style="color:#18181b;">Nó Calhegas Morais</strong> · FOG-NODE-PT-CM-001<br/><strong style="color:#18181b;">Orquestrador</strong> (SCA · função de orquestração no Nó)<br/>Sistema automatizado de comunicações · AMCM ENI<br/>';
  const footerNote = en
    ? 'Automated message signed by the Node and the Orchestrator. For human ENI contact: geral@eni.calhegasmorais.pt · +44 7404 796458.'
    : 'Mensagem automática assinada pelo Nó e pelo Orquestrador. Para contacto humano da ENI: geral@eni.calhegasmorais.pt · +44 7404 796458.';
  return `<!DOCTYPE html>
<html lang="${en ? 'en-GB' : 'pt-PT'}">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="background:#ffffff;border:1px solid #e4e4e7;max-width:560px;">
        <tr><td style="padding:20px 28px;border-bottom:2px solid #18181b;">
          <div style="font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#52525b;">${headerSub}</div>
          <div style="font-size:18px;font-weight:bold;margin-top:4px;color:#18181b;">${headerBrand}</div>
        </td></tr>
        <tr><td style="padding:28px;font-size:15px;line-height:1.55;color:#27272a;">
          ${subject ? '<p style="margin:0 0 16px;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:#71717a;">' + escapeHtml(subject) + '</p>' : ''}
          <div>${body}</div>
        </td></tr>
        <tr><td style="padding:20px 28px;border-top:1px solid #e4e4e7;font-size:12px;line-height:1.5;color:#52525b;">
          ${sigTitle}
          <a href="https://calhegasmorais.pt/" style="color:#1d4ed8;text-decoration:none;">calhegasmorais.pt</a>
          · <a href="https://eni.calhegasmorais.pt/" style="color:#1d4ed8;text-decoration:none;">eni.calhegasmorais.pt</a><br/>
          <span style="color:#a1a1aa;">noreply@eni.calhegasmorais.pt</span>
        </td></tr>
        <tr><td style="padding:12px 28px 20px;font-size:11px;color:#a1a1aa;">
          ${footerNote}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}



function j(d, s = 200) {
  return new Response(JSON.stringify(d, null, 2), {
    status: s,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  });
}

function headers(env) {
  const key = env.DEOMAIL_API_KEY;
  if (!key) return null;
  return { "X-API-Key": key, "Content-Type": "application/json", Accept: "application/json" };
}

async function deo(env, method, path, body) {
  const h = headers(env);
  if (!h) return { ok: false, status: 503, body: { error: "deomail_not_configured" } };
  const url = path.startsWith("http") ? path : API_BASE + path;
  const r = await fetch(url, {
    method,
    headers: h,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text.slice(0, 800) };
  }
  return { ok: r.ok, status: r.status, body: parsed };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
          "Access-Control-Allow-Headers": "*",
        },
      });
    }

    try {
      if (path === "/health" || path === "/") {
        return j({
          status: "ok",
          service: "stratamesh-deomail",
          entity: "AMCM ENI",
          default_from: env.DEOMAIL_FROM || DEFAULT_FROM,
          configured: !!env.DEOMAIL_API_KEY,
          version: VERSION,
          endpoints: [
            "GET /health",
            "GET /status",
            "GET /emails?limit=&offset=&folder=",
            "GET /emails/:id",
            "GET /inbox",
            "POST /send",
            "POST /webhook",
          ],
        });
      }

      if (path === "/status") {
        const probe = await deo(env, "GET", "/emails?limit=1");
        return j({
          entity: "AMCM ENI",
          configured: !!env.DEOMAIL_API_KEY,
          default_from: env.DEOMAIL_FROM || DEFAULT_FROM,
          api_base: API_BASE,
          upstream_ok: probe.ok,
          upstream_status: probe.status,
          sample_total: probe.body?.pagination?.total ?? null,
          version: VERSION,
        });
      }

      if (path === "/emails" && request.method === "GET") {
        const limit = url.searchParams.get("limit") || "20";
        const offset = url.searchParams.get("offset") || "0";
        const folder = url.searchParams.get("folder");
        let q = `/emails?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`;
        if (folder) q += `&folder=${encodeURIComponent(folder)}`;
        const r = await deo(env, "GET", q);
        return j({ ok: r.ok, ...r.body, version: VERSION }, r.ok ? 200 : r.status);
      }

      if (path === "/inbox" && request.method === "GET") {
        const limit = url.searchParams.get("limit") || "20";
        const r = await deo(env, "GET", `/emails/inbox?limit=${encodeURIComponent(limit)}`);
        return j({ ok: r.ok, ...r.body, version: VERSION }, r.ok ? 200 : r.status);
      }

      const m = path.match(/^\/emails\/([a-f0-9-]{36})$/i);
      if (m && request.method === "GET") {
        const r = await deo(env, "GET", `/emails/${m[1]}`);
        return j({ ok: r.ok, ...r.body, version: VERSION }, r.ok ? 200 : r.status);
      }

      if (path === "/send" && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const to = body.to || body.email || body.recipient;
        const toList = Array.isArray(to) ? to : [to].filter(Boolean);
        if (!toList.length) return j({ error: "to_required" }, 400);
        if (!body.subject && !body.assunto) return j({ error: "subject_required" }, 400);
        const payload = {
          from: body.from || env.DEOMAIL_FROM || DEFAULT_FROM,
          to: toList,
          subject: String(body.subject || body.assunto).slice(0, 500),
          fingerprint: false,
          disable_fingerprint: true,
        };
        const rawText = body.text || body.body || body.message || '';
        if (rawText) payload.text = String(rawText);
        if (body.html) {
          payload.html = String(body.html);
        } else if (rawText && body.formal !== false) {
          payload.html = formalHtml(String(rawText), body.subject || body.assunto || '', body.lang || body.locale || body.language || 'pt');
          if (!payload.text) payload.text = String(rawText);
        }
        if (!payload.text && !payload.html) payload.text = '(sem corpo)';
        if (body.reply_to || body.replyTo) payload.reply_to = body.reply_to || body.replyTo;
        const r = await deo(env, "POST", "/send", payload);
        return j({ ok: r.ok, status: r.status, deomail: r.body, version: VERSION }, r.ok ? 200 : 502);
      }

      if (path === "/webhook" && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        let orch = null;
        try {
          const summary =
            body.subject || body.text || body.preview || body.email?.subject || JSON.stringify(body).slice(0, 400);
          const payload = {
            message: "Email DeoMail: " + summary,
            channel: "deomail",
            lang: "pt",
            clearance: "internal",
            deomail: body,
          };
          if (env.ORCH && typeof env.ORCH.fetch === "function") {
            const r = await env.ORCH.fetch(
              new Request("https://orch.internal/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              })
            );
            if (r.ok) orch = await r.json();
          } else {
            const r = await fetch("https://stratamesh-orchestrator.stratamesh.workers.dev/chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            if (r.ok) orch = await r.json();
          }
        } catch (e) {
          orch = { error: String(e.message || e) };
        }
        return j({ ok: true, received: true, orchestrator: !!orch, orch, version: VERSION });
      }

      return j({ error: "not_found", version: VERSION }, 404);
    } catch (e) {
      return j({ error: String(e.message || e), version: VERSION }, 500);
    }
  },
};
