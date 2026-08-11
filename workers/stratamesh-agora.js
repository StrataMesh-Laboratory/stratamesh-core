export default {
    async fetch(request, env) {
      const url = new URL(request.url);
      let path = url.pathname;
      if (path.startsWith('/api/v1/agora')) path = '/agora' + path.slice('/api/v1/agora'.length);
      else if (path.startsWith('/api/v1/') && path.includes('agora')) path = path.replace('/api/v1', '');
      if (path === '/health') path = '/agora/health';
      if (path === '/status') path = '/agora/status';

      if (path === '/agora/health') {
        return new Response(JSON.stringify({ status: 'active', version: '2.1.0-whitepaper', role: 'P2P exchange where contributors list STRATA for external value (crypto/stable/fiat); not a protocol mint', external_value_exchange: true, endpoints: ['/agora/health', '/agora/listing', '/agora/order', '/agora/trade', '/agora/book', '/agora/balance', '/agora/auction', '/agora/status'] }), { headers: { 'Content-Type': 'application/json' } });
      }

      if (path === '/agora/listing' && request.method === 'POST') {
        const data = await request.json();
        const listingId = 'LIST-' + Date.now();
        const result = await env.STRATAMESH_LEDGER.prepare(
          'INSERT INTO agora_listings (listing_id, node_id, token_amount, price_per_token, reference_currency, status, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime("now"))'
        ).bind(listingId, data.node_id || 'calhegasmorais_fog_genesis_001', data.token_amount || 10000, data.price_per_token || 0.01, data.reference_currency || 'USDC', 'active').run();
        return new Response(JSON.stringify({ success: true, listing_id: listingId, tokens_listed: data.token_amount || 10000, price: data.price_per_token || 0.01 }), { headers: { 'Content-Type': 'application/json' } });
      }

      if (path === '/agora/order' && request.method === 'POST') {
        const data = await request.json();
        const orderId = 'ORD-' + Date.now();
        return new Response(JSON.stringify({ success: true, order_id: orderId, order_type: data.order_type, amount: data.token_amount, price: data.price_per_token }), { headers: { 'Content-Type': 'application/json' } });
      }

      if (path === '/agora/trade' && request.method === 'POST') {
        const data = await request.json();
        const tradeId = 'TRD-' + Date.now();
        return new Response(JSON.stringify({ success: true, trade_id: tradeId, amount: data.token_amount, price: data.price_per_token }), { headers: { 'Content-Type': 'application/json' } });
      }

      if (path === '/agora/book') {
        const listings = await env.STRATAMESH_LEDGER.prepare('SELECT * FROM agora_listings WHERE status = ? ORDER BY created_at DESC LIMIT 20').bind('active').all();
        return new Response(JSON.stringify({ success: true, listings: listings.results || [] }), { headers: { 'Content-Type': 'application/json' } });
      }

      if (path === '/agora/balance') {
        const url2 = new URL(request.url);
        const nodeId = url2.searchParams.get('node_id') || 'calhegasmorais_fog_genesis_001';
        const balance = await env.STRATAMESH_LEDGER.prepare('SELECT * FROM token_balances WHERE node_id = ?').bind(nodeId).first();
        return new Response(JSON.stringify({ success: true, balance: balance || { node_id: nodeId, balance: 0 } }), { headers: { 'Content-Type': 'application/json' } });
      }

      if (path === '/agora/auction' && request.method === 'POST') {
        const data = await request.json();
        const auctionId = 'AUC-' + Date.now();
        return new Response(JSON.stringify({ success: true, auction_id: auctionId, type: 'dutch', start_price: data.start_price || 0.01, end_price: data.end_price || 0.001, duration: data.duration || 86400 }), { headers: { 'Content-Type': 'application/json' } });
      }

      if (path === '/agora/status') {
        let total_listings = 0, total_trades = 0;
        try {
          const lr = await env.STRATAMESH_LEDGER.prepare("SELECT COUNT(*) as c FROM agora_listings").first();
          total_listings = lr?.c ?? 0;
        } catch (_) {}
        try {
          const tr = await env.STRATAMESH_LEDGER.prepare("SELECT COUNT(*) as c FROM agora_trades").first();
          total_trades = tr?.c ?? 0;
        } catch (_) {
          try {
            const tr2 = await env.STRATAMESH_LEDGER.prepare("SELECT COUNT(*) as c FROM trades").first();
            total_trades = tr2?.c ?? 0;
          } catch (_) {}
        }
        return new Response(JSON.stringify({ success: true, status: 'operational', total_listings, total_trades, service: 'stratamesh-agora', version: '2.1.0' }), { headers: { 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({ error: 'Not Found', available_endpoints: ['/agora/health', '/agora/listing', '/agora/order', '/agora/trade', '/agora/book', '/agora/balance', '/agora/auction', '/agora/status'] }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }
  };
