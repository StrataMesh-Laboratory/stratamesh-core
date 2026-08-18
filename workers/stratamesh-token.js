/**
 * STRATA functional engine — exclusive foundational token of StrataMesh.
 *
 * FUNGIBLE:
 *   - Base STRATA: settlement, PoS, Agora; mint only via Node PoC (stratamesh-poc).
 *   - World sub-tokens: fungible tokens scoped to an open world, collateralised (lastrados)
 *     by locked STRATA — not free emission of base STRATA.
 *
 * NON-FUNGIBLE (STRATA NFT):
 *   - Building blocks of open worlds and CGU sandboxes (users + SCAs).
 *   - External-asset representatives and imports anchored on the DLT.
 *
 * Worlds and sandboxes are not decorative metadata: their structure is composed of STRATA NFTs.
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


async function ensureStrataFunctionalSchema(db) {
  if (!db) return;
  const stmts = [
    `CREATE TABLE IF NOT EXISTS strata_nfts (
      id TEXT PRIMARY KEY, owner TEXT, name TEXT, description TEXT, asset_type TEXT,
      metadata_json TEXT, content_cid TEXT, dag_vertex TEXT, role TEXT, world_id TEXT, sandbox_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS nft_assets (
      id TEXT PRIMARY KEY, owner TEXT, name TEXT, description TEXT, asset_type TEXT,
      metadata_json TEXT, content_cid TEXT, dag_vertex TEXT, role TEXT, world_id TEXT, sandbox_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS world_structures (
      world_id TEXT PRIMARY KEY, title TEXT, realm_id TEXT, owner TEXT, genesis_nft_id TEXT,
      block_count INTEGER DEFAULT 0, status TEXT DEFAULT 'active',
      meta_json TEXT, created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS world_nft_blocks (
      block_id TEXT PRIMARY KEY, world_id TEXT NOT NULL, nft_id TEXT NOT NULL,
      block_role TEXT NOT NULL, ordinal INTEGER DEFAULT 0, meta_json TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS world_fungible_tokens (
      symbol TEXT PRIMARY KEY, world_id TEXT NOT NULL, name TEXT, issuer TEXT,
      supply REAL NOT NULL, lock_strata REAL NOT NULL, collateral_account TEXT,
      dag_vertex TEXT, created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS world_token_balances (
      account TEXT NOT NULL, symbol TEXT NOT NULL, balance REAL NOT NULL DEFAULT 0,
      PRIMARY KEY (account, symbol)
    )`,
    `CREATE TABLE IF NOT EXISTS cgu_records (
      cgu_id TEXT PRIMARY KEY, nft_id TEXT NOT NULL, sandbox_id TEXT, world_id TEXT,
      author_kind TEXT, author_id TEXT, title TEXT, status TEXT DEFAULT 'draft',
      created_at TEXT DEFAULT (datetime('now'))
    )`,
  ];
  for (const s of stmts) {
    try { await db.prepare(s).run(); } catch (_) {}
  }
  for (const a of [
    "ALTER TABLE nft_assets ADD COLUMN role TEXT",
    "ALTER TABLE nft_assets ADD COLUMN world_id TEXT",
    "ALTER TABLE nft_assets ADD COLUMN sandbox_id TEXT",
    "ALTER TABLE nft_assets ADD COLUMN name TEXT",
    "ALTER TABLE nft_assets ADD COLUMN description TEXT",
    "ALTER TABLE nft_assets ADD COLUMN asset_type TEXT",
    "ALTER TABLE nft_assets ADD COLUMN metadata_json TEXT",
    "ALTER TABLE nft_assets ADD COLUMN content_cid TEXT",
    "ALTER TABLE nft_assets ADD COLUMN dag_vertex TEXT",
    "ALTER TABLE nft_assets ADD COLUMN owner TEXT",
    "ALTER TABLE nft_assets ADD COLUMN created_at TEXT",
  ]) {
    try { await db.prepare(a).run(); } catch (_) {}
  }
}

async function mintStrataNft(db, env, {
  owner, name, description, role, world_id, sandbox_id, kind, attributes, authors,
}) {
  await ensureStrataFunctionalSchema(db);
  const id = 'nft_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  const metadata = {
    name, description: description || '',
    foundational_token: 'STRATA',
    form: 'non_fungible',
    role: role || kind || 'building_block',
    kind: kind || role || 'building_block',
    world_id: world_id || null,
    sandbox_id: sandbox_id || null,
    attributes: attributes || {},
    authors: authors || [],
    cgu_includes_sca: true,
    standard: 'strata-nft-1',
    node: 'FOG-NODE-PT-CM-001',
    created_at: new Date().toISOString(),
  };
  const content = JSON.stringify(metadata);
  const cid = await contentCid(content);
  const dag = await dagSubmit(env, {
    type: 'strata_nft',
    id, owner, role: metadata.role, world_id, sandbox_id,
  }, content);
  const metaStr = JSON.stringify(metadata);
  await db.prepare(
    `INSERT INTO strata_nfts (id, owner, name, description, asset_type, metadata_json, content_cid, dag_vertex, role, world_id, sandbox_id)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    id, owner, name, description || '', metadata.role, metaStr, cid,
    dag.vertex_id || null, metadata.role, world_id || null, sandbox_id || null,
  ).run();
  // best-effort mirror into legacy nft_assets if compatible
  try {
    await db.prepare(
      `INSERT INTO nft_assets (id, metadata_json) VALUES (?,?)`
    ).bind(id, metaStr).run();
  } catch (_) {}
  return { nft_id: id, content_cid: cid, dag_vertex: dag.vertex_id || null, metadata, table: 'strata_nfts' };
}

async function lockStrataCollateral(db, issuer, amount, vaultAccount) {
  const br = await db.prepare(
    "SELECT balance FROM token_balances WHERE account = ? AND token_type IN ('STRATA','strata')"
  ).bind(issuer).first().catch(() => null);
  const bal = Number(br?.balance || 0);
  if (bal < amount) {
    return { ok: false, balance: bal, required: amount };
  }
  await db.prepare(
    "UPDATE token_balances SET balance = balance - ? WHERE account = ? AND token_type IN ('STRATA','strata')"
  ).bind(amount, issuer).run();
  await db.prepare(
    `INSERT INTO token_balances (account, token_type, balance, total_minted, total_burned)
     VALUES (?, 'STRATA_LOCKED', ?, 0, 0)
     ON CONFLICT(account, token_type) DO UPDATE SET balance = balance + excluded.balance`
  ).bind(vaultAccount, amount).run().catch(async () => {
    await db.prepare(
      "INSERT INTO token_balances (account, token_type, balance) VALUES (?, 'STRATA_LOCKED', ?)"
    ).bind(vaultAccount, amount).run().catch(() => {});
  });
  return { ok: true, locked: amount, vault: vaultAccount };
}


export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let path = url.pathname;
    // normalize prefixes
    // Longer prefixes first; never strip bare "/token" from "/tokenisation…"
    for (const pfx of ['/api/v1/token', '/api/v1/nft', '/token/', '/nft/']) {
      if (path === pfx.slice(0, -1)) { path = '/'; break; }
      if (path.startsWith(pfx)) {
        path = path.slice(pfx.length - 1) || '/'; // keep leading /
        if (!path.startsWith('/')) path = '/' + path;
        break;
      }
    }
    if (path === '/token' || path === '/nft') path = '/';
    if (request.method === 'OPTIONS') return json({ ok: true });

    const db = env.STRATAMESH_LEDGER || env.LEDGER || env.DB;


    // WHITEPAPLE: base STRATA is minted ONLY via Proof of Contribution (stratamesh-poc).
    // This worker tokenises assets (NFT) and tracks balances — it does NOT emit STRATA.
    
    if (path === '/tokenisation/kinds' || path === '/tokenisation' || path === '/nft/kinds' || path === '/kinds') {
      return json({
        foundational_token: 'STRATA',
        forms: {
          fungible: { role: 'settlement, PoS, Agora, contribution metering', mint: 'Node PoC only' },
          non_fungible: {
            role: 'tokenisation of digital substance or external-asset representatives on the DLT',
            kinds: [
              { id: 'open_world', note: 'Open worlds composed of STRATA NFTs' },
              { id: 'cgu', aliases: ['ugc'], note: 'User-Generated Creations including SCA authors' },
              { id: 'external_asset', note: 'Representative of off-DLT asset anchored on DLT' },
              { id: 'import', note: 'Import from other DLT or cold storage as STRATA NFT' },
            ],
          },
        },
      });
    }

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
        version: '3.0.0-strata-functional',
        total_supply: supply,
        holders,
        nft_count: nfts,
        engines: ['fungible_STRATA', 'world_sub_tokens_collateralised', 'strata_nft_world_blocks', 'strata_nft_cgu', 'nft_import', 'dag_anchor', 'ipfs_metadata'],
        strata_definition: 'Functional: base STRATA fungible (PoC mint) + world sub-tokens fungible collateralised in STRATA; STRATA NFTs are the building blocks of open worlds and CGU sandboxes (users+SCAs).',
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
      const world_id = url.searchParams.get('world_id');
      const limit = Math.min(50, parseInt(url.searchParams.get('limit') || '20', 10));
      try {
        await ensureStrataFunctionalSchema(db);
        let rows = { results: [] };
        try {
          if (owner && world_id) {
            rows = await db.prepare('SELECT * FROM strata_nfts WHERE owner = ? AND world_id = ? ORDER BY created_at DESC LIMIT ?').bind(owner, world_id, limit).all();
          } else if (owner) {
            rows = await db.prepare('SELECT * FROM strata_nfts WHERE owner = ? ORDER BY created_at DESC LIMIT ?').bind(owner, limit).all();
          } else if (world_id) {
            rows = await db.prepare('SELECT * FROM strata_nfts WHERE world_id = ? ORDER BY created_at DESC LIMIT ?').bind(world_id, limit).all();
          } else {
            rows = await db.prepare('SELECT * FROM strata_nfts ORDER BY created_at DESC LIMIT ?').bind(limit).all();
          }
        } catch (_) {
          if (owner) {
            rows = await db.prepare('SELECT * FROM nft_assets WHERE owner = ? ORDER BY rowid DESC LIMIT ?').bind(owner, limit).all();
          } else {
            rows = await db.prepare('SELECT * FROM nft_assets ORDER BY rowid DESC LIMIT ?').bind(limit).all();
          }
        }
        return json({ success: true, nfts: rows.results || [], count: (rows.results || []).length, source: 'strata_nfts' });
      } catch (e) {
        return json({ error: String(e.message || e) }, 500);
      }
    }

    // --- GET single NFT NFT ---
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

    // --- POST /mint  CGU/UGC + asset tokenisation → STRATA NFT ---
    if (path === '/mint' && request.method === 'POST') {
      if (!db) return json({ error: 'ledger unavailable' }, 503);
      const body = await request.json().catch(() => ({}));
      const owner = body.owner || body.account || body.node_id || 'anonymous';
      const kind_raw = String(body.kind || body.category || body.asset_type || body.type || 'cgu').toLowerCase();
      const kind_map = {
        ugc: 'cgu', cgu: 'cgu', sandbox: 'cgu', creation: 'cgu',
        open_world: 'open_world', world: 'open_world', mundo: 'open_world',
        external: 'external_asset', external_asset: 'external_asset', representative: 'external_asset',
        import: 'import', cold: 'import',
        digital: 'cgu', physical: 'external_asset', financial: 'external_asset',
      };
      const kind = kind_map[kind_raw] || kind_raw || 'cgu';
      const asset_type =
        body.asset_type || body.type || (body.physical ? 'physical' : body.financial ? 'financial' : kind === 'open_world' ? 'open_world' : 'digital');
      const name = body.name || body.title || (kind === 'open_world' ? 'Open World' : kind === 'cgu' ? 'CGU Creation' : 'Strata Asset');
      const description = body.description || '';
      const attributes = body.attributes || body.traits || {};
      const external_ref = body.external_ref || body.source || null;
      const physical_ref = body.physical_ref || body.serial || null;
      const financial_ref = body.financial_ref || body.isin || null;
      const authors = body.authors || body.creators || []; // users and/or SCA ids

      const metadata = {
        name,
        description,
        kind,
        asset_type,
        attributes,
        authors,
        foundational_token: 'STRATA',
        form: 'non_fungible',
        external_ref,
        physical_ref,
        financial_ref,
        standard: 'strata-nft-1',
        cgu_includes_sca: true,
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


    // ========== STRATA FUNCTIONAL ENGINE ==========
    await ensureStrataFunctionalSchema(db);

    if (path === '/architecture' || path === '/strata/architecture') {
      return json({
        foundational_token: 'STRATA',
        fungible: {
          base_STRATA: {
            role: 'settlement, PoS, Agora, contribution metering',
            mint: 'Node PoC only (stratamesh-poc)',
          },
          world_sub_tokens: {
            role: 'fungible tokens developed inside open worlds',
            collateral: 'must lock base STRATA (lastrado) — not free base emission',
            endpoint: 'POST /world-token',
          },
        },
        non_fungible: {
          role: 'building blocks of open worlds and CGU sandboxes; external-asset representatives',
          open_world: 'composed of STRATA NFT blocks (POST /world/compose, /world/block)',
          cgu: 'CGU creations (users + SCAs) are STRATA NFTs (POST /cgu/mint)',
          endpoint_kinds: 'GET /tokenisation/kinds',
        },
        invariant: 'World structure and sandbox CGU are not metadata — they are STRATA NFTs. Sub-tokens in worlds are STRATA-collateralised fungibles.',
      });
    }

    // Compose open world as genesis STRATA NFT + block registry
    if ((path === '/world/compose' || path === '/open-world/compose') && request.method === 'POST') {
      if (!db) return json({ error: 'ledger unavailable' }, 503);
      try {
      const body = await request.json().catch(() => ({}));
      const world_id = body.world_id || body.id || ('world_' + crypto.randomUUID().slice(0, 10));
      const owner = body.owner || body.operator || body.account || 'FOG-NODE-PT-CM-001';
      const title = body.title || body.name || world_id;
      const realm_id = body.realm_id || null;
      const genesis = await mintStrataNft(db, env, {
        owner, name: title + ' · genesis',
        description: body.description || 'Open-world genesis block (STRATA NFT)',
        role: 'world_genesis', kind: 'open_world',
        world_id, attributes: { genesis: true, realm_id },
      });
      await db.prepare(
        `INSERT INTO world_structures (world_id, title, realm_id, owner, genesis_nft_id, block_count, status, meta_json)
         VALUES (?,?,?,?,?,1,'active',?)
         ON CONFLICT(world_id) DO UPDATE SET title=excluded.title, genesis_nft_id=excluded.genesis_nft_id, block_count=excluded.block_count`
      ).bind(world_id, title, realm_id, owner, genesis.nft_id, JSON.stringify({ realm_id, composed_at: new Date().toISOString() })).run().catch(async () => {
        await db.prepare(
          `INSERT OR REPLACE INTO world_structures (world_id, title, realm_id, owner, genesis_nft_id, block_count, status, meta_json)
           VALUES (?,?,?,?,?,1,'active',?)`
        ).bind(world_id, title, realm_id, owner, genesis.nft_id, JSON.stringify({ realm_id })).run();
      });
      const block_id = 'blk_' + crypto.randomUUID().slice(0, 12);
      await db.prepare(
        `INSERT INTO world_nft_blocks (block_id, world_id, nft_id, block_role, ordinal, meta_json)
         VALUES (?,?,?,?,0,?)`
      ).bind(block_id, world_id, genesis.nft_id, 'genesis', JSON.stringify({ genesis: true })).run();
      return json({
        success: true,
        world_id, title, owner, realm_id,
        structure: 'open_world_as_strata_nfts',
        genesis_nft: genesis,
        block_id,
        next: ['POST /world/block', 'POST /world-token', 'POST /cgu/mint'],
      });
      } catch (e) {
        return json({ success: false, error: String(e.message || e), stack: String(e.stack || '').slice(0, 300) }, 500);
      }
    }

    // Add building-block STRATA NFT to an open world
    if ((path === '/world/block' || path === '/open-world/block') && request.method === 'POST') {
      if (!db) return json({ error: 'ledger unavailable' }, 503);
      try {
      const body = await request.json().catch(() => ({}));
      const world_id = body.world_id;
      if (!world_id) return json({ error: 'world_id required' }, 400);
      const owner = body.owner || body.account || 'FOG-NODE-PT-CM-001';
      const role = body.block_role || body.role || 'building_block';
      const name = body.name || body.title || (role + ' block');
      const nft = await mintStrataNft(db, env, {
        owner, name, description: body.description || '',
        role, kind: 'open_world_block', world_id,
        attributes: body.attributes || {},
      });
      const ordinal = Number(body.ordinal || 0);
      const block_id = 'blk_' + crypto.randomUUID().slice(0, 12);
      await db.prepare(
        `INSERT INTO world_nft_blocks (block_id, world_id, nft_id, block_role, ordinal, meta_json) VALUES (?,?,?,?,?,?)`
      ).bind(block_id, world_id, nft.nft_id, role, ordinal, JSON.stringify(body.attributes || {})).run();
      try {
        await db.prepare('UPDATE world_structures SET block_count = COALESCE(block_count,0) + 1 WHERE world_id = ?').bind(world_id).run();
      } catch (_) {}
      return json({ success: true, world_id, block_id, nft, role: 'strata_nft_building_block' });
      } catch (e) {
        return json({ success: false, error: String(e.message || e) }, 500);
      }
    }

    if (path === '/world/structure' || path === '/open-world/structure') {
      if (!db) return json({ world: null, blocks: [] });
      const world_id = url.searchParams.get('world_id') || url.searchParams.get('id');
      if (!world_id) return json({ error: 'world_id required' }, 400);
      const world = await db.prepare('SELECT * FROM world_structures WHERE world_id = ?').bind(world_id).first().catch(() => null);
      const blocks = await db.prepare(
        'SELECT * FROM world_nft_blocks WHERE world_id = ? ORDER BY ordinal, created_at'
      ).bind(world_id).all().catch(() => ({ results: [] }));
      return json({
        success: true,
        world_id,
        structure: world || null,
        blocks: blocks.results || [],
        note: 'Open world is composed of these STRATA NFT blocks',
      });
    }

    // CGU creation as STRATA NFT (users + SCAs)
    if ((path === '/cgu/mint' || path === '/ugc/mint' || path === '/sandbox/cgu') && request.method === 'POST') {
      if (!db) return json({ error: 'ledger unavailable' }, 503);
      try {
      const body = await request.json().catch(() => ({}));
      const author_id = body.author_id || body.owner || body.account || body.sca_id || 'anonymous';
      const author_kind = body.author_kind || (body.sca_id ? 'sca' : body.user_id ? 'user' : 'user');
      const sandbox_id = body.sandbox_id || null;
      const world_id = body.world_id || body.parent_world_id || null;
      const title = body.title || body.name || 'CGU';
      const nft = await mintStrataNft(db, env, {
        owner: author_id, name: title, description: body.description || '',
        role: 'cgu', kind: 'cgu', world_id, sandbox_id,
        attributes: body.attributes || {},
        authors: [{ kind: author_kind, id: author_id }],
      });
      const cgu_id = 'cgu_' + crypto.randomUUID().slice(0, 12);
      await db.prepare(
        `INSERT INTO cgu_records (cgu_id, nft_id, sandbox_id, world_id, author_kind, author_id, title, status)
         VALUES (?,?,?,?,?,?,?,?)`
      ).bind(cgu_id, nft.nft_id, sandbox_id, world_id, author_kind, author_id, title, body.status || 'draft').run();
      return json({
        success: true,
        cgu_id,
        nft,
        author_kind,
        author_id,
        note: 'CGU is a STRATA NFT; authors may be users or SCAs',
      });
      } catch (e) {
        return json({ success: false, error: String(e.message || e) }, 500);
      }
    }

    // Fungible sub-token inside an open world, collateralised by base STRATA
    if ((path === '/world-token' || path === '/world/token' || path === '/sub-token') && request.method === 'POST') {
      if (!db) return json({ error: 'ledger unavailable' }, 503);
      const body = await request.json().catch(() => ({}));
      const world_id = body.world_id;
      const issuer = body.issuer || body.owner || body.account;
      const symbol = String(body.symbol || body.ticker || '').toUpperCase().slice(0, 16);
      const name = body.name || symbol;
      const supply = Number(body.supply || 0);
      const lock_strata = Number(body.lock_strata != null ? body.lock_strata : Math.max(1, Math.ceil(supply / 100)));
      if (!world_id || !issuer || !symbol || supply <= 0) {
        return json({ error: 'world_id, issuer, symbol, supply > 0 required' }, 400);
      }
      const vault = `world:${world_id}:token:${symbol}`;
      const lock = await lockStrataCollateral(db, issuer, lock_strata, vault);
      if (!lock.ok) {
        return json({
          success: false,
          error: 'insufficient_STRATA_collateral',
          required_lock: lock_strata,
          balance: lock.balance,
          rule: 'World fungible sub-tokens must be lastrados (collateralised) in base STRATA',
        }, 402);
      }
      await db.prepare(
        `INSERT INTO world_fungible_tokens (symbol, world_id, name, issuer, supply, lock_strata, collateral_account, dag_vertex)
         VALUES (?,?,?,?,?,?,?,?)
         ON CONFLICT(symbol) DO UPDATE SET supply = excluded.supply, lock_strata = world_fungible_tokens.lock_strata + excluded.lock_strata`
      ).bind(symbol, world_id, name, issuer, supply, lock_strata, vault, null).run();
      await db.prepare(
        `INSERT INTO world_token_balances (account, symbol, balance) VALUES (?,?,?)
         ON CONFLICT(account, symbol) DO UPDATE SET balance = balance + excluded.balance`
      ).bind(issuer, symbol, supply).run();
      const dag = await dagSubmit(env, {
        type: 'world_fungible_token', world_id, symbol, supply, lock_strata, issuer,
      }, JSON.stringify({ symbol, world_id, supply, lock_strata }));
      return json({
        success: true,
        symbol, world_id, name, supply,
        collateral: { token: 'STRATA', locked: lock_strata, vault },
        form: 'fungible_sub_token_lastrado_em_STRATA',
        dag_vertex: dag.vertex_id || null,
        note: 'Not base STRATA emission — open-world fungible backed by locked STRATA',
      });
    }

    if (path === '/world-token/balance' || path === '/world/token/balance') {
      const account = url.searchParams.get('account');
      const symbol = url.searchParams.get('symbol');
      if (!account) return json({ error: 'account required' }, 400);
      let q, binds;
      if (symbol) {
        q = 'SELECT * FROM world_token_balances WHERE account = ? AND symbol = ?';
        binds = [account, symbol];
      } else {
        q = 'SELECT * FROM world_token_balances WHERE account = ?';
        binds = [account];
      }
      const rows = await db.prepare(q).bind(...binds).all().catch(() => ({ results: [] }));
      return json({ success: true, account, balances: rows.results || [] });
    }

    if (path === '/world-token/list' || path === '/world/tokens') {
      const world_id = url.searchParams.get('world_id');
      const rows = world_id
        ? await db.prepare('SELECT * FROM world_fungible_tokens WHERE world_id = ?').bind(world_id).all().catch(() => ({ results: [] }))
        : await db.prepare('SELECT * FROM world_fungible_tokens ORDER BY created_at DESC LIMIT 100').all().catch(() => ({ results: [] }));
      return json({ success: true, tokens: rows.results || [], note: 'Fungible sub-tokens lastrados em STRATA within open worlds' });
    }


    return json({
      error: 'not found',
      endpoints: [
        'GET /health',
        'GET /architecture',
        'GET /supply',
        'GET /balance?account=',
        'GET /list?owner=',
        'GET /world/structure?world_id=',
        'GET /world-token/list',
        'GET /tokenisation/kinds',
        'POST /world/compose',
        'POST /world/block',
        'POST /cgu/mint',
        'POST /world-token',
        'POST /mint',
        'POST /import',
        'POST /transfer',
        'POST /lab/grant',
      ],
    }, 404);
  },
};
