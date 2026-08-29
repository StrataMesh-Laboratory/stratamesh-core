/**
 * AMCM ENI — DeoMail (Cloudflare Worker)
 * From: noreply@eni.calhegasmorais.pt
 * Layout kinds: 2fa · briefing · update · invite · reset · register · system
 */
const VERSION = "1.4.5-fingerprint-free";
const API_BASE = "https://api.deomail.com/v1";
const DEFAULT_FROM = "noreply@eni.calhegasmorais.pt";

const T = {
  bg: "#0a0a0b",
  card: "#111113",
  fg: "#e8e6e3",
  muted: "#9a9790",
  accent: "#c4b5a0",
  line: "#1c1c1f",
  ok: "#6b8f71",
  action: "#c47a3a",
  critical: "#b33a2a",
  watch: "#c4a017",
};

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "\u0026amp;")
    .replace(/</g, "\u0026lt;")
    .replace(/>/g, "\u0026gt;")
    .replace(/"/g, "\u0026quot;");
}

function isEn(lang) {
  return String(lang || "").toLowerCase().startsWith("en");
}

function copy(lang) {
  const en = isEn(lang);
  return {
    en,
    node: en ? "Calhegas Morais Node" : "Nó Calhegas Morais",
    brand: "AMCM ENI · StrataMesh",
    fog: "FOG-NODE-PT-CM-001",
    orch: en
      ? "Orchestrator · SCA appointment on this Fog"
      : "Orquestrador · cargo SCA neste Fog",
    footer: en
      ? "Automated message from the Node. Human ENI contact: geral@eni.calhegasmorais.pt · +44 7404 796458."
      : "Mensagem automática do Nó. Contacto humano da ENI: geral@eni.calhegasmorais.pt · +44 7404 796458.",
    ignore: en
      ? "If you did not request this, ignore the message. The code expires in 10 minutes."
      : "Se não solicitou isto, ignore a mensagem. O código caduca em 10 minutos.",
    valid: en ? "Valid 10 minutes · one use" : "Válido 10 minutos · uma utilização",
    portal: "https://calhegasmorais.pt/dashboard",
    site: "https://calhegasmorais.pt/",
  };
}

function kickerFor(kind, lang) {
  const en = isEn(lang);
  const map = {
    "2fa": en ? "Verification" : "Verificação",
    staff_2fa: en ? "Staff verification" : "Verificação de pessoal",
    briefing: en ? "Daily briefing" : "Briefing diário",
    update: en ? "Node update" : "Actualização do Nó",
    invite: en ? "Set password" : "Definir palavra-passe",
    reset: en ? "Password reset" : "Redefinição de palavra-passe",
    register: en ? "Registration" : "Registo",
    system: en ? "System" : "Sistema",
  };
  return map[kind] || map.system;
}

function textToHtml(text) {
  return escapeHtml(text).replace(/\n/g, "<br/>");
}

function flagColor(flag) {
  const f = String(flag || "").toUpperCase();
  if (f === "CRITICAL") return T.critical;
  if (f === "ACTION") return T.action;
  if (f === "WATCH") return T.watch;
  if (f === "STABLE") return T.ok;
  return T.accent;
}

function sectionHtml(sec) {
  const flag = String(sec.flag || "").toUpperCase();
  const isAttn = sec.kind === "attention";
  const isHealth = sec.kind === "health";
  const accent = flag ? flagColor(flag) : T.accent;
  const kicker = sec.kicker ? `<div style="font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${accent};margin:0 0 6px;">${escapeHtml(sec.kicker)}</div>` : "";
  const titleSize = isAttn ? "20px" : isHealth ? "15px" : "18px";
  const title = sec.title ? `<div style="font-family:${isHealth ? "'IBM Plex Mono',ui-monospace,monospace" : "Georgia,'Times New Roman',serif"};font-size:${titleSize};color:${isAttn ? accent : T.fg};margin:0 0 8px;">${escapeHtml(sec.title)}</div>` : "";
  const body = sec.body ? `<div style="color:${T.fg};font-size:15px;line-height:1.6;margin:0 0 8px;">${typeof sec.body === "string" && sec.body.includes("<") ? sec.body : textToHtml(sec.body)}</div>` : "";
  let items = "";
  if (Array.isArray(sec.items) && sec.items.length) {
    items = "<table role='presentation' width='100%' cellspacing='0' cellpadding='0'>" +
      sec.items.map((it, i) =>
        `<tr><td style="padding:6px 0;color:${T.muted};font-size:13px;font-family:'IBM Plex Mono',ui-monospace,monospace;width:28px;vertical-align:top;">${String(i + 1).padStart(2, "0")}</td>` +
        `<td style="padding:6px 0;color:${T.fg};font-size:${isHealth ? "13px" : "15px"};line-height:1.5;font-family:${isHealth ? "'IBM Plex Mono',ui-monospace,monospace" : "Georgia,'Times New Roman',serif"};">${escapeHtml(it)}</td></tr>`
      ).join("") +
      "</table>";
  }
  const pad = isAttn ? "18px 14px" : "16px 0";
  const bg = isAttn ? T.bg : "transparent";
  const border = isAttn ? `border:1px solid ${accent};` : `border-top:1px solid ${T.line};`;
  return `<tr><td style="padding:${pad};${border}background:${bg};">${kicker}${title}${body}${items}</td></tr>`;
}

function ctaHtml(cta) {
  if (!cta || !cta.href) return "";
  const label = escapeHtml(cta.label || "Abrir");
  return `<tr><td style="padding:8px 0 4px;">
    <a href="${escapeHtml(cta.href)}" style="display:inline-block;padding:12px 22px;background:${T.accent};color:${T.bg};text-decoration:none;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;">${label}</a>
  </td></tr>`;
}

function codeBlock(code) {
  const digits = escapeHtml(String(code || "").replace(/\s/g, ""));
  return `<tr><td style="padding:12px 0 20px;">
    <div style="border:1px solid ${T.line};background:${T.bg};padding:22px 12px;text-align:center;">
      <div style="font-family:'IBM Plex Mono',ui-monospace,Consolas,monospace;font-size:32px;letter-spacing:0.28em;color:${T.fg};font-weight:500;">${digits}</div>
    </div>
  </td></tr>`;
}

/**
 * Editorial HTML matching calhegasmorais.pt (dark, serif brand, mono kickers).
 * kinds: 2fa | staff_2fa | briefing | update | invite | reset | register | system
 */
function eniMail(opts) {
  const c = copy(opts.lang);
  const kind = String(opts.kind || "system");
  const subject = opts.subject || c.node;
  const preheader = opts.preheader || kickerFor(kind, opts.lang) + " · " + c.fog;
  const sections = Array.isArray(opts.sections) ? opts.sections : [];
  const code = opts.code || "";
  const cta = opts.cta || null;
  const bodyText = opts.text || opts.body || "";

  let inner = "";
  if (code && (kind === "2fa" || kind === "staff_2fa" || kind === "register")) {
    inner += `<tr><td style="padding:0 0 8px;color:${T.muted};font-size:15px;line-height:1.6;">${
      c.en
        ? "Use this code to complete sign-in on the Calhegas Morais Node."
        : "Use este código para concluir a sessão no Nó Calhegas Morais."
    }</td></tr>`;
    inner += codeBlock(code);
    inner += `<tr><td style="padding:0 0 16px;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${T.muted};">${c.valid}</td></tr>`;
    inner += `<tr><td style="padding:0 0 8px;color:${T.muted};font-size:14px;line-height:1.5;">${c.ignore}</td></tr>`;
  } else if (sections.length) {
    inner += sections.map(sectionHtml).join("");
    inner += ctaHtml(cta);
  } else {
    inner += `<tr><td style="padding:4px 0 12px;color:${T.fg};font-size:15px;line-height:1.65;">${textToHtml(bodyText)}</td></tr>`;
    inner += ctaHtml(cta);
  }

  return `<!DOCTYPE html>
<html lang="${c.en ? "en-GB" : "pt-PT"}">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${T.bg};color:${T.fg};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${T.bg};padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="background:${T.card};border:1px solid ${T.line};max-width:560px;width:100%;">
        <tr><td style="padding:22px 28px;border-bottom:1px solid ${T.line};">
          <div style="font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${T.accent};">${escapeHtml(kickerFor(kind, opts.lang))}</div>
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;color:${T.fg};margin-top:6px;">${escapeHtml(c.node)}</div>
          <div style="font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${T.muted};margin-top:6px;">${c.brand} · ${c.fog}</div>
        </td></tr>
        <tr><td style="padding:28px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            ${subject ? `<tr><td style="padding:0 0 16px;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:${T.muted};">${escapeHtml(subject)}</td></tr>` : ""}
            ${inner}
          </table>
        </td></tr>
        <tr><td style="padding:18px 28px 22px;border-top:1px solid ${T.line};font-size:12px;line-height:1.55;color:${T.muted};">
          <div style="color:${T.fg};margin-bottom:6px;">${c.orch}</div>
          <a href="${c.site}" style="color:${T.accent};text-decoration:none;">calhegasmorais.pt</a>
          · <a href="https://eni.calhegasmorais.pt/" style="color:${T.accent};text-decoration:none;">eni.calhegasmorais.pt</a><br/>
          <span style="color:${T.muted};">${DEFAULT_FROM}</span>
          <div style="margin-top:10px;font-size:11px;color:${T.muted};">${c.footer}</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function formalHtml(text, subject, lang) {
  return eniMail({ kind: "system", text, subject, lang });
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
          layout: ["2fa", "briefing", "update", "invite", "reset", "register", "system"],
          endpoints: [
            "GET /health",
            "GET /status",
            "GET /preview?kind=2fa|briefing|update",
            "GET /emails?limit=&offset=&folder=",
            "GET /emails/:id",
            "GET /inbox",
            "POST /send",
            "POST /webhook",
          ],
        });
      }

      if (path === "/preview") {
        const kind = url.searchParams.get("kind") || "2fa";
        const lang = url.searchParams.get("lang") || "pt";
        const html = sampleLayout(kind, lang);
        return new Response(html, {
          headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
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
        // Fingerprint is toggled by the operator (default: off / no footer).
        // If upstream rejects, surface deomail.success/error — do not invent plan rules.
        const payload = {
          from: body.from || env.DEOMAIL_FROM || DEFAULT_FROM,
          to: toList,
          subject: String(body.subject || body.assunto).slice(0, 500),
        };
        const cc = body.cc || body.CC;
        if (cc) payload.cc = Array.isArray(cc) ? cc : [cc];
        const bcc = body.bcc || body.BCC;
        if (bcc) payload.bcc = Array.isArray(bcc) ? bcc : [bcc];
        // Free plan: DeoMail rejects fingerprint:false (FINGERPRINT_REQUIRES_PLAN).
        // Omit fingerprint fields unless explicitly true — mail still sends with default footer.
        if (body.fingerprint === true || body.disable_fingerprint === false) {
          payload.fingerprint = true;
        }
        // Do NOT set fingerprint:false or disable_fingerprint:true on free plan.

        const rawText = body.text || body.body || body.message || "";
        if (rawText) payload.text = String(rawText);
        if (body.html) {
          payload.html = String(body.html);
        } else if (body.formal !== false) {
          payload.html = eniMail({
            kind: body.kind || "system",
            lang: body.lang || body.locale || body.language || "pt",
            subject: body.subject || body.assunto || "",
            text: rawText,
            code: body.code,
            sections: body.sections,
            cta: body.cta,
            preheader: body.preheader,
          });
          if (!payload.text) payload.text = String(rawText || "");
        }
        if (!payload.text && !payload.html) payload.text = "(sem corpo)";
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

function sampleLayout(kind, lang) {
  const en = isEn(lang);
  if (kind === "2fa" || kind === "staff_2fa") {
    return eniMail({
      kind,
      lang,
      subject: en ? "Verification code" : "Código de verificação",
      code: "847291",
      preheader: en ? "Your 6-digit code" : "O seu código de 6 dígitos",
    });
  }
  if (kind === "briefing") {
    return eniMail({
      kind: "briefing",
      lang,
      subject: en ? "Daily briefing · command" : "Briefing diário · comando",
      preheader: en ? "OWNER ATTENTION: none." : "ATENÇÃO DO PROPRIETÁRIO: nenhuma.",
      sections: [
        { kicker: en ? "00 · Owner attention" : "00 · Atenção do proprietário", title: en ? "OWNER ATTENTION: none." : "ATENÇÃO DO PROPRIETÁRIO: nenhuma.", kind: "attention", flag: "STABLE", items: [en ? "No interruption this cycle." : "Nenhuma interrupção neste ciclo."] },
        { kicker: en ? "01 · Executive" : "01 · Estado executivo", title: en ? "Node STABLE · World WATCH" : "Nó STABLE · Mundo WATCH", items: [en ? "NODE STATUS: STABLE" : "NODE STATUS: STABLE", en ? "EXTERNAL ENVIRONMENT: WATCH — the world can be elevated without the Node being at risk." : "EXTERNAL ENVIRONMENT: WATCH — o mundo pode estar elevado sem o Nó estar em risco."] },
        { kicker: en ? "08 · Today's plan" : "08 · Plano de acção — hoje", title: "P0 · T-026A", items: [en ? "ACTIVE — internal Meta checklist. Completion: validated checklist." : "ACTIVE — checklist interna Meta. Critério: checklist validada."] },
        { kicker: "11 · Node health", title: "FOG-NODE-PT-CM-001", kind: "health", items: ["Fog operational · Ágora active · PdC active"] },
      ],
      cta: { label: en ? "Open portal" : "Abrir portal", href: "https://calhegasmorais.pt/dashboard" },
    });
  }
  return eniMail({
    kind: "update",
    lang,
    subject: en ? "Node update" : "Actualização do Nó",
    sections: [
      {
        kicker: en ? "Account" : "Conta",
        title: en ? "Internal floor" : "Piso interno",
        body: en
          ? "Your confirmed account stays on internal clearance. The Panel is this account’s sandbox."
          : "A sua conta confirmada permanece na clearance interna. O Painel é a sandbox desta conta.",
      },
    ],
    cta: { label: en ? "Open panel" : "Abrir painel", href: "https://calhegasmorais.pt/painel" },
  });
}
