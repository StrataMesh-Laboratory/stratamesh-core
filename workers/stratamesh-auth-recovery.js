export default {
  async fetch(r, e) {
    const u = new URL(r.url);
    let path = u.pathname;
    if (path.startsWith('/api/auth-recovery')) path = path.slice('/api/auth-recovery'.length) || '/';
    else if (path.startsWith('/api/recovery')) path = path.slice('/api/recovery'.length) || '/';
    if (!path.startsWith('/')) path = '/' + path;
    const j = (d, s = 200) => new Response(JSON.stringify(d), {
      status: s,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
    if (r.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization'
        }
      });
    }
    if (path === '/health' && r.method === 'GET') {
      return j({ success: true, worker: 'stratamesh-auth-recovery', timestamp: new Date().toISOString() });
    }
    try {
      if (path === '/request-recovery' && r.method === 'POST') {
        const { email } = await r.json();
        const user = await e.AUTH_DB.prepare('SELECT id,email,verification_status FROM users WHERE email=?').bind(email).first();
        if (!user) return j({ error: 'If email exists, recovery instructions sent' }, 200);
        const code = crypto.randomUUID().split('-')[0];
        const exp = new Date(Date.now() + 3600000).toISOString();
        await e.AUTH_DB.prepare('INSERT INTO password_recovery (user_id,code,expires_at,used) VALUES (?,?,?,0)').bind(user.id, code, exp).run();
        if (e.RATE_LIMIT) await e.RATE_LIMIT.put('rc:' + email, code, { expirationTtl: 3600 });
        return j({ message: 'Recovery code sent to your email', code_hint: code });
      }
      if (path === '/verify-recovery' && r.method === 'POST') {
        const { email, code } = await r.json();
        const user = await e.AUTH_DB.prepare('SELECT id FROM users WHERE email=?').bind(email).first();
        if (!user) return j({ error: 'Invalid' }, 400);
        const row = await e.AUTH_DB.prepare("SELECT * FROM password_recovery WHERE user_id=? AND code=? AND used=0 AND expires_at > datetime('now')").bind(user.id, code).first();
        if (!row) return j({ error: 'Invalid or expired code' }, 400);
        return j({ success: true, recovery_id: row.id, message: 'Code verified' });
      }
      if (path === '/reset-password' && r.method === 'POST') {
        const { email, code, password } = await r.json();
        if (!email || !code || !password) return j({ error: 'email, code, password required' }, 400);
        const user = await e.AUTH_DB.prepare('SELECT id FROM users WHERE email=?').bind(email).first();
        if (!user) return j({ error: 'Invalid' }, 400);
        const row = await e.AUTH_DB.prepare("SELECT * FROM password_recovery WHERE user_id=? AND code=? AND used=0 AND expires_at > datetime('now')").bind(user.id, code).first();
        if (!row) return j({ error: 'Invalid or expired code' }, 400);
        const salt = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
        const enc = new TextEncoder();
        const keyMat = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);
        const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' }, keyMat, 256);
        const hash = [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
        await e.AUTH_DB.prepare('UPDATE users SET password_hash=? WHERE id=?').bind(salt + ':' + hash, user.id).run();
        await e.AUTH_DB.prepare('UPDATE password_recovery SET used=1 WHERE id=?').bind(row.id).run();
        return j({ success: true, message: 'Password updated' });
      }
      if ((path === '/grok-inbox' || path === '/inbox') && r.method === 'GET') {
        const auth = r.headers.get('Authorization') || '';
        const ok = e.AUTH_TOKEN && (auth === 'Bearer ' + e.AUTH_TOKEN || auth === e.AUTH_TOKEN);
        if (!ok) return j({ error: 'Unauthorized' }, 401);
        if (!e.RATE_LIMIT) return j({ error: 'no kv' }, 500);
        const latest = await e.RATE_LIMIT.get('grok-mail:latest');
        const index = JSON.parse((await e.RATE_LIMIT.get('grok-mail:index')) || '[]');
        const items = [];
        for (const id of index.slice(0, 10)) {
          const row = await e.RATE_LIMIT.get('grok-mail:' + id);
          if (row) items.push(JSON.parse(row));
        }
        return j({ success: true, latest: latest ? JSON.parse(latest) : null, items });
      }
      return j({ error: 'Not Found', path }, 404);
    } catch (err) {
      return j({ error: String(err.message || err) }, 500);
    }
  },

  async email(message, env) {
    const raw = await new Response(message.raw).text();
    const rec = {
      id: Date.now().toString(36) + '-' + crypto.randomUUID().slice(0, 8),
      from: message.from,
      to: message.to,
      subject: message.headers.get('subject') || '',
      receivedAt: new Date().toISOString(),
      text: raw.slice(0, 24000)
    };
    if (env.RATE_LIMIT) {
      await env.RATE_LIMIT.put('grok-mail:' + rec.id, JSON.stringify(rec), { expirationTtl: 604800 });
      await env.RATE_LIMIT.put('grok-mail:latest', JSON.stringify(rec), { expirationTtl: 604800 });
      const idx = JSON.parse((await env.RATE_LIMIT.get('grok-mail:index')) || '[]');
      idx.unshift(rec.id);
      await env.RATE_LIMIT.put('grok-mail:index', JSON.stringify(idx.slice(0, 50)), { expirationTtl: 604800 });
    }
  }
};
