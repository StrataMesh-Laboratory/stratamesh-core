export default {
    async fetch(request, env) {
      const url = new URL(request.url);
      let path = url.pathname;
      if (path.startsWith('/api/v1/poc')) path = path.slice('/api/v1/poc'.length) || '/health';
      if (path.startsWith('/api/v1/')) path = path.slice('/api/v1'.length);

      // CORS headers
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      };
      if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

      try {
        // Health check
        if (path === '/health') {
          return Response.json({ status: 'healthy', service: 'stratamesh-poc', version: '3.3.0-whitepaper', sole_mint_path: true, policy: 'STRATA minted only for verified contribution of compute/storage to the DLT. No free mint. Non-contributors acquire STRATA only on Strata Agora vs external value.', timestamp: new Date().toISOString() }, { headers: corsHeaders });
        }

        // Mint Strata from contribution
        if (path === '/mint' && request.method === 'POST') {
          const body = await request.json();
          const { node_id, contribution_type, contribution_points, contribution_data, proof_hash } = body;
          if (!node_id || !contribution_type || !contribution_points) {
            return Response.json({ error: 'Missing required fields: node_id, contribution_type, contribution_points' }, { status: 400, headers: corsHeaders });
          }
          // Get minting rate for contribution type
          const typeRow = await env.LEDGER.prepare('SELECT minting_rate FROM contribution_types WHERE name = ?').bind(contribution_type).first();
          const rate = typeRow ? typeRow.minting_rate : 0.1;
          const amount = Math.floor(contribution_points * rate);
          if (amount <= 0) return Response.json({ error: 'Contribution too small to mint' }, { status: 400, headers: corsHeaders });
          // Insert minting event
          const mintResult = await env.LEDGER.prepare('INSERT INTO minting_events (node_id, contribution_type, contribution_score, amount, proof_hash, status) VALUES (?, ?, ?, ?, ?, ?)').bind(node_id, contribution_type, contribution_points, amount, proof_hash || null, 'confirmed').run();
          // Upsert token balance with composite key (account, token_type)
          await env.LEDGER.prepare('INSERT INTO token_balances (account, token_type, balance) VALUES (?, ?, ?) ON CONFLICT(account, token_type) DO UPDATE SET balance = balance + ?').bind(node_id, 'STRATA', amount, amount).run();
          // Record contribution
          await env.LEDGER.prepare('INSERT INTO contribution_records (node_id, metric, value, created_at) VALUES (?, ?, ?, ?)').bind(node_id, contribution_type, contribution_points, new Date().toISOString()).run();
          // Record on proof chain
          const lastProof = await env.LEDGER.prepare('SELECT current_hash FROM proof_chain ORDER BY id DESC LIMIT 1').first();
          const prevHash = lastProof ? lastProof.current_hash : 'genesis';
          const newHash = proof_hash || 'poc-' + Date.now();
          await env.LEDGER.prepare('INSERT INTO proof_chain (previous_hash, current_hash, action, actor) VALUES (?, ?, ?, ?)').bind(prevHash, newHash, 'mint', node_id).run();
          return Response.json({ success: true, minting_event_id: mintResult.meta.last_row_id, node_id, contribution_type, contribution_points, minting_rate: rate, amount_minted: amount, new_hash: newHash, message: 'Every STRATA is earned via Proof of Contribution. No free mint. Trade only on Strata Agora for external value.' }, { headers: corsHeaders });
        }

        // Get balance
        if (path === '/balance' && request.method === 'GET') {
          const node_id = url.searchParams.get('node_id');
          if (!node_id) return Response.json({ error: 'Missing node_id parameter' }, { status: 400, headers: corsHeaders });
          const balance = await env.LEDGER.prepare('SELECT * FROM token_balances WHERE account = ? AND token_type = ?').bind(node_id, 'STRATA').first();
          const contributions = await env.LEDGER.prepare('SELECT COUNT(*) as count, COALESCE(SUM(value), 0) as total_points FROM contribution_records WHERE node_id = ?').bind(node_id).first();
          return Response.json({ node_id, token_type: 'STRATA', balance: balance ? balance.balance : 0, total_contributions: contributions.count, total_contribution_points: contributions.total_points }, { headers: corsHeaders });
        }

        // Starter tasks
        if (path === '/starter-tasks' && request.method === 'GET') {
          const tasks = await env.LEDGER.prepare('SELECT * FROM starter_tasks WHERE is_active = 1').all();
          return Response.json({ tasks: tasks.results }, { headers: corsHeaders });
        }

        // Claim starter task reward
        if (path === '/starter-claim' && request.method === 'POST') {
          const body = await request.json();
          const { node_id, task_id } = body;
          if (!node_id || !task_id) return Response.json({ error: 'Missing node_id or task_id' }, { status: 400, headers: corsHeaders });
          const task = await env.LEDGER.prepare('SELECT * FROM starter_tasks WHERE id = ? AND is_active = 1').bind(task_id).first();
          if (!task) return Response.json({ error: 'Task not found or inactive' }, { status: 404, headers: corsHeaders });
          // Mint reward via contribution
          const mintResult = await env.LEDGER.prepare('INSERT INTO minting_events (node_id, contribution_type, contribution_score, amount, proof_hash, status) VALUES (?, ?, ?, ?, ?)').bind(node_id, 'starter_task', task.reward_amount, task.reward_amount, 'starter-' + task_id + '-' + Date.now(), 'confirmed').run();
          await env.LEDGER.prepare('INSERT INTO token_balances (account, token_type, balance) VALUES (?, ?, ?) ON CONFLICT(account, token_type) DO UPDATE SET balance = balance + ?').bind(node_id, 'STRATA', task.reward_amount, task.reward_amount).run();
          return Response.json({ success: true, task_name: task.name, reward: task.reward_amount, message: 'Starter contribution (lab onboarding task) counted as PoC. Base emission remains contribution-only — not a faucet.' }, { headers: corsHeaders });
        }

        // Contribution types
        if (path === '/contribution-types' && request.method === 'GET') {
          const types = await env.LEDGER.prepare('SELECT * FROM contribution_types').all();
          return Response.json({ contribution_types: types.results }, { headers: corsHeaders });
        }

        // Minting history
        if (path === '/history' && request.method === 'GET') {
          const node_id = url.searchParams.get('node_id');
          let query, params;
          if (node_id) {
            query = 'SELECT * FROM minting_events WHERE node_id = ? ORDER BY id DESC LIMIT 50';
            params = [node_id];
          } else {
            query = 'SELECT * FROM minting_events ORDER BY id DESC LIMIT 50';
            params = [];
          }
          const events = params.length > 0 ? await env.LEDGER.prepare(query).bind(...params).all() : await env.LEDGER.prepare(query).all();
          return Response.json({ events: events.results }, { headers: corsHeaders });
        }

        // Proof chain
        if (path === '/proof-chain' && request.method === 'GET') {
          const chain = await env.LEDGER.prepare('SELECT * FROM proof_chain ORDER BY id DESC LIMIT 50').all();
          return Response.json({ chain: chain.results }, { headers: corsHeaders });
        }

        return Response.json({ error: 'Not found', endpoints: ['/health', '/mint', '/balance', '/starter-tasks', '/starter-claim', '/contribution-types', '/history', '/proof-chain'] }, { status: 404, headers: corsHeaders });
      } catch (err) {
        return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
      }
    }
  };
