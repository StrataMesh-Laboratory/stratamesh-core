export default {
    async fetch(request, env, ctx) {
      const url = new URL(request.url);
      let path = url.pathname;
      // Normalize route prefixes so zone routes (/api/auth/*) match handlers (/login, /me, ...)
      if (path.startsWith('/api/auth')) {
        path = path.slice('/api/auth'.length) || '/';
      }
      if (!path.startsWith('/')) path = '/' + path;
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json'
      };
      const PAYG_RATES = { health:0, status:0, ontology:0, nft_view:0, nft_list:0, dashboard_tick:0.001, orch_chat:0.02, spa_execute:0.05, sandbox_run:0.04, va_api:0.03, agora_order:0.01, nft_mint:0.10, nft_transfer:0.02 };
      const PAYG_FLOOR = 0.1;
      const STATIC_ACTIONS = Object.keys(PAYG_RATES).filter((k) => PAYG_RATES[k] <= 0);
      async function ensurePayg() {
        if (!env.AUTH_DB) return;
        await env.AUTH_DB.prepare(`CREATE TABLE IF NOT EXISTS payg_ledger (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          action TEXT NOT NULL,
          amount REAL NOT NULL,
          balance_after REAL,
          ts TEXT DEFAULT (datetime('now'))
        )`).run().catch(() => {});
        await env.AUTH_DB.prepare('ALTER TABLE users ADD COLUMN token_balance REAL DEFAULT 0').run().catch(() => {});
        await env.AUTH_DB.prepare('ALTER TABLE users ADD COLUMN lab_balance REAL DEFAULT 0').run().catch(() => {});
        await env.AUTH_DB.prepare('ALTER TABLE users ADD COLUMN lab_grant_at TEXT').run().catch(() => {});
        await env.AUTH_DB.prepare('ALTER TABLE staff ADD COLUMN lab_balance REAL DEFAULT 0').run().catch(() => {});
        await env.AUTH_DB.prepare('ALTER TABLE staff ADD COLUMN lab_grant_at TEXT').run().catch(() => {});
        await env.AUTH_DB.prepare(`CREATE TABLE IF NOT EXISTS lab_meta (k TEXT PRIMARY KEY, v TEXT)`).run().catch(() => {});
        try {
          const done = await env.AUTH_DB.prepare("SELECT v FROM lab_meta WHERE k = 'lstrata_reset_v1'").first();
          if (!done) {
            await env.AUTH_DB.prepare("UPDATE users SET lab_balance = 50, lab_grant_at = datetime('now')").run();
            await env.AUTH_DB.prepare("UPDATE staff SET lab_balance = 500, lab_grant_at = datetime('now')").run();
            await env.AUTH_DB.prepare("INSERT OR REPLACE INTO lab_meta (k, v) VALUES ('lstrata_reset_v1', datetime('now'))").run();
          }
        } catch (_) {}
        // New accounts after the one-shot reset: same grant (users/ACB 50, staff 500).
        try {
          await env.AUTH_DB.prepare("UPDATE users SET lab_balance = 50, lab_grant_at = datetime('now') WHERE lab_grant_at IS NULL OR TRIM(COALESCE(lab_grant_at,'')) = ''").run();
          await env.AUTH_DB.prepare("UPDATE staff SET lab_balance = 500, lab_grant_at = datetime('now') WHERE lab_grant_at IS NULL OR TRIM(COALESCE(lab_grant_at,'')) = ''").run();
        } catch (_) {}
      }
      function paygMode(bal) { return Number(bal || 0) < PAYG_FLOOR ? 'static' : 'live'; }
      function paygView(user) {
        const lab = Number(user.lab_balance != null ? user.lab_balance : 0);
        const poc = Number(user.token_balance || 0);
        const mode = paygMode(lab);
        return {
          ok: true,
          dashboard: true,
          user_id: user.id || user.user_id,
          email: user.email,
          wallet: user.strata_address || user.wallet,
          balance: lab,
          lab_balance: lab,
          poc_balance: poc,
          unit: 'L-STRATA',
          mode,
          static_only: mode === 'static',
          floor: PAYG_FLOOR,
          burn_pole: '#0',
          mint_pole: '#mint',
          burn_rates: PAYG_RATES,
          static_actions: STATIC_ACTIONS,
          note: 'PAYG burns L-STRATA (lab grant, non-transitioning). PoC STRATA is separate and only from #mint.',
        };
      }
      async function ensureAccountGraph() {
        if (!env.AUTH_DB) return;
        await env.AUTH_DB.prepare(`CREATE TABLE IF NOT EXISTS account_events (
          id TEXT PRIMARY KEY,
          user_id INTEGER,
          wallet TEXT NOT NULL,
          kind TEXT NOT NULL,
          pole TEXT,
          amount REAL DEFAULT 0,
          action TEXT,
          counterparty TEXT,
          dag_tx TEXT,
          ts TEXT DEFAULT (datetime('now'))
        )`).run().catch(() => {});
        await env.AUTH_DB.prepare('ALTER TABLE users ADD COLUMN minted_poc REAL DEFAULT 0').run().catch(() => {});
        await env.AUTH_DB.prepare('ALTER TABLE users ADD COLUMN burned_pos REAL DEFAULT 0').run().catch(() => {});
      }
      function isPoleWallet(w) {
        const a = String(w || '');
        return a === '#mint' || a === '#0' || a === 'FOG-NODE-PT-CM-001' || a === 'treasury';
      }
      async function ensureUserWallet(user) {
        if (!user) return null;
        const uid = user.id || user.user_id;
        if (user.strata_address && !isPoleWallet(user.strata_address)) return user.strata_address;
        const w = 'sm:u:' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
        await env.AUTH_DB.prepare('UPDATE users SET strata_address = ? WHERE id = ?').bind(w, uid).run();
        await ensureAccountGraph();
        const eid = 'open_' + crypto.randomUUID().slice(0, 10);
        await env.AUTH_DB.prepare(
          'INSERT INTO account_events (id, user_id, wallet, kind, pole, amount, action) VALUES (?,?,?,?,?,?,?)'
        ).bind(eid, uid, w, 'open', null, 0, 'account_open').run().catch(() => {});
        user.strata_address = w;
        return w;
      }
      async function recordAccountEvent(userId, wallet, kind, pole, amount, action, counterparty) {
        await ensureAccountGraph();
        const id = (kind || 'ev') + '_' + crypto.randomUUID().slice(0, 10);
        await env.AUTH_DB.prepare(
          'INSERT INTO account_events (id, user_id, wallet, kind, pole, amount, action, counterparty) VALUES (?,?,?,?,?,?,?,?)'
        ).bind(id, userId, wallet, kind, pole || null, amount || 0, action || null, counterparty || null).run().catch(() => {});
        return id;
      }
      async function lifecycleView(user) {
        await ensureAccountGraph();
        const wallet = await ensureUserWallet(user);
        const uid = user.id || user.user_id;
        const minted = Number(user.minted_poc || 0);
        const burned = Number(user.burned_pos || 0);
        const bal = Number(user.token_balance || 0);
        let events = [];
        try {
          const rows = await env.AUTH_DB.prepare(
            'SELECT id, kind, pole, amount, action, counterparty, ts FROM account_events WHERE user_id = ? ORDER BY ts DESC LIMIT 50'
          ).bind(uid).all();
          events = (rows && rows.results) || [];
        } catch (_) {}
        return {
          ok: true,
          user_id: uid,
          email: user.email,
          wallet,
          minted_from_mint: minted,
          burned_to_zero: burned,
          circulating: bal,
          mode: paygMode(bal),
          static_only: paygMode(bal) === 'static',
          dashboard: true,
          poles: { mint: '#mint', burn: '#0' },
          node_treasury: 'FOG-NODE-PT-CM-001',
          citizen: true,
          events,
          note: 'Individuated #mint → wallet → #0. Hire is transfer. Fog treasury is not this account.',
        };
      }

      async function ensureLoginTrustTable() {
        await env.AUTH_DB.prepare(`CREATE TABLE IF NOT EXISTS login_trust (
          email TEXT PRIMARY KEY,
          trusted_until TEXT NOT NULL,
          last_2fa_at TEXT,
          user_id INTEGER,
          kind TEXT DEFAULT 'user'
        )`).run().catch(() => {});
      }
      async function isLoginTrusted(email) {
        return false;
      }
      async function markLoginTrusted(email, userId, kind) {
        try {
          await ensureLoginTrustTable();
          await env.AUTH_DB.prepare(
            "INSERT INTO login_trust (email, trusted_until, last_2fa_at, user_id, kind) VALUES (?, datetime('now', '+1 hour'), datetime('now'), ?, ?) ON CONFLICT(email) DO UPDATE SET trusted_until = datetime('now', '+1 hour'), last_2fa_at = datetime('now'), user_id = excluded.user_id, kind = excluded.kind"
          ).bind(String(email).toLowerCase(), userId != null ? userId : null, kind || 'user').run();
        } catch (_) {}
      }


      if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

      // --- TOTP (RFC 6238, HMAC-SHA-1) — staff app-based 2FA without npm ---
      function b32Encode(bytes) {
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        let bits = 0, value = 0, out = '';
        for (let i = 0; i < bytes.length; i++) {
          value = (value << 8) | bytes[i];
          bits += 8;
          while (bits >= 5) {
            out += alphabet[(value >>> (bits - 5)) & 31];
            bits -= 5;
          }
        }
        if (bits > 0) out += alphabet[(value << (5 - bits)) & 31];
        return out;
      }
      function b32Decode(str) {
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        const clean = String(str || '').toUpperCase().replace(/=+$/, '').replace(/[^A-Z2-7]/g, '');
        let bits = 0, value = 0;
        const out = [];
        for (let i = 0; i < clean.length; i++) {
          const idx = alphabet.indexOf(clean[i]);
          if (idx < 0) continue;
          value = (value << 5) | idx;
          bits += 5;
          if (bits >= 8) {
            out.push((value >>> (bits - 8)) & 255);
            bits -= 8;
          }
        }
        return new Uint8Array(out);
      }
      async function hmacSha1(keyBytes, msgBytes) {
        const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
        const sig = await crypto.subtle.sign('HMAC', key, msgBytes);
        return new Uint8Array(sig);
      }
      async function totpCode(secretB32, step = 30, digits = 6) {
        const key = b32Decode(secretB32);
        const counter = Math.floor(Date.now() / 1000 / step);
        const buf = new ArrayBuffer(8);
        const view = new DataView(buf);
        view.setUint32(0, Math.floor(counter / 0x100000000), false);
        view.setUint32(4, counter >>> 0, false);
        const hmac = await hmacSha1(key, new Uint8Array(buf));
        const offset = hmac[hmac.length - 1] & 0xf;
        const bin =
          ((hmac[offset] & 0x7f) << 24) |
          ((hmac[offset + 1] & 0xff) << 16) |
          ((hmac[offset + 2] & 0xff) << 8) |
          (hmac[offset + 3] & 0xff);
        const mod = 10 ** digits;
        return String(bin % mod).padStart(digits, '0');
      }
      async function totpVerify(secretB32, code, window = 1) {
        const want = String(code || '').trim();
        if (!/^\d{6}$/.test(want)) return false;
        for (let w = -window; w <= window; w++) {
          const key = b32Decode(secretB32);
          const counter = Math.floor(Date.now() / 1000 / 30) + w;
          const buf = new ArrayBuffer(8);
          const view = new DataView(buf);
          view.setUint32(0, Math.floor(counter / 0x100000000), false);
          view.setUint32(4, counter >>> 0, false);
          const hmac = await hmacSha1(key, new Uint8Array(buf));
          const offset = hmac[hmac.length - 1] & 0xf;
          const bin =
            ((hmac[offset] & 0x7f) << 24) |
            ((hmac[offset + 1] & 0xff) << 16) |
            ((hmac[offset + 2] & 0xff) << 8) |
            (hmac[offset + 3] & 0xff);
          const c = String(bin % 1000000).padStart(6, '0');
          if (c === want) return true;
        }
        return false;
      }
      async function ensureStaffTotpColumn() {
        try {
          await env.AUTH_DB.prepare('ALTER TABLE staff ADD COLUMN totp_secret TEXT').run();
        } catch (_) {}
      }


      async function sha256Hex(s) {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s)));
        return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
      }
      async function resolveSession(env, bearer) {
        const token = String(bearer || '').replace(/^Bearer\s+/i, '').trim();
        if (!token) return null;
        const th = await sha256Hex(token);
        let session = await env.AUTH_DB.prepare(
          "SELECT * FROM sessions WHERE (token_hash = ? OR token = ?) AND expires_at > datetime('now')"
        ).bind(th, token).first();
        return session || null;
      }
      async function issueSession(env, userId) {
        const token = crypto.randomUUID() + '.' + crypto.randomUUID();
        const token_hash = await sha256Hex(token);
        await env.AUTH_DB.prepare(
          "INSERT INTO sessions (user_id, token, token_hash, expires_at) VALUES (?, ?, ?, datetime('now', '+30 days'))"
        ).bind(userId, token, token_hash).run();
        return token;
      }
      async function verifyTurnstile(env, token, ip) {
        const secret = env.TURNSTILE_SECRET;
        if (!secret) return { ok: true, skipped: true, reason: 'no_secret_configured' };
        if (!token || String(token).length < 10) {
          if (env.LAB_TURNSTILE_SOFT === '1') return { ok: true, soft: true, reason: 'missing_token_lab' };
          return { ok: false, error: 'turnstile_token_required', detail: 'Complete the Turnstile check before continuing' };
        }
        try {
          const body = new URLSearchParams();
          body.set('secret', secret);
          body.set('response', String(token));
          if (ip) body.set('remoteip', ip);
          const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body,
          });
          const j = await r.json();
          if (j && j.success) return { ok: true, hostname: j.hostname };
          const codes = (j && j['error-codes']) || [];
          // Lab soft-pass for domain mismatch while widget domains propagate
          if (env.LAB_TURNSTILE_SOFT === '1') {
            // Laboratory: do not block registration/login on Turnstile edge failures
            return { ok: true, soft: true, codes: codes, hostname: j && j.hostname };
          }
          return { ok: false, error: 'turnstile_failed', codes: codes, hostname: j && j.hostname };
        } catch (e) {
          if (env.LAB_TURNSTILE_SOFT === '1') return { ok: true, soft: true, reason: 'verify_error_soft' };
          return { ok: false, error: 'turnstile_verify_error', detail: String(e.message || e) };
        }
      }

      
      // Health / diagnostic endpoint
      if (path === '/health' && request.method === 'GET') {
        const diagnostics = {
          success: true,
          timestamp: new Date().toISOString(),
          worker: 'stratamesh-auth',
          version: '2.10.5-turnstile-lab',
          checks: {}
        };
        try {
          const userCount = await env.AUTH_DB.prepare('SELECT COUNT(*) as count FROM users').first();
          diagnostics.checks.database = { status: 'ok', users: userCount?.count || 0 };
        } catch (e) {
          diagnostics.checks.database = { status: 'error', error: e.message };
        }
        try {
          const staffCount = await env.AUTH_DB.prepare('SELECT COUNT(*) as count FROM staff').first();
          diagnostics.checks.staff = { status: 'ok', count: staffCount?.count || 0 };
        } catch (e) {
          diagnostics.checks.staff = { status: 'error', error: e.message };
        }
        try {
          const sessionCount = await env.AUTH_DB.prepare("SELECT COUNT(*) as count FROM sessions WHERE expires_at > datetime('now')").first();
          diagnostics.checks.sessions = { status: 'ok', active: sessionCount?.count || 0 };
        } catch (e) {
          diagnostics.checks.sessions = { status: 'error', error: e.message };
        }
        return new Response(JSON.stringify(diagnostics), { headers: corsHeaders });
      }
      
      if (path === '/login' && request.method === 'POST') {
        try {
          const loginBody = await request.json();
          const email = String(loginBody.email || '').trim();
          const password = loginBody.password;
          const lang = resolveLang(loginBody, request);
          if (!email || !password) {
            return new Response(JSON.stringify({ success: false, error: 'Email and password required' }), { headers: corsHeaders, status: 400 });
          }
          
          const user = await env.AUTH_DB.prepare('SELECT * FROM users WHERE lower(email) = lower(?)').bind(email.toLowerCase()).first();
          if (user && user.password_hash && String(user.password_hash).includes(':') && !String(user.password_hash).includes('no_password')) {
            const [salt, storedHash] = user.password_hash.split(':');
            const enc = new TextEncoder();
            const keyMat = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
            const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' }, keyMat, 256);
            const hash = btoa(String.fromCharCode(...new Uint8Array(bits)));
            if (hash !== storedHash) {
              return new Response(JSON.stringify({ success: false, error: 'Invalid password' }), { headers: corsHeaders, status: 401 });
            }
            // 2FA trust window: successful 2FA within last hour skips new OTP
            if (await isLoginTrusted(user.email)) {
              const token = crypto.randomUUID() + crypto.randomUUID();
              const th = token; // token_hash same lab style if used
              await env.AUTH_DB.prepare(
                "INSERT INTO sessions (user_id, token, token_hash, expires_at) VALUES (?, ?, ?, datetime('now', '+30 days'))"
              ).bind(user.id, token, th).run();
              return new Response(JSON.stringify({
                success: true,
                token,
                session_token: token,
                trusted_2fa: true,
                trust_window: '1h',
                email: user.email,
                clearance: user.clearance_level || 'public',
                clearance_level: user.clearance_level || 'public',
                message: lang === 'en' ? 'Signed in (2FA trust window still valid).' : 'Sessão iniciada (janela de confiança 2FA ainda válida).',
              }), { headers: corsHeaders });
            }
            // Email 2FA for common users — code only via e-mail
            await ensureEmailOtpTable();
            const code = sixDigit();
            const challenge = crypto.randomUUID();
            await env.AUTH_DB.prepare(
              "INSERT INTO email_otp (email, user_id, code, challenge, purpose, expires_at) VALUES (?, ?, ?, ?, 'login', datetime('now', '+10 minutes'))"
            ).bind(user.email, user.id, code, challenge).run();
            const mc = mailCopy(lang, 'user_2fa', code);
            queueSystemEmail(env, ctx, user.email, mc.subject, mc.text, lang, { kind: mc.kind, code: mc.code, cta: mc.cta });
            const echo = env.LAB_OTP_ECHO === '1';
            return new Response(JSON.stringify({
              success: true,
              requires_2fa: true,
              challenge,
              channel: 'email',
              type: 'user',
              lang,
              message: lang === 'en'
                ? 'Password OK. Enter the 6-digit code from your email.'
                : 'Password OK. Introduza o código de 6 dígitos do e-mail.',
              email_sent: true,
              email: user.email,
              lab_otp: echo ? code : undefined,
            }), { headers: corsHeaders });
          }
          
          const staff = await env.AUTH_DB.prepare('SELECT * FROM staff WHERE lower(email) = lower(?)').bind(email.toLowerCase()).first();
          if (staff && staff.password_hash) {
            const parts = String(staff.password_hash).split(':');
            if (parts.length < 2) {
              return new Response(JSON.stringify({ success: false, error: 'Staff credentials misconfigured' }), { headers: corsHeaders, status: 500 });
            }
            const [saltS, storedHashS] = parts;
            const encS = new TextEncoder();
            const keyMatS = await crypto.subtle.importKey('raw', encS.encode(password), 'PBKDF2', false, ['deriveBits']);
            const bitsS = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: encS.encode(saltS), iterations: 100000, hash: 'SHA-256' }, keyMatS, 256);
            const hashS = btoa(String.fromCharCode(...new Uint8Array(bitsS)));
            if (hashS !== storedHashS) {
              return new Response(JSON.stringify({ success: false, error: lang === 'en' ? 'Invalid password' : 'Palavra-passe inválida' }), { headers: corsHeaders, status: 401 });
            }
            await ensureStaffTotpColumn();
            if (await isLoginTrusted(staff.email)) {
              const token = crypto.randomUUID() + crypto.randomUUID();
              await env.AUTH_DB.prepare(
                "INSERT INTO sessions (user_id, token, token_hash, expires_at) VALUES (?, ?, ?, datetime('now', '+30 days'))"
              ).bind(-Math.abs(staff.id), token, token).run();
              return new Response(JSON.stringify({
                success: true, token, session_token: token, type: 'staff', trusted_2fa: true,
                email: staff.email, role: staff.role, clearance: staff.clearance_level || 'INTERNAL',
                clearance_level: staff.clearance_level || 'INTERNAL',
              }), { headers: corsHeaders });
            }
            if (staff.totp_secret) {
              return new Response(JSON.stringify({
                success: true, requires_2fa: true, challenge: 'TOTP-' + staff.id, channel: 'totp', type: 'staff',
                message: lang === 'en' ? 'Enter the 6-digit code from your authenticator app.' : 'Introduza o código de 6 dígitos da app autenticadora.',
                email: staff.email, role: staff.role,
              }), { headers: corsHeaders });
            }
            await env.AUTH_DB.prepare(`CREATE TABLE IF NOT EXISTS staff_otp (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              staff_id INTEGER NOT NULL, code TEXT NOT NULL, challenge TEXT NOT NULL,
              expires_at TEXT NOT NULL, used INTEGER DEFAULT 0,
              created_at TEXT DEFAULT (datetime('now'))
            )`).run();
            const codeS = sixDigit();
            const challengeS = crypto.randomUUID();
            await env.AUTH_DB.prepare(
              "INSERT INTO staff_otp (staff_id, code, challenge, expires_at) VALUES (?, ?, ?, datetime('now', '+10 minutes'))"
            ).bind(staff.id, codeS, challengeS).run();
            const mcS = mailCopy(lang, 'staff_2fa', codeS);
            queueSystemEmail(env, ctx, staff.email, mcS.subject, mcS.text, lang, { kind: mcS.kind, code: mcS.code, cta: mcS.cta });
            return new Response(JSON.stringify({
              success: true, requires_2fa: true, challenge: challengeS, channel: 'email', type: 'staff',
              message: lang === 'en' ? 'Password OK. Enter the 6-digit code from your email.' : 'Password OK. Introduza o código de 6 dígitos do e-mail.',
              email_sent: true, email: staff.email,
            }), { headers: corsHeaders });
          }
          
          return new Response(JSON.stringify({ success: false, error: lang === 'en' ? 'User not found' : 'Utilizador não encontrado' }), { headers: corsHeaders, status: 404 });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), { headers: corsHeaders, status: 500 });
        }
      }
      



      function resolveLang(body, request) {
        const b = body || {};
        let l = b.lang || b.locale || b.language || '';
        if (!l && request) {
          const al = request.headers.get('Accept-Language') || '';
          if (al.toLowerCase().startsWith('en')) l = 'en';
        }
        l = String(l || 'pt').toLowerCase();
        if (l.startsWith('en')) return 'en';
        return 'pt';
      }

      function mailCopy(lang, kind, code) {
        const en = lang === 'en';
        if (kind === 'fog_2fa') {
          return {
            subject: en
              ? 'Calhegas Morais Node · Fog bootstrap 2FA'
              : 'Nó Calhegas Morais · 2FA de instalação Fog',
            text: en
              ? ('Your Fog Node bootstrap code is: ' + code + '\n\nValid for 10 minutes. One use. Node install will not start without it.')
              : ('O código de instalação do Nó Fog é: ' + code + '\n\nVálido 10 minutos. Uma utilização. A instalação não começa sem ele.'),
            kind: 'fog_2fa',
            code,
            cta: null,
          };
        }
        if (kind === 'staff_2fa') {
          return {
            subject: en
              ? 'Calhegas Morais Node · staff 2FA code'
              : 'Nó Calhegas Morais · código 2FA (pessoal)',
            text: en
              ? ('Your staff verification code is: ' + code + '\n\nValid for 10 minutes. One use.')
              : ('O seu código de verificação (pessoal) é: ' + code + '\n\nVálido 10 minutos. Uma utilização.'),
            kind: 'staff_2fa',
            code,
          };
        }
        if (kind === 'user_2fa') {
          return {
            subject: en
              ? 'Calhegas Morais Node · verification code'
              : 'Nó Calhegas Morais · código de verificação',
            text: en
              ? ('Your verification code is: ' + code + '\n\nValid for 10 minutes. One use.')
              : ('O seu código de verificação é: ' + code + '\n\nVálido 10 minutos. Uma utilização.'),
            kind: '2fa',
            code,
          };
        }
        if (kind === 'invite') {
          return {
            subject: en
              ? 'Calhegas Morais Node · set your password'
              : 'Nó Calhegas Morais · definir a sua palavra-passe',
            text: en
              ? ('Open this link within 1 hour to set your password:\n\n' + code)
              : ('Abra este link no prazo de 1 hora para definir a palavra-passe:\n\n' + code),
            kind: 'invite',
            cta: { label: en ? 'Set password' : 'Definir palavra-passe', href: code },
          };
        }
        if (kind === 'reset') {
          return {
            subject: en
              ? 'Calhegas Morais Node · password reset'
              : 'Nó Calhegas Morais · redefinição de palavra-passe',
            text: en
              ? ('Open this link within 1 hour to set a new password:\n\n' + code)
              : ('Abra este link no prazo de 1 hora para definir uma nova palavra-passe:\n\n' + code),
            kind: 'reset',
            cta: { label: en ? 'Reset password' : 'Redefinir palavra-passe', href: code },
          };
        }
        if (kind === 'register') {
          return {
            subject: en
              ? 'Calhegas Morais Node · registration received'
              : 'Nó Calhegas Morais · confirmação de registo',
            text: en
              ? ('Your registration has been received. KYC status: pending staff approval.\nEmail confirmation code: ' + code)
              : ('O seu registo foi recebido. Estado KYC: pendente de aprovação.\nCódigo de confirmação: ' + code),
            kind: 'register',
            code,
          };
        }
        return { subject: en ? 'Calhegas Morais Node' : 'Nó Calhegas Morais', text: String(code || ''), kind: 'system' };
      }

      async function notifyOrchMail(env, subject, meta) {
        try {
          const msg = 'Sistema de correio do Nó: ' + subject + (meta ? ' · ' + meta : '');
          const payload = { message: msg, channel: 'email-system', lang: 'pt', clearance: 'internal' };
          if (env.ORCH && typeof env.ORCH.fetch === 'function') {
            await env.ORCH.fetch(new Request('https://orch.internal/chat', {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
            }));
          } else {
            await fetch('https://stratamesh-orchestrator.stratamesh.workers.dev/chat', {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
            });
          }
        } catch (_) {}
      }

      function queueSystemEmail(env, ctx, to, subject, text, lang, extra) {
        const job = sendSystemEmail(env, to, subject, text, lang, extra);
        if (ctx && typeof ctx.waitUntil === 'function') {
          ctx.waitUntil(job.catch(() => {}));
          return { queued: true };
        }
        return job;
      }

      async function sendSystemEmail(env, to, subject, text, lang, extra) {
        const from = env.MAIL_FROM || 'noreply@eni.calhegasmorais.pt';
        const payload = {
          from, to, subject, text, formal: true, fingerprint: false, lang: lang || 'pt',
          kind: extra && extra.kind, code: extra && extra.code, cta: extra && extra.cta,
          sections: extra && extra.sections, preheader: extra && extra.preheader,
        };
        let result = { ok: false };
        try {
          if (env.DEOMAIL && typeof env.DEOMAIL.fetch === 'function') {
            const r = await env.DEOMAIL.fetch(new Request('https://deomail.internal/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            }));
            result = { ok: r.ok, body: await r.json().catch(() => ({})) };
          }
        } catch (_) {}
        if (!result.ok) {
          try {
            const r = await fetch('https://stratamesh-deomail.stratamesh.workers.dev/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
            result = { ok: r.ok, body: await r.json().catch(() => ({})) };
          } catch (e) {
            result = { ok: false, error: String(e.message || e) };
          }
        }
        // Skip orchestrator notify for 2FA (latency); still notify for other system mail
        if (result.ok && !/2FA|verificação|verification code|código de verificação/i.test(String(subject || ''))) {
          try { await notifyOrchMail(env, subject, 'to=' + to); } catch (_) {}
        }
        return result;
      }

      function sixDigit() {
        return String(Math.floor(100000 + Math.random() * 900000));
      }

      function isStubEmail(email) {
        const e = String(email || "").trim().toLowerCase();
        if (!e || !e.includes("@")) return true;
        const at = e.lastIndexOf("@");
        const local = e.slice(0, at);
        const domain = e.slice(at + 1);
        if (!domain.includes(".")) return true;
        const stubDom = /^(example\.(com|org|net)|test\.(com|org)|localhost|invalid|mailinator\.com|guerrillamail\.com|tempmail\.com|yopmail\.com|throwaway\.email|fake\.local|stratamesh\.test|calhegas\.test)$/;
        if (stubDom.test(domain)) return true;
        if (/\.(test|invalid|localhost|example)$/.test(domain)) return true;
        if (/^(test|stub|fake|demo|dummy|nologin|foo|bar|asdf|user\d+)$/.test(local)) return true;
        if (/\+stub|\+test|\+fake/.test(local)) return true;
        return false;
      }

      async function listConfirmedEmails() {
        const rows = await env.AUTH_DB.prepare(
          "SELECT id, email, email_confirmed, verification_status FROM users WHERE email IS NOT NULL AND trim(email) != ''"
        ).all();
        const all = (rows && rows.results) || [];
        const confirmed = [];
        const stubs = [];
        for (const u of all) {
          if (isStubEmail(u.email)) stubs.push(u);
          else if (Number(u.email_confirmed) === 1) confirmed.push(u);
        }
        return { all, confirmed, stubs };
      }

      async function ensurePasswordTokenTable() {
        await env.AUTH_DB.prepare(`CREATE TABLE IF NOT EXISTS password_tokens (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT NOT NULL,
          user_id INTEGER,
          token TEXT NOT NULL UNIQUE,
          purpose TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          used INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now'))
        )`).run();
        try { await env.AUTH_DB.prepare('CREATE INDEX IF NOT EXISTS idx_pw_token ON password_tokens(token)').run(); } catch (_) {}
      }


      async function ensureKycColumns() {
        const alters = [
          'ALTER TABLE users ADD COLUMN username TEXT',
          'ALTER TABLE users ADD COLUMN sovereign_id TEXT',
          'ALTER TABLE users ADD COLUMN full_name_legal TEXT',
          'ALTER TABLE users ADD COLUMN terms_accepted_at TEXT',
          'ALTER TABLE users ADD COLUMN terms_version TEXT',
          'ALTER TABLE users ADD COLUMN kyc_step INTEGER DEFAULT 0',
          'ALTER TABLE users ADD COLUMN kyc_auto_score REAL',
          'ALTER TABLE users ADD COLUMN kyc_auto_report TEXT',
          'ALTER TABLE users ADD COLUMN panel_unlocked INTEGER DEFAULT 0',
        ];
        for (const sql of alters) {
          try { await env.AUTH_DB.prepare(sql).run(); } catch (_) {}
        }
        await env.AUTH_DB.prepare(`CREATE TABLE IF NOT EXISTS kyc_submissions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          doc_type TEXT NOT NULL,
          sovereign_id TEXT NOT NULL,
          issuing_country TEXT,
          full_name_claimed TEXT,
          mrz_line1 TEXT,
          mrz_line2 TEXT,
          mrz_line3 TEXT,
          doc_meta_json TEXT,
          auto_valid INTEGER DEFAULT 0,
          auto_score REAL,
          auto_report TEXT,
          status TEXT DEFAULT 'submitted',
          created_at TEXT DEFAULT (datetime('now'))
        )`).run();
        try { await env.AUTH_DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_sovereign ON users(sovereign_id) WHERE sovereign_id IS NOT NULL AND sovereign_id != ""').run(); } catch (_) {}
        try { await env.AUTH_DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE username IS NOT NULL AND username != ""').run(); } catch (_) {}
      }

      function validateUsername(u) {
        const s = String(u || '').trim();
        if (s.length < 3 || s.length > 32) return { ok: false, error: 'username_length' };
        if (!/^[a-zA-Z][a-zA-Z0-9_\.]+$/.test(s)) return { ok: false, error: 'username_charset' };
        const banned = ['admin','root','staff','system','orchestrator','null','undefined','calhegas','stratamesh'];
        if (banned.includes(s.toLowerCase())) return { ok: false, error: 'username_reserved' };
        return { ok: true, username: s };
      }

      /** ICAO 9303 check digit (open standard — no proprietary API). */
      function icaoCheckDigit(data) {
        const weights = [7, 3, 1];
        const map = {};
        for (let i = 0; i <= 9; i++) map[String(i)] = i;
        for (let i = 0; i < 26; i++) map[String.fromCharCode(65 + i)] = 10 + i;
        map['<'] = 0;
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const ch = data[i].toUpperCase();
          const v = map[ch];
          if (v === undefined) return null;
          sum += v * weights[i % 3];
        }
        return String(sum % 10);
      }

      function parseAndValidateMRZ(line1, line2) {
        const L1 = String(line1 || '').toUpperCase().replace(/\s+/g, '');
        const L2 = String(line2 || '').toUpperCase().replace(/\s+/g, '');
        const report = { standard: 'ICAO_9303', format: null, checks: [], ok: false };
        if (!L1 || !L2) {
          report.checks.push({ field: 'mrz', ok: false, detail: 'MRZ lines required for automated passport/ID check' });
          return report;
        }
        // TD3 passport: 2 x 44
        if (L1.length === 44 && L2.length === 44 && (L1.startsWith('P') || L1.startsWith('IP'))) {
          report.format = 'TD3';
          const names = L1.slice(5);
          const docNum = L2.slice(0, 9);
          const docCd = L2[9];
          const nationality = L2.slice(10, 13);
          const birth = L2.slice(13, 19);
          const birthCd = L2[19];
          const sex = L2[20];
          const expiry = L2.slice(21, 27);
          const expiryCd = L2[27];
          const optional = L2.slice(28, 42);
          const optionalCd = L2[42];
          const compositeCd = L2[43];
          const c1 = icaoCheckDigit(docNum) === docCd;
          const c2 = icaoCheckDigit(birth) === birthCd;
          const c3 = icaoCheckDigit(expiry) === expiryCd;
          const c4 = icaoCheckDigit(optional) === optionalCd;
          const composite = docNum + docCd + birth + birthCd + expiry + expiryCd + optional + optionalCd;
          const c5 = icaoCheckDigit(composite) === compositeCd;
          report.checks.push({ field: 'document_number', ok: c1, value_masked: docNum.slice(0, 3) + '******' });
          report.checks.push({ field: 'birth_date', ok: c2 });
          report.checks.push({ field: 'expiry', ok: c3 });
          report.checks.push({ field: 'optional', ok: c4 });
          report.checks.push({ field: 'composite', ok: c5 });
          report.document_number = docNum.replace(/</g, '');
          report.nationality = nationality.replace(/</g, '');
          report.sex = sex;
          const nameParts = names.split('<<');
          report.surname = (nameParts[0] || '').replace(/</g, ' ').trim();
          report.given_names = (nameParts[1] || '').replace(/</g, ' ').trim();
          report.full_name = (report.surname + ' ' + report.given_names).trim();
          report.ok = c1 && c2 && c3 && c5;
          report.score = [c1, c2, c3, c4, c5].filter(Boolean).length / 5;
          return report;
        }
        // TD1 ID card: 3 x 30 — accept line1+line2 minimal
        if (L1.length === 30 && L2.length === 30) {
          report.format = 'TD1';
          const docNum = L1.slice(5, 14);
          const docCd = L1[14];
          const c1 = icaoCheckDigit(docNum) === docCd;
          report.checks.push({ field: 'document_number', ok: c1 });
          report.document_number = docNum.replace(/</g, '');
          report.ok = c1;
          report.score = c1 ? 0.7 : 0.2;
          return report;
        }
        report.checks.push({ field: 'mrz', ok: false, detail: 'Unsupported MRZ length (need TD3 44+44 or TD1 30+30)' });
        report.score = 0;
        return report;
      }

      /** Portuguese NIF checksum (open algorithm). */
      function validatePortugueseNIF(nif) {
        const s = String(nif || '').replace(/\s/g, '');
        if (!/^\d{9}$/.test(s)) return { ok: false, score: 0 };
        const n = s.split('').map(Number);
        let sum = 0;
        for (let i = 0; i < 8; i++) sum += n[i] * (9 - i);
        let check = 11 - (sum % 11);
        if (check >= 10) check = 0;
        const ok = check === n[8];
        return { ok, score: ok ? 1 : 0, standard: 'PT_NIF' };
      }

      async function ensureEmailOtpTable() {
        await env.AUTH_DB.prepare(`CREATE TABLE IF NOT EXISTS email_otp (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT NOT NULL,
          user_id INTEGER,
          staff_id INTEGER,
          code TEXT NOT NULL,
          challenge TEXT NOT NULL,
          purpose TEXT DEFAULT 'login',
          expires_at TEXT NOT NULL,
          used INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now'))
        )`).run();
      }


      function maskEmail(email) {
        const e = String(email || '').trim();
        const at = e.lastIndexOf('@');
        if (at < 1) return '***';
        return e[0] + '***@' + e.slice(at + 1);
      }

      async function ensureFogNodes() {
        await env.AUTH_DB.prepare(`CREATE TABLE IF NOT EXISTS fog_nodes (
          node_id TEXT PRIMARY KEY,
          operator_email TEXT NOT NULL,
          label TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        )`).run();
        const n = await env.AUTH_DB.prepare('SELECT COUNT(*) AS c FROM fog_nodes').first();
        if (!n || Number(n.c) === 0) {
          const staff = await env.AUTH_DB.prepare('SELECT email FROM staff ORDER BY id ASC LIMIT 1').first();
          if (staff && staff.email) {
            await env.AUTH_DB.prepare(
              'INSERT OR IGNORE INTO fog_nodes (node_id, operator_email, label) VALUES (?, ?, ?)'
            ).bind('FOG-NODE-PT-CM-001', staff.email, 'Calhegas Morais Fog').run();
          }
        }
      }

      async function ensureBootstrapTokens() {
        await env.AUTH_DB.prepare(`CREATE TABLE IF NOT EXISTS fog_bootstrap_tokens (
          token TEXT PRIMARY KEY,
          node_id TEXT NOT NULL,
          operator_email TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          created_at TEXT DEFAULT (datetime('now'))
        )`).run();
      }

      // Fog hardware bootstrap: node_id → 2FA to registered operator email → short token
      if ((path === '/fog/bootstrap/challenge' || path === '/fog-bootstrap-challenge') && request.method === 'POST') {
        try {
          const body = await request.json().catch(() => ({}));
          const lang = resolveLang(body, request);
          const nodeId = String(body.node_id || body.node || '').trim().toUpperCase();
          if (!nodeId || nodeId.length < 8) {
            return new Response(JSON.stringify({ success: false, error: lang === 'en' ? 'Registered node id required.' : 'Indique o id de nó registado.' }), { headers: corsHeaders, status: 400 });
          }
          await ensureFogNodes();
          await ensureEmailOtpTable();
          const row = await env.AUTH_DB.prepare('SELECT node_id, operator_email, label FROM fog_nodes WHERE upper(node_id) = ?').bind(nodeId).first();
          if (!row) {
            return new Response(JSON.stringify({ success: false, error: lang === 'en' ? 'Unknown node id.' : 'Id de nó desconhecido.', node_id: nodeId }), { headers: corsHeaders, status: 404 });
          }
          const code = sixDigit();
          const challenge = crypto.randomUUID();
          await env.AUTH_DB.prepare(
            "INSERT INTO email_otp (email, code, challenge, purpose, expires_at) VALUES (?, ?, ?, 'fog_bootstrap', datetime('now', '+10 minutes'))"
          ).bind(row.operator_email, code, challenge).run();
          const mc = mailCopy(lang, 'fog_2fa', code);
          queueSystemEmail(env, ctx, row.operator_email, mc.subject, mc.text, lang, { kind: mc.kind, code: mc.code, cta: mc.cta });
          return new Response(JSON.stringify({
            success: true,
            requires_2fa: true,
            challenge,
            channel: 'email',
            node_id: row.node_id,
            label: row.label || null,
            operator_masked: maskEmail(row.operator_email),
            email_sent: true,
            expires_in: 600,
            message: lang === 'en'
              ? ('A 6-digit code was sent to the registered operator ' + maskEmail(row.operator_email) + '.')
              : ('Foi enviado um código de 6 dígitos ao operador registado ' + maskEmail(row.operator_email) + '.'),
          }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), { headers: corsHeaders, status: 500 });
        }
      }

      if ((path === '/fog/bootstrap/verify' || path === '/fog-bootstrap-verify') && request.method === 'POST') {
        try {
          const body = await request.json().catch(() => ({}));
          const lang = resolveLang(body, request);
          const nodeId = String(body.node_id || '').trim().toUpperCase();
          const challenge = String(body.challenge || '').trim();
          const code = String(body.code || '').trim();
          if (!nodeId || !challenge || !code) {
            return new Response(JSON.stringify({ success: false, error: 'node_id, challenge and code required' }), { headers: corsHeaders, status: 400 });
          }
          await ensureFogNodes();
          await ensureBootstrapTokens();
          const otp = await env.AUTH_DB.prepare(
            "SELECT * FROM email_otp WHERE challenge = ? AND purpose = 'fog_bootstrap' AND used = 0 AND expires_at > datetime('now') ORDER BY id DESC LIMIT 1"
          ).bind(challenge).first();
          if (!otp || String(otp.code) !== code) {
            return new Response(JSON.stringify({ success: false, error: lang === 'en' ? 'Invalid or expired code.' : 'Código inválido ou expirado.' }), { headers: corsHeaders, status: 401 });
          }
          const node = await env.AUTH_DB.prepare('SELECT * FROM fog_nodes WHERE upper(node_id) = ?').bind(nodeId).first();
          if (!node || String(node.operator_email).toLowerCase() !== String(otp.email).toLowerCase()) {
            return new Response(JSON.stringify({ success: false, error: lang === 'en' ? 'Node does not match this challenge.' : 'O nó não corresponde a este desafio.' }), { headers: corsHeaders, status: 401 });
          }
          await env.AUTH_DB.prepare('UPDATE email_otp SET used = 1 WHERE id = ?').bind(otp.id).run();
          const token = crypto.randomUUID() + crypto.randomUUID();
          await env.AUTH_DB.prepare(
            "INSERT INTO fog_bootstrap_tokens (token, node_id, operator_email, expires_at) VALUES (?, ?, ?, datetime('now', '+24 hours'))"
          ).bind(token, node.node_id, node.operator_email).run();
          return new Response(JSON.stringify({
            success: true,
            bootstrap_token: token,
            node_id: node.node_id,
            operator_masked: maskEmail(node.operator_email),
            expires_in: 86400,
            message: lang === 'en' ? 'Operator verified. Continue with GitHub and Cloudflare keys.' : 'Operador verificado. Continue com as chaves GitHub e Cloudflare.',
          }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), { headers: corsHeaders, status: 500 });
        }
      }

      if ((path === '/fog/bootstrap/session' || path === '/fog-bootstrap-session') && request.method === 'POST') {
        try {
          const body = await request.json().catch(() => ({}));
          const token = String(body.token || body.bootstrap_token || '').trim();
          if (!token) {
            return new Response(JSON.stringify({ success: false, error: 'token required' }), { headers: corsHeaders, status: 400 });
          }
          await ensureBootstrapTokens();
          const row = await env.AUTH_DB.prepare(
            "SELECT node_id, operator_email, expires_at FROM fog_bootstrap_tokens WHERE token = ? AND expires_at > datetime('now')"
          ).bind(token).first();
          if (!row) {
            return new Response(JSON.stringify({ success: false, error: 'invalid or expired' }), { headers: corsHeaders, status: 401 });
          }
          return new Response(JSON.stringify({
            success: true,
            node_id: row.node_id,
            operator_masked: maskEmail(row.operator_email),
            expires_at: row.expires_at,
            role: String(row.node_id || '').toUpperCase().startsWith('EDGE') ? 'edge' : 'fog',
          }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), { headers: corsHeaders, status: 500 });
        }
      }

      // --- STAFF-only login (separate from public users / future CMD) ---
      
      // --- Staff TOTP enroll / status ---
      if ((path === '/staff/totp/enroll' || path === '/staff-totp-enroll') && request.method === 'POST') {
        try {
          await ensureStaffTotpColumn();
          const body = await request.json().catch(() => ({}));
          const email = String(body.email || '').trim().toLowerCase();
          const password = String(body.password || '');
          if (!email || !password) {
            return new Response(JSON.stringify({ success: false, error: 'email and password required' }), { headers: corsHeaders, status: 400 });
          }
          const staff = await env.AUTH_DB.prepare('SELECT * FROM staff WHERE lower(email) = lower(?)').bind(email).first();
          if (!staff || !staff.password_hash) {
            return new Response(JSON.stringify({ success: false, error: 'Invalid credentials' }), { headers: corsHeaders, status: 401 });
          }
          const parts = String(staff.password_hash).split(':');
          const [salt, storedHash] = parts;
          const enc = new TextEncoder();
          const keyMat = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
          const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' }, keyMat, 256);
          const hash = btoa(String.fromCharCode(...new Uint8Array(bits)));
          if (hash !== storedHash) {
            return new Response(JSON.stringify({ success: false, error: 'Invalid credentials' }), { headers: corsHeaders, status: 401 });
          }
          const rnd = new Uint8Array(20);
          crypto.getRandomValues(rnd);
          const secret = b32Encode(rnd);
          await env.AUTH_DB.prepare('UPDATE staff SET totp_secret = ? WHERE id = ?').bind(secret, staff.id).run();
          const label = encodeURIComponent('CMN Staff:' + email);
          const issuer = encodeURIComponent('CalhegasMorais');
          const otpauth = 'otpauth://totp/' + label + '?secret=' + secret + '&issuer=' + issuer + '&digits=6&period=30';
          return new Response(JSON.stringify({
            success: true,
            secret,
            otpauth_url: otpauth,
            message: 'Scan otpauth_url in Google Authenticator / Aegis / 1Password. Next staff login requires TOTP.',
          }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), { headers: corsHeaders, status: 500 });
        }
      }
      if ((path === '/staff/totp/status' || path === '/staff-totp-status') && request.method === 'POST') {
        try {
          await ensureStaffTotpColumn();
          const body = await request.json().catch(() => ({}));
          const email = String(body.email || '').trim().toLowerCase();
          const staff = await env.AUTH_DB.prepare('SELECT id, email, totp_secret FROM staff WHERE lower(email) = lower(?)').bind(email).first();
          return new Response(JSON.stringify({
            success: true,
            enrolled: !!(staff && staff.totp_secret),
            email: staff ? staff.email : null,
          }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), { headers: corsHeaders, status: 500 });
        }
      }

      if ((path === '/staff/login' || path === '/staff-login') && request.method === 'POST') {
        try {
          const staffBody = await request.json();
          const email = staffBody.email;
          const password = staffBody.password;
          const lang = resolveLang(staffBody, request);
          if (!email || !password) {
            return new Response(JSON.stringify({ success: false, error: 'Email and password required' }), { headers: corsHeaders, status: 400 });
          }
          const staff = await env.AUTH_DB.prepare('SELECT * FROM staff WHERE lower(email) = lower(?)').bind(String(email).trim()).first();
          if (!staff || !staff.password_hash) {
            return new Response(JSON.stringify({ success: false, error: 'Staff account not found' }), { headers: corsHeaders, status: 401 });
          }
          const parts = String(staff.password_hash).split(':');
          if (parts.length < 2) {
            return new Response(JSON.stringify({ success: false, error: 'Staff credentials misconfigured' }), { headers: corsHeaders, status: 500 });
          }
          const [salt, storedHash] = parts;
          const enc = new TextEncoder();
          const keyMat = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
          const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' }, keyMat, 256);
          const hash = btoa(String.fromCharCode(...new Uint8Array(bits)));
          if (hash !== storedHash) {
            return new Response(JSON.stringify({ success: false, error: 'Invalid password' }), { headers: corsHeaders, status: 401 });
          }
          await ensureStaffTotpColumn();
          // 2FA trust window (1h after successful 2FA)
          if (await isLoginTrusted(staff.email)) {
            const token = crypto.randomUUID() + crypto.randomUUID();
            await env.AUTH_DB.prepare(
              "INSERT INTO sessions (user_id, token, token_hash, expires_at) VALUES (?, ?, ?, datetime('now', '+30 days'))"
            ).bind(-Math.abs(staff.id), token, token).run();
            return new Response(JSON.stringify({
              success: true,
              token,
              session_token: token,
              type: 'staff',
              trusted_2fa: true,
              trust_window: '1h',
              email: staff.email,
              role: staff.role,
              clearance: staff.clearance_level || 'INTERNAL',
              clearance_level: staff.clearance_level || 'INTERNAL',
              message: lang === 'en' ? 'Staff signed in (2FA trust window).' : 'Pessoal: sessão iniciada (janela 2FA).',
            }), { headers: corsHeaders });
          }
          // Prefer app TOTP when enrolled
          if (staff.totp_secret) {
            return new Response(JSON.stringify({
              success: true,
              requires_2fa: true,
              challenge: 'TOTP-' + staff.id,
              channel: 'totp',
              message: 'Staff password OK. Enter the 6-digit code from your authenticator app.',
              email: staff.email,
              role: staff.role,
            }), { headers: corsHeaders });
          }
          // Email OTP (never return code in API body unless LAB_OTP_ECHO=1)
          await env.AUTH_DB.prepare(`CREATE TABLE IF NOT EXISTS staff_otp (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            staff_id INTEGER NOT NULL,
            code TEXT NOT NULL,
            challenge TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            used INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
          )`).run();
          const code = sixDigit();
          const challenge = crypto.randomUUID();
          await env.AUTH_DB.prepare(
            "INSERT INTO staff_otp (staff_id, code, challenge, expires_at) VALUES (?, ?, ?, datetime('now', '+10 minutes'))"
          ).bind(staff.id, code, challenge).run();
          const mc = mailCopy(lang, 'staff_2fa', code);
          queueSystemEmail(env, ctx, staff.email, mc.subject, mc.text, lang, { kind: mc.kind, code: mc.code, cta: mc.cta });
          const echo = env.LAB_OTP_ECHO === '1';
          return new Response(JSON.stringify({
            success: true,
            requires_2fa: true,
            challenge,
            channel: 'email',
            lang,
            message: lang === 'en'
              ? 'Password OK. Enter the 6-digit code from your email.'
              : 'Password OK. Introduza o código de 6 dígitos do e-mail.',
            email_sent: true,
            lab_otp: echo ? code : undefined,
            email: staff.email,
            role: staff.role,
          }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), { headers: corsHeaders, status: 500 });
        }
      }

      if ((path === '/staff/2fa' || path === '/staff-2fa') && request.method === 'POST') {
        try {
          const { challenge, code, email } = await request.json();
          if (!challenge || !code) {
            return new Response(JSON.stringify({ success: false, error: 'challenge and code required' }), { headers: corsHeaders, status: 400 });
          }
          const row = await env.AUTH_DB.prepare(
            "SELECT * FROM staff_otp WHERE challenge = ? AND used = 0 AND expires_at > datetime('now') ORDER BY id DESC LIMIT 1"
          ).bind(challenge).first();
          let staff = null;
          if (String(challenge).startsWith('TOTP-')) {
            const sid = parseInt(String(challenge).slice(5), 10);
            staff = await env.AUTH_DB.prepare('SELECT * FROM staff WHERE id = ?').bind(sid).first();
            if (!staff || !staff.totp_secret || !(await totpVerify(staff.totp_secret, code))) {
              return new Response(JSON.stringify({ success: false, error: 'Invalid or expired TOTP code' }), { headers: corsHeaders, status: 401 });
            }
          } else {
            if (!row || String(row.code) !== String(code).trim()) {
              return new Response(JSON.stringify({ success: false, error: 'Invalid or expired 2FA code' }), { headers: corsHeaders, status: 401 });
            }
            await env.AUTH_DB.prepare('UPDATE staff_otp SET used = 1 WHERE id = ?').bind(row.id).run();
            staff = await env.AUTH_DB.prepare('SELECT * FROM staff WHERE id = ?').bind(row.staff_id).first();
          }
          if (!staff) {
            return new Response(JSON.stringify({ success: false, error: 'Staff not found' }), { headers: corsHeaders, status: 401 });
          }
          const token = await issueSession(env, -staff.id);
          await env.AUTH_DB.prepare("UPDATE staff SET last_login = datetime('now') WHERE id = ?").bind(staff.id).run();
          try { await markLoginTrusted(staff.email, -Math.abs(staff.id), 'staff'); } catch (_) {}
          return new Response(JSON.stringify({
            success: true,
            type: 'staff',
            token,
            role: staff.role || 'staff',
            clearance: staff.clearance_level || 'INTERNAL',
            clearance_level: staff.clearance_level || 'INTERNAL',
            email: staff.email,
            message: 'Staff session issued after 2FA'
          }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), { headers: corsHeaders, status: 500 });
        }
      }

      
      

      if ((path === '/auth/email/verify' || path === '/email/verify' || path === '/2fa/email') && request.method === 'POST') {
        try {
          await ensureEmailOtpTable();
          const body = await request.json();
          const challenge = body.challenge;
          const code = String(body.code || '').trim();
          if (!challenge || !code) {
            return new Response(JSON.stringify({ success: false, error: 'challenge and code required' }), { headers: corsHeaders, status: 400 });
          }
          const row = await env.AUTH_DB.prepare(
            "SELECT * FROM email_otp WHERE challenge = ? AND used = 0 AND expires_at > datetime('now') ORDER BY id DESC LIMIT 1"
          ).bind(challenge).first();
          if (!row || String(row.code) !== code) {
            return new Response(JSON.stringify({ success: false, error: 'Invalid or expired code' }), { headers: corsHeaders, status: 401 });
          }
          await env.AUTH_DB.prepare('UPDATE email_otp SET used = 1 WHERE id = ?').bind(row.id).run();
          const user = await env.AUTH_DB.prepare('SELECT * FROM users WHERE id = ?').bind(row.user_id).first();
          if (!user) {
            return new Response(JSON.stringify({ success: false, error: 'User not found' }), { headers: corsHeaders, status: 404 });
          }
          const token = await issueSession(env, user.id);
          try { await markLoginTrusted(email || (row && row.email), row && row.user_id, 'user'); } catch (_) {}

          return new Response(JSON.stringify({
            success: true,
            token,
            type: 'user',
            role: user.clearance_level || 'basic',
            clearance: user.clearance_level || 'basic',
            email: user.email,
            wallet: user.strata_address,
            verification_status: user.verification_status,
            panel_unlocked: !!user.panel_unlocked,
            kyc_step: user.kyc_step || 0,
            username: user.username || null,
            message: 'Session issued after email 2FA',
          }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), { headers: corsHeaders, status: 500 });
        }
      }

      // Broadcast notices by clearance (staff/orchestrator)
      if ((path === '/notify/broadcast' || path === '/broadcast') && request.method === 'POST') {
        try {
          const body = await request.json();
          const subject = body.subject || 'Aviso — Nó Calhegas Morais';
          const text = body.text || body.message || '';
          const clearance = body.clearance || body.clearance_level || null; // e.g. PUBLIC, INTERNAL, all
          if (!text) {
            return new Response(JSON.stringify({ success: false, error: 'text required' }), { headers: corsHeaders, status: 400 });
          }
          let q = 'SELECT email, clearance_level FROM users WHERE email IS NOT NULL AND email != "" AND email_confirmed = 1';
          let rows;
          if (clearance && String(clearance).toLowerCase() !== 'all') {
            rows = await env.AUTH_DB.prepare(q + ' AND upper(clearance_level) = upper(?)').bind(clearance).all();
          } else {
            rows = await env.AUTH_DB.prepare(q).all();
          }
          const list = ((rows && rows.results) || []).filter((u) => u.email && !isStubEmail(u.email));
          let sent = 0, failed = 0;
          for (const u of list) {
            const r = await sendSystemEmail(env, u.email, subject, text, 'pt', { kind: 'update' });
            if (r.ok) sent++; else failed++;
          }
          return new Response(JSON.stringify({
            success: true,
            recipients: list.length,
            sent,
            failed,
            clearance: clearance || 'all',
          }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), { headers: corsHeaders, status: 500 });
        }
      }

      if ((path === '/users/confirmed' || path === '/users/mail-list') && request.method === 'GET') {
        try {
          const role = request.headers.get('X-AMCM-Role') || '';
          const authHeader = request.headers.get('Authorization');
          let allowed = role === 'briefing' || role === 'deomail';
          if (!allowed && authHeader) {
            const token = authHeader.replace('Bearer ', '');
            const session = await sessionWithClearance(env, token);
            allowed = staffClearanceOK(session);
          }
          if (!allowed) {
            return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { headers: corsHeaders, status: 401 });
          }
          const { confirmed, stubs } = await listConfirmedEmails();
          return new Response(JSON.stringify({
            success: true,
            emails: confirmed.map((u) => u.email),
            confirmed: confirmed.length,
            stubs_ignored: stubs.length,
          }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), { headers: corsHeaders, status: 500 });
        }
      }

      if ((path === '/users/sweep-stubs' || path === '/users/sweep') && (request.method === 'POST' || request.method === 'GET')) {
        try {
          const role = request.headers.get('X-AMCM-Role') || '';
          const authHeader = request.headers.get('Authorization');
          let allowed = role === 'briefing';
          if (!allowed && authHeader) {
            const token = authHeader.replace('Bearer ', '');
            const session = await sessionWithClearance(env, token);
            allowed = staffClearanceOK(session);
          }
          if (!allowed) {
            return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { headers: corsHeaders, status: 401 });
          }
          const { stubs, confirmed, all } = await listConfirmedEmails();
          const removed = [];
          for (const u of stubs) {
            try { await env.AUTH_DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(u.id).run(); } catch (_) {}
            try { await env.AUTH_DB.prepare('DELETE FROM email_otp WHERE user_id = ?').bind(u.id).run(); } catch (_) {}
            await env.AUTH_DB.prepare('DELETE FROM users WHERE id = ?').bind(u.id).run();
            removed.push(u.email);
          }
          return new Response(JSON.stringify({
            success: true,
            scanned: all.length,
            kept_confirmed: confirmed.length,
            removed: removed.length,
            emails: removed,
          }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), { headers: corsHeaders, status: 500 });
        }
      }

      // --- Phone OTP (common users): SMS primary, password optional second factor ---
      async function ensurePhoneTables() {
        await env.AUTH_DB.prepare(`CREATE TABLE IF NOT EXISTS phone_otp (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          phone TEXT NOT NULL,
          code TEXT NOT NULL,
          challenge TEXT NOT NULL,
          purpose TEXT DEFAULT 'login',
          expires_at TEXT NOT NULL,
          used INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now'))
        )`).run();
        try {
          await env.AUTH_DB.prepare(`ALTER TABLE users ADD COLUMN phone TEXT`).run();
        } catch (_) {}
        try {
          await env.AUTH_DB.prepare(`ALTER TABLE users ADD COLUMN phone_verified INTEGER DEFAULT 0`).run();
        } catch (_) {}
      }

      function normalizePhone(raw) {
        let s = String(raw || '').replace(/[^\d+]/g, '');
        if (s.startsWith('00')) s = '+' + s.slice(2);
        if (/^9\d{8}$/.test(s)) s = '+351' + s; // PT mobile shorthand
        if (/^3519\d{8}$/.test(s)) s = '+' + s;
        if (!s.startsWith('+') && /^\d{10,15}$/.test(s)) s = '+' + s;
        return s;
      }

      async function sendSmsOtp(phone, code, env) {
        // Twilio Verify preferred
        if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_VERIFY_SID) {
          const url = `https://verify.twilio.com/v2/Services/${env.TWILIO_VERIFY_SID}/Verifications`;
          const body = new URLSearchParams({ To: phone, Channel: 'sms' });
          const auth = btoa(env.TWILIO_ACCOUNT_SID + ':' + env.TWILIO_AUTH_TOKEN);
          const r = await fetch(url, {
            method: 'POST',
            headers: { Authorization: 'Basic ' + auth, 'Content-Type': 'application/x-www-form-urlencoded' },
            body,
          });
          const data = await r.json().catch(() => ({}));
          if (!r.ok) return { ok: false, provider: 'twilio_verify', error: data.message || ('HTTP ' + r.status), data };
          return { ok: true, provider: 'twilio_verify', sid: data.sid, status: data.status };
        }
        // Twilio Messages API fallback
        if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM) {
          const url = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`;
          const body = new URLSearchParams({
            To: phone,
            From: env.TWILIO_FROM,
            Body: 'StrataMesh CMN code: ' + code + ' (valid 10 min)',
          });
          const auth = btoa(env.TWILIO_ACCOUNT_SID + ':' + env.TWILIO_AUTH_TOKEN);
          const r = await fetch(url, {
            method: 'POST',
            headers: { Authorization: 'Basic ' + auth, 'Content-Type': 'application/x-www-form-urlencoded' },
            body,
          });
          const data = await r.json().catch(() => ({}));
          if (!r.ok) return { ok: false, provider: 'twilio_sms', error: data.message || ('HTTP ' + r.status), data };
          return { ok: true, provider: 'twilio_sms', sid: data.sid };
        }
        // Lab: no provider — code stored server-side; echo only if LAB_OTP_ECHO !== '0'
        return { ok: true, provider: 'lab_echo', lab: true };
      }

      async function checkTwilioVerify(phone, code, env) {
        if (!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_VERIFY_SID)) return null;
        const url = `https://verify.twilio.com/v2/Services/${env.TWILIO_VERIFY_SID}/VerificationCheck`;
        const body = new URLSearchParams({ To: phone, Code: code });
        const auth = btoa(env.TWILIO_ACCOUNT_SID + ':' + env.TWILIO_AUTH_TOKEN);
        const r = await fetch(url, {
          method: 'POST',
          headers: { Authorization: 'Basic ' + auth, 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
        });
        const data = await r.json().catch(() => ({}));
        return { ok: r.ok && data.status === 'approved', status: data.status, data };
      }

      if ((path === '/auth/phone/start' || path === '/phone/start') && request.method === 'POST') {
        try {
          await ensurePhoneTables();
          const body = await request.json();
          const phone = normalizePhone(body.phone);
          if (!/^\+\d{10,15}$/.test(phone)) {
            return new Response(JSON.stringify({ success: false, error: 'Invalid phone. Use E.164 e.g. +3519xxxxxxxx' }), { status: 400, headers: corsHeaders });
          }
          const code = String(Math.floor(100000 + Math.random() * 900000));
          const challenge = crypto.randomUUID();
          await env.AUTH_DB.prepare(
            "INSERT INTO phone_otp (phone, code, challenge, purpose, expires_at) VALUES (?, ?, ?, 'login', datetime('now', '+10 minutes'))"
          ).bind(phone, code, challenge).run();
          const sent = await sendSmsOtp(phone, code, env);
          if (!sent.ok) {
            return new Response(JSON.stringify({ success: false, error: sent.error || 'SMS send failed', provider: sent.provider }), { status: 502, headers: corsHeaders });
          }
          const echo = env.LAB_OTP_ECHO !== '0' && sent.provider === 'lab_echo';
          return new Response(JSON.stringify({
            success: true,
            challenge,
            phone_masked: phone.slice(0, 4) + '****' + phone.slice(-3),
            provider: sent.provider,
            password_optional: true,
            message: sent.provider === 'lab_echo'
              ? 'Lab mode: SMS provider not configured. Use lab_otp.'
              : 'SMS code sent. Password is optional second factor after verify.',
            lab_otp: echo ? code : undefined,
          }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: corsHeaders });
        }
      }

      if ((path === '/auth/phone/verify' || path === '/phone/verify') && request.method === 'POST') {
        try {
          await ensurePhoneTables();
          const body = await request.json();
          const phone = normalizePhone(body.phone);
          const code = String(body.code || '').trim();
          const challenge = body.challenge;
          const password = body.password ? String(body.password) : null;
          if (!phone || !code) {
            return new Response(JSON.stringify({ success: false, error: 'phone and code required' }), { status: 400, headers: corsHeaders });
          }

          let verified = false;
          const tw = await checkTwilioVerify(phone, code, env);
          if (tw && tw.ok) {
            verified = true;
          } else {
            let row = null;
            if (challenge) {
              row = await env.AUTH_DB.prepare(
                "SELECT * FROM phone_otp WHERE challenge = ? AND phone = ? AND used = 0 AND expires_at > datetime('now') ORDER BY id DESC LIMIT 1"
              ).bind(challenge, phone).first();
            } else {
              row = await env.AUTH_DB.prepare(
                "SELECT * FROM phone_otp WHERE phone = ? AND used = 0 AND expires_at > datetime('now') ORDER BY id DESC LIMIT 1"
              ).bind(phone).first();
            }
            if (row && String(row.code) === code) {
              verified = true;
              await env.AUTH_DB.prepare('UPDATE phone_otp SET used = 1 WHERE id = ?').bind(row.id).run();
            }
          }
          if (!verified) {
            return new Response(JSON.stringify({ success: false, error: 'Invalid or expired code' }), { status: 401, headers: corsHeaders });
          }

          // Upsert user by phone
          let user = await env.AUTH_DB.prepare('SELECT * FROM users WHERE phone = ?').bind(phone).first();
          if (!user) {
            const email = 'phone_' + phone.replace(/\D/g, '') + '@id.calhegasmorais.pt';
            const existing = await env.AUTH_DB.prepare('SELECT * FROM users WHERE lower(email) = lower(?)').bind(email).first();
            if (existing) {
              user = existing;
              await env.AUTH_DB.prepare("UPDATE users SET phone = ?, phone_verified = 1 WHERE id = ?").bind(phone, user.id).run();
            } else {
              const salt = crypto.randomUUID();
              let password_hash = salt + ':phone_no_password';
              if (password && password.length >= 8) {
                const enc = new TextEncoder();
                const keyMat = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
                const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' }, keyMat, 256);
                password_hash = salt + ':' + btoa(String.fromCharCode(...new Uint8Array(bits)));
              }
              const doc_hash = 'phone_' + phone.replace(/\D/g, '');
              await env.AUTH_DB.prepare(
                `INSERT INTO users (email, password_hash, strata_address, verification_status, doc_type, doc_hash, clearance_level, email_confirmed, phone, phone_verified)
                 VALUES (?, ?, NULL, 'verified', 'phone', ?, 'basic', 1, ?, 1)`
              ).bind(email, password_hash, doc_hash, phone).run();
              user = await env.AUTH_DB.prepare('SELECT * FROM users WHERE phone = ?').bind(phone).first();
            }
          } else {
            await env.AUTH_DB.prepare("UPDATE users SET phone_verified = 1, verification_status = 'verified' WHERE id = ?").bind(user.id).run();
            // Optional password as second factor if account has real password
            if (password && user.password_hash && !String(user.password_hash).includes('phone_no_password') && !String(user.password_hash).includes('social_no_password')) {
              const parts = String(user.password_hash).split(':');
              if (parts.length >= 2) {
                const [salt, storedHash] = parts;
                const enc = new TextEncoder();
                const keyMat = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
                const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' }, keyMat, 256);
                const hash = btoa(String.fromCharCode(...new Uint8Array(bits)));
                if (hash !== storedHash) {
                  return new Response(JSON.stringify({ success: false, error: 'SMS ok but password second factor failed' }), { status: 401, headers: corsHeaders });
                }
              }
            } else if (password && password.length >= 8) {
              // Set optional password on first use
              const salt = crypto.randomUUID();
              const enc = new TextEncoder();
              const keyMat = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
              const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' }, keyMat, 256);
              const password_hash = salt + ':' + btoa(String.fromCharCode(...new Uint8Array(bits)));
              await env.AUTH_DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(password_hash, user.id).run();
            }
            user = await env.AUTH_DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first();
          }

          const token = crypto.randomUUID();
          await env.AUTH_DB.prepare(
            "INSERT INTO sessions (user_id, token, token_hash, expires_at) VALUES (?, ?, ?, datetime('now', '+30 days'))"
          ).bind(user.id, token, token).run();
          return new Response(JSON.stringify({
            success: true,
            type: 'user',
            token,
            email: user.email,
            phone: phone,
            clearance: user.clearance_level || 'basic',
            password_set: !!(user.password_hash && !String(user.password_hash).includes('no_password')),
            message: 'Phone verified. Session issued. Password remains optional.',
          }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: corsHeaders });
        }
      }



      if (path === '/register' && request.method === 'POST') {
        try {
          let body = {};
          const ct = (request.headers.get('Content-Type') || '');
          if (ct.includes('multipart/form-data') || ct.includes('application/x-www-form-urlencoded')) {
            const fd = await request.formData();
            body = Object.fromEntries([...fd.entries()].map(([k,v]) => [k, typeof v === 'string' ? v : (v.name || 'upload')]));
          } else {
            try { body = await request.json(); } catch (_) { body = {}; }
          }
          const email = String(body.email || '').trim().toLowerCase();
          const lang = resolveLang(body, request);
          const portalBase = (env.PORTAL_BASE || 'https://calhegasmorais.pt').replace(/\/+$/, '');
          const pathSet = lang === 'en' ? '/en/dashboard' : '/dashboard';
          if (!email || !email.includes('@')) {
            return new Response(JSON.stringify({ success: false, error: lang === 'en' ? 'Valid email required' : 'E-mail válido obrigatório' }), { headers: corsHeaders, status: 400 });
          }
          const termsOk = body.terms_accepted === true || body.terms_accepted === 'true' || body.accept_terms === true || body.accept_terms === '1';
          if (!termsOk) {
            return new Response(JSON.stringify({
              success: false,
              error: lang === 'en'
                ? 'You must accept the Node terms and conditions to register.'
                : 'Tem de aceitar os termos e condições do Nó para se registar.',
              code: 'terms_required',
              terms_url: 'https://calhegasmorais.pt/terms',
            }), { headers: corsHeaders, status: 400 });
          }
          let username = null;
          if (body.username) {
            const uv = validateUsername(body.username);
            if (!uv.ok) {
              return new Response(JSON.stringify({ success: false, error: 'Invalid username', code: uv.error }), { headers: corsHeaders, status: 400 });
            }
            username = uv.username;
          }
          await ensureKycColumns();
          // optional password ignored for new flow; invite link only
          const labReg = env.LAB_REGISTER === '1' && request.headers.get('X-Lab-Register') === '1';
          if (!labReg) {
            const tsToken = body['cf-turnstile-response'] || body.turnstile_token || body.turnstile || '';
            const ip = request.headers.get('CF-Connecting-IP') || '';
            const ts = await verifyTurnstile(env, tsToken, ip);
            if (!ts.ok) {
              return new Response(JSON.stringify({ success: false, error: ts.error || 'turnstile_failed', codes: ts.codes || [] }), { headers: corsHeaders, status: 400 });
            }
          }
          await ensurePasswordTokenTable();
          let user = await env.AUTH_DB.prepare('SELECT id, email, password_hash, verification_status FROM users WHERE lower(email) = lower(?)').bind(email).first();
          if (user && user.password_hash && String(user.password_hash).length > 10) {
            // already has password — suggest reset
            return new Response(JSON.stringify({
              success: false,
              error: lang === 'en' ? 'Email already registered. Use password recovery.' : 'E-mail já registado. Use a recuperação de palavra-passe.',
              code: 'already_registered',
            }), { headers: corsHeaders, status: 409 });
          }
          if (!user) {
            const doc_hash = 'pending_' + crypto.randomUUID().replace(/-/g, '');
            const wallet = 'sm:u:' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
            await env.AUTH_DB.prepare(
              'INSERT INTO users (email, password_hash, strata_address, verification_status, doc_type, doc_hash, clearance_level, email_confirmed) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
            ).bind(email, '', wallet, 'pending', 'passport', doc_hash, 'basic', 0).run();
            try {
              await env.AUTH_DB.prepare("UPDATE users SET lab_balance = 50, lab_grant_at = datetime('now'), terms_accepted_at = datetime('now'), terms_version = ?, username = ?, kyc_step = 0, panel_unlocked = 0 WHERE lower(email) = lower(?)").bind(body.terms_version || 'node-1.0', username, email).run();
            } catch (_) {
              try {
                await env.AUTH_DB.prepare("UPDATE users SET terms_accepted_at = datetime('now'), terms_version = ?, username = ?, kyc_step = 0, panel_unlocked = 0 WHERE lower(email) = lower(?)").bind(body.terms_version || 'node-1.0', username, email).run();
              } catch (__) {}
            }
            user = await env.AUTH_DB.prepare('SELECT id, email, verification_status, clearance_level FROM users WHERE lower(email) = lower(?)').bind(email).first();
            if (user) {
              await ensureAccountGraph();
              const wrow = await env.AUTH_DB.prepare('SELECT strata_address FROM users WHERE id = ?').bind(user.id).first();
              if (wrow && wrow.strata_address) {
                await recordAccountEvent(user.id, wrow.strata_address, 'open', null, 0, 'account_open', null);
              }
            }
          }
          const token = crypto.randomUUID() + '-' + crypto.randomUUID();
          await env.AUTH_DB.prepare(
            "INSERT INTO password_tokens (email, user_id, token, purpose, expires_at) VALUES (?, ?, ?, 'invite', datetime('now', '+1 hour'))"
          ).bind(email, user.id, token).run();
          const link = ((env.PORTAL_BASE || 'https://calhegasmorais.pt').replace(/\/+$/, '')) + pathSet + '?setpw=' + encodeURIComponent(token) + '&lang=' + lang;
          const mc = mailCopy(lang, 'invite', link);
          await sendSystemEmail(env, email, mc.subject, mc.text, lang, { kind: mc.kind, code: mc.code, cta: mc.cta });
          return new Response(JSON.stringify({
            success: true,
            message: lang === 'en'
              ? 'Check your email for a one-hour link to set your password. KYC remains pending staff approval.'
              : 'Consulte o e-mail: link de 1 hora para definir a palavra-passe. O KYC continua pendente de aprovação pelo pessoal.',
            email_sent: true,
            channel: 'email',
            expires_in: 3600,
            user: { id: user.id, email: user.email, verification_status: user.verification_status || 'pending' },
          }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), { headers: corsHeaders, status: 400 });
        }
      }



      async function sessionWithClearance(env, token) {
        if (!token) return null;
        const th = await sha256Hex(token);
        let session = await env.AUTH_DB.prepare(
          "SELECT s.*, u.clearance_level AS user_clearance FROM sessions s LEFT JOIN users u ON s.user_id = u.id WHERE (s.token_hash = ? OR s.token = ?) AND s.expires_at > datetime('now')"
        ).bind(th, token).first();
        if (!session) return null;
        const uid = session.user_id;
        if (uid != null && Number(uid) < 0) {
          const sid = Math.abs(Number(uid));
          const staff = await env.AUTH_DB.prepare('SELECT id, email, role, clearance_level FROM staff WHERE id = ?').bind(sid).first();
          if (staff) {
            session.clearance_level = staff.clearance_level || 'INTERNAL';
            session.staff_id = staff.id;
            session.staff_email = staff.email;
            session.staff_role = staff.role;
            session.is_staff = true;
          }
        } else {
          session.clearance_level = session.user_clearance || session.clearance_level || 'basic';
          session.is_staff = false;
        }
        return session;
      }

      function staffClearanceOK(session, minLevels) {
        if (!session) return false;
        const c = String(session.clearance_level || '').toUpperCase();
        const allowed = (minLevels || ['INTERNAL', 'CONFIDENTIAL', 'SECRET', 'TOP_SECRET']).map((x) => x.toUpperCase());
        return allowed.includes(c);
      }


      if ((path === '/set-password-page' || path === '/password/page') && request.method === 'GET') {
        const u = new URL(request.url);
        const token = u.searchParams.get('token') || u.searchParams.get('setpw') || '';
        const lang = (u.searchParams.get('lang') || 'pt').toLowerCase().startsWith('en') ? 'en' : 'pt';
        const dest = ((env.PORTAL_BASE || 'https://calhegasmorais.pt').replace(/\/+$/, ''))
          + (lang === 'en' ? '/en/dashboard' : '/dashboard')
          + '?setpw=' + encodeURIComponent(token) + '&lang=' + lang;
        return Response.redirect(dest, 302);
      }

      if ((path === '/auth/set-password' || path === '/set-password' || path === '/password/set') && request.method === 'POST') {
        try {
          const body = await request.json().catch(() => ({}));
          const token = String(body.token || body.setpw || '').trim();
          const password = String(body.password || '');
          const lang = resolveLang(body, request);
          if (!token) {
            return new Response(JSON.stringify({ success: false, error: lang === 'en' ? 'Token required' : 'Token obrigatório' }), { headers: corsHeaders, status: 400 });
          }
          if (!password || password.length < 8) {
            return new Response(JSON.stringify({ success: false, error: lang === 'en' ? 'Password must be at least 8 characters' : 'A palavra-passe deve ter pelo menos 8 caracteres' }), { headers: corsHeaders, status: 400 });
          }
          await ensurePasswordTokenTable();
          const row = await env.AUTH_DB.prepare(
            "SELECT * FROM password_tokens WHERE token = ? AND used = 0 AND expires_at > datetime('now') ORDER BY id DESC LIMIT 1"
          ).bind(token).first();
          if (!row) {
            return new Response(JSON.stringify({ success: false, error: lang === 'en' ? 'Invalid or expired link' : 'Link inválido ou expirado' }), { headers: corsHeaders, status: 401 });
          }
          const salt = crypto.randomUUID();
          const enc = new TextEncoder();
          const keyMat = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
          const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' }, keyMat, 256);
          const hash = btoa(String.fromCharCode(...new Uint8Array(bits)));
          const password_hash = salt + ':' + hash;
          await env.AUTH_DB.prepare("UPDATE users SET password_hash = ?, email_confirmed = 1 WHERE id = ?").bind(password_hash, row.user_id).run();
          await env.AUTH_DB.prepare('UPDATE password_tokens SET used = 1 WHERE id = ?').bind(row.id).run();
          return new Response(JSON.stringify({
            success: true,
            message: lang === 'en' ? 'Password set. You may sign in (2FA code will be emailed).' : 'Palavra-passe definida. Pode iniciar sessão (o código 2FA será enviado por e-mail).',
            email: row.email,
          }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), { headers: corsHeaders, status: 500 });
        }
      }

      if ((path === '/auth/forgot-password' || path === '/forgot-password' || path === '/password/forgot') && request.method === 'POST') {
        try {
          const body = await request.json().catch(() => ({}));
          const email = String(body.email || '').trim().toLowerCase();
          const lang = resolveLang(body, request);
          const portalBase = (env.PORTAL_BASE || 'https://calhegasmorais.pt').replace(/\/+$/, '');
          const pathSet = lang === 'en' ? '/en/dashboard' : '/dashboard';
          if (!email || !email.includes('@')) {
            return new Response(JSON.stringify({ success: false, error: lang === 'en' ? 'Valid email required' : 'E-mail válido obrigatório' }), { headers: corsHeaders, status: 400 });
          }
          await ensurePasswordTokenTable();
          const user = await env.AUTH_DB.prepare('SELECT id, email FROM users WHERE lower(email) = lower(?)').bind(email).first();
          if (user) {
            const token = crypto.randomUUID() + '-' + crypto.randomUUID();
            await env.AUTH_DB.prepare(
              "INSERT INTO password_tokens (email, user_id, token, purpose, expires_at) VALUES (?, ?, ?, 'reset', datetime('now', '+1 hour'))"
            ).bind(email, user.id, token).run();
            const link = ((env.PORTAL_BASE || 'https://calhegasmorais.pt').replace(/\/+$/, '')) + pathSet + '?setpw=' + encodeURIComponent(token) + '&lang=' + lang;
            const mc = mailCopy(lang, 'reset', link);
            await sendSystemEmail(env, email, mc.subject, mc.text, lang, { kind: mc.kind, code: mc.code, cta: mc.cta });
          }
          return new Response(JSON.stringify({
            success: true,
            message: lang === 'en'
              ? 'If the email is registered, a one-hour reset link has been sent.'
              : 'Se o e-mail estiver registado, foi enviado um link de redefinição válido por 1 hora.',
            email_sent: true,
          }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), { headers: corsHeaders, status: 500 });
        }
      }


      if ((path === '/kyc/submit' || path === '/kyc/document') && request.method === 'POST') {
        try {
          await ensureKycColumns();
          const authHeader = request.headers.get('Authorization');
          if (!authHeader) return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { headers: corsHeaders, status: 401 });
          const token = authHeader.replace('Bearer ', '');
          const th = await sha256Hex(token);
          const session = await env.AUTH_DB.prepare(
            "SELECT s.*, u.id as uid FROM sessions s JOIN users u ON s.user_id = u.id WHERE (s.token_hash = ? OR s.token = ?) AND s.expires_at > datetime('now')"
          ).bind(th, token).first();
          if (!session || session.user_id < 0) {
            return new Response(JSON.stringify({ success: false, error: 'User session required' }), { headers: corsHeaders, status: 401 });
          }
          const body = await request.json().catch(() => ({}));
          const lang = resolveLang(body, request);
          const doc_type = String(body.doc_type || body.document_type || 'passport').toLowerCase();
          const sovereign_id = String(body.sovereign_id || body.document_number || body.passport_number || body.citizen_number || '').trim().toUpperCase().replace(/\s+/g, '');
          const issuing_country = String(body.issuing_country || body.country || 'PRT').toUpperCase().slice(0, 3);
          const full_name_claimed = String(body.full_name || body.full_name_claimed || '').trim();
          const mrz1 = body.mrz_line1 || body.mrz1 || '';
          const mrz2 = body.mrz_line2 || body.mrz2 || '';
          let username = body.username ? validateUsername(body.username) : null;
          if (body.username && username && !username.ok) {
            return new Response(JSON.stringify({ success: false, error: 'Invalid username', code: username.error }), { headers: corsHeaders, status: 400 });
          }
          if (!sovereign_id || sovereign_id.length < 5) {
            return new Response(JSON.stringify({ success: false, error: lang === 'en' ? 'Document number required' : 'Número de documento obrigatório' }), { headers: corsHeaders, status: 400 });
          }
          // uniqueness of sovereign_id
          const clash = await env.AUTH_DB.prepare(
            'SELECT id, email FROM users WHERE sovereign_id = ? AND id != ?'
          ).bind(sovereign_id, session.user_id).first();
          if (clash) {
            return new Response(JSON.stringify({ success: false, error: lang === 'en' ? 'This document identity is already registered on StrataMesh' : 'Esta identidade documental já está registada na StrataMesh', code: 'sovereign_id_taken' }), { headers: corsHeaders, status: 409 });
          }
          // Automated verification — ICAO 9303 MRZ (open standard) and/or PT NIF structure
          let report = { ok: false, score: 0, method: 'none' };
          if (mrz1 && mrz2) {
            report = parseAndValidateMRZ(mrz1, mrz2);
            report.method = 'ICAO_9303_MRZ';
            if (report.document_number && report.document_number !== sovereign_id.replace(/</g, '')) {
              // allow if sovereign is prefix/contains
              if (!sovereign_id.includes(report.document_number.replace(/</g, '')) && !report.document_number.includes(sovereign_id.slice(0, 6))) {
                report.checks.push({ field: 'sovereign_match', ok: false, detail: 'Document number does not match MRZ' });
                report.ok = false;
                report.score = Math.min(report.score, 0.4);
              }
            }
          } else if (doc_type === 'nif' || (issuing_country === 'PRT' && /^\d{9}$/.test(sovereign_id))) {
            const nif = validatePortugueseNIF(sovereign_id);
            report = { ok: nif.ok, score: nif.score, method: 'PT_NIF', checks: [{ field: 'nif_checksum', ok: nif.ok }] };
          } else {
            // structural minimum for national ID without MRZ (lab): length + charset
            const structural = /^[A-Z0-9]{5,20}$/.test(sovereign_id);
            report = {
              ok: false,
              score: structural ? 0.35 : 0,
              method: 'STRUCTURAL_ONLY',
              checks: [{ field: 'structure', ok: structural, detail: 'MRZ recommended for automated passport verification (ICAO 9303). Without MRZ, status stays pending_review.' }],
            };
          }
          const full_name_legal = (report.full_name && report.ok) ? report.full_name : (full_name_claimed || null);
          const auto_valid = report.ok && report.score >= 0.8 ? 1 : 0;
          const status = auto_valid ? 'verified' : 'pending_review';
          const kyc_step = auto_valid ? 3 : 2;
          const panel_unlocked = auto_valid ? 1 : 0;
          await env.AUTH_DB.prepare(
            `INSERT INTO kyc_submissions (user_id, doc_type, sovereign_id, issuing_country, full_name_claimed, mrz_line1, mrz_line2, doc_meta_json, auto_valid, auto_score, auto_report, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            session.user_id, doc_type, sovereign_id, issuing_country, full_name_claimed || null,
            mrz1 || null, mrz2 || null, JSON.stringify({ issuing_country, doc_type }).slice(0, 500),
            auto_valid, report.score || 0, JSON.stringify(report).slice(0, 4000), status
          ).run();
          await env.AUTH_DB.prepare(
            `UPDATE users SET sovereign_id = ?, full_name_legal = COALESCE(?, full_name_legal), doc_type = ?, verification_status = ?,
             kyc_step = ?, kyc_auto_score = ?, kyc_auto_report = ?, panel_unlocked = ?,
             username = COALESCE(?, username), updated_at = datetime('now') WHERE id = ?`
          ).bind(
            sovereign_id, full_name_legal, doc_type, status,
            kyc_step, report.score || 0, JSON.stringify(report).slice(0, 2000), panel_unlocked,
            username && username.ok ? username.username : null,
            session.user_id
          ).run();
          return new Response(JSON.stringify({
            success: true,
            automated: true,
            verification_standard: report.method,
            auto_valid: !!auto_valid,
            score: report.score,
            verification_status: status,
            panel_unlocked: !!panel_unlocked,
            kyc_step,
            sovereign_id,
            full_name_legal: full_name_legal || undefined,
            message: auto_valid
              ? (lang === 'en'
                ? 'Document checks passed (ICAO 9303 / open algorithms). Panel tools unlocked. Legal name stored internally (not public).'
                : 'Verificação documental automática OK (ICAO 9303 / algoritmos abertos). Ferramentas do painel desbloqueadas. Nome legal guardado internamente (não público).')
              : (lang === 'en'
                ? 'Submission received. Automated checks incomplete — pending_review (staff may assist). Panel remains locked until verified.'
                : 'Submissão recebida. Verificação automática incompleta — pending_review. Painel bloqueado até verificação.'),
            report: { ok: report.ok, score: report.score, method: report.method, checks: report.checks },
          }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), { headers: corsHeaders, status: 500 });
        }
      }


      if ((path === '/terms' || path === '/auth/terms') && request.method === 'GET') {
        const u = new URL(request.url);
        const lang = (u.searchParams.get('lang') || 'pt').toLowerCase().startsWith('en') ? 'en' : 'pt';
        const format = (u.searchParams.get('format') || '').toLowerCase();
        const version = 'node-1.0';
        const title = lang === 'en'
          ? 'Calhegas Morais Node — Terms and Conditions'
          : 'Nó Calhegas Morais — Termos e Condições';
        const sections_pt = [
          ['1. Natureza do serviço', 'O domínio e os serviços associados operam o Nó Fog de referência Calhegas Morais (FOG-NODE-PT-CM-001), em versão de laboratório da StrataMesh (tecnologia de registo distribuído). O operador da infraestrutura de laboratório é a AMCM ENI (André Manuel Calhegas Morais, Empresário em Nome Individual). Nada aqui constitui aconselhamento financeiro, oferta de valores mobiliários ou serviço bancário.'],
          ['2. Registo e credenciais', 'O registo exige aceitação expressa destes termos. Após o registo, a conta fica associada a um endereço de correio electrónico e a uma palavra-passe definida pelo utilizador através de ligação de uso único. O acesso quotidiano pode exigir autenticação de dois factores por e-mail.'],
          ['3. Identidade e verificação (KYC)', 'Para desbloquear ferramentas do painel, o Nó exige verificação de identidade documental soberana (passaporte internacional ou documento nacional oficial). A verificação automática baseia-se em padrões abertos, nomeadamente a zona de leitura óptica (MRZ) segundo ICAO 9303 e, quando aplicável, algoritmos públicos de validação estrutural (por exemplo checksums nacionais). O número de documento (identificador soberano) passa a ser o identificador de registo na StrataMesh ligado a esta conta no Nó.'],
          ['4. Dados pessoais e privacidade', 'O nome legal completo e os números de documento são dados internos de verificação — não constituem perfil público. O nome de utilizador (username), escolhido dentro das regras do Nó, é a identidade pública no ambiente do Nó. O e-mail serve comunicações de sistema (2FA, segurança, avisos).'],
          ['5. Conduta e sanções', 'É proibido o uso de documentos falsos, a usurpação de identidade, ataques à malha ou a exploração abusiva dos serviços. Em caso de abuso, o Nó pode suspender a conta. Tentativas de ataque não geram recompensa em STRATA; recursos capturados podem ser absorvidos pela malha segundo as regras anti-fragilidade do protocolo.'],
          ['6. STRATA e laboratório', 'STRATA e a Ágora, nesta fase, são mecanismos de protocolo em ensaio. Saldos ou emissões de laboratório que não resultem de Prova de Contributo efectiva do Nó não transitam automaticamente para uma eventual fase pós-laboratório, salvo regras expressas em contrário.'],
          ['7. Painel e clearance', 'As ferramentas do painel de utilizador comum desbloqueiam-se após verificação automática (ou elevação autorizada) bem-sucedida. O acesso de pessoal rege-se por clearance interna e autenticação própria, distinta do registo público.'],
          ['8. Alterações', 'A versão vigente destes termos é «' + version + '». Alterações relevantes podem ser comunicadas por e-mail de sistema ou aviso no portal. A continuação do uso após a entrada em vigor implica aceitação da versão actualizada, quando a lei aplicável o permitir.'],
          ['9. Contacto', 'AMCM ENI · geral@eni.calhegasmorais.pt · +44 7404 796458 · https://eni.calhegasmorais.pt/ · https://calhegasmorais.pt/'],
        ];
        const sections_en = [
          ['1. Nature of the service', 'The domain and related services operate the Calhegas Morais reference Fog Node (FOG-NODE-PT-CM-001), a laboratory version of StrataMesh (distributed ledger technology). Laboratory infrastructure is operated under AMCM ENI (André Manuel Calhegas Morais, sole trader). Nothing herein is financial advice, an offer of securities, or a banking service.'],
          ['2. Registration and credentials', 'Registration requires explicit acceptance of these terms. After registration, the account is bound to an email address and a password set by the user via a one-time link. Day-to-day access may require email two-factor authentication.'],
          ['3. Identity and verification (KYC)', 'To unlock panel tools, the Node requires sovereign document identity verification (international passport or official national ID). Automated checks rely on open standards, including the machine-readable zone (MRZ) under ICAO 9303 and, where applicable, public structural validation algorithms. The document number (sovereign identifier) becomes the StrataMesh registration identifier linked to this Node account.'],
          ['4. Personal data and privacy', 'Legal full name and document numbers are internal verification data — not a public profile. The username, chosen within Node rules, is the public identity on the Node. Email is used for system communications (2FA, security, notices).'],
          ['5. Conduct and sanctions', 'False documents, identity misuse, mesh attacks or abusive exploitation of services are prohibited. The Node may suspend accounts for abuse. Attack attempts do not earn STRATA rewards; captured resources may be absorbed under protocol anti-fragility rules.'],
          ['6. STRATA and laboratory status', 'STRATA and the Agora are protocol mechanisms under trial in this phase. Laboratory balances or issuances that do not result from effective Node Proof of Contribution do not automatically carry into a post-laboratory phase unless expressly stated otherwise.'],
          ['7. Panel and clearance', 'Common-user panel tools unlock after successful automated verification (or authorised elevation). Staff access is governed by internal clearance and separate authentication.'],
          ['8. Changes', 'The current terms version is «' + version + '». Material changes may be notified by system email or portal notice. Continued use after the effective date may constitute acceptance where applicable law allows.'],
          ['9. Contact', 'AMCM ENI · geral@eni.calhegasmorais.pt · +44 7404 796458 · https://eni.calhegasmorais.pt/ · https://calhegasmorais.pt/'],
        ];
        const sections = lang === 'en' ? sections_en : sections_pt;
        const bodyPlain = sections.map(function (s) { return s[0] + '. ' + s[1]; }).join(' ');
        if (format === 'json') {
          return new Response(JSON.stringify({
            success: true,
            version: version,
            lang: lang === 'en' ? 'en-GB' : 'pt-PT',
            title: title,
            body: bodyPlain,
            sections: sections.map(function (s) { return { heading: s[0], text: s[1] }; }),
            terms_url: 'https://calhegasmorais.pt/terms',
          }, null, 2), {
            headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=300' },
          });
        }
        const esc = function (s) {
          return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        };
        const articles = sections.map(function (s) {
          return '<section style="margin:0 0 1.35rem"><h2 style="font-size:1rem;font-weight:600;margin:0 0 .4rem;color:#e8e8ea">' + esc(s[0]) + '</h2><p style="margin:0;color:#a1a1aa;font-size:.92rem;line-height:1.55">' + esc(s[1]) + '</p></section>';
        }).join('');
        const back = lang === 'en' ? 'Back to portal' : 'Voltar ao portal';
        const kicker = lang === 'en' ? 'Legal · laboratory' : 'Jurídico · laboratório';
        const html = '<!DOCTYPE html><html lang="' + (lang === 'en' ? 'en-GB' : 'pt-PT') + '"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>' + esc(title) + '</title><style>body{margin:0;background:#0a0a0c;color:#e8e8ea;font-family:system-ui,-apple-system,sans-serif}a{color:#8b9cf7;text-decoration:none}a:hover{text-decoration:underline}.wrap{max-width:40rem;margin:0 auto;padding:2.5rem 1.25rem 4rem}.kicker{font-size:.65rem;letter-spacing:.14em;text-transform:uppercase;color:#71717a;margin-bottom:.75rem}h1{font-size:1.65rem;font-weight:500;margin:0 0 .35rem;letter-spacing:-.02em}.meta{font-size:.8rem;color:#71717a;margin-bottom:2rem}.foot{margin-top:2.5rem;padding-top:1.25rem;border-top:1px solid #27272a;font-size:.8rem;color:#71717a}</style></head><body><div class="wrap"><div class="kicker">' + esc(kicker) + '</div><h1>' + esc(title) + '</h1><p class="meta">Version ' + esc(version) + ' · AMCM ENI · FOG-NODE-PT-CM-001</p>' + articles + '<div class="foot"><a href="https://calhegasmorais.pt/dashboard">' + esc(back) + '</a> · <a href="https://eni.calhegasmorais.pt/">AMCM ENI</a></div></div></body></html>';
        return new Response(html, {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=300',
          },
        });
      }

      if ((path === '/stats' || path === '/kyc/stats' || path === '/users/stats') && request.method === 'GET') {
        try {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader) return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { headers: corsHeaders, status: 401 });
          const token = authHeader.replace('Bearer ', '');
          const session = await sessionWithClearance(env, token);
          if (!staffClearanceOK(session)) {
            return new Response(JSON.stringify({ success: false, error: 'Insufficient clearance', clearance: session && session.clearance_level }), { headers: corsHeaders, status: 403 });
          }
          await ensureKycColumns();
          const totalRow = await env.AUTH_DB.prepare('SELECT COUNT(*) AS c FROM users').first();
          const pendingRow = await env.AUTH_DB.prepare(
            "SELECT COUNT(*) AS c FROM users WHERE lower(verification_status) IN ('pending', 'pending_review')"
          ).first();
          const verifiedRow = await env.AUTH_DB.prepare(
            "SELECT COUNT(*) AS c FROM users WHERE lower(verification_status) = 'verified'"
          ).first();
          const rejectedRow = await env.AUTH_DB.prepare(
            "SELECT COUNT(*) AS c FROM users WHERE lower(verification_status) = 'rejected'"
          ).first();
          const unlockedRow = await env.AUTH_DB.prepare(
            'SELECT COUNT(*) AS c FROM users WHERE panel_unlocked = 1'
          ).first();
          const staffRow = await env.AUTH_DB.prepare('SELECT COUNT(*) AS c FROM staff').first();
          const total = totalRow?.c ?? 0;
          const pending = pendingRow?.c ?? 0;
          const verified = verifiedRow?.c ?? 0;
          const rejected = rejectedRow?.c ?? 0;
          const panel_unlocked = unlockedRow?.c ?? 0;
          const staff = staffRow?.c ?? 0;
          return new Response(JSON.stringify({
            success: true,
            total,
            users: total,
            pending,
            verified,
            rejected,
            panel_unlocked,
            staff,
          }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), { headers: corsHeaders, status: 500 });
        }
      }

      if ((path === '/pending' || path === '/kyc/pending') && request.method === 'GET') {
        try {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader) return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { headers: corsHeaders, status: 401 });
          const token = authHeader.replace('Bearer ', '');
          const session = await sessionWithClearance(env, token);
          if (!staffClearanceOK(session)) {
            return new Response(JSON.stringify({ success: false, error: 'Insufficient clearance', clearance: session && session.clearance_level }), { headers: corsHeaders, status: 403 });
          }
          const results = await env.AUTH_DB.prepare(
            "SELECT id, email, strata_address as wallet_address, created_at, verification_status, clearance_level, doc_type, email_confirmed FROM users WHERE lower(verification_status) = 'pending' ORDER BY id ASC"
          ).all();
          const list = (results && results.results) || [];
          return new Response(JSON.stringify({ success: true, pending: list, users: list, count: list.length }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), { headers: corsHeaders, status: 500 });
        }
      }

      if ((path === '/verified' || path === '/kyc/verified') && request.method === 'GET') {
        try {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader) return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { headers: corsHeaders, status: 401 });
          const token = authHeader.replace('Bearer ', '');
          const session = await sessionWithClearance(env, token);
          if (!staffClearanceOK(session)) {
            return new Response(JSON.stringify({ success: false, error: 'Insufficient clearance', clearance: session && session.clearance_level }), { headers: corsHeaders, status: 403 });
          }
          const results = await env.AUTH_DB.prepare(
            "SELECT id, email, verification_status, strata_address as wallet_address, clearance_level, created_at FROM users WHERE lower(verification_status) = 'verified' ORDER BY id ASC"
          ).all();
          const list = (results && results.results) || [];
          return new Response(JSON.stringify({ success: true, verified: list, users: list, count: list.length }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), { headers: corsHeaders, status: 500 });
        }
      }

      if ((path === '/verify' || path === '/kyc/verify') && request.method === 'POST') {
        try {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader) return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { headers: corsHeaders, status: 401 });
          const token = authHeader.replace('Bearer ', '');
          const session = await sessionWithClearance(env, token);
          if (!staffClearanceOK(session, ['SECRET', 'TOP_SECRET', 'INTERNAL', 'CONFIDENTIAL'])) {
            return new Response(JSON.stringify({ success: false, error: 'Insufficient clearance for KYC action', clearance: session && session.clearance_level }), { headers: corsHeaders, status: 403 });
          }
          const body = await request.json();
          const user_id = body.user_id || body.id;
          const action = body.action || body.status;
          const strata_address = body.strata_address || null;
          const status = action === 'reject' || action === 'rejected' ? 'rejected' : 'verified';
          await env.AUTH_DB.prepare('UPDATE users SET verification_status = ?, strata_address = COALESCE(?, strata_address) WHERE id = ?').bind(status, strata_address, user_id).run();
          return new Response(JSON.stringify({ success: true, user_id, verification_status: status }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), { headers: corsHeaders, status: 500 });
        }
      }

      if (path === '/wallet' && request.method === 'GET') {
        try {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader) return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { headers: corsHeaders, status: 401 });
          const token = authHeader.replace('Bearer ', '');
          const th = await sha256Hex(token);
          const session = await env.AUTH_DB.prepare("SELECT s.*, u.strata_address as wallet_address, u.token_balance FROM sessions s JOIN users u ON s.user_id = u.id WHERE (s.token_hash = ? OR s.token = ?) AND s.expires_at > datetime('now')").bind(th, token).first();
          if (!session) return new Response(JSON.stringify({ success: false, error: 'Invalid session' }), { headers: corsHeaders, status: 401 });
          return new Response(JSON.stringify({ success: true, wallet: session.wallet_address, balance: session.token_balance || 0 }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), { headers: corsHeaders, status: 500 });
        }
      }

      if ((path === '/subsistence' || path === '/payg' || path === '/lifecycle') && request.method === 'GET') {
        try {
          const authHeader = request.headers.get('Authorization') || '';
          if (!authHeader) return new Response(JSON.stringify({ ok: false, dashboard: false, error: 'anonymous — register to instantiate a dashboard' }), { status: 401, headers: corsHeaders });
          const token = authHeader.replace(/^Bearer\s+/i, '');
          const th = await sha256Hex(token);
          const user = await env.AUTH_DB.prepare("SELECT s.*, u.email, u.strata_address, u.token_balance, u.minted_poc, u.burned_pos, u.id as user_id FROM sessions s JOIN users u ON s.user_id = u.id WHERE (s.token_hash = ? OR s.token = ?) AND s.expires_at > datetime('now')").bind(th, token).first();
          if (user) {
            const wallet = await ensureUserWallet(user);
            const lv = await lifecycleView({ ...user, strata_address: wallet, token_balance: user.token_balance, minted_poc: user.minted_poc, burned_pos: user.burned_pos });
            return new Response(JSON.stringify(lv), { headers: corsHeaders });
          }
          const staff = await env.AUTH_DB.prepare("SELECT s.*, st.email FROM sessions s JOIN staff st ON ABS(s.user_id) = st.id WHERE (s.token_hash = ? OR s.token = ?) AND s.expires_at > datetime('now')").bind(th, token).first();
          if (staff) return new Response(JSON.stringify({ ok: true, dashboard: true, type: 'staff', email: staff.email, mode: 'live', static_only: false, payg_exempt: true, note: 'staff operator, not a citizen PAYG rail' }), { headers: corsHeaders });
          return new Response(JSON.stringify({ ok: false, dashboard: false, error: 'Invalid session' }), { status: 401, headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500, headers: corsHeaders });
        }
      }

      if ((path === '/payg/tick' || path === '/payg/spend') && request.method === 'POST') {
        try {
          await ensurePayg();
          const authHeader = request.headers.get('Authorization') || '';
          if (!authHeader) return new Response(JSON.stringify({ ok: false, mode: 'deny', reason: 'anonymous — dashboard is registered-only' }), { status: 401, headers: corsHeaders });
          const token = authHeader.replace(/^Bearer\s+/i, '');
          const th = await sha256Hex(token);
          const body = await request.json().catch(() => ({}));
          const action = String(body.action || 'dashboard_tick');
          const cost = Number(PAYG_RATES[action] != null ? PAYG_RATES[action] : 0.02);
          const staff = await env.AUTH_DB.prepare("SELECT s.*, st.email FROM sessions s JOIN staff st ON ABS(s.user_id) = st.id WHERE (s.token_hash = ? OR s.token = ?) AND s.expires_at > datetime('now')").bind(th, token).first();
          if (staff) return new Response(JSON.stringify({ ok: true, mode: 'live', charged: 0, action, payg_exempt: true }), { headers: corsHeaders });
          const user = await env.AUTH_DB.prepare("SELECT s.*, u.email, u.strata_address, u.token_balance, u.lab_balance, u.minted_poc, u.burned_pos, u.id as user_id FROM sessions s JOIN users u ON s.user_id = u.id WHERE (s.token_hash = ? OR s.token = ?) AND s.expires_at > datetime('now')").bind(th, token).first();
          if (!user) return new Response(JSON.stringify({ ok: false, mode: 'deny', reason: 'Invalid session' }), { status: 401, headers: corsHeaders });
          const bal = Number(user.lab_balance != null ? user.lab_balance : 0);
          const poc = Number(user.token_balance || 0);
          const mode = paygMode(bal);
          if (cost <= 0) {
            return new Response(JSON.stringify({ ok: true, mode, charged: 0, action, balance: bal, lab_balance: bal, poc_balance: poc, unit: 'L-STRATA', static_only: mode === 'static', allowed: STATIC_ACTIONS }), { headers: corsHeaders });
          }
          if (mode === 'static' || bal < PAYG_FLOOR || bal < cost + PAYG_FLOOR) {
            return new Response(JSON.stringify({
              ok: false, mode: 'static', charged: 0, action, rate: cost, balance: bal, lab_balance: bal, poc_balance: poc,
              static_only: true, allowed: STATIC_ACTIONS, unit: 'L-STRATA',
              reason: 'insufficient_subsistence — NFTs only (L-STRATA lab grant)',
              burn_pole: '#0',
            }), { status: 402, headers: corsHeaders });
          }
          const next = Math.round((bal - cost) * 1e6) / 1e6;
          const wallet = await ensureUserWallet(user);
          await env.AUTH_DB.prepare('UPDATE users SET lab_balance = ?, burned_pos = COALESCE(burned_pos,0) + ? WHERE id = ?').bind(next, cost, user.user_id).run();
          await env.AUTH_DB.prepare('INSERT INTO payg_ledger (user_id, action, amount, balance_after) VALUES (?,?,?,?)').bind(user.user_id, action, cost, next).run();
          const dagTx = await recordAccountEvent(user.user_id, wallet, 'burn', '#0', cost, action, null);
          if (env.TOKEN) {
            try {
              const burnUrl = new URL('https://token.internal/burn');
              await env.TOKEN.fetch(new Request(burnUrl.toString(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ account: wallet, amount: cost, reason: action, resource_class: 'payg' }),
              }));
            } catch (_) {}
          }
          return new Response(JSON.stringify({
            ok: true, mode: paygMode(next), charged: cost, action, balance: next,
            wallet, static_only: paygMode(next) === 'static', burn_pole: '#0', reason: 'burned_to_#0',
            dag_tx: dagTx, minted: false,
          }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500, headers: corsHeaders });
        }
      }

      if ((path === '/lifecycle/transfer' || path === '/payg/transfer') && request.method === 'POST') {
        try {
          await ensurePayg();
          const authHeader = request.headers.get('Authorization') || '';
          if (!authHeader) return new Response(JSON.stringify({ ok: false, error: 'anonymous' }), { status: 401, headers: corsHeaders });
          const token = authHeader.replace(/^Bearer\s+/i, '');
          const th = await sha256Hex(token);
          const body = await request.json().catch(() => ({}));
          const to = String(body.to || body.recipient || '');
          const amount = Number(body.amount || 0);
          if (!to || !(amount > 0)) return new Response(JSON.stringify({ ok: false, error: 'to and amount > 0' }), { status: 400, headers: corsHeaders });
          if (isPoleWallet(to)) return new Response(JSON.stringify({ ok: false, error: 'pole_not_transfer', mint: false }), { status: 403, headers: corsHeaders });
          const user = await env.AUTH_DB.prepare("SELECT s.*, u.email, u.strata_address, u.token_balance, u.minted_poc, u.burned_pos, u.id as user_id FROM sessions s JOIN users u ON s.user_id = u.id WHERE (s.token_hash = ? OR s.token = ?) AND s.expires_at > datetime('now')").bind(th, token).first();
          if (!user) return new Response(JSON.stringify({ ok: false, error: 'Invalid session' }), { status: 401, headers: corsHeaders });
          const from = await ensureUserWallet(user);
          const bal = Number(user.token_balance || 0);
          if (bal < amount + PAYG_FLOOR) return new Response(JSON.stringify({ ok: false, error: 'insufficient_subsistence', mint: false }), { status: 402, headers: corsHeaders });
          const dest = await env.AUTH_DB.prepare('SELECT id, token_balance, strata_address FROM users WHERE strata_address = ?').bind(to).first();
          if (!dest) return new Response(JSON.stringify({ ok: false, error: 'unknown_recipient' }), { status: 404, headers: corsHeaders });
          const nextFrom = Math.round((bal - amount) * 1e6) / 1e6;
          const nextTo = Math.round((Number(dest.token_balance || 0) + amount) * 1e6) / 1e6;
          await env.AUTH_DB.prepare('UPDATE users SET token_balance = ? WHERE id = ?').bind(nextFrom, user.user_id).run();
          await env.AUTH_DB.prepare('UPDATE users SET token_balance = ? WHERE id = ?').bind(nextTo, dest.id).run();
          await recordAccountEvent(user.user_id, from, 'transfer_out', null, amount, 'hire', to);
          await recordAccountEvent(dest.id, to, 'transfer_in', null, amount, 'hire', from);
          return new Response(JSON.stringify({ ok: true, from, to, amount, mint: false, reason: 'hire', balance: nextFrom }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500, headers: corsHeaders });
        }
      }
      
      if (path === '/me' && request.method === 'GET') {
        try {
          await ensurePayg();
          await ensureAccountGraph();
          const authHeader = request.headers.get('Authorization');
          if (!authHeader) return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { headers: corsHeaders, status: 401 });
          const token = authHeader.replace(/^Bearer\s+/i, '').trim();
          const th = await sha256Hex(token);
          let userSession = null;
          try {
            userSession = await env.AUTH_DB.prepare("SELECT s.*, u.email, u.clearance_level, u.verification_status, u.strata_address, u.token_balance, u.lab_balance, u.minted_poc, u.burned_pos, u.id as user_id FROM sessions s JOIN users u ON s.user_id = u.id WHERE (s.token_hash = ? OR s.token = ?) AND s.expires_at > datetime('now')").bind(th, token).first();
          } catch (_) {
            userSession = await env.AUTH_DB.prepare("SELECT s.*, u.email, u.clearance_level, u.verification_status, u.strata_address, u.token_balance, u.id as user_id FROM sessions s JOIN users u ON s.user_id = u.id WHERE (s.token_hash = ? OR s.token = ?) AND s.expires_at > datetime('now')").bind(th, token).first();
          }
          if (userSession) {
            const wallet = await ensureUserWallet(userSession);
            const life = await lifecycleView({ ...userSession, strata_address: wallet });
            const lab = Number(userSession.lab_balance != null ? userSession.lab_balance : 0);
            const poc = Number(userSession.token_balance || 0);
            return new Response(JSON.stringify({ 
              success: true, 
              type: 'user',
              email: userSession.email,
              role: userSession.clearance_level || 'basic',
              clearance: userSession.clearance_level || 'basic',
              wallet,
              balance: lab,
              lab_balance: lab,
              poc_balance: poc,
              unit: 'L-STRATA',
              verification_status: userSession.verification_status,
              subsistence: paygView({
                id: userSession.user_id,
                email: userSession.email,
                strata_address: wallet,
                token_balance: poc,
                lab_balance: lab,
              }),
              lifecycle: life,
            }), { headers: corsHeaders });
          }
          
          const staffSession = await env.AUTH_DB.prepare("SELECT s.*, st.email, st.role, st.clearance_level, st.lab_balance FROM sessions s JOIN staff st ON (s.user_id = -st.id OR ABS(s.user_id) = st.id) WHERE (s.token_hash = ? OR s.token = ?) AND s.expires_at > datetime('now')").bind(th, token).first();
          if (staffSession) {
            return new Response(JSON.stringify({ 
              success: true, 
              type: 'staff',
              email: staffSession.email,
              role: staffSession.role || 'staff',
              clearance: staffSession.clearance_level || 'INTERNAL',
              clearance_level: staffSession.clearance_level || 'INTERNAL',
              lab_balance: Number(staffSession.lab_balance != null ? staffSession.lab_balance : 500),
              poc_balance: 0,
              unit: 'L-STRATA',
              payg_exempt: true,
            }), { headers: corsHeaders });
          }
          
          return new Response(JSON.stringify({ success: false, error: 'Invalid session' }), { headers: corsHeaders, status: 401 });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), { headers: corsHeaders, status: 500 });
        }
      }
      
      
      // --- Auth method discovery (UI) ---
      if ((path === '/auth/methods' || path === '/methods') && request.method === 'GET') {
        const cmdOn = env.AUTH_CMD_ENABLED === '1' && env.CMD_CLIENT_ID;
        const eudiOn = env.AUTH_EUDI_ENABLED === '1';
        const googleOn = !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
        const appleOn = !!(env.APPLE_CLIENT_ID && env.APPLE_TEAM_ID && env.APPLE_KEY_ID && env.APPLE_PRIVATE_KEY);
        const msOn = !!(env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET);
        return new Response(JSON.stringify({
          success: true,
          methods: [
            { id: 'phone', enabled: true, label: 'Mobile SMS OTP (primary common users)', register: true, login: true,
              endpoints: { start: '/auth/phone/start', verify: '/auth/phone/verify' },
              note: 'Password optional second factor after SMS' },
            { id: 'password', enabled: true, label: 'Email + password (fallback)', register: true, login: true, turnstile: true },
            { id: 'turnstile', enabled: !!env.TURNSTILE_SECRET, sitekey: env.TURNSTILE_SITEKEY || '0x4AAAAAADF2vDlGNQpLYloe', label: 'Cloudflare Turnstile' },
            { id: 'google', enabled: googleOn, label: 'Google', register: true, login: true,
              start: '/auth/google/start', note: googleOn ? 'OIDC' : 'Set GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET' },
            { id: 'apple', enabled: appleOn, label: 'Apple', register: true, login: true,
              start: '/auth/apple/start', note: appleOn ? 'Sign in with Apple' : 'Set APPLE_CLIENT_ID, TEAM_ID, KEY_ID, PRIVATE_KEY' },
            { id: 'microsoft', enabled: msOn, label: 'Microsoft', register: true, login: true,
              start: '/auth/microsoft/start', note: msOn ? 'OIDC' : 'Set MICROSOFT_CLIENT_ID + MICROSOFT_CLIENT_SECRET' },
            { id: 'staff', enabled: true, label: 'Staff / Pessoal (email + password + 2FA)', register: false, login: true,
              endpoints: { login: '/staff/login', verify_2fa: '/staff/2fa', totp_enroll: '/staff/totp/enroll' }, note: 'Internal only · TOTP app when enrolled' },
            { id: 'cmd', enabled: !!cmdOn, label: 'Chave Móvel Digital (Portugal)', register: true, login: true,
              note: cmdOn ? 'Autenticação.gov' : 'Pending AMA SP — lab' },
            { id: 'eudi', enabled: !!eudiOn, label: 'EU Digital Identity Wallet', register: true, login: true,
              note: eudiOn ? 'OpenID4VP' : 'Pending RP — lab' },
          ],
          default: 'password',
          oauth_redirect_base: env.OAUTH_REDIRECT_BASE || 'https://stratamesh-auth.stratamesh.workers.dev',
          documentation: 'docs/AUTH-SOCIAL-OAUTH.md'
        }), { headers: corsHeaders });
      }

      // --- CMD (Portugal) OAuth start ---
      if ((path === '/auth/cmd/start' || path === '/cmd/start') && request.method === 'GET') {
        if (env.AUTH_CMD_ENABLED !== '1' || !env.CMD_CLIENT_ID || !env.CMD_AUTH_URL) {
          return new Response(JSON.stringify({
            success: false,
            error: 'CMD not configured',
            code: 'CMD_NOT_CONFIGURED',
            how: 'Register as Service Provider at Autenticação.gov (OAuth), set CMD_* secrets and AUTH_CMD_ENABLED=1',
            docs: 'https://github.com/amagovpt/doc-AUTENTICACAO',
            local_docs: 'docs/AUTH-EU-DIGITAL-ID.md'
          }), { status: 501, headers: corsHeaders });
        }
        const state = crypto.randomUUID();
        const redirect = env.CMD_REDIRECT_URI || (url.origin + '/auth/cmd/callback');
        const authUrl = new URL(env.CMD_AUTH_URL);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('client_id', env.CMD_CLIENT_ID);
        authUrl.searchParams.set('redirect_uri', redirect);
        authUrl.searchParams.set('state', state);
        if (env.CMD_SCOPE) authUrl.searchParams.set('scope', env.CMD_SCOPE);
        return new Response(JSON.stringify({
          success: true,
          authorize_url: authUrl.toString(),
          state
        }), { headers: corsHeaders });
      }

      if ((path === '/auth/cmd/callback' || path === '/cmd/callback') && request.method === 'GET') {
        if (env.AUTH_CMD_ENABLED !== '1') {
          return new Response(JSON.stringify({ success: false, error: 'CMD not configured' }), { status: 501, headers: corsHeaders });
        }
        // Token exchange + user upsert implemented after AMA credentials are available
        return new Response(JSON.stringify({
          success: false,
          error: 'CMD callback handler awaiting provider credentials (token URL + attribute mapping)',
          code: 'CMD_CALLBACK_STUB'
        }), { status: 501, headers: corsHeaders });
      }

      // --- EUDI Wallet start ---
      if ((path === '/auth/eudi/start' || path === '/eudi/start') && request.method === 'GET') {
        if (env.AUTH_EUDI_ENABLED !== '1') {
          return new Response(JSON.stringify({
            success: false,
            error: 'EUDI not configured',
            code: 'EUDI_NOT_CONFIGURED',
            how: 'Register as Wallet Relying Party; implement OpenID4VP verifier; set AUTH_EUDI_ENABLED=1',
            docs: 'https://github.com/eu-digital-identity-wallet'
          }), { status: 501, headers: corsHeaders });
        }
        return new Response(JSON.stringify({ success: false, error: 'EUDI flow not yet wired' }), { status: 501, headers: corsHeaders });
      }

      
      // ========== Social OAuth (Google / Apple / Microsoft) ==========
      async function issueUserSession(user) {
        const token = crypto.randomUUID() + '.' + crypto.randomUUID();
        const token_hash = await sha256Hex(token);
        await env.AUTH_DB.prepare(
          "INSERT INTO sessions (user_id, token, token_hash, expires_at) VALUES (?, ?, ?, datetime('now', '+30 days'))"
        ).bind(user.id, 'redacted', token_hash).run();
        return {
          success: true,
          type: 'user',
          token,
          email: user.email,
          clearance: user.clearance_level || 'basic',
          verification_status: user.verification_status,
          role: 'user',
          provider: user._provider || 'social',
        };
      }

      async function upsertSocialUser(email, provider, subject) {
        email = String(email || '').trim().toLowerCase();
        if (!email || !email.includes('@')) throw new Error('Provider did not return email');
        let user = await env.AUTH_DB.prepare('SELECT * FROM users WHERE lower(email) = lower(?)').bind(email).first();
        const doc_hash = ('oauth_' + provider + '_' + String(subject || email)).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120);
        if (!user) {
          const salt = crypto.randomUUID();
          const password_hash = salt + ':social_no_password';
          await env.AUTH_DB.prepare(
            "INSERT INTO users (email, password_hash, strata_address, verification_status, doc_type, doc_hash, clearance_level, email_confirmed) VALUES (?, ?, NULL, 'verified', ?, ?, 'basic', 1)"
          ).bind(email, password_hash, 'oauth_' + provider, doc_hash).run();
          try {
            await env.AUTH_DB.prepare("UPDATE users SET lab_balance = 50, lab_grant_at = datetime('now') WHERE lower(email) = lower(?)").bind(email).run();
          } catch (_) {}
          user = await env.AUTH_DB.prepare('SELECT * FROM users WHERE lower(email) = lower(?)').bind(email).first();
        } else {
          await env.AUTH_DB.prepare(
            "UPDATE users SET email_confirmed = 1, verification_status = CASE WHEN verification_status = 'pending' THEN 'verified' ELSE verification_status END, updated_at = datetime('now') WHERE id = ?"
          ).bind(user.id).run();
          user = await env.AUTH_DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first();
        }
        user._provider = provider;
        return user;
      }

      function oauthRedirectUri(provider, env, url) {
        const base = (env.OAUTH_REDIRECT_BASE || url.origin).replace(/\/$/, '');
        return base + '/auth/' + provider + '/callback';
      }

      if ((path === '/auth/google/start' || path === '/google/start') && request.method === 'GET') {
        if (!env.GOOGLE_CLIENT_ID) {
          return new Response(JSON.stringify({ success: false, code: 'GOOGLE_NOT_CONFIGURED', error: 'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET' }), { status: 501, headers: corsHeaders });
        }
        const redirect_uri = oauthRedirectUri('google', env, url);
        const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        u.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
        u.searchParams.set('redirect_uri', redirect_uri);
        u.searchParams.set('response_type', 'code');
        u.searchParams.set('scope', 'openid email profile');
        u.searchParams.set('state', crypto.randomUUID());
        u.searchParams.set('access_type', 'online');
        u.searchParams.set('prompt', 'select_account');
        if (url.searchParams.get('json') === '1') {
          return new Response(JSON.stringify({ success: true, authorize_url: u.toString(), redirect_uri }), { headers: corsHeaders });
        }
        return Response.redirect(u.toString(), 302);
      }

      if ((path === '/auth/google/callback' || path === '/google/callback') && request.method === 'GET') {
        try {
          if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
            return new Response(JSON.stringify({ success: false, error: 'Google not configured' }), { status: 501, headers: corsHeaders });
          }
          const code = url.searchParams.get('code');
          if (!code) return new Response(JSON.stringify({ success: false, error: 'missing code' }), { status: 400, headers: corsHeaders });
          const redirect_uri = oauthRedirectUri('google', env, url);
          const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              code,
              client_id: env.GOOGLE_CLIENT_ID,
              client_secret: env.GOOGLE_CLIENT_SECRET,
              redirect_uri,
              grant_type: 'authorization_code',
            }),
          });
          const tok = await tokenRes.json();
          if (!tok.access_token) {
            return new Response(JSON.stringify({ success: false, error: 'token exchange failed', detail: tok }), { status: 400, headers: corsHeaders });
          }
          const ui = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
            headers: { Authorization: 'Bearer ' + tok.access_token },
          }).then((r) => r.json());
          const user = await upsertSocialUser(ui.email, 'google', ui.sub);
          const session = await issueUserSession(user);
          const portal = env.PORTAL_URL || 'https://stratamesh-spa.stratamesh.workers.dev/dashboard';
          return Response.redirect(portal + (portal.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(session.token) + '&provider=google', 302);
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: corsHeaders });
        }
      }

      if ((path === '/auth/microsoft/start' || path === '/microsoft/start') && request.method === 'GET') {
        if (!env.MICROSOFT_CLIENT_ID) {
          return new Response(JSON.stringify({ success: false, code: 'MICROSOFT_NOT_CONFIGURED', error: 'Set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET' }), { status: 501, headers: corsHeaders });
        }
        const tenant = env.MICROSOFT_TENANT || 'common';
        const redirect_uri = oauthRedirectUri('microsoft', env, url);
        const u = new URL('https://login.microsoftonline.com/' + tenant + '/oauth2/v2.0/authorize');
        u.searchParams.set('client_id', env.MICROSOFT_CLIENT_ID);
        u.searchParams.set('response_type', 'code');
        u.searchParams.set('redirect_uri', redirect_uri);
        u.searchParams.set('response_mode', 'query');
        u.searchParams.set('scope', 'openid email profile User.Read');
        u.searchParams.set('state', crypto.randomUUID());
        if (url.searchParams.get('json') === '1') {
          return new Response(JSON.stringify({ success: true, authorize_url: u.toString(), redirect_uri }), { headers: corsHeaders });
        }
        return Response.redirect(u.toString(), 302);
      }

      if ((path === '/auth/microsoft/callback' || path === '/microsoft/callback') && request.method === 'GET') {
        try {
          if (!env.MICROSOFT_CLIENT_ID || !env.MICROSOFT_CLIENT_SECRET) {
            return new Response(JSON.stringify({ success: false, error: 'Microsoft not configured' }), { status: 501, headers: corsHeaders });
          }
          const code = url.searchParams.get('code');
          if (!code) return new Response(JSON.stringify({ success: false, error: 'missing code' }), { status: 400, headers: corsHeaders });
          const tenant = env.MICROSOFT_TENANT || 'common';
          const redirect_uri = oauthRedirectUri('microsoft', env, url);
          const tokenRes = await fetch('https://login.microsoftonline.com/' + tenant + '/oauth2/v2.0/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              code,
              client_id: env.MICROSOFT_CLIENT_ID,
              client_secret: env.MICROSOFT_CLIENT_SECRET,
              redirect_uri,
              grant_type: 'authorization_code',
              scope: 'openid email profile User.Read',
            }),
          });
          const tok = await tokenRes.json();
          if (!tok.access_token) {
            return new Response(JSON.stringify({ success: false, error: 'token exchange failed', detail: tok }), { status: 400, headers: corsHeaders });
          }
          const ui = await fetch('https://graph.microsoft.com/v1.0/me', {
            headers: { Authorization: 'Bearer ' + tok.access_token },
          }).then((r) => r.json());
          const email = ui.mail || ui.userPrincipalName;
          const user = await upsertSocialUser(email, 'microsoft', ui.id);
          const session = await issueUserSession(user);
          const portal = env.PORTAL_URL || 'https://stratamesh-spa.stratamesh.workers.dev/dashboard';
          return Response.redirect(portal + (portal.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(session.token) + '&provider=microsoft', 302);
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: corsHeaders });
        }
      }

      if ((path === '/auth/apple/start' || path === '/apple/start') && request.method === 'GET') {
        if (!env.APPLE_CLIENT_ID) {
          return new Response(JSON.stringify({ success: false, code: 'APPLE_NOT_CONFIGURED', error: 'Set APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY' }), { status: 501, headers: corsHeaders });
        }
        const redirect_uri = oauthRedirectUri('apple', env, url);
        const u = new URL('https://appleid.apple.com/auth/authorize');
        u.searchParams.set('client_id', env.APPLE_CLIENT_ID);
        u.searchParams.set('redirect_uri', redirect_uri);
        u.searchParams.set('response_type', 'code');
        u.searchParams.set('response_mode', 'form_post');
        u.searchParams.set('scope', 'name email');
        u.searchParams.set('state', crypto.randomUUID());
        if (url.searchParams.get('json') === '1') {
          return new Response(JSON.stringify({ success: true, authorize_url: u.toString(), redirect_uri }), { headers: corsHeaders });
        }
        return Response.redirect(u.toString(), 302);
      }

      if ((path === '/auth/apple/callback' || path === '/apple/callback') && (request.method === 'POST' || request.method === 'GET')) {
        return new Response(JSON.stringify({
          success: false,
          code: 'APPLE_CALLBACK_PARTIAL',
          error: 'Apple token exchange needs APPLE_* key material for client_secret JWT',
        }), { status: 501, headers: corsHeaders });
      }


      return new Response(JSON.stringify({ error: 'Not Found', path }), { status: 404, headers: corsHeaders });
    }
  };