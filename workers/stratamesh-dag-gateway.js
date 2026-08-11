export default {
    async fetch(request, env) {
      const url = new URL(request.url);
      const path = url.pathname;
      
      // CORS headers
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-StrataMesh-Key',
      };
      
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
      }
      
      // Helper: JSON response
      const json = (data, status = 200) => new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
      
      // POST /api/v1/submit — full DAG+IPFS pipeline (proxy to stratamesh-dag)
      if (path === '/health' || path === '/api/v1/health' || path === '/') {
        return json({ status: 'ok', service: 'stratamesh-dag-gateway', version: '1.1.0', endpoints: ['/api/v1/status','/api/v1/submit','/api/v1/tips','/api/v1/vertices'] });
      }
      if ((path === '/api/v1/submit' || path === '/api/v1/dag/submit') && request.method === 'POST') {
        try {
          const body = await request.text();
          let resp;
          if (env.DAG && typeof env.DAG.fetch === 'function') {
            resp = await env.DAG.fetch(new Request('https://dag/submit', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body
            }));
          } else {
            resp = await fetch('https://stratamesh-dag.stratamesh.workers.dev/submit', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body
            });
          }
          const text = await resp.text();
          return new Response(text, { status: resp.status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        } catch (e) {
          return json({ error: e.message }, 502);
        }
      }

      // GET /api/v1/tips — proxy
      if (path === '/api/v1/tips' && request.method === 'GET') {
        try {
          const resp = await fetch('https://stratamesh-dag.stratamesh.workers.dev/tips');
          const text = await resp.text();
          return new Response(text, { status: resp.status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        } catch (e) {
          return json({ error: e.message }, 502);
        }
      }

      // GET /api/v1/status - Node status
      if (path === '/api/v1/status' && request.method === 'GET') {
        return json({
          node: 'calhegasmorais.pt',
          type: 'FOG_GENESIS',
          status: 'active',
          version: '2.0.0',
          endpoints: ['status','genesis','vertices','cid','known-nodes','request-counter','mint','burn','tip-select']
        });
      }
      
      // GET /api/v1/genesis - Genesis vertex
      if (path === '/api/v1/genesis' && request.method === 'GET') {
        try {
          const result = await env.DB.prepare('SELECT * FROM dag_vertices WHERE vertex_type = ? LIMIT 1').bind('GENESIS').first();
          return json(result || { error: 'Genesis vertex not found' });
        } catch (e) {
          return json({ error: e.message }, 500);
        }
      }
      
      // GET /api/v1/vertices - Query vertices
      if (path === '/api/v1/vertices' && request.method === 'GET') {
        try {
          const limit = parseInt(url.searchParams.get('limit') || '50');
          const type = url.searchParams.get('type');
          let query = 'SELECT * FROM dag_vertices';
          const params = [];
          if (type) { query += ' WHERE vertex_type = ?'; params.push(type); }
          query += ' ORDER BY created_at DESC LIMIT ?';
          params.push(limit);
          const result = await env.DB.prepare(query).bind(...params).all();
          return json({ vertices: result.results, count: result.results.length });
        } catch (e) {
          return json({ error: e.message }, 500);
        }
      }
      
      // POST /api/v1/vertices - Submit new vertex
      if (path === '/api/v1/vertices' && request.method === 'POST') {
        try {
          const body = await request.json();
          const vertexId = crypto.randomUUID();
          const result = await env.DB.prepare(
            'INSERT INTO dag_vertices (vertex_id, vertex_type, parent_vertices, ipfs_cid, payload, emission_node, cumulative_weight, confirmed, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime("now"))'
          ).bind(
            vertexId,
            body.vertex_type || 'STANDARD',
            JSON.stringify(body.parent_vertices || []),
            body.ipfs_cid || null,
            JSON.stringify(body.payload || {}),
            body.emission_node || 'calhegasmorais.pt',
            body.cumulative_weight || 0,
            0
          ).run();
          return json({ vertex_id: vertexId, status: 'submitted' }, 201);
        } catch (e) {
          return json({ error: e.message }, 500);
        }
      }
      
      // GET /api/v1/cid - CID lookup
      if (path === '/api/v1/cid' && request.method === 'GET') {
        const cid = url.searchParams.get('cid');
        if (!cid) return json({ error: 'cid parameter required' }, 400);
        try {
          const cached = await env.CID_CACHE.get(cid, { type: 'json' });
          if (cached) return json({ cid, ...cached, cached: true });
          const result = await env.DB.prepare('SELECT * FROM cid_registry WHERE cid = ?').bind(cid).first();
          if (result) {
            await env.CID_CACHE.put(cid, JSON.stringify(result), { expirationTtl: 3600 });
            return json({ cid, ...result, cached: false });
          }
          return json({ error: 'CID not found' }, 404);
        } catch (e) {
          return json({ error: e.message }, 500);
        }
      }
      
      // GET /api/v1/known-nodes - Network peer registry
      if (path === '/api/v1/known-nodes' && request.method === 'GET') {
        try {
          const result = await env.DB.prepare('SELECT node_id, public_key, node_type, domain, status, last_heartbeat FROM known_nodes WHERE status = ?').bind('active').all();
          return json({ nodes: result.results, count: result.results.length });
        } catch (e) {
          return json({ error: e.message }, 500);
        }
      }
      
      // POST /api/v1/mint - Mint tokens (thermodynamic proof)
      if (path === '/api/v1/mint' && request.method === 'POST') {
        try {
          const body = await request.json();
          const mintId = 'mint-' + crypto.randomUUID();
          const tokensMinted = (body.work_units || 0) * (body.coefficient || 1);
          const burnFraction = tokensMinted * 0.01;
          const netTokens = tokensMinted - burnFraction;
          
          await env.DB.prepare(
            'INSERT INTO minting_ledger (mint_id, mint_type, node_id, work_proof, work_units, coefficient, tokens_minted, burn_fraction, net_tokens, timestamp, verification_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime("now"), ?)'
          ).bind(
            mintId, body.mint_type || 'TIP_VALIDATION', body.node_id || 'calhegasmorais_fog_genesis_001',
            body.work_proof || 'pending', body.work_units || 0, body.coefficient || 1,
            tokensMinted, burnFraction, netTokens, 'pending'
          ).run();
          
          await env.DB.prepare(
            'UPDATE token_balances SET balance = balance + ?, total_minted = total_minted + ?, last_mint = datetime("now") WHERE node_id = ?'
          ).bind(netTokens, netTokens, body.node_id || 'calhegasmorais_fog_genesis_001').run();
          
          return json({ mint_id: mintId, tokens_minted: tokensMinted, burn_fraction: burnFraction, net_tokens: netTokens }, 201);
        } catch (e) {
          return json({ error: e.message }, 500);
        }
      }
      
      // POST /api/v1/burn - Burn tokens
      if (path === '/api/v1/burn' && request.method === 'POST') {
        try {
          const body = await request.json();
          const amount = body.amount || 0;
          const current = await env.DB.prepare('SELECT balance FROM token_balances WHERE node_id = ?').bind(body.node_id || 'calhegasmorais_fog_genesis_001').first();
          if (!current || current.balance < amount) return json({ error: 'Insufficient balance' }, 402);
          
          await env.DB.prepare(
            'UPDATE token_balances SET balance = balance - ?, total_burned = total_burned + ?, last_burn = datetime("now") WHERE node_id = ?'
          ).bind(amount, amount, body.node_id || 'calhegasmorais_fog_genesis_001').run();
          
          return json({ burned: amount, new_balance: current.balance - amount });
        } catch (e) {
          return json({ error: e.message }, 500);
        }
      }
      
      // GET /api/v1/request-counter - Request counter status
      if (path === '/api/v1/request-counter' && request.method === 'GET') {
        try {
          const result = await env.DB.prepare('SELECT * FROM request_counter ORDER BY date DESC LIMIT 1').first();
          return json(result || { count: 0, tier: 'normal' });
        } catch (e) {
          return json({ error: e.message }, 500);
        }
      }
      
      // POST /api/v1/request-counter/init - Initialize request counter
      if (path === '/api/v1/request-counter/init' && request.method === 'POST') {
        try {
          await env.DB.prepare(
            'INSERT OR REPLACE INTO request_counter (date, count, tier, last_updated) VALUES (date("now"), 0, "normal", datetime("now"))'
          ).run();
          return json({ initialized: true, count: 0, tier: 'normal' });
        } catch (e) {
          return json({ error: e.message }, 500);
        }
      }
      
      // POST /api/v1/tip-select - Tip selection algorithm
      if (path === '/api/v1/tip-select' && request.method === 'POST') {
        try {
          const body = await request.json();
          const numTips = body.num_tips || 2;
          const result = await env.DB.prepare(
            'SELECT vertex_id, cumulative_weight FROM dag_vertices WHERE confirmed = 0 ORDER BY cumulative_weight ASC, created_at DESC LIMIT ?'
          ).bind(numTips).all();
          return json({ tips: result.results, algorithm: 'weighted-random', version: '1.0.0' });
        } catch (e) {
          return json({ error: e.message }, 500);
        }
      }
      
      // 404 fallback
      return json({ error: 'Not Found', path }, 404);
    }
  };
