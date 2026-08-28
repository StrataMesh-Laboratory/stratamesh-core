/**
 * stratamesh-origin-archive — last-resort staff recovery pile.
 * origin.calhegasmorais.pt  ·  AUTH_DB staff (same table as portal)  ·  R2 pile
 * Daily snapshots via GitHub Action (not a 6th CF cron). Cheap /health.
 * Version: 0.1.0-origin-archive
 */
const VERSION = "0.1.0-origin-archive";
const COOKIE = "cmn_origin_session";

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extra },
  });
}

function html(body, status = 200, extra = {}) {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", ...extra },
  });
}

function cookieSet(token) {
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`;
}
function cookieClear() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function readCookie(request) {
  const raw = request.headers.get("Cookie") || "";
  const m = raw.match(new RegExp("(?:^|; )" + COOKIE + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : "";
}

async function sha256Hex(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(s)));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function pbkdf2Match(password, stored) {
  const parts = String(stored || "").split(":");
  if (parts.length < 2) return false;
  const [salt, storedHash] = parts;
  const enc = new TextEncoder();
  const keyMat = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(salt), iterations: 100000, hash: "SHA-256" },
    keyMat,
    256
  );
  const hash = btoa(String.fromCharCode(...new Uint8Array(bits)));
  return hash === storedHash;
}

async function totpVerify(secretB32, code) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = String(secretB32 || "").toUpperCase().replace(/=+$/, "").replace(/[^A-Z2-7]/g, "");
  let bits = 0, value = 0;
  const key = [];
  for (let i = 0; i < clean.length; i++) {
    const idx = alphabet.indexOf(clean[i]);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      key.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  const keyBytes = new Uint8Array(key);
  const want = String(code || "").trim();
  if (!/^\d{6}$/.test(want)) return false;
  const cryptoKey = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  for (let w = -1; w <= 1; w++) {
    const counter = Math.floor(Date.now() / 1000 / 30) + w;
    const buf = new ArrayBuffer(8);
    const view = new DataView(buf);
    view.setUint32(0, Math.floor(counter / 0x100000000), false);
    view.setUint32(4, counter >>> 0, false);
    const hmac = new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, new Uint8Array(buf)));
    const offset = hmac[hmac.length - 1] & 0xf;
    const bin =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);
    const c = String(bin % 1000000).padStart(6, "0");
    if (c === want) return true;
  }
  return false;
}

async function issueSession(env, staffId) {
  const token = crypto.randomUUID() + "." + crypto.randomUUID();
  const token_hash = await sha256Hex(token);
  await env.AUTH_DB.prepare(
    "INSERT INTO sessions (user_id, token, token_hash, expires_at) VALUES (?, ?, ?, datetime('now', '+24 hours'))"
  ).bind(-staffId, "redacted", token_hash).run();
  return token;
}

async function resolveStaff(env, request) {
  const bearer = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const token = bearer || readCookie(request);
  if (!token) return null;
  const th = await sha256Hex(token);
  const session = await env.AUTH_DB.prepare(
    "SELECT * FROM sessions WHERE (token_hash = ? OR token = ?) AND expires_at > datetime('now')"
  ).bind(th, token).first();
  if (!session || session.user_id == null || Number(session.user_id) >= 0) return null;
  const staff = await env.AUTH_DB.prepare(
    "SELECT id, email, role, clearance_level FROM staff WHERE id = ?"
  ).bind(Math.abs(Number(session.user_id))).first();
  if (!staff) return null;
  return { token, staff };
}

function pageShell(title, inner) {
  return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet"/>
<style>
:root{--bg:#07111c;--ink:#d7e4ef;--muted:#8aa0b3;--line:#1c3348;--surface:#0c1a28;--teal:#2f9e8a;--danger:#c45c4a;--ok:#6fbf73}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--ink);font-family:"IBM Plex Sans",system-ui,sans-serif;min-height:100%}
a{color:var(--teal);text-decoration:none}a:hover{text-decoration:underline}
.wrap{max-width:44rem;margin:0 auto;padding:2rem 1.25rem 4rem}
.kicker{font-family:"IBM Plex Mono",monospace;font-size:.68rem;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}
h1{font-size:1.75rem;font-weight:600;letter-spacing:-.02em;margin:.5rem 0 0.75rem}
p,li{color:var(--muted);line-height:1.55;font-size:.95rem}
.card{background:var(--surface);border:1px solid var(--line);border-radius:.75rem;padding:1.15rem 1.2rem;margin:1rem 0}
label{display:block;font-family:"IBM Plex Mono",monospace;font-size:.68rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:0.85rem 0 .35rem}
input{width:100%;padding:.8rem .9rem;background:#07111c;border:1px solid var(--line);border-radius:.5rem;color:var(--ink);font-size:1rem}
button{margin-top:1rem;width:100%;padding:.85rem 1rem;background:transparent;border:1px solid var(--teal);color:var(--teal);border-radius:.5rem;font-family:"IBM Plex Mono",monospace;letter-spacing:.08em;text-transform:uppercase;font-size:.72rem;cursor:pointer;min-height:44px}
button:hover{background:var(--teal);color:#07111c}
.err{color:var(--danger);font-size:.88rem;min-height:1.2em}
.row{display:flex;justify-content:space-between;gap:1rem;align-items:baseline;border-bottom:1px solid var(--line);padding:.65rem 0}
.row:last-child{border-bottom:none}
.mono{font-family:"IBM Plex Mono",monospace;font-size:.78rem}
.pill{display:inline-block;border:1px solid var(--line);padding:.2rem .5rem;border-radius:999px;font-family:"IBM Plex Mono",monospace;font-size:.62rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.ok{color:var(--ok);border-color:#2a3a2c}
footer{margin-top:2rem;font-size:.75rem;color:var(--muted)}
</style>
</head>
<body><main class="wrap">${inner}</main></body></html>`;
}

function loginPage(err) {
  return pageShell(
    "Origin archive · staff",
    `<p class="kicker">origin.calhegasmorais.pt</p>
     <h1>Arquivo de recuperação</h1>
     <p>Last-resort static pile. Same staff table as the portal (email + password + 2FA). Not the public node.</p>
     <form class="card" method="post" action="/login">
       <label for="email">Staff email</label>
       <input id="email" name="email" type="email" autocomplete="username" required/>
       <label for="password">Password</label>
       <input id="password" name="password" type="password" autocomplete="current-password" required/>
       <p class="err">${err || ""}</p>
       <button type="submit">Continuar</button>
     </form>
     <p class="mono">Lab · n=1 · spa.source=lab_seed · Challenge 0 unfunded</p>`
  );
}

function twoFaPage(challenge, channel, err) {
  return pageShell(
    "Origin archive · 2FA",
    `<p class="kicker">Staff 2FA</p>
     <h1>Código de verificação</h1>
     <p>${channel === "totp" ? "Authenticator app (TOTP)." : "Código enviado por e-mail. Não é mostrado neste ecrã."}</p>
     <form class="card" method="post" action="/2fa">
       <input type="hidden" name="challenge" value="${challenge}"/>
       <label for="code">Código de 6 dígitos</label>
       <input id="code" name="code" inputmode="numeric" pattern="\\d{6}" maxlength="6" autocomplete="one-time-code" required/>
       <p class="err">${err || ""}</p>
       <button type="submit">Entrar</button>
     </form>`
  );
}

async function listPile(env) {
  const obj = env.ARCHIVE && (await env.ARCHIVE.get("pile/index.json"));
  if (obj) {
    try {
      return JSON.parse(await obj.text());
    } catch (_) {}
  }
  return { days: [], note: "empty pile — first snapshot pending" };
}

function pilePage(staff, pile) {
  const days = pile.days || [];
  const rows = days.length
    ? days
        .map(
          (d) => `<div class="row">
            <div><strong class="mono">${d.date}</strong><div class="mono">${d.sha ? d.sha.slice(0, 8) : "—"} · ${d.files || 0} files</div></div>
            <a href="/v/${d.date}/">abrir</a>
          </div>`
        )
        .join("")
    : `<p>No snapshots yet. Daily GitHub Action writes the pile after 00:20 UTC.</p>`;
  return pageShell(
    "Origin archive · pile",
    `<p class="kicker">Recovery pile</p>
     <h1>Versões anteriores</h1>
     <p>Staff <span class="mono">${staff.email}</span> · <span class="pill ok">${staff.role || "staff"}</span>
        · <a href="/logout">sair</a></p>
     <div class="card">${rows}</div>
     <p>Latest static copy: <a href="/latest/">/latest/</a> — landing, portal, laboratório. Repo zip per day when present.</p>
     <footer>Same AUTH_DB staff as the portal. No 6th cron. Fog 530 remains P1. Mesh n=1.</footer>`
  );
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/health" && request.method === "GET") {
      return json({
        ok: true,
        service: "stratamesh-origin-archive",
        version: VERSION,
        staff_gated: true,
        sixth_cron: false,
      });
    }

    if (path === "/logout") {
      return html(loginPage("Sessão encerrada."), 200, { "set-cookie": cookieClear() });
    }

    if (path === "/login" && request.method === "POST") {
      const form = await request.formData().catch(() => null);
      const email = String((form && form.get("email")) || "").trim().toLowerCase();
      const password = String((form && form.get("password")) || "");
      if (!email || !password) return html(loginPage("Email and password required."), 400);
      const staff = await env.AUTH_DB.prepare("SELECT * FROM staff WHERE lower(email) = lower(?)").bind(email).first();
      if (!staff || !staff.password_hash || !(await pbkdf2Match(password, staff.password_hash))) {
        return html(loginPage("Credenciais inválidas."), 401);
      }
      if (staff.totp_secret) {
        return html(twoFaPage("TOTP-" + staff.id, "totp"));
      }
      try {
        await env.AUTH_DB.prepare(`CREATE TABLE IF NOT EXISTS staff_otp (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          staff_id INTEGER NOT NULL,
          code TEXT NOT NULL,
          challenge TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          used INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now'))
        )`).run();
      } catch (_) {}
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const challenge = crypto.randomUUID();
      await env.AUTH_DB.prepare(
        "INSERT INTO staff_otp (staff_id, code, challenge, expires_at) VALUES (?, ?, ?, datetime('now', '+10 minutes'))"
      ).bind(staff.id, code, challenge).run();
      try {
        if (env.DEOMAIL && typeof env.DEOMAIL.fetch === "function") {
          await env.DEOMAIL.fetch(
            new Request("https://deomail.internal/send", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                from: env.MAIL_FROM || "noreply@eni.calhegasmorais.pt",
                to: staff.email,
                subject: "Nó Calhegas Morais · código 2FA (origin archive)",
                text:
                  "Mensagem automática do Nó Calhegas Morais.\n\nCódigo origin archive: " +
                  code +
                  "\nVálido 10 minutos.",
                formal: true,
                lang: "pt",
              }),
            })
          );
        }
      } catch (_) {}
      return html(twoFaPage(challenge, "email"));
    }

    if (path === "/2fa" && request.method === "POST") {
      const form = await request.formData().catch(() => null);
      const challenge = String((form && form.get("challenge")) || "");
      const code = String((form && form.get("code")) || "").trim();
      if (!challenge || !code) return html(twoFaPage(challenge, "email", "Código obrigatório."), 400);
      let staff = null;
      if (challenge.startsWith("TOTP-")) {
        const sid = parseInt(challenge.slice(5), 10);
        staff = await env.AUTH_DB.prepare("SELECT * FROM staff WHERE id = ?").bind(sid).first();
        if (!staff || !staff.totp_secret || !(await totpVerify(staff.totp_secret, code))) {
          return html(twoFaPage(challenge, "totp", "Código TOTP inválido."), 401);
        }
      } else {
        const row = await env.AUTH_DB.prepare(
          "SELECT * FROM staff_otp WHERE challenge = ? AND used = 0 AND expires_at > datetime('now') ORDER BY id DESC LIMIT 1"
        ).bind(challenge).first();
        if (!row || String(row.code) !== code) {
          return html(twoFaPage(challenge, "email", "Código inválido ou expirado."), 401);
        }
        await env.AUTH_DB.prepare("UPDATE staff_otp SET used = 1 WHERE id = ?").bind(row.id).run();
        staff = await env.AUTH_DB.prepare("SELECT * FROM staff WHERE id = ?").bind(row.staff_id).first();
      }
      if (!staff) return html(loginPage("Staff not found."), 401);
      const token = await issueSession(env, staff.id);
      return new Response(null, {
        status: 303,
        headers: { location: "/", "set-cookie": cookieSet(token) },
      });
    }

    let session = null;
    try {
      session = await resolveStaff(env, request);
    } catch (e) {
      return html(loginPage("AUTH_DB unavailable: " + String(e.message || e)), 503);
    }
    if (!session) {
      if (path === "/" || path === "/login") return html(loginPage());
      return html(loginPage("Sessão staff necessária."), 401);
    }

    if (path === "/" || path === "/pile") {
      const pile = await listPile(env);
      return html(pilePage(session.staff, pile));
    }

    if (path === "/api/pile") {
      return json({ ok: true, staff: session.staff.email, ...(await listPile(env)) });
    }

    let key = null;
    if (path === "/latest" || path === "/latest/") {
      const pile = await listPile(env);
      const latest = (pile.days || [])[0];
      if (!latest) return html(pageShell("Empty", "<p>Pile empty.</p>"), 404);
      return new Response(null, { status: 302, headers: { location: "/v/" + latest.date + "/" } });
    }
    const vm = path.match(/^\/v\/([^/]+)\/(.*)$/);
    if (vm) {
      const rest = vm[2] || "index.html";
      key = "pile/" + vm[1] + "/" + rest.replace(/^\//, "");
      if (key.endsWith("/")) key += "index.html";
    }
    if (key && env.ARCHIVE) {
      const obj = await env.ARCHIVE.get(key);
      if (!obj) {
        const alt = await env.ARCHIVE.get(key.replace(/index\.html$/, "laboratorio.html"));
        if (!alt) return html(pageShell("Missing", `<p class="mono">${key}</p><p>Not in this day's pile.</p>`), 404);
        return new Response(alt.body, { headers: { "content-type": alt.httpMetadata?.contentType || "text/html; charset=utf-8" } });
      }
      const type = obj.httpMetadata?.contentType || guessType(key);
      return new Response(obj.body, { headers: { "content-type": type, "cache-control": "private, max-age=60" } });
    }

    return html(loginPage(), 404);
  },
};

function guessType(key) {
  if (key.endsWith(".html")) return "text/html; charset=utf-8";
  if (key.endsWith(".json")) return "application/json; charset=utf-8";
  if (key.endsWith(".md")) return "text/markdown; charset=utf-8";
  if (key.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (key.endsWith(".css")) return "text/css; charset=utf-8";
  if (key.endsWith(".svg")) return "image/svg+xml";
  if (key.endsWith(".zip")) return "application/zip";
  return "application/octet-stream";
}
