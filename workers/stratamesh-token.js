/**
 * StrataMesh Token Engine — STRATA foundational token
 * Fungible STRATA + tokenisation to STRATA NFTs (native digital substance & external-asset representatives)
 * Open worlds & CGU/UGC (users + SCAs) are STRATA NFTs · import external/cold · DAG · IPFS
 */
async function sha256(d) {
  const h = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(typeof d === 'string' ? d : JSON.stringify(d))
  );
  return Array.from(new Uint8Array(h))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Lab CIDv1-style: bafy + base32-ish of sha256 (not full multiformats, stable content-id) */
async function contentCid(d) {
  const hex = await sha256(d);
  const alphabet = 'abcdefghijklmnopqrstuvwxyz234567';
  let bits = '';
  for (let i = 0; i < hex.length; i += 2) {
    bits += parseInt(hex.slice(i, i + 2), 16).toString(2).padStart(8, '0');
  }
  let out = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    out += alphabet[parseInt(bits.slice(i, i + 5), 2)];
  }
  return 'bafy' + out.slice(0, 52);
}

async function labSign(payload, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret || 'stratamesh-lab-signing-v1'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  });
}

async function dagSubmit(env, payload, content) {
  const body = JSON.stringify({
    payload,
    content: content || null,
    node_id: payload.emission_node || 'FOG-NODE-PT-CM-001',
  });
  try {
    if (env.DAG && typeof env.DAG.fetch === 'function') {
      const r = await env.DAG.fetch(
        new Request('https://dag/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        })
      );
      return await r.json();
    }
    const r = await fetch('https://stratamesh-dag.stratamesh.workers.dev/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    return await r.json();
  } catch (e) {
    return { success: false, error: String(e.message || e) };
  }
}


async function ensureLabOrigin(db) {
  if (!db) return;
  try {
    await db.prepare(`CREATE TABLE IF NOT EXISTS strata_origin_ledger (
      id TEXT PRIMARY KEY,
      account TEXT NOT NULL,
      amount REAL NOT NULL,
      origin TEXT NOT NULL,
      transit_eligible INTEGER NOT NULL DEFAULT 0,
      lab_only INTEGER NOT NULL DEFAULT 1,
      meta_json TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`).run();
  } catch (_) {}
  try {
    await db.prepare(`ALTER TABLE token_balances ADD COLUMN lab_balance REAL DEFAULT 0`).run();
  } catch (_) {}
  try {
    await db.prepare(`ALTER TABLE token_balances ADD COLUMN poc_balance REAL DEFAULT 0`).run();
  } catch (_) {}
}

async function recordOrigin(db, account, amount, origin, meta) {
  await ensureLabOrigin(db);
  const lab_only = origin === 'lab_bootstrap' || origin === 'lab_grant' ? 1 : 0;
  const transit = origin === 'poc_contribution' ? 1 : 0;
  const id = 'so_' + crypto.randomUUID().slice(0, 12);
  await db.prepare(
    `INSERT INTO strata_origin_ledger (id, account, amount, origin, transit_eligible, lab_only, meta_json)
     VALUES (?,?,?,?,?,?,?)`
  ).bind(id, account, amount, origin, transit, lab_only, JSON.stringify(meta || {})).run();
  // Update split balances
  const col = transit ? 'poc_balance' : 'lab_balance';
  try {
    await db.prepare(
      `INSERT INTO token_balances (account, token_type, balance, total_minted, total_burned, lab_balance, poc_balance)
       VALUES (?, 'STRATA', ?, ?, 0, ?, ?)
       ON CONFLICT(account, token_type) DO UPDATE SET
         balance = balance + excluded.balance,
         total_minted = COALESCE(token_balances.total_minted,0) + excluded.total_minted,
         lab_balance = COALESCE(token_balances.lab_balance,0) + excluded.lab_balance,
         poc_balance = COALESCE(token_balances.poc_balance,0) + excluded.poc_balance`
    ).bind(
      account,
      amount,
      amount,
      transit ? 0 : amount,
      transit ? amount : 0,
    ).run();
  } catch (e) {
    // fallback without columns
    await db.prepare(
      `INSERT INTO token_balances (account, token_type, balance, total_minted, total_burned)
       VALUES (?, 'STRATA', ?, ?, 0)
       ON CONFLICT(account, token_type) DO UPDATE SET
         balance = balance + excluded.balance,
         total_minted = COALESCE(token_balances.total_minted,0) + excluded.total_minted`
    ).bind(account, amount, amount).run();
  }
  return { id, account, amount, origin, transit_eligible: !!transit, lab_only: !!lab_only };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let path = url.pathname;
    // normalize prefixes
    for (const pfx of ['/api/v1/token', '/api/v1/nft', '/token', '/nft']) {
      if (path.startsWith(pfx)) {
        path = path.slice(pfx.length) || '/';
        break;
      }
    }
    if (request.method === 'OPTIONS') return json({ ok: true });

    const db = env.STRATAMESH_LEDGER || env.LEDGER || env.DB;


    // WHITEPAPLE: base STRATA is minted ONLY via Proof of Contribution (stratamesh-poc).
    // This worker tokenises assets (NFT) and tracks balances — it does NOT emit STRATA.
    if ((path === '/mint-strata' || path === '/mint/strata' || path === '/emit') && request.method === 'POST') {
      return json({
        success: false,
        error: 'STRATA emission forbidden here',
        whitepaper: 'Mint only via Proof of Contribution when nodes contribute resources to the DLT. Acquire STRATA on Strata Agora (P2P) against external value.',
        use: {
          mint: 'POST https://stratamesh-poc.stratamesh.workers.dev/mint',
          acquire: 'POST /agora listing or auction',
        },
      }, 403);
    }

    // --- supply / health ---
    let supply = 0,
      holders = 0;
    if (db) {
      try {
        const r = await db
          .prepare(
            "SELECT COALESCE(SUM(balance),0) as s, COUNT(*) as c FROM token_balances WHERE token_type IN ('STRATA','strata')"
          )
          .first();
        supply = r?.s ?? 0;
        holders = r?.c ?? 0;
      } catch (_) {}
    }

    if (path === '/health' || path === '/' || path === '') {
      let nfts = 0;
      try {
        const r = await db.prepare('SELECT COUNT(*) as c FROM nft_assets').first();
        nfts = r?.c ?? 0;
      } catch (_) {}
      return json({
        service: 'stratamesh-token',
        status: 'active',
        version: '2.5.1-app-token',
        total_supply: supply,
        holders,
        nft_count: nfts,
        engines: ['fungible_STRATA', 'strata_nft_tokenisation', 'nft_cgu_ugc', 'nft_import', 'open_world_nfts', 'dag_anchor', 'ipfs_metadata', 'app_token_factory'],
        strata_definition: 'Exclusive foundational token — fungible form and NFT form via tokenisation; not merely unit of account',
        emission_policy: 'STRATA mint only via PoC (stratamesh-poc); acquire via Agora P2P for external value',
        timestamp: new Date().toISOString(),
      });
    }

    if (path === '/supply' || path === '/status') {
      return json({ success: true, total_supply: supply, holders, status: 'active' });
    }


    
    if ((path === '/lab/grant' || path === '/lab/bootstrap') && request.method === 'POST') {
      if (!db) return json({ error: 'ledger unavailable' }, 503);
      const body = await request.json().catch(() => ({}));
      const account = body.account || body.beneficiary;
      const amount = Number(body.amount);
      if (!account || !(amount > 0)) return json({ error: 'account and amount > 0 required' }, 400);
      const rec = await recordOrigin(db, account, amount, body.origin === 'lab_grant' ? 'lab_grant' : 'lab_bootstrap', {
        note: body.note || 'laboratory initial offer',
        environment: 'lab',
      });
      return json({
        success: true,
        ...rec,
        warning: 'LAB ONLY — this STRATA does not transit to post-lab published network',
        transit_eligible: false,
      });
    }

    if (path === '/lab/policy' || path === '/emission-policy') {
      return json({
        environment: 'laboratory',
        strata: {
          lab_bootstrap_or_grant: { valid_in: 'lab_only', transit_to_post_lab: false },
          poc_contribution: { valid_in: 'lab_and_post_lab', transit_to_post_lab: true, sole_protocol_mint: true },
          agora_transfer: { valid_in: 'depends_on_source_units', note: 'transfer does not change origin of units when tracked' },
        },
        rule: 'Initial laboratory STRATA not earned via Node PoC is lab-only. Only PoC-earned STRATA by Nodes transit to the published version.',
      });
    }


    if (path === '/emission-audit' || path === '/audit') {
      let balances = [];
      let mints = [];
      try {
        const b = await db.prepare("SELECT account, balance, total_minted FROM token_balances WHERE token_type IN ('STRATA','strata') ORDER BY balance DESC LIMIT 50").all();
        balances = b.results || [];
      } catch (_) {}
      try {
        const m = await db.prepare('SELECT * FROM minting_events ORDER BY rowid DESC LIMIT 30').all();
        mints = m.results || [];
      } catch (_) {}
      const pre_policy = balances.filter((x) => !mints.some((m) => m.node_id === x.account) && Number(x.balance) > 0);
      let origin_rows = [];
      try {
        await ensureLabOrigin(db);
        origin_rows = (await db.prepare('SELECT origin, SUM(amount) as total, SUM(transit_eligible) as transit_rows FROM strata_origin_ledger GROUP BY origin').all()).results || [];
      } catch (_) {}
      return json({
        success: true,
        environment: 'laboratory',
        policy: {
          sole_protocol_mint: 'poc_contribution via stratamesh-poc',
          lab_bootstrap: 'lab-only STRATA; valid only in laboratory version; does NOT transit to post-lab',
          post_lab_transit: 'only balances with origin=poc_contribution (Node PdC) are eligible to transit',
          agora: 'P2P acquisition of existing STRATA — does not create protocol mint',
        },
        balances,
        recent_poc_mints: mints,
        origin_aggregates: origin_rows,
        pre_policy_or_unattributed: pre_policy.map((x) => x.account),
        note: 'Lab initial offer / grants are lab_only. Post-lab published network recognises only PoC-earned STRATA.',
      });
    }

    // --- fungible balance ---
    if (path === '/wallet' || path === '/balance') {
      const account = url.searchParams.get('account') || url.searchParams.get('owner');
      if (!account || !db) {
        return json({
          success: true,
          balance: 0,
          note: 'pass ?account=… ; PoC /balance for contribution wallet',
        });
      }
      try {
        const rows = await db
          .prepare('SELECT token_type, balance, total_minted, total_burned FROM token_balances WHERE account = ?')
          .bind(account)
          .all();
        let origins = [];
        try {
          await ensureLabOrigin(db);
          origins = (await db.prepare('SELECT origin, SUM(amount) as amount FROM strata_origin_ledger WHERE account = ? GROUP BY origin').bind(account).all()).results || [];
        } catch (_) {}
        const lab = origins.filter((o) => o.origin === 'lab_bootstrap' || o.origin === 'lab_grant').reduce((a, o) => a + Number(o.amount || 0), 0);
        const poc = origins.filter((o) => o.origin === 'poc_contribution').reduce((a, o) => a + Number(o.amount || 0), 0);
        return json({
          success: true,
          account,
          balances: rows.results || [],
          lab_policy: {
            lab_only_balance: lab,
            transit_eligible_poc_balance: poc,
            note: 'Only PoC-earned STRATA transit to post-lab; lab offer is laboratory-only',
          },
          origin_breakdown: origins,
        });
      } catch (e) {
        return json({ error: String(e.message || e) }, 500);
      }
    }

    // --- NFT list ---
    if (path === '/list' || path === '/nfts') {
      if (!db) return json({ nfts: [] });
      const owner = url.searchParams.get('owner');
      const limit = Math.min(50, parseInt(url.searchParams.get('limit') || '20', 10));
      try {
        let rows;
        if (owner) {
          rows = await db
            .prepare('SELECT * FROM nft_assets WHERE owner = ? ORDER BY created_at DESC LIMIT ?')
            .bind(owner, limit)
            .all();
        } else {
          rows = await db
            .prepare('SELECT * FROM nft_assets ORDER BY created_at DESC LIMIT ?')
            .bind(limit)
            .all();
        }
        return json({ success: true, nfts: rows.results || [], count: (rows.results || []).length });
      } catch (e) {
        return json({ error: String(e.message || e) }, 500);
      }
    }

    // --- GET single NFT ---
    if (path === '/get' || path.startsWith('/get/')) {
      const id = url.searchParams.get('id') || path.replace(/^\/get\/?/, '');
      if (!id) return json({ error: 'id required' }, 400);
      try {
        const row = await db.prepare('SELECT * FROM nft_assets WHERE id = ?').bind(id).first();
        if (!row) return json({ error: 'not found' }, 404);
        return json({ success: true, nft: row });
      } catch (e) {
        return json({ error: String(e.message || e) }, 500);
      }
    }


    // --- App-token factory (whitepaper: app tokens rooted in STRATA) ---
    if ((path === '/app-token' || path === '/mint-app-token') && request.method === 'POST') {
      if (!db) return json({ error: 'ledger unavailable' }, 503);
      const body = await request.json().catch(() => ({}));
      const issuer = body.issuer || body.owner || body.account || body.node_id;
      const symbol = (body.symbol || body.ticker || '').toUpperCase().slice(0, 12);
      const name = body.name || symbol || 'AppToken';
      const supply = Number(body.supply || body.amount || 0);
      const lock_strata = Number(body.lock_strata != null ? body.lock_strata : Math.max(1, Math.ceil(supply / 1000)));
      if (!issuer || !symbol || supply <= 0) {
        return json({ error: 'issuer, symbol, supply > 0 required' }, 400);
      }
      // require STRATA lock (not free emission of base token)
      let strataBal = 0;
      try {
        const br = await db.prepare("SELECT balance FROM token_balances WHERE account = ? AND token_type IN ('STRATA','strata')").bind(issuer).first();
        strataBal = Number(br?.balance || 0);
      } catch (_) {}
      if (strataBal < lock_strata) {
        return json({
          success: false,
          error: 'insufficient_STRATA_to_root_app_token',
          required_lock: lock_strata,
          balance: strataBal,
          whitepaper: 'Application-specific tokens are rooted in STRATA demand — lock/burn STRATA earned via PoC or bought on Agora',
        }, 402);
      }
      // lock STRATA into app_token_locks
      await db.prepare("UPDATE token_balances SET balance = balance - ? WHERE account = ? AND token_type IN ('STRATA','strata')").bind(lock_strata, issuer).run();
      try {
        await db.prepare(`CREATE TABLE IF NOT EXISTS app_tokens (
          symbol TEXT PRIMARY KEY, name TEXT, issuer TEXT, supply REAL, lock_strata REAL, dag_vertex TEXT, created_at TEXT
        )`).run();
        await db.prepare(`CREATE TABLE IF NOT EXISTS app_token_balances (
          account TEXT, symbol TEXT, balance REAL, PRIMARY KEY (account, symbol)
        )`).run();
      } catch (_) {}
      await db.prepare(
        "INSERT INTO token_balances (account, token_type, balance) VALUES (?, 'STRATA_LOCKED', ?) ON CONFLICT(account, token_type) DO UPDATE SET balance = balance + excluded.balance"
      ).bind(issuer + ':app:' + symbol, lock_strata).run().catch(()=>{});

      const dag = await dagSubmit(env, { type: 'app_token_mint', symbol, name, issuer, supply, lock_strata }, JSON.stringify({ symbol, supply }));
      try {
        await db.prepare('INSERT OR REPLACE INTO app_tokens (symbol, name, issuer, supply, lock_strata, dag_vertex, created_at) VALUES (?,?,?,?,?,?,?)')
          .bind(symbol, name, issuer, supply, lock_strata, dag.vertex_id || null, new Date().toISOString()).run();
        await db.prepare('INSERT INTO app_token_balances (account, symbol, balance) VALUES (?,?,?) ON CONFLICT(account, symbol) DO UPDATE SET balance = balance + excluded.balance')
          .bind(issuer, symbol, supply).run();
      } catch (e) {
        return json({ error: 'app token insert failed', detail: String(e.message || e) }, 500);
      }
      return json({
        success: true,
        app_token: { symbol, name, issuer, supply, lock_strata, dag_vertex: dag.vertex_id || null },
        message: 'App token minted; STRATA locked as root collateral (not base STRATA emission)',
      });
    }

    if (path === '/app-tokens' && request.method === 'GET') {
      try {
        const rows = await db.prepare('SELECT * FROM app_tokens ORDER BY created_at DESC LIMIT 50').all();
        return json({ success: true, tokens: rows.results || [] });
      } catch (_) {
        return json({ success: true, tokens: [] });
      }
    }

    // --- POST /mint  UGC / asset tokenization ---
    if (path === '/mint' && request.method === 'POST') {
      if (!db) return json({ error: 'ledger unavailable' }, 503);
      const body = await request.json().catch(() => ({}));
      const owner = body.owner || body.account || body.node_id || 'anonymous';
      const asset_type =
        body.asset_type || body.type || (body.physical ? 'physical' : body.financial ? 'financial' : 'digital');
      const name = body.name || body.title || 'Untitled Strata Asset';
      const description = body.description || '';
      const attributes = body.attributes || body.traits || {};
      const external_ref = body.external_ref || body.source || null; // e.g. other DLT
      const physical_ref = body.physical_ref || body.serial || null;
      const financial_ref = body.financial_ref || body.isin || null;

      const metadata = {
        name,
        description,
        asset_type,
        attributes,
        external_ref,
        physical_ref,
        financial_ref,
        standard: 'strata-nft-1',
        node: 'FOG-NODE-PT-CM-001',
        created_at: new Date().toISOString(),
      };

      // Whitepaper: tokenising assets is funded by STRATA demand — require holding STRATA (earned via PoC or bought on Agora)
      const TOKENISE_MIN_STRATA = Number(body.min_strata != null ? body.min_strata : 1);
      const TOKENISE_FEE = Number(body.fee_strata != null ? body.fee_strata : 0.1);
      let strataBal = 0;
      try {
        const br = await db
          .prepare("SELECT balance FROM token_balances WHERE account = ? AND token_type IN ('STRATA','strata')")
          .bind(owner)
          .first();
        strataBal = Number(br?.balance || 0);
      } catch (_) {}
      if (strataBal < TOKENISE_MIN_STRATA) {
        return json({
          success: false,
          error: 'insufficient_STRATA',
          required: TOKENISE_MIN_STRATA,
          balance: strataBal,
          whitepaper:
            'Asset tokenisation requires STRATA. Earn via Proof of Contribution (node work) or acquire on Strata Agora against external value. No free mint of base STRATA.',
          acquire: {
            poc: 'POST /api/v1/poc/mint (contributors only)',
            agora: 'POST /api/v1/agora/listing or /auction (P2P external value)',
          },
        }, 402);
      }
      // small fee burn/treasury move (lab): reduces spender balance
      if (TOKENISE_FEE > 0 && strataBal >= TOKENISE_FEE) {
        try {
          await db
            .prepare("UPDATE token_balances SET balance = balance - ? WHERE account = ? AND token_type IN ('STRATA','strata')")
            .bind(TOKENISE_FEE, owner)
            .run();
          await db
            .prepare(
              "INSERT INTO token_balances (account, token_type, balance) VALUES ('tokenise_fees', 'STRATA', ?) ON CONFLICT(account, token_type) DO UPDATE SET balance = balance + ?"
            )
            .bind(TOKENISE_FEE, TOKENISE_FEE)
            .run();
        } catch (_) {}
      }

      metadata.lab_signature = await labSign(JSON.stringify({ name, owner, asset_type, attributes }), env.LAB_SIGNING_SECRET);
      const metaStr = JSON.stringify(metadata);
      let metadata_cid = body.metadata_cid || null;
      // Real IPFS edge: /add → CIDv1 + store
      try {
        let ipfsRes;
        if (env.IPFS && typeof env.IPFS.fetch === 'function') {
          ipfsRes = await env.IPFS.fetch(new Request('https://ipfs/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: metadata, name, node_id: owner }),
          }));
        } else {
          ipfsRes = await fetch('https://stratamesh-ipfs.stratamesh.workers.dev/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: metadata, name, node_id: owner }),
          });
        }
        const ij = await ipfsRes.json();
        if (ij && ij.cid) metadata_cid = ij.cid;
      } catch (_) {}
      if (!metadata_cid) metadata_cid = await contentCid(metaStr);

      try {
        await db
          .prepare(
            'INSERT INTO ipfs_pins (node_id, cid, pin_name, size_bytes, tier, status, strata_cost) VALUES (?,?,?,?,?,?,?)'
          )
          .bind(owner, metadata_cid, name.slice(0, 64), metaStr.length, 'contributor', 'pinned', 0)
          .run();
      } catch (_) {}

      // DAG anchor
      const dag = await dagSubmit(
        env,
        {
          type: 'nft_mint',
          owner,
          asset_type,
          name,
          metadata_cid,
          emission_node: owner,
        },
        metaStr
      );
      const dag_cid = dag.vertex_id || dag.ipfs_cid || dag.payload_hash || null;

      const id = body.id || 'nft_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
      try {
        await db
          .prepare(
            'INSERT INTO nft_assets (id, owner, metadata_cid, asset_type, dag_cid, created_at) VALUES (?,?,?,?,?,?)'
          )
          .bind(id, owner, metadata_cid, asset_type, dag_cid, new Date().toISOString())
          .run();
      } catch (e) {
        return json({ error: 'insert failed', detail: String(e.message || e), id }, 500);
      }

      return json({
        success: true,
        mode: 'ugc_mint',
        strata_fee: TOKENISE_FEE,
        strata_balance_after: Math.max(0, strataBal - TOKENISE_FEE),
        nft: {
          id,
          owner,
          metadata_cid,
          asset_type,
          dag_cid,
          metadata,
        },
        dag: {
          success: !!dag.success,
          vertex_id: dag.vertex_id,
          tips: dag.tips,
          pipeline: dag.pipeline,
        },
        message: 'Asset tokenized as Strata NFT — metadata pinned, event on DAG',
      });
    }

    // --- POST /import — other DLT / cold storage reference ---
    if (path === '/import' && request.method === 'POST') {
      if (!db) return json({ error: 'ledger unavailable' }, 503);
      const body = await request.json().catch(() => ({}));
      const owner = body.owner || body.account || 'anonymous';
      const source_chain = body.source_chain || body.chain || body.network || 'external';
      const source_contract = body.contract || body.collection || null;
      const source_token_id = body.token_id || body.tokenId || null;
      const cold_proof = body.cold_proof || body.proof || body.signature || null;
      const name = body.name || `Imported ${source_chain} asset`;
      const asset_type = body.asset_type || 'imported';

      if (!source_token_id && !body.metadata_cid && !cold_proof) {
        return json(
          {
            error: 'need source token_id and/or metadata_cid and/or cold_proof',
          },
          400
        );
      }

      const metadata = {
        name,
        description: body.description || `Imported from ${source_chain}`,
        asset_type,
        source: {
          chain: source_chain,
          contract: source_contract,
          token_id: source_token_id,
          cold_proof: cold_proof ? String(cold_proof).slice(0, 200) : null,
          uri: body.uri || null,
        },
        standard: 'strata-nft-import-1',
        created_at: new Date().toISOString(),
      };
      metadata.lab_signature = await labSign(JSON.stringify({ source_chain, source_token_id, owner }), env.LAB_SIGNING_SECRET);
      const metaStr = JSON.stringify(metadata);
      const metadata_cid = body.metadata_cid || (await contentCid(metaStr));

      try {
        await db
          .prepare(
            'INSERT INTO ipfs_pins (node_id, cid, pin_name, size_bytes, tier, status, strata_cost) VALUES (?,?,?,?,?,?,?)'
          )
          .bind(owner, metadata_cid, name.slice(0, 64), metaStr.length, 'contributor', 'pinned', 0)
          .run();
      } catch (_) {}

      const dag = await dagSubmit(
        env,
        {
          type: 'nft_import',
          owner,
          source_chain,
          source_token_id,
          metadata_cid,
          emission_node: owner,
        },
        metaStr
      );
      const dag_cid = dag.vertex_id || null;
      const id =
        body.id ||
        'nft_imp_' +
          (await sha256(`${source_chain}:${source_contract}:${source_token_id}`)).slice(0, 16);

      try {
        await db
          .prepare(
            'INSERT INTO nft_assets (id, owner, metadata_cid, asset_type, dag_cid, created_at) VALUES (?,?,?,?,?,?)'
          )
          .bind(id, owner, metadata_cid, asset_type, dag_cid, new Date().toISOString())
          .run();
      } catch (e) {
        // idempotent-ish
        if (String(e.message || e).includes('UNIQUE')) {
          const existing = await db.prepare('SELECT * FROM nft_assets WHERE id = ?').bind(id).first();
          return json({ success: true, mode: 'import_existing', nft: existing });
        }
        return json({ error: String(e.message || e) }, 500);
      }

      return json({
        success: true,
        mode: 'import',
        nft: { id, owner, metadata_cid, asset_type, dag_cid, metadata },
        dag: { success: !!dag.success, vertex_id: dag.vertex_id },
        message: 'External/cold asset referenced as Strata NFT (claim, not custody of foreign chain)',
      });
    }

    // --- POST /transfer NFT ---
    if (path === '/transfer' && request.method === 'POST') {
      if (!db) return json({ error: 'ledger unavailable' }, 503);
      const body = await request.json().catch(() => ({}));
      const id = body.id || body.nft_id;
      const to = body.to || body.new_owner;
      const from = body.from || body.owner;
      if (!id || !to) return json({ error: 'id and to required' }, 400);
      const nft = await db.prepare('SELECT * FROM nft_assets WHERE id = ?').bind(id).first();
      if (!nft) return json({ error: 'not found' }, 404);
      if (from && nft.owner !== from) return json({ error: 'owner mismatch' }, 403);

      const dag = await dagSubmit(env, {
        type: 'nft_transfer',
        id,
        from: nft.owner,
        to,
        emission_node: nft.owner,
      });
      await db.prepare('UPDATE nft_assets SET owner = ? WHERE id = ?').bind(to, id).run();
      return json({
        success: true,
        nft_id: id,
        from: nft.owner,
        to,
        dag_cid: dag.vertex_id || null,
      });
    }

    return json({
      error: 'not found',
      endpoints: [
        'GET /health',
        'GET /supply',
        'GET /balance?account=',
        'GET /list?owner=',
        'GET /get?id=',
        'POST /mint',
        'POST /import',
        'POST /transfer',
      ],
    }, 404);
  },
};
