export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let path = url.pathname;
    if (path.startsWith('/api/v1/token')) path = path.slice('/api/v1/token'.length) || '/';
    if (path.startsWith('/token')) path = path.slice('/token'.length) || '/';
    const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
    if (request.method === 'OPTIONS') return new Response(null, { headers: { ...headers, 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': '*' } });

    let supply = 0, holders = 0;
    try {
      if (env.STRATAMESH_LEDGER || env.LEDGER) {
        const db = env.STRATAMESH_LEDGER || env.LEDGER;
        try {
          const r = await db.prepare("SELECT COALESCE(SUM(balance),0) as s, COUNT(*) as c FROM token_balances").first();
          supply = r?.s ?? 0; holders = r?.c ?? 0;
        } catch (_) {
          try {
            const r = await db.prepare("SELECT COALESCE(SUM(amount),0) as s FROM token_ledger").first();
            supply = r?.s ?? 0;
          } catch (_) {}
        }
      }
    } catch (_) {}

    if (path === '/health' || path === '/' || path === '') {
      return new Response(JSON.stringify({
        service: 'stratamesh-token', status: 'active', version: '1.1.0',
        total_supply: supply, holders, timestamp: new Date().toISOString()
      }), { headers });
    }
    if (path === '/supply' || path === '/status') {
      return new Response(JSON.stringify({ success: true, total_supply: supply, holders, status: 'active' }), { headers });
    }
    if (path === '/wallet' || path === '/balance') {
      return new Response(JSON.stringify({ success: true, balance: 0, note: 'use Authorization session; PoC /balance for contribution wallet' }), { headers });
    }
    return new Response(JSON.stringify({ error: 'not found', endpoints: ['/health','/supply','/status','/wallet'] }), { status: 404, headers });
  }
};
