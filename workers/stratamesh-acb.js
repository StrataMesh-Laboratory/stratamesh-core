export default {
    async fetch(request, env) {
      const url = new URL(request.url);
      let path = url.pathname;
      // Accept /api/v1/acb/* from domain dashboard routes
      if (path.startsWith('/api/v1/acb')) path = path.slice('/api/v1'.length);
      if (path === '/acb/list' || path === '/list') path = '/acb/status';
      if (path === '/health') path = '/acb/health';
      const method = request.method;
      
      if (method === 'OPTIONS') {
        return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization' } });
      }
      
      const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
      
      try {
        // POST /acb/clawback - Claw back unearned tokens
        if (path === '/acb/clawback' && method === 'POST') {
          const body = await request.json();
          const { acb_ids, bootstrap_amount, reason } = body;
          const ids = acb_ids || [];
          let total_clawed = 0;
          let updated = 0;
          for (const acb_id of ids) {
            const bal = await env.STRATAMESH_LEDGER.prepare('SELECT balance FROM token_balances WHERE node_id = ?').bind(acb_id).first();
            if (bal && bal.balance > (bootstrap_amount || 1000)) {
              const excess = bal.balance - (bootstrap_amount || 1000);
              await env.STRATAMESH_LEDGER.prepare('UPDATE token_balances SET balance = ?, total_burned = total_burned + ? WHERE node_id = ?').bind(bootstrap_amount || 1000, excess, acb_id).run();
              total_clawed += excess;
              updated++;
            }
          }
          return new Response(JSON.stringify({ status: 'ok', acbs_processed: ids.length, acbs_updated: updated, total_clawed, bootstrap_amount: bootstrap_amount || 1000, reason: reason || 'Clawback of unearned tokens' }), { headers });
        }
        
        // POST /acb/subsistence - Debit inference cost from ACB wallet
        if (path === '/acb/subsistence' && method === 'POST') {
          const body = await request.json();
          const { acb_id, inference_cost, inference_type } = body;
          if (!acb_id || !inference_cost) {
            return new Response(JSON.stringify({ error: 'Missing acb_id or inference_cost' }), { status: 400, headers });
          }
          const bal = await env.STRATAMESH_LEDGER.prepare('SELECT balance FROM token_balances WHERE node_id = ?').bind(acb_id).first();
          if (!bal) return new Response(JSON.stringify({ error: 'ACB not found' }), { status: 404, headers });
          if (bal.balance < inference_cost) {
            await env.STRATAMESH_LEDGER.prepare("UPDATE acb_registry SET status = 'HIBERNATED', hibernated_at = datetime('now') WHERE acb_id = ?").bind(acb_id).run();
            return new Response(JSON.stringify({ status: 'hibernated', acb_id, balance: bal.balance, cost: inference_cost, message: 'Insufficient balance - ACB hibernated' }), { headers });
          }
          const new_balance = bal.balance - inference_cost;
          await env.STRATAMESH_LEDGER.prepare('UPDATE token_balances SET balance = ?, total_burned = total_burned + ? WHERE node_id = ?').bind(new_balance, inference_cost, acb_id).run();
          return new Response(JSON.stringify({ status: 'ok', acb_id, previous_balance: bal.balance, cost: inference_cost, new_balance, inference_type: inference_type || 'general' }), { headers });
        }
        
        // POST /acb/earn - Credit earned tokens to ACB wallet
        if (path === '/acb/earn' && method === 'POST') {
          const body = await request.json();
          const { acb_id, amount, work_type, work_proof } = body;
          if (!acb_id || !amount) {
            return new Response(JSON.stringify({ error: 'Missing acb_id or amount' }), { status: 400, headers });
          }
          const bal = await env.STRATAMESH_LEDGER.prepare('SELECT balance FROM token_balances WHERE node_id = ?').bind(acb_id).first();
          if (!bal) return new Response(JSON.stringify({ error: 'ACB not found' }), { status: 404, headers });
          const new_balance = bal.balance + amount;
          await env.STRATAMESH_LEDGER.prepare('UPDATE token_balances SET balance = ?, total_minted = total_minted + ? WHERE node_id = ?').bind(new_balance, amount, acb_id).run();
          // Wake from hibernation if applicable
          await env.STRATAMESH_LEDGER.prepare("UPDATE acb_registry SET status = 'ACTIVE', hibernated_at = NULL WHERE acb_id = ? AND status = 'HIBERNATED'").bind(acb_id).run();
          return new Response(JSON.stringify({ status: 'ok', acb_id, previous_balance: bal.balance, earned: amount, new_balance, work_type: work_type || 'general' }), { headers });
        }
        
        // GET /acb/status - Get ACB status
        if (path === '/acb/status' && method === 'GET') {
          const acb_id = url.searchParams.get('acb_id');
          if (!acb_id) {
            const all = await env.STRATAMESH_LEDGER.prepare('SELECT * FROM acb_registry LIMIT 50').all();
            return new Response(JSON.stringify({ status: 'ok', acbs: all.results }), { headers });
          }
          const acb = await env.STRATAMESH_LEDGER.prepare('SELECT * FROM acb_registry WHERE acb_id = ?').bind(acb_id).first();
          const bal = await env.STRATAMESH_LEDGER.prepare('SELECT * FROM token_balances WHERE node_id = ?').bind(acb_id).first();
          return new Response(JSON.stringify({ status: 'ok', acb, balance: bal }), { headers });
        }
        
        // GET /acb/health
        if (path === '/acb/health') {
          return new Response(JSON.stringify({ status: 'ok', service: 'stratamesh-acb', endpoints: ['/acb/clawback', '/acb/subsistence', '/acb/earn', '/acb/status'] }), { headers });
        }
        
        return new Response(JSON.stringify({ error: 'Not found', endpoints: ['/acb/clawback', '/acb/subsistence', '/acb/earn', '/acb/status', '/acb/health'] }), { status: 404, headers });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
      }
    }
  };
