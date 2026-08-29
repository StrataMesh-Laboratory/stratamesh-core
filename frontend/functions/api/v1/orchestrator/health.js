/**
 * GET /api/v1/orchestrator/health — Pages Function (fail-open when Worker route misses).
 */
function pulseId() {
  return 'pulse-' + new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z') + '-' + Math.random().toString(36).slice(2, 8);
}

export async function onRequestGet() {
  return new Response(JSON.stringify({
    status: 'ok',
    service: 'stratamesh-orchestrator',
    origin: 'calhegasmorais.pt',
    version: 'origin-orch-chat-1.0.0',
    node_id: 'FOG-NODE-PT-CM-001',
    pulse_id: pulseId(),
    lab: true,
    endpoints: ['POST /api/orchestrator/chat', 'GET /api/v1/orchestrator/health'],
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    },
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  });
}
