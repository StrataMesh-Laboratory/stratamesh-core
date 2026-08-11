export default {
    async fetch(request, env) {
      const url = new URL(request.url);
      let path = url.pathname;
      if (path.startsWith('/api/v1/dao')) path = '/dao' + path.slice('/api/v1/dao'.length);
      if (path === '/health') path = '/dao/health';
      if (path === '/status') path = '/dao/status';
      if (path === '/proposals') path = '/dao/proposals';

      if (path === '/dao/health') {
        return new Response(JSON.stringify({ status: 'active', version: '2.0.0', endpoints: ['/dao/health', '/dao/proposal', '/dao/vote', '/dao/proposals', '/dao/spa', '/dao/status'] }), { headers: { 'Content-Type': 'application/json' } });
      }

      if (path === '/dao/proposal' && request.method === 'POST') {
        const data = await request.json();
        const proposalId = 'PROP-' + Date.now();
        const result = await env.STRATAMESH_LEDGER.prepare(
          'INSERT INTO dao_proposals (proposal_id, proposer_id, title, description, status, created_at) VALUES (?, ?, ?, ?, ?, datetime("now"))'
        ).bind(proposalId, data.proposer_id || 'calhegasmorais_fog_genesis_001', data.title || 'Untitled', data.description || '', 'open').run();
        return new Response(JSON.stringify({ success: true, proposal_id: proposalId }), { headers: { 'Content-Type': 'application/json' } });
      }

      if (path === '/dao/vote' && request.method === 'POST') {
        const data = await request.json();
        const voteId = 'VOTE-' + Date.now();
        return new Response(JSON.stringify({ success: true, vote_id: voteId, proposal_id: data.proposal_id, vote: data.vote, voter: data.voter_id }), { headers: { 'Content-Type': 'application/json' } });
      }

      if (path === '/dao/proposals') {
        const proposals = await env.STRATAMESH_LEDGER.prepare('SELECT * FROM dao_proposals ORDER BY created_at DESC LIMIT 20').all();
        return new Response(JSON.stringify({ success: true, proposals: proposals.results || [] }), { headers: { 'Content-Type': 'application/json' } });
      }

      if (path === '/dao/spa' && request.method === 'POST') {
        const data = await request.json();
        const spaId = 'SPA-' + Date.now();
        return new Response(JSON.stringify({ success: true, spa_id: spaId, node_id: data.node_id, service_type: data.service_type }), { headers: { 'Content-Type': 'application/json' } });
      }

      if (path === '/dao/status') {
        return new Response(JSON.stringify({ success: true, status: 'operational', active_proposals: 0, total_members: 1 }), { headers: { 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({ error: 'Not Found', available_endpoints: ['/dao/health', '/dao/proposal', '/dao/vote', '/dao/proposals', '/dao/spa', '/dao/status'] }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }
  };
