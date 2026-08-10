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
      
      // Health / diagnostic endpoint
      if (path === '/health' && request.method === 'GET') {
        const diagnostics = {
          success: true,
          timestamp: new Date().toISOString(),
          worker: 'stratamesh-auth',
          version: '2.1.0',
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
            const token = crypto.randomUUID();
            await env.AUTH_DB.prepare("INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, datetime('now', '+24 hours'))").bind(user.id, token).run();
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
            await env.AUTH_DB.prepare("INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, datetime('now', '+24 hours'))").bind(-staff.id, token).run();
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
      
      if (path === '/staff-login' && request.method === 'POST') {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Use /login endpoint. Staff login is now unified.',
          redirect: '/login'
        }), { headers: corsHeaders, status: 410 });
      }
      
      if (path === '/register' && request.method === 'POST') {
        try {
          const { email, password, wallet_address } = await request.json();
          const salt = crypto.randomUUID();
          const enc = new TextEncoder();
          const keyMat = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
          const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' }, keyMat, 256);
          const hash = btoa(String.fromCharCode(...new Uint8Array(bits)));
          const password_hash = salt + ':' + hash;
          await env.AUTH_DB.prepare('INSERT INTO users (email, password_hash, wallet_address, status, doc_type, doc_hash) VALUES (?, ?, ?, ?, ?, ?)').bind(email, password_hash, wallet_address || null, 'pending', 'passport', 'pending').run();
          return new Response(JSON.stringify({ success: true, message: 'Registration successful' }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), { headers: corsHeaders, status: 400 });
        }
      }
      
      if (path === '/pending' && request.method === 'GET') {
        try {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader) return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { headers: corsHeaders, status: 401 });
          const token = authHeader.replace('Bearer ', '');
          const session = await env.AUTH_DB.prepare("SELECT s.*, u.clearance_level FROM sessions s LEFT JOIN users u ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > datetime('now')").bind(token).first();
          if (!session || (session.clearance_level !== 'INTERNAL' && session.clearance_level !== 'CONFIDENTIAL' && session.clearance_level !== 'SECRET' && session.clearance_level !== 'TOP_SECRET')) {
            return new Response(JSON.stringify({ success: false, error: 'Insufficient clearance' }), { headers: corsHeaders, status: 403 });
          }
          const results = await env.AUTH_DB.prepare("SELECT id, email, wallet_address, created_at, verification_status FROM users WHERE status = ? OR verification_status = ?").bind('pending', 'pending').all();
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
          const session = await env.AUTH_DB.prepare("SELECT s.*, u.clearance_level FROM sessions s LEFT JOIN users u ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > datetime('now')").bind(token).first();
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
          const session = await env.AUTH_DB.prepare("SELECT s.*, u.clearance_level FROM sessions s LEFT JOIN users u ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > datetime('now')").bind(token).first();
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
          const session = await env.AUTH_DB.prepare("SELECT s.*, u.wallet_address, u.token_balance FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > datetime('now')").bind(token).first();
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
          
          const userSession = await env.AUTH_DB.prepare("SELECT s.*, u.email, u.clearance_level, u.verification_status, u.strata_address, u.token_balance FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > datetime('now')").bind(token).first();
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
      
      return new Response(JSON.stringify({ error: 'Not Found', path }), { status: 404, headers: corsHeaders });
    }
  };