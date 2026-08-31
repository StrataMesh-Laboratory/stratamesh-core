/**
 * Strata Agora — whitepaper P2P: list STRATA for EXTERNAL value only.
 * Uses existing D1 schema (listing_id, node_id, token_amount, price_per_token, reference_currency).
 *
 * Lab book (non-transitioning L-STRATA) is the operator offering:
 *   1 L-STRATA = €0.10 = 1 mesh-service-unit (Fog Lisbon 100W·h × overhead).
 *   Wiener Philharmoniker L-STRATA = (spot EUR per oz × fraction) / 0.10.
 *   Spot is live XAU/EUR (Swissquote mid, fallback gold-api USD × Frankfurter).
 * D1 user listings still merge in; lab rows always present.
 */
function j(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

const LAB_EUR_PER_LSTRATA = 0.10;
const LAB_SELLER = 'FOG-NODE-PT-CM-001';
const LAB_SELLER_ENI = 'AMCM ENI';
const AGORA_VERSION = '3.3.2-settlements-count';
let _goldSpotCache = null;

async function fetchJson(url, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs || 2500);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'stratamesh-agora/' + AGORA_VERSION },
    });
    const json = await r.json().catch(() => null);
    return { ok: r.ok, json };
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e).slice(0, 160) };
  } finally {
    clearTimeout(t);
  }
}

