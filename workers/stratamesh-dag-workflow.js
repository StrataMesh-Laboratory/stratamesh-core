import { WorkflowEntrypoint } from 'cloudflare:workers';
export class DAGValidationWorkflow extends WorkflowEntrypoint {
  async run(event, step) {
    const tx = event.payload;
    const v1 = await step.do('validate-schema', async () => {
      if (!tx.hash || !tx.type || !tx.address) throw new Error('Invalid schema');
      return { valid: true };
    });
    const v2 = await step.do('check-double-spend', async () => {
      const exists = await this.env.AUTH_DB.prepare('SELECT id FROM dag_vertices WHERE payload_hash = ?').bind(tx.hash).first();
      if (exists) throw new Error('Double spend detected');
      return { unique: true };
    });
    const v3 = await step.do('validate-ipsf-cid', async () => {
      if (tx.cid) {
        const pinned = await this.env.DOC_STORAGE.head('ipfs/' + tx.cid);
        if (!pinned) throw new Error('CID not pinned');
      }
      return { cid_valid: true };
    });
    const v4 = await step.do('check-rate-limit', async () => {
      const key = 'rate:' + tx.address + ':' + tx.type;
      const count = parseInt((await this.env.RATE_LIMIT.get(key)) || '0');
      if (count >= 200) throw new Error('Rate limit exceeded');
      await this.env.RATE_LIMIT.put(key, String(count + 1), { expirationTtl: 3600 });
      return { within_limit: true };
    });
    const v5 = await step.do('select-tips', async () => {
      const tips = await this.env.AUTH_DB.prepare('SELECT id, cumulative_weight FROM dag_vertices ORDER BY cumulative_weight DESC LIMIT 2').all();
      return { tip_ids: tips.results.map(t => t.id) };
    });
    const v6 = await step.do('attach-vertex', async () => {
      const result = await this.env.AUTH_DB.prepare('INSERT INTO dag_vertices (payload_hash, tx_type, address, cid, tip1, tip2, cumulative_weight, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, datetime("now"))').bind(tx.hash, tx.type, tx.address, tx.cid || null, v5.tip_ids[0] || null, v5.tip_ids[1] || null).run();
      return { vertex_id: result.meta.last_row_id, attached: true };
    });
    return { vertex_id: v6.vertex_id, tips: v5.tip_ids, validations: { schema: v1.valid, unique: v2.unique, cid: v3.cid_valid, rate: v4.within_limit } };
  }
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health') return new Response(JSON.stringify({ status: 'ok', service: 'stratamesh-dag-workflow' }), { headers: { 'Content-Type': 'application/json' } });
    if (url.pathname === '/trigger' && request.method === 'POST') {
      const payload = await request.json();
      const instance = await env.DAG_WORKFLOW.create({ payload });
      return new Response(JSON.stringify({ instance_id: instance.id, status: 'running' }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (url.pathname === '/status' && request.method === 'GET') {
      const id = url.searchParams.get('id');
      if (!id) return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      const instance = await env.DAG_WORKFLOW.get(id);
      return new Response(JSON.stringify({ id: instance.id, status: await instance.status() }), { headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('Not found', { status: 404 });
  }
};
