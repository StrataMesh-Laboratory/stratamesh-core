/**
 * Strata Agora — whitepaper P2P: list STRATA for EXTERNAL value only.
 * Uses existing D1 schema (listing_id, node_id, token_amount, price_per_token, reference_currency).
 */
function j(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let path = url.pathname;
    if (path.startsWith('/api/v1/agora')) path = '/agora' + path.slice('/api/v1/agora'.length);
    if (path === '/health' || path === '/' || path === '') path = '/agora/health';
    if (path === '/status') path = '/agora/status';

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
          'Access-Control-Allow-Headers': '*',
        },
      });
    }

    const db = env.STRATAMESH_LEDGER || env.LEDGER || env.DB;
    try {
      if (path === '/agora/health') {
        return j({
          status: 'active',
          version: '3.2.1-n-lt-2',
          role: 'P2P exchange: STRATA listed for external value (EUR/crypto/stable). Not a mint.',
          external_value_exchange: true,
          settlement: 'lab_intent + agora_payments verification_status',
        });
      }


      // Market rate from open STRATA listings (external quote) — no admin price
      if (path === '/agora/rate' || path === '/agora/price' || path === '/rate' || path === '/price') {
        const asset = (url.searchParams.get('quote') || url.searchParams.get('asset') || 'EUR').toUpperCase();
        let rows = [];
        try {
          rows = (await db.prepare(
            "SELECT token_amount, price_per_token, reference_currency FROM agora_listings WHERE status = 'active' AND UPPER(COALESCE(reference_currency,'EUR')) = ?"
          ).bind(asset).all()).results || [];
        } catch (_) {
          try {
            rows = (await db.prepare(
              "SELECT token_amount, price_per_token, reference_currency FROM agora_listings WHERE status = 'active'"
            ).all()).results || [];
            rows = rows.filter(r => (r.reference_currency || 'EUR').toUpperCase() === asset);
          } catch (__) {}
        }
        if (!rows.length) {
          return j({
            success: true,
            quote_asset: asset,
            strata_per_quote: null,
            quote_per_strata: null,
            liquidity: 0,
            message: 'No active Agora listings — cannot form rate',
          });
        }
        // VWAP: price_per_token is quote per STRATA
        let vol = 0, pq = 0;
        const prices = [];
        for (const r of rows) {
          const amt = Number(r.token_amount) || 0;
          const px = Number(r.price_per_token) || 0;
          if (amt > 0 && px > 0) {
            vol += amt;
            pq += px * amt;
            prices.push(px);
          }
        }
        if (vol <= 0) {
          return j({ success: true, quote_asset: asset, strata_per_quote: null, quote_per_strata: null, liquidity: 0 });
        }
        const quote_per_strata = pq / vol; // e.g. EUR per 1 STRATA
        const strata_per_quote = 1 / quote_per_strata;
        prices.sort((a,b)=>a-b);
        const mid = prices[Math.floor(prices.length/2)];
        return j({
          success: true,
          quote_asset: asset,
          quote_per_strata,
          strata_per_quote,
          vwap_quote_per_strata: quote_per_strata,
          median_quote_per_strata: mid,
          liquidity_strata: vol,
          listings: rows.length,
          source: 'agora_open_book_vwap',
          note: 'Rate discovered on Agora P2P book — not set by protocol',
        });
      }

      if (path === '/agora/listing' && request.method === 'POST') {
        const data = await request.json().catch(() => ({}));
        const seller = data.seller || data.node_id || data.account;
        const amount = Number(data.amount_strata || data.token_amount || data.amount || 0);
        const quote_asset = (data.quote_asset || data.reference_currency || data.want || 'EUR').toUpperCase();
        const quote_total = Number(data.quote_amount || 0);
        const price_per = amount > 0 ? (quote_total > 0 ? quote_total / amount : Number(data.price_per_token || data.price || 0)) : 0;
        if (!seller || amount <= 0 || price_per <= 0) {
          return j({
            error: 'seller, amount_strata > 0, and price (quote_amount or price_per_token) required',
            example: { seller: 'FOG-NODE-…', amount_strata: 10, quote_asset: 'EUR', quote_amount: 5 },
          }, 400);
        }
        const bal = await db
          .prepare("SELECT balance FROM token_balances WHERE account = ? AND token_type IN ('STRATA','strata')")
          .bind(seller)
          .first();
        const have = Number(bal?.balance || 0);
        if (have < amount) {
          return j({ error: 'insufficient_STRATA', balance: have, need: amount }, 402);
        }
        // escrow
        await db
          .prepare("UPDATE token_balances SET balance = balance - ? WHERE account = ? AND token_type IN ('STRATA','strata')")
          .bind(amount, seller)
          .run();
        await db
          .prepare(
            "INSERT INTO token_balances (account, token_type, balance) VALUES (?, 'STRATA_ESCROW', ?) ON CONFLICT(account, token_type) DO UPDATE SET balance = balance + excluded.balance"
          )
          .bind(seller + ':escrow', amount)
          .run();

        const listing_id = 'LST-' + crypto.randomUUID().slice(0, 10);
        await db
          .prepare(
            `INSERT INTO agora_listings (listing_id, node_id, token_amount, price_per_token, reference_currency, listing_type, status, created_at, updated_at)
             VALUES (?,?,?,?,?,?, 'active', datetime('now'), datetime('now'))`
          )
          .bind(listing_id, seller, amount, price_per, quote_asset, data.listing_type || 'fixed')
          .run();
        return j({
          success: true,
          listing: {
            listing_id,
            seller,
            amount_strata: amount,
            price_per_token: price_per,
            quote_asset,
            quote_total: price_per * amount,
            status: 'active',
          },
          escrowed: amount,
          note: 'Buyer pays external value; then POST /agora/trade with listing_id + buyer + payment_method',
        });
      }

      if (path === '/agora/book' || (path === '/agora/listing' && request.method === 'GET')) {
        const rows = await db
          .prepare("SELECT * FROM agora_listings WHERE status = 'active' ORDER BY created_at DESC LIMIT 50")
          .all();
        return j({ success: true, listings: rows.results || [], mode: 'external_value_p2p' });
      }

      if ((path === '/agora/trade' || path === '/agora/order') && request.method === 'POST') {
        const data = await request.json().catch(() => ({}));
        const listing_id = data.listing_id || data.id;
        const buyer = data.buyer || data.account;
        const payment_method = data.payment_method || data.quote_asset || 'EUR';
        const tx_hash = data.tx_hash || data.payment_ref || null;
        if (!listing_id || !buyer) return j({ error: 'listing_id and buyer required' }, 400);
        const listing = await db.prepare('SELECT * FROM agora_listings WHERE listing_id = ?').bind(listing_id).first();
        if (!listing || listing.status !== 'active') return j({ error: 'listing not active' }, 404);
        const amount = Number(listing.token_amount);
        const seller = listing.node_id;

        // release escrow → buyer
        try {
          await db
            .prepare("UPDATE token_balances SET balance = balance - ? WHERE account = ? AND token_type = 'STRATA_ESCROW'")
            .bind(amount, seller + ':escrow')
            .run();
        } catch (_) {}
        await db
          .prepare(
            "INSERT INTO token_balances (account, token_type, balance) VALUES (?, 'STRATA', ?) ON CONFLICT(account, token_type) DO UPDATE SET balance = balance + excluded.balance"
          )
          .bind(buyer, amount)
          .run();
        await db
          .prepare("UPDATE agora_listings SET status = 'filled', updated_at = datetime('now') WHERE listing_id = ?")
          .bind(listing_id)
          .run();

        // payment record (external)
        try {
          await db
            .prepare(
              `INSERT INTO agora_payments (buyer_id, seller_id, amount_strata, payment_method, tx_hash, verification_status)
               VALUES (?,?,?,?,?,?)`
            )
            .bind(buyer, seller, amount, payment_method, tx_hash, tx_hash ? 'lab_confirmed' : 'pending')
            .run();
        } catch (_) {}

        // order pair for legacy trades table (best-effort)
        const trade_id = 'TRD-' + crypto.randomUUID().slice(0, 10);
        try {
          const bid = 'ORD-B-' + crypto.randomUUID().slice(0, 8);
          const ask = 'ORD-A-' + crypto.randomUUID().slice(0, 8);
          await db
            .prepare(
              `INSERT INTO agora_orders (order_id, account, order_type, token_type, amount, price, status, filled_at)
               VALUES (?,?,?,?,?,?, 'filled', datetime('now'))`
            )
            .bind(bid, buyer, 'bid', 'STRATA', amount, listing.price_per_token)
            .run();
          await db
            .prepare(
              `INSERT INTO agora_orders (order_id, account, order_type, token_type, amount, price, status, filled_at)
               VALUES (?,?,?,?,?,?, 'filled', datetime('now'))`
            )
            .bind(ask, seller, 'ask', 'STRATA', amount, listing.price_per_token)
            .run();
          await db
            .prepare(
              `INSERT INTO agora_trades (trade_id, bid_order_id, ask_order_id, token_amount, price_per_token, reference_currency)
               VALUES (?,?,?,?,?,?)`
            )
            .bind(trade_id, bid, ask, amount, listing.price_per_token, listing.reference_currency)
            .run();
        } catch (_) {}

        return j({
          success: true,
          trade_id,
          listing_id,
          seller,
          buyer,
          amount_strata: amount,
          quote: { asset: listing.reference_currency, price_per_token: listing.price_per_token },
          payment_method,
          settlement_status: tx_hash ? 'lab_confirmed' : 'pending_external_proof',
          note: 'Whitepaper: buyer acquired STRATA via P2P external value — not protocol mint.',
        });
      }

      if (path === '/agora/auction' && request.method === 'POST') {
        const data = await request.json().catch(() => ({}));
        return j({
          success: true,
          auction_id: 'AUC-' + Date.now(),
          type: 'dutch',
          quote_asset: (data.quote_asset || 'EUR').toUpperCase(),
          start_price: data.start_price || 0.01,
          end_price: data.end_price || 0.001,
          note: 'Price discovery helper — put STRATA on book via /agora/listing (escrow).',
        });
      }

      if (path === '/agora/balance') {
        const nodeId = url.searchParams.get('node_id') || url.searchParams.get('account') || '';
        if (!nodeId) return j({ error: 'account or node_id required' }, 400);
        const balances = await db
          .prepare("SELECT * FROM token_balances WHERE account = ? OR account = ?")
          .bind(nodeId, nodeId + ':escrow')
          .all();
        return j({ success: true, account: nodeId, balances: balances.results || [] });
      }

      if (path === '/agora/status') {
        let total_listings = 0,
          total_trades = 0;
        try {
          total_listings = (await db.prepare('SELECT COUNT(*) as c FROM agora_listings').first())?.c ?? 0;
        } catch (_) {}
        try {
          total_trades = (await db.prepare('SELECT COUNT(*) as c FROM agora_trades').first())?.c ?? 0;
        } catch (_) {}
        return j({
          success: true,
          status: 'operational',
          version: '3.2.1-n-lt-2',
          total_listings,
          total_trades,
          settlement: 'lab_intent',
          settlements: { unavailable: 'n<2' },
          n: 1,
          note: 'Lab n=1: settlement count is not a scalar; unavailable until n>=2',
        });
      }

      if (path === '/agora/settlements') {
        return j({
          settlements: { unavailable: 'n<2' },
          n: 1,
          f_max: 0,
          lab: true,
          note: 'Honest: do not report 0 trades as a settlement metric when n<2',
        });
      }

      return j({ error: 'Not Found' }, 404);
    } catch (e) {
      return j({ error: String(e.message || e) }, 500);
    }
  },
};