async function goldSpotEurPerOz() {
  const now = Date.now();
  if (_goldSpotCache && now - _goldSpotCache.at < 60000 && _goldSpotCache.eur_per_oz > 0) {
    return _goldSpotCache;
  }
  const sq = await fetchJson(
    'https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAU/EUR',
    2500
  );
  try {
    const arr = Array.isArray(sq.json) ? sq.json : [];
    const prices = (arr[0] && arr[0].spreadProfilePrices) || [];
    const std = prices.find((p) => p.spreadProfile === 'standard') || prices[0];
    const bid = Number(std && std.bid);
    const ask = Number(std && std.ask);
    if (bid > 0 && ask > 0) {
      _goldSpotCache = {
        ok: true,
        eur_per_oz: (bid + ask) / 2,
        source: 'swissquote_xau_eur_mid',
        at: now,
        stale: false,
      };
      return _goldSpotCache;
    }
  } catch (_) {}
  const [g, fx] = await Promise.all([
    fetchJson('https://api.gold-api.com/price/XAU', 2500),
    fetchJson('https://api.frankfurter.app/latest?from=USD&to=EUR', 2500),
  ]);
  const usd = Number(g.json && g.json.price);
  const usdEur = Number(fx.json && fx.json.rates && fx.json.rates.EUR);
  if (usd > 0 && usdEur > 0) {
    _goldSpotCache = {
      ok: true,
      eur_per_oz: usd * usdEur,
      source: 'gold-api_usd*frankfurter',
      at: now,
      usd_per_oz: usd,
      fx_usd_eur: usdEur,
      stale: false,
    };
    return _goldSpotCache;
  }
  if (_goldSpotCache && _goldSpotCache.eur_per_oz > 0) {
    return Object.assign({}, _goldSpotCache, { stale: true });
  }
  return { ok: false, eur_per_oz: null, source: 'unavailable', at: now, stale: true };
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

async function labBook() {
  const spot = await goldSpotEurPerOz();
  const ozEur = Number(spot.eur_per_oz);
  const eurLots = [1, 2, 5, 10, 20, 50, 100, 200, 500];
  const goldLots = [
    { label: '1 oz', frac: 1 },
    { label: '1/2 oz', frac: 0.5 },
    { label: '1/4 oz', frac: 0.25 },
    { label: '1/10 oz', frac: 0.1 },
    { label: '1/25 oz', frac: 0.04 },
  ];
  const eur = eurLots.map((e) => {
    const amount = e / LAB_EUR_PER_LSTRATA;
    return {
      listing_id: 'LAB-EUR-' + e,
      node_id: LAB_SELLER,
      seller: LAB_SELLER,
      seller_eni: LAB_SELLER_ENI,
      token_amount: amount,
      amount_lstrata: amount,
      price_per_token: LAB_EUR_PER_LSTRATA,
      reference_currency: 'EUR',
      quote_asset: 'EUR',
      quote_total: e,
      listing_type: 'lab_fixed',
      status: 'active',
      unit: 'L-STRATA',
      non_transitioning: true,
      book: 'eur',
      title: e + ' EUR',
      note: 'Lab L-STRATA, non-transitioning. Peg 1 L-STRATA = €0.10 mesh-service-unit.',
    };
  });
  const gold = ozEur > 0
    ? goldLots.map((o) => {
        const eurVal = ozEur * o.frac;
        const amount = round2(eurVal / LAB_EUR_PER_LSTRATA);
        return {
          listing_id: 'LAB-AU-' + String(o.label).replace(/\s+/g, ''),
          node_id: LAB_SELLER,
          seller: LAB_SELLER,
          seller_eni: LAB_SELLER_ENI,
          token_amount: amount,
          amount_lstrata: amount,
          price_per_token: LAB_EUR_PER_LSTRATA,
          reference_currency: 'XAU',
          quote_asset: 'XAU',
          quote_total: round2(eurVal),
          gold_oz: o.frac,
          gold_label: o.label,
          gold_coin: 'Wiener Philharmoniker',
          gold_spot_eur_per_oz: round2(ozEur),
          gold_spot_source: spot.source,
          gold_spot_at: new Date(spot.at).toISOString(),
          listing_type: 'lab_gold_wiener_philharmoniker',
          status: 'active',
          unit: 'L-STRATA',
          non_transitioning: true,
          book: 'gold',
          title: 'Wiener Philharmoniker ' + o.label,
          note:
            'L-STRATA = (spot EUR/oz × ' +
            o.frac +
            ') / 0.10. Spot ' +
            round2(ozEur) +
            ' EUR/oz (' +
            spot.source +
            (spot.stale ? ', stale' : '') +
            '). Index is gold, not a fixed EUR face.',
        };
      })
    : [];
  return {
    eur,
    gold,
    all: eur.concat(gold),
    peg: {
      eur_per_lstrata: LAB_EUR_PER_LSTRATA,
      gold_oz_eur: ozEur > 0 ? round2(ozEur) : null,
      gold_spot_source: spot.source,
      gold_spot_at: new Date(spot.at).toISOString(),
      formula: 'l_strata = (gold_spot_eur_per_oz * oz_fraction) / 0.10',
      stale: !!spot.stale,
      ok: !!spot.ok,
    },
  };
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
    const lab = await labBook();
    try {
      if (path === '/agora/health') {
        return j({
          status: 'active',
          version: AGORA_VERSION,
          role: 'P2P exchange: L-STRATA listed for external value (EUR / Wiener Philharmoniker gold). Not a mint.',
          external_value_exchange: true,
          lab_peg: lab.peg,
          settlement: 'lab_intent + agora_payments verification_status',
        });
      }

      if (path === '/agora/gold-spot' || path === '/gold-spot') {
        return j({ success: true, peg: lab.peg, gold: lab.gold, formula: lab.peg.formula });
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
        const labRows = lab.all.filter((r) => (r.reference_currency || 'EUR').toUpperCase() === asset
          || (asset === 'EUR' && r.book === 'eur')
          || (asset === 'XAU' && r.book === 'gold'));
        if (!rows.length) rows = labRows;
        else rows = rows.concat(labRows);
        if (!rows.length) {
          return j({
            success: true,
            quote_asset: asset,
            strata_per_quote: asset === 'EUR' ? (1 / LAB_EUR_PER_LSTRATA) : null,
            quote_per_strata: asset === 'EUR' ? LAB_EUR_PER_LSTRATA : null,
            liquidity: 0,
            source: 'lab_peg',
            message: asset === 'EUR' ? 'Lab peg 1 L-STRATA = €0.10' : 'No active Agora listings — cannot form rate',
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
          source: 'agora_open_book_vwap+lab_peg',
          lab_peg: lab.peg,
          unit: 'L-STRATA',
          note: 'Rate discovered on Agora P2P book merged with operator lab peg — not protocol mint.',
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
        let rows = [];
        try {
          rows = (await db
            .prepare("SELECT * FROM agora_listings WHERE status = 'active' ORDER BY created_at DESC LIMIT 50")
            .all()).results || [];
        } catch (_) { rows = []; }
        const listings = lab.all.concat(rows);
        return j({
          success: true,
          listings,
          eur: lab.eur,
          gold: lab.gold,
          peg: lab.peg,
          seller: LAB_SELLER,
          seller_eni: LAB_SELLER_ENI,
          unit: 'L-STRATA',
          non_transitioning: true,
          mode: 'lab_book+external_value_p2p',
          note: 'Operator lab book: EUR 1–500 and Wiener Philharmoniker 1…1/25 oz against non-transitioning L-STRATA. Peg 1 L-STRATA = €0.10.',
        });
      }

      if ((path === '/agora/trade' || path === '/agora/order') && request.method === 'POST') {
        const data = await request.json().catch(() => ({}));
        const listing_id = data.listing_id || data.id;
        const buyer = data.buyer || data.account;
        const payment_method = data.payment_method || data.quote_asset || 'EUR';
        const tx_hash = data.tx_hash || data.payment_ref || null;
        if (!listing_id || !buyer) return j({ error: 'listing_id and buyer required' }, 400);
        const labHit = lab.all.find((x) => x.listing_id === listing_id);
        if (labHit) {
          return j({
            success: true,
            trade_id: 'LAB-INT-' + crypto.randomUUID().slice(0, 8),
            listing_id,
            seller: labHit.seller,
            buyer,
            amount_strata: labHit.token_amount,
            unit: 'L-STRATA',
            non_transitioning: true,
            quote: { asset: labHit.reference_currency, price_per_token: labHit.price_per_token, total: labHit.quote_total, gold_oz: labHit.gold_oz || null },
            payment_method,
            settlement_status: 'lab_intent_pending_external_proof',
            note: 'Lab offering: intent recorded. L-STRATA do not transit. External EUR / gold proof required to settle.',
          });
        }
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

      if (path === '/agora/status' || path === '/agora/settlements') {
        let total_listings = 0,
          total_trades = 0,
          confirmed = 0;
        try {
          total_listings = (await db.prepare('SELECT COUNT(*) as c FROM agora_listings').first())?.c ?? 0;
        } catch (_) {}
        try {
          total_trades = (await db.prepare('SELECT COUNT(*) as c FROM agora_trades').first())?.c ?? 0;
        } catch (_) {}
        try {
          confirmed = (await db.prepare("SELECT COUNT(*) as c FROM agora_trades WHERE settlement_status IN ('lab_confirmed','confirmed') OR tx_hash IS NOT NULL AND tx_hash != ''").first())?.c ?? 0;
        } catch (_) {
          confirmed = 0;
        }
        const settlements = Number(total_trades) || 0;
        const body = {
          success: true,
          status: 'operational',
          version: AGORA_VERSION,
          total_listings: total_listings + lab.all.length,
          lab_listings: lab.all.length,
          total_trades,
          confirmed,
          settlement: 'lab_intent',
          settlements,
          n: 2,
          f_max: 0,
          mesh_member: true,
          authority: 'FOG-NODE-PT-CM-001',
          peg: lab.peg,
          lab: true,
          note: 'settlements is COUNT(agora_trades). n=2 mesh (Fog+Edge), f_max=0 until n>=3. Not seed. Not BFT.',
        };
        return j(body);
      }

      return j({ error: 'Not Found' }, 404);
    } catch (e) {
      return j({ error: String(e.message || e) }, 500);
    }
  },
};
