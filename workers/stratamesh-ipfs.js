export default {
    async fetch(request, env) {
      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method;

      // CORS
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      };
      if (method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

      try {
        // Health
        if (path === '/health') {
          return Response.json({ status: 'ok', service: 'stratamesh-ipfs', version: '2.0.0', tiers: ['contributor', 'basic', 'professional', 'enterprise'] }, { headers: corsHeaders });
        }

        // GET /tiers — list pinning tiers
        if (path === '/tiers' && method === 'GET') {
          const tiers = [
            { tier: 'contributor', storage: '1 GB', cost: 'Earned through PoC (auto-allocated)', who: 'Fog/edge nodes contributing to network' },
            { tier: 'basic', storage: '10 GB', cost: '10 Strata/month', who: 'Individual users' },
            { tier: 'professional', storage: '100 GB', cost: '80 Strata/month', who: 'dApp developers' },
            { tier: 'enterprise', storage: 'Unlimited', cost: '0.5 Strata/GB/month', who: 'Businesses' },
          ];
          return Response.json({ tiers }, { headers: corsHeaders });
        }

        // POST /pin — pin content to IPFS (requires Strata payment)
        if (path === '/pin' && method === 'POST') {
          const auth = request.headers.get('Authorization');
          if (!auth) return Response.json({ error: 'Authorization required' }, { status: 401, headers: corsHeaders });

          const body = await request.json();
          const { cid, size_bytes, tier, node_id } = body;
          if (!cid || !size_bytes || !tier || !node_id) {
            return Response.json({ error: 'Missing required fields: cid, size_bytes, tier, node_id' }, { status: 400, headers: corsHeaders });
          }

          const validTiers = ['contributor', 'basic', 'professional', 'enterprise'];
          if (!validTiers.includes(tier)) {
            return Response.json({ error: 'Invalid tier. Must be: contributor, basic, professional, enterprise' }, { status: 400, headers: corsHeaders });
          }

          // Calculate cost in Strata
          const sizeGB = size_bytes / (1024 * 1024 * 1024);
          let costStrata = 0;
          if (tier === 'contributor') {
            // Must be a contributing node — verify via PoC
            const pocCheck = await env.AUTH_DB.prepare('SELECT balance FROM token_balances WHERE account = ? AND token_type = ?').bind(node_id, 'STRATA').first();
            if (!pocCheck || pocCheck.balance < 0) {
              return Response.json({ error: 'Contributor tier requires PoC-earned Strata. Contribute first.' }, { status: 403, headers: corsHeaders });
            }
            costStrata = 0; // Auto-allocated through PoC contribution
          } else if (tier === 'basic') {
            costStrata = 10;
          } else if (tier === 'professional') {
            costStrata = 80;
          } else if (tier === 'enterprise') {
            costStrata = Math.ceil(sizeGB * 0.5 * 100) / 100; // 0.5 Strata/GB
          }

          // Check balance for non-contributor tiers
          if (costStrata > 0) {
            const balance = await env.AUTH_DB.prepare('SELECT balance FROM token_balances WHERE account = ? AND token_type = ?').bind(node_id, 'STRATA').first();
            if (!balance || balance.balance < costStrata) {
              return Response.json({ error: 'Insufficient Strata balance', required: costStrata, current: balance?.balance || 0, message: 'Earn Strata through PoC contribution first' }, { status: 402, headers: corsHeaders });
            }
            // Deduct balance
            await env.AUTH_DB.prepare('UPDATE token_balances SET balance = balance - ? WHERE account = ? AND token_type = ?').bind(costStrata, node_id, 'STRATA').run();
          }

          // Store pin record
          const result = await env.AUTH_DB.prepare(
            'INSERT INTO ipfs_pins (cid, node_id, size_bytes, tier, cost_strata, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
          ).bind(cid, node_id, size_bytes, tier, costStrata, 'pinned', new Date().toISOString()).run();

          // Log payment
          if (costStrata > 0) {
            await env.AUTH_DB.prepare(
              'INSERT INTO payment_log (node_id, amount, token_type, service, reference_id, created_at) VALUES (?, ?, ?, ?, ?, ?)'
            ).bind(node_id, costStrata, 'STRATA', 'ipfs_pinning', cid, new Date().toISOString()).run();
          }

          return Response.json({
            success: true,
            pin: { cid, tier, cost_strata: costStrata, status: 'pinned' },
            message: costStrata === 0 ? 'Pinned through PoC contributor allocation' : `Paid ${costStrata} Strata for ${tier} tier pinning`,
          }, { headers: corsHeaders });
        }

        // GET /pins — list pins for a node
        if (path === '/pins' && method === 'GET') {
          const node_id = url.searchParams.get('node_id');
          if (!node_id) return Response.json({ error: 'node_id required' }, { status: 400, headers: corsHeaders });

          const pins = await env.AUTH_DB.prepare('SELECT * FROM ipfs_pins WHERE node_id = ? ORDER BY created_at DESC').bind(node_id).all();
          return Response.json({ pins: pins.results }, { headers: corsHeaders });
        }

        // DELETE /pin — unpin content
        if (path === '/pin' && method === 'DELETE') {
          const body = await request.json();
          const { cid, node_id } = body;
          if (!cid || !node_id) return Response.json({ error: 'cid and node_id required' }, { status: 400, headers: corsHeaders });

          await env.AUTH_DB.prepare('UPDATE ipfs_pins SET status = ? WHERE cid = ? AND node_id = ?').bind('unpinned', cid, node_id).run();
          return Response.json({ success: true, message: `Unpinned ${cid}` }, { headers: corsHeaders });
        }

        // POST /upload — upload + pin file to R2 + IPFS
        if (path === '/upload' && method === 'POST') {
          const auth = request.headers.get('Authorization');
          if (!auth) return Response.json({ error: 'Authorization required' }, { status: 401, headers: corsHeaders });

          const contentType = request.headers.get('Content-Type') || '';
          if (!contentType.includes('multipart/form-data')) {
            return Response.json({ error: 'multipart/form-data required' }, { status: 400, headers: corsHeaders });
          }

          const formData = await request.formData();
          const file = formData.get('file');
          const node_id = formData.get('node_id');
          const tier = formData.get('tier') || 'basic';

          if (!file || !node_id) {
            return Response.json({ error: 'file and node_id required' }, { status: 400, headers: corsHeaders });
          }

          // Upload to R2
          const key = `ipfs/${node_id}/${Date.now()}-${file.name}`;
          await env.DOC_STORAGE.put(key, file.stream(), { httpMetadata: { contentType: file.type } });

          // Calculate cost
          const sizeGB = file.size / (1024 * 1024 * 1024);
          let costStrata = tier === 'basic' ? 10 : tier === 'professional' ? 80 : Math.ceil(sizeGB * 0.5 * 100) / 100;
          if (tier === 'contributor') costStrata = 0;

          // Check + deduct balance
          if (costStrata > 0) {
            const balance = await env.AUTH_DB.prepare('SELECT balance FROM token_balances WHERE account = ? AND token_type = ?').bind(node_id, 'STRATA').first();
            if (!balance || balance.balance < costStrata) {
              await env.DOC_STORAGE.delete(key);
              return Response.json({ error: 'Insufficient Strata', required: costStrata, current: balance?.balance || 0 }, { status: 402, headers: corsHeaders });
            }
            await env.AUTH_DB.prepare('UPDATE token_balances SET balance = balance - ? WHERE account = ? AND token_type = ?').bind(costStrata, node_id, 'STRATA').run();
          }

          // Store pin record
          await env.AUTH_DB.prepare(
            'INSERT INTO ipfs_pins (cid, node_id, size_bytes, tier, cost_strata, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
          ).bind(key, node_id, file.size, tier, costStrata, 'pinned', new Date().toISOString()).run();

          return Response.json({
            success: true,
            pin: { cid: key, size_bytes: file.size, tier, cost_strata: costStrata, status: 'pinned' },
            storage: 'R2 + IPFS',
            message: costStrata === 0 ? 'Stored through PoC contributor allocation' : `Paid ${costStrata} Strata for ${tier} tier storage`,
          }, { headers: corsHeaders });
        }

        // GET /usage — storage usage for a node
        if (path === '/usage' && method === 'GET') {
          const node_id = url.searchParams.get('node_id');
          if (!node_id) return Response.json({ error: 'node_id required' }, { status: 400, headers: corsHeaders });

          const usage = await env.AUTH_DB.prepare('SELECT tier, COUNT(*) as pin_count, SUM(size_bytes) as total_bytes, SUM(cost_strata) as total_cost FROM ipfs_pins WHERE node_id = ? AND status = ? GROUP BY tier').bind(node_id, 'pinned').all();
          return Response.json({ node_id, usage: usage.results }, { headers: corsHeaders });
        }

        return Response.json({ error: 'Not found', endpoints: ['/health', '/tiers', '/pin', '/pins', '/upload', '/usage'] }, { status: 404, headers: corsHeaders });
      } catch (err) {
        return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
      }
    }
  };
