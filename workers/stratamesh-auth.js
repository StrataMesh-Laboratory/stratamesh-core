export default {
    async fetch(request, env) {
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
      if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

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
          "INSERT INTO sessions (user_id, token, token_hash, expires_at) VALUES (?, ?, ?, datetime('now', '+24 hours'))"
        ).bind(userId, 'redacted', token_hash).run();
        return token;
      }
      async function verifyTurnstile(env, token, ip) {
        const secret = env.TURNSTILE_SECRET;
        if (!secret) return { ok: true, skipped: true, reason: 'no_secret_configured' };
        if (!token || String(token).length < 10) return { ok: false, error: 'turnstile_token_required' };
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
          return { ok: false, error: 'turnstile_failed', codes: (j && j['error-codes']) || [] };
        } catch (e) {
          return { ok: false, error: 'turnstile_verify_error', detail: String(e.message || e) };
        }
      }

      
      // Health / diagnostic endpoint
      if (path === '/health' && request.method === 'GET') {
        const diagnostics = {
          success: true,
          timestamp: new Date().toISOString(),
          worker: 'stratamesh-auth',
          version: '2.6.0-turnstile-session-hash',
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
          const { email, password } = await request.json();
          if (!email || !password) {
            return new Response(JSON.stringify({ success: false, error: 'Email and password required' }), { headers: corsHeaders, status: 400 });
          }
          
          const user = await env.AUTH_DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
          if (user) {
            const [salt, storedHash] = user.password_hash.split(':');
            const enc = new TextEncoder();
            const keyMat = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
            const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' }, keyMat, 256);
            const hash = btoa(String.fromCharCode(...new Uint8Array(bits)));
            if (hash !== storedHash) {
              return new Response(JSON.stringify({ success: false, error: 'Invalid password' }), { headers: corsHeaders, status: 401 });
            }
            const token = await issueSession(env, user.id);
            return new Response(JSON.stringify({ 
              success: true, 
              token, 
              type: 'user',
              role: user.clearance_level || 'basic',
              clearance: user.clearance_level || 'basic',
              email: user.email,
              wallet: user.strata_address,
              verification_status: user.verification_status
            }), { headers: corsHeaders });
          }
          
          const staff = await env.AUTH_DB.prepare('SELECT * FROM staff WHERE email = ?').bind(email).first();
          if (staff) {
            const [salt, storedHash] = staff.password_hash.split(':');
            const enc = new TextEncoder();
            const keyMat = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
            const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' }, keyMat, 256);
            const hash = btoa(String.fromCharCode(...new Uint8Array(bits)));
            if (hash !== storedHash) {
              return new Response(JSON.stringify({ success: false, error: 'Invalid password' }), { headers: corsHeaders, status: 401 });
            }
            const token = crypto.randomUUID();
            await env.AUTH_DB.prepare("UPDATE staff SET last_login = datetime('now') WHERE id = ?").bind(staff.id).run();
            await env.AUTH_DB.prepare("INSERT INTO sessions (user_id, token, token_hash, expires_at) VALUES (?, ?, ?, datetime('now', '+24 hours'))").bind(-staff.id, token, token).run();
            return new Response(JSON.stringify({ 
              success: true, 
              token, 
              type: 'staff',
              role: staff.role || 'staff',
              clearance: staff.clearance_level || 'INTERNAL',
              email: staff.email
            }), { headers: corsHeaders });
          }
          
          return new Response(JSON.stringify({ success: false, error: 'User not found' }), { headers: corsHeaders, status: 404 });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), { headers: corsHeaders, status: 500 });
        }
      }
      

      // --- STAFF-only login (separate from public users / future CMD) ---
      if ((path === '/staff/login' || path === '/staff-login') && request.method === 'POST') {
        try {
          const { email, password } = await request.json();
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
          // Ensure OTP table
          await env.AUTH_DB.prepare(`CREATE TABLE IF NOT EXISTS staff_otp (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            staff_id INTEGER NOT NULL,
            code TEXT NOT NULL,
            challenge TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            used INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
          )`).run();
          const code = String(Math.floor(100000 + Math.random() * 900000));
          const challenge = crypto.randomUUID();
          await env.AUTH_DB.prepare(
            "INSERT INTO staff_otp (staff_id, code, challenge, expires_at) VALUES (?, ?, ?, datetime('now', '+10 minutes'))"
          ).bind(staff.id, code, challenge).run();
          // Lab: no mail provider bound — echo OTP when LAB_OTP_ECHO=1 (default true in lab)
          const echo = env.LAB_OTP_ECHO !== '0';
          const channel = env.STAFF_2FA_CHANNEL || 'email';
          return new Response(JSON.stringify({
            success: true,
            requires_2fa: true,
            challenge,
            channel,
            message: 'Staff password OK. Enter the 6-digit code (lab 2FA).',
            // Production: send code via email/SMS provider; never echo.
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
          if (!row || String(row.code) !== String(code).trim()) {
            return new Response(JSON.stringify({ success: false, error: 'Invalid or expired 2FA code' }), { headers: corsHeaders, status: 401 });
          }
          await env.AUTH_DB.prepare('UPDATE staff_otp SET used = 1 WHERE id = ?').bind(row.id).run();
          const staff = await env.AUTH_DB.prepare('SELECT * FROM staff WHERE id = ?').bind(row.staff_id).first();
          if (!staff) {
            return new Response(JSON.stringify({ success: false, error: 'Staff not found' }), { headers: corsHeaders, status: 401 });
          }
          const token = crypto.randomUUID();
          await env.AUTH_DB.prepare("UPDATE staff SET last_login = datetime('now') WHERE id = ?").bind(staff.id).run();
          await env.AUTH_DB.prepare(
            "INSERT INTO sessions (user_id, token, token_hash, expires_at) VALUES (?, ?, ?, datetime('now', '+24 hours'))"
          ).bind(-staff.id, token, token).run();
          return new Response(JSON.stringify({
            success: true,
            type: 'staff',
            token,
            role: staff.role || 'staff',
            clearance: staff.clearance_level || 'INTERNAL',
            email: staff.email,
            message: 'Staff session issued after 2FA'
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
          const password = String(body.password || '');
          const wallet_address = body.wallet_address || body.strata_address || null;
          const doc_type = String(body.doc_type || body.document_type || 'passport').slice(0, 64);
          if (!email || !email.includes('@')) {
            return new Response(JSON.stringify({ success: false, error: 'Valid email required' }), { headers: corsHeaders, status: 400 });
          }
          if (!password || password.length < 8) {
            return new Response(JSON.stringify({ success: false, error: 'Password must be at least 8 characters' }), { headers: corsHeaders, status: 400 });
          }
          const tsToken = body['cf-turnstile-response'] || body.turnstile_token || body.turnstile || '';
          const ip = request.headers.get('CF-Connecting-IP') || '';
          const ts = await verifyTurnstile(env, tsToken, ip);
          if (!ts.ok) {
            return new Response(JSON.stringify({ success: false, error: ts.error || 'turnstile_failed', codes: ts.codes || [] }), { headers: corsHeaders, status: 400 });
          }
          const existing = await env.AUTH_DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
          if (existing) {
            return new Response(JSON.stringify({ success: false, error: 'Email already registered' }), { headers: corsHeaders, status: 409 });
          }
          const salt = crypto.randomUUID();
          const enc = new TextEncoder();
          const keyMat = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
          const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' }, keyMat, 256);
          const hash = btoa(String.fromCharCode(...new Uint8Array(bits)));
          const password_hash = salt + ':' + hash;
          const doc_hash = 'pending_' + crypto.randomUUID().replace(/-/g, '');
          await env.AUTH_DB.prepare(
            'INSERT INTO users (email, password_hash, strata_address, verification_status, doc_type, doc_hash, clearance_level, email_confirmed) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(email, password_hash, wallet_address || null, 'pending', doc_type, doc_hash, 'basic', 0).run();
          const user = await env.AUTH_DB.prepare('SELECT id, email, verification_status, clearance_level FROM users WHERE email = ?').bind(email).first();
          return new Response(JSON.stringify({
            success: true,
            message: 'Registration successful. Verification pending. You can log in; elevated clearance requires review.',
            user
          }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), { headers: corsHeaders, status: 400 });
        }
      }
      
      if (path === '/pending' && request.method === 'GET') {
        try {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader) return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { headers: corsHeaders, status: 401 });
          const token = authHeader.replace('Bearer ', '');
          const th = await sha256Hex(token);
          const session = await env.AUTH_DB.prepare("SELECT s.*, u.clearance_level FROM sessions s LEFT JOIN users u ON s.user_id = u.id WHERE (s.token_hash = ? OR s.token = ?) AND s.expires_at > datetime('now')").bind(th, token).first();
          if (!session || (session.clearance_level !== 'INTERNAL' && session.clearance_level !== 'CONFIDENTIAL' && session.clearance_level !== 'SECRET' && session.clearance_level !== 'TOP_SECRET')) {
            return new Response(JSON.stringify({ success: false, error: 'Insufficient clearance' }), { headers: corsHeaders, status: 403 });
          }
          const results = await env.AUTH_DB.prepare("SELECT id, email, strata_address as wallet_address, created_at, verification_status FROM users WHERE verification_status = ?").bind('pending').all();
          return new Response(JSON.stringify({ success: true, pending: results.results }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), { headers: corsHeaders, status: 500 });
        }
      }
      
      if (path === '/verify' && request.method === 'POST') {
        try {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader) return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { headers: corsHeaders, status: 401 });
          const token = authHeader.replace('Bearer ', '');
          const th = await sha256Hex(token);
          const session = await env.AUTH_DB.prepare("SELECT s.*, u.clearance_level FROM sessions s LEFT JOIN users u ON s.user_id = u.id WHERE (s.token_hash = ? OR s.token = ?) AND s.expires_at > datetime('now')").bind(th, token).first();
          if (!session || (session.clearance_level !== 'SECRET' && session.clearance_level !== 'TOP_SECRET')) {
            return new Response(JSON.stringify({ success: false, error: 'Insufficient clearance: SECRET required' }), { headers: corsHeaders, status: 403 });
          }
          const { user_id, action, strata_address } = await request.json();
          const status = action === 'approve' ? 'verified' : 'rejected';
          await env.AUTH_DB.prepare('UPDATE users SET verification_status = ?, strata_address = ? WHERE id = ?').bind(status, strata_address || null, user_id).run();
          return new Response(JSON.stringify({ success: true, status }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), { headers: corsHeaders, status: 500 });
        }
      }
      
      if (path === '/verified' && request.method === 'GET') {
        try {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader) return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { headers: corsHeaders, status: 401 });
          const token = authHeader.replace('Bearer ', '');
          const th = await sha256Hex(token);
          const session = await env.AUTH_DB.prepare("SELECT s.*, u.clearance_level FROM sessions s LEFT JOIN users u ON s.user_id = u.id WHERE (s.token_hash = ? OR s.token = ?) AND s.expires_at > datetime('now')").bind(th, token).first();
          if (!session || (session.clearance_level !== 'INTERNAL' && session.clearance_level !== 'CONFIDENTIAL' && session.clearance_level !== 'SECRET' && session.clearance_level !== 'TOP_SECRET')) {
            return new Response(JSON.stringify({ success: false, error: 'Insufficient clearance' }), { headers: corsHeaders, status: 403 });
          }
          const results = await env.AUTH_DB.prepare("SELECT id, email, verification_status, strata_address FROM users WHERE verification_status = ?").bind('verified').all();
          return new Response(JSON.stringify({ success: true, verified: results.results }), { headers: corsHeaders });
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
      
      if (path === '/me' && request.method === 'GET') {
        try {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader) return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { headers: corsHeaders, status: 401 });
          const token = authHeader.replace('Bearer ', '');
          const th = await sha256Hex(token);
          const userSession = await env.AUTH_DB.prepare("SELECT s.*, u.email, u.clearance_level, u.verification_status, u.strata_address, u.token_balance FROM sessions s JOIN users u ON s.user_id = u.id WHERE (s.token_hash = ? OR s.token = ?) AND s.expires_at > datetime('now')").bind(th, token).first();
          if (userSession) {
            return new Response(JSON.stringify({ 
              success: true, 
              type: 'user',
              email: userSession.email,
              role: userSession.clearance_level || 'basic',
              clearance: userSession.clearance_level || 'basic',
              wallet: userSession.strata_address,
              balance: userSession.token_balance || 0,
              verification_status: userSession.verification_status
            }), { headers: corsHeaders });
          }
          
          const staffSession = await env.AUTH_DB.prepare("SELECT s.*, st.email, st.role, st.clearance_level FROM sessions s JOIN staff st ON ABS(s.user_id) = st.id WHERE s.token = ? AND s.expires_at > datetime('now')").bind(token).first();
          if (staffSession) {
            return new Response(JSON.stringify({ 
              success: true, 
              type: 'staff',
              email: staffSession.email,
              role: staffSession.role || 'staff',
              clearance: staffSession.clearance_level || 'INTERNAL'
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
              endpoints: { login: '/staff/login', verify_2fa: '/staff/2fa' }, note: 'Internal only' },
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