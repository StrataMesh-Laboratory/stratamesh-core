import { WorkflowEntrypoint } from 'cloudflare:workers';
export class IOTABridgeWorkflow extends WorkflowEntrypoint {
  async run(event, step) {
    const tx = event.payload;
    const v1 = await step.do('validate-iot-payload', async () => {
      if (!tx.device_id || !tx.data || !tx.address) throw new Error('Invalid IoT payload');
      return { valid: true };
    });
    const v2 = await step.do('submit-to-iota', async () => {
      const resp = await fetch('https://api.testnet.iota.org/api/core/v3/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: { type: 2, data: tx.data, tag: tx.device_id, address: tx.address } })
      });
      if (!resp.ok) throw new Error('IOTA submission failed: ' + resp.status);
      const result = await resp.json();
      return { message_id: result.messageId };
    });
    const v3 = await step.do('embed-cid-in-dag', async () => {
      const cid = 'iota:' + v2.message_id;
      await this.env.AUTH_DB.prepare('INSERT INTO dag_vertices (payload_hash, tx_type, address, cid, cumulative_weight, created_at) VALUES (?, ?, ?, ?, 0.1, datetime("now"))').bind(v2.message_id, 'iot_lightweight', tx.address, cid).run();
      return { cid, weight: 0.1 };
    });
    return { message_id: v2.message_id, dag_cid: v3.cid, weight: v3.weight };
  }
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const j = (d, s=200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });
    if (url.pathname === '/health') return j({ status: 'ok', service: 'stratamesh-iota' });
    if (url.pathname === '/submit' && request.method === 'POST') {
      const payload = await request.json();
      const instance = await env.IOTA_WORKFLOW.create({ payload });
      return j({ instance_id: instance.id, status: 'running' });
    }
    if (url.pathname === '/status' && request.method === 'GET') {
      const id = url.searchParams.get('id');
      if (!id) return j({ error: 'Missing id' }, 400);
      const inst = await env.IOTA_WORKFLOW.get(id);
      return j({ id: inst.id, status: await inst.status() });
    }
    if (url.pathname === '/batch' && request.method === 'POST') {
      const payloads = await request.json();
      const results = [];
      for (const p of payloads.slice(0, 50)) {
        const inst = await env.IOTA_WORKFLOW.create({ payload: p });
        results.push({ instance_id: inst.id });
      }
      return j({ submitted: results.length, instances: results });
    }
    return j({ error: 'Not found' }, 404);
  }
};
