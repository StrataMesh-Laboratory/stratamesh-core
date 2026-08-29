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
 *   - Collateral in fungible STRATA is distinct from Agora market value.
 *   - If market < collateral, holder may redeem the composing STRATA (burn NFT, unlock vault).
 *   - Modes: static | dynamic | suspended_static.
 *     Dynamic: ongoing resource burn from collateral into #0.
 *     Collateral depleted → suspended_static until top-up; may resume dynamic.
 *   - Possession of an NFT is measured by fractions of locked STRATA collateral,
 *     independent of market price. Selling a fraction transfers that collateral slice
 *     (and thus that part of the NFT); the sale capitalizes at the agreed market price.
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



/** STRATA monetary poles (TRD layer — protocol addresses on the shared ledger).
 *  #mint — emission source: only creates STRATA; never receives; spendable balance always 0.
 *  #0    — burn sink: only accepts STRATA when resources are consumed; never transfers out.
 *
 * Fog holon (not an entity, no user/SCA account):
 *  NODE_WALLET = FOG-NODE-PT-CM-001 — carteira / tesouraria do Nó.
 *  What the Node produces (PdC) and spends (operation) goes through this wallet.
 *  LEGACY_TREASURY_ALIAS ("treasury") is a historical ledger row for the same Fog treasury —
 *  not a separate entity. Prefer NODE_WALLET.
 *
 * STRATA units themselves may be:
 *  lab_only — laboratory version, not transitável to the published network
 *  poc_contribution — transit-eligible protocol mint via stratamesh-poc
 * The "stub" character is of the lab STRATA units, not of the Fog wallet.
 *
 * User / SCA accounts are a distinct holonic layer (entities with Painel + Bancada).
 * Do not conflate TRD poles, Fog wallet, and user/SCA account wallets.
 */
const STRATA_MINT_SOURCE = '#mint';
const STRATA_BURN_SINK = '#0';
const NODE_WALLET = 'FOG-NODE-PT-CM-001';
const LEGACY_TREASURY_ALIAS = 'treasury';
/**
 * Smart-contract STRATA NFT: static ↔ dynamic operational lifecycle.
 * APS/SPA is one kind of such NFT — not a separate architectural layer.
 * No EVM ontology imported.
 */
const CONTRACT_KINDS = new Set(['smart_contract', 'contract', 'spa', 'aps', 'service_agreement']);

function isSmartContractNft(nft) {
  if (!nft) return false;
  const role = String(nft.role || '').toLowerCase();
  const asset = String(nft.asset_type || '').toLowerCase();
  let kind = '';
  try {
    kind = String(JSON.parse(nft.metadata_json || '{}').kind || '').toLowerCase();
  } catch (_) {}
  return CONTRACT_KINDS.has(role) || CONTRACT_KINDS.has(asset) || CONTRACT_KINDS.has(kind);
}
function isSpaNft(nft) {
  return isSmartContractNft(nft);
}

function isNodeWallet(account) {
  const a = String(account || '');
  return a === NODE_WALLET || a === LEGACY_TREASURY_ALIAS;
}

function resolveWalletAccount(account) {
  const a = String(account || '');
  if (a === LEGACY_TREASURY_ALIAS) return NODE_WALLET;
  return a;
}

async function ensureMonetaryPoles(db) {
  if (!db) return;
  try {
    await db.prepare(
      `INSERT INTO token_balances (account, token_type, balance, total_minted, total_burned)
       VALUES (?, 'STRATA', 0, 0, 0)
       ON CONFLICT(account, token_type) DO NOTHING`
    ).bind(STRATA_MINT_SOURCE).run();
  } catch (_) {
    try {
      await db.prepare(
        `INSERT OR IGNORE INTO token_balances (account, token_type, balance, total_minted, total_burned)
         VALUES (?, 'STRATA', 0, 0, 0)`
      ).bind(STRATA_MINT_SOURCE).run();
    } catch (_) {}
  }
  try {
    await db.prepare(
      `INSERT INTO token_balances (account, token_type, balance, total_minted, total_burned)
       VALUES (?, 'STRATA', 0, 0, 0)
       ON CONFLICT(account, token_type) DO NOTHING`
    ).bind(STRATA_BURN_SINK).run();
  } catch (_) {
    try {
      await db.prepare(
        `INSERT OR IGNORE INTO token_balances (account, token_type, balance, total_minted, total_burned)
         VALUES (?, 'STRATA', 0, 0, 0)`
      ).bind(STRATA_BURN_SINK).run();
    } catch (_) {}
  }
  try {
    await db.prepare(
      `CREATE TABLE IF NOT EXISTS strata_burn_events (
        id TEXT PRIMARY KEY,
        from_account TEXT NOT NULL,
        amount REAL NOT NULL,
        reason TEXT,
        resource_class TEXT,
        meta_json TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )`
    ).run();
  } catch (_) {}
}

function isMintSource(account) {
  return String(account || '') === STRATA_MINT_SOURCE || String(account || '').toLowerCase() === 'strata://mint';
}
function isBurnSink(account) {
  return String(account || '') === STRATA_BURN_SINK || String(account || '') === '0' || String(account || '').toLowerCase() === 'strata://burn';
}

/** Record protocol emission: node receives STRATA; #mint total_minted rises; #mint never holds spendable. */
async function recordMintEmission(db, node_id, amount) {
  if (!db || !(amount > 0) || !node_id) return;
  if (isBurnSink(node_id) || isMintSource(node_id)) return;
  await ensureMonetaryPoles(db);
  await db.prepare(
    `INSERT INTO token_balances (account, token_type, balance, total_minted, total_burned)
     VALUES (?, 'STRATA', 0, ?, 0)
     ON CONFLICT(account, token_type) DO UPDATE SET
       total_minted = COALESCE(token_balances.total_minted,0) + excluded.total_minted,
       balance = 0`
  ).bind(STRATA_MINT_SOURCE, amount).run();
}

/** Burn on resource use: debit payer → credit #0 (sink never transfers out). */
async function burnStrataToSink(db, from_account, amount, reason, meta) {
  const cost = Math.abs(Number(amount) || 0);
  if (!db || cost <= 0 || !from_account) {
    return { ok: false, error: 'invalid_burn' };
  }
  if (isBurnSink(from_account)) {
    return { ok: false, error: 'burn_sink_cannot_spend' };
  }
  if (isMintSource(from_account)) {
    return { ok: false, error: 'mint_source_cannot_spend' };
  }
  await ensureMonetaryPoles(db);
  let bal = 0;
  try {
    const row = await db.prepare(
      "SELECT balance FROM token_balances WHERE account = ? AND token_type IN ('STRATA','strata')"
    ).bind(from_account).first();
    bal = Number(row?.balance || 0);
  } catch (_) {}
  if (bal < cost) {
    return { ok: false, error: 'insufficient_balance', balance: bal, required: cost };
  }
  await db.prepare(
    `UPDATE token_balances SET
       balance = balance - ?,
       total_burned = COALESCE(total_burned,0) + ?
     WHERE account = ? AND token_type IN ('STRATA','strata')`
  ).bind(cost, cost, from_account).run();
  await db.prepare(
    `INSERT INTO token_balances (account, token_type, balance, total_minted, total_burned)
     VALUES (?, 'STRATA', ?, 0, 0)
     ON CONFLICT(account, token_type) DO UPDATE SET
       balance = balance + excluded.balance`
  ).bind(STRATA_BURN_SINK, cost).run();
  const id = 'burn_' + crypto.randomUUID().slice(0, 12);
  try {
    await db.prepare(
      `INSERT INTO strata_burn_events (id, from_account, amount, reason, resource_class, meta_json)
       VALUES (?,?,?,?,?,?)`
    ).bind(
      id, from_account, cost, reason || 'resource_use',
      (meta && meta.resource_class) || null,
      JSON.stringify(meta || {})
    ).run();
  } catch (_) {}
  let sink = 0, payer = 0;
  try {
    sink = Number((await db.prepare("SELECT balance FROM token_balances WHERE account = ? AND token_type IN ('STRATA','strata')").bind(STRATA_BURN_SINK).first())?.balance || 0);
    payer = Number((await db.prepare("SELECT balance FROM token_balances WHERE account = ? AND token_type IN ('STRATA','strata')").bind(from_account).first())?.balance || 0);
  } catch (_) {}
  return {
    ok: true,
    burn_id: id,
    from: from_account,
    to: STRATA_BURN_SINK,
    amount: cost,
    reason: reason || 'resource_use',
    from_balance: payer,
    sink_balance: sink,
    out_of_circulation: true,
  };
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
    `CREATE TABLE IF NOT EXISTS nft_market_quotes (
      nft_id TEXT PRIMARY KEY,
      market_strata REAL NOT NULL,
      source TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS cgu_records (
      cgu_id TEXT PRIMARY KEY, nft_id TEXT NOT NULL, sandbox_id TEXT, world_id TEXT,
      author_kind TEXT, author_id TEXT, title TEXT, status TEXT DEFAULT 'draft',
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS nft_resource_burns (
      id TEXT PRIMARY KEY,
      nft_id TEXT NOT NULL,
      amount REAL NOT NULL,
      mode_after TEXT,
      reason TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS nft_fractions (
      id TEXT PRIMARY KEY,
      nft_id TEXT NOT NULL,
      holder TEXT NOT NULL,
      strata_units REAL NOT NULL,
      share_bps INTEGER,
      acquired_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS nft_fraction_trades (
      id TEXT PRIMARY KEY,
      nft_id TEXT NOT NULL,
      from_holder TEXT NOT NULL,
      to_holder TEXT NOT NULL,
      strata_units REAL NOT NULL,
      price_strata REAL,
      capitalized REAL,
      dag_vertex TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    /* Bundle: first-class structural relation NFT → child NFTs (recursive composition) */
    `CREATE TABLE IF NOT EXISTS nft_bundle_edges (
      id TEXT PRIMARY KEY,
      parent_nft_id TEXT NOT NULL,
      child_nft_id TEXT NOT NULL,
      ordinal INTEGER DEFAULT 0,
      role TEXT,
      actor TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(parent_nft_id, child_nft_id)
    )`,
    /* Majority liquidation: fractional holders vote; aye weight > 50% executes proportional redeem */
    `CREATE TABLE IF NOT EXISTS nft_liquidation_proposals (
      id TEXT PRIMARY KEY,
      nft_id TEXT NOT NULL,
      proposer TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      aye_weight REAL DEFAULT 0,
      nay_weight REAL DEFAULT 0,
      threshold REAL DEFAULT 0.5,
      created_at TEXT DEFAULT (datetime('now')),
      executed_at TEXT,
      meta_json TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS nft_liquidation_votes (
      id TEXT PRIMARY KEY,
      proposal_id TEXT NOT NULL,
      nft_id TEXT NOT NULL,
      holder TEXT NOT NULL,
      strata_units REAL NOT NULL,
      ballot TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(proposal_id, holder)
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
    "ALTER TABLE strata_nfts ADD COLUMN collateral_strata REAL",
    "ALTER TABLE strata_nfts ADD COLUMN collateral_vault TEXT",
    "ALTER TABLE strata_nfts ADD COLUMN status TEXT",
    "ALTER TABLE strata_nfts ADD COLUMN redeemed_at TEXT",
    "ALTER TABLE strata_nfts ADD COLUMN mode TEXT",
    "ALTER TABLE strata_nfts ADD COLUMN burn_rate_per_hour REAL",
    "ALTER TABLE strata_nfts ADD COLUMN last_burn_at TEXT",
    "ALTER TABLE strata_nfts ADD COLUMN total_resource_burned REAL",
    "ALTER TABLE cgu_records ADD COLUMN collateral_strata REAL",
  ]) {
    try { await db.prepare(a).run(); } catch (_) {}
  }
}

async function mintStrataNft(db, env, {
  owner, name, description, role, world_id, sandbox_id, kind, attributes, authors, collateral_strata,
  mode, burn_rate_per_hour,
}) {
  await ensureStrataFunctionalSchema(db);
  const id = 'nft_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  const collateral = Math.max(0, Number(collateral_strata != null ? collateral_strata : 0.01));
  let modeNorm = String(mode || 'static').toLowerCase();
  if (modeNorm !== 'dynamic' && modeNorm !== 'static') modeNorm = 'static';
  if (modeNorm === 'dynamic' && collateral <= 0) modeNorm = 'static';
  // Lab-realistic default: 0.0001 STRATA/hour when dynamic (~0.0024/day)
  const burnRate = modeNorm === 'dynamic'
    ? Math.max(0, Number(burn_rate_per_hour != null ? burn_rate_per_hour : 0.0001))
    : Math.max(0, Number(burn_rate_per_hour != null ? burn_rate_per_hour : 0));
  const vault = 'nft:' + id + ':collateral';
  let lock = { ok: true, locked: 0, vault };
  if (collateral > 0) {
    lock = await lockStrataCollateral(db, owner, collateral, vault);
    if (!lock.ok) {
      const err = new Error('insufficient_STRATA_collateral');
      err.detail = { required: collateral, balance: lock.balance, owner };
      throw err;
    }
  }
  const nowIso = new Date().toISOString();
  const metadata = {
    name, description: description || '',
    foundational_token: 'STRATA',
    form: 'non_fungible',
    role: role || kind || 'building_block',
    kind: kind || role || 'building_block',
    world_id: world_id || null,
    sandbox_id: sandbox_id || null,
    collateral_strata: collateral,
    collateral_vault: vault,
    mode: modeNorm,
    burn_rate_per_hour: burnRate,
    market_distinct_from_collateral: true,
    attributes: attributes || {},
    authors: authors || [],
    cgu_includes_sca: true,
    standard: 'strata-nft-3-static-dynamic',
    node: 'FOG-NODE-PT-CM-001',
    created_at: nowIso,
  };
  const content = JSON.stringify(metadata);
  const cid = await contentCid(content);
  const dag = await dagSubmit(env, {
    type: 'strata_nft',
    id, owner, role: metadata.role, world_id, sandbox_id,
  }, content);
  const metaStr = JSON.stringify(metadata);
  await db.prepare(
    `INSERT INTO strata_nfts (id, owner, name, description, asset_type, metadata_json, content_cid, dag_vertex, role, world_id, sandbox_id, collateral_strata, collateral_vault, status, mode, burn_rate_per_hour, last_burn_at, total_resource_burned)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    id, owner, name, description || '', metadata.role, metaStr, cid,
    dag.vertex_id || null, metadata.role, world_id || null, sandbox_id || null,
    collateral, vault, 'active', modeNorm, burnRate, nowIso, 0,
  ).run();
  // best-effort mirror into legacy nft_assets if compatible
  try {
    await db.prepare(
      `INSERT INTO nft_assets (id, metadata_json) VALUES (?,?)`
    ).bind(id, metaStr).run();
  } catch (_) {}
  // Possession = fractions of locked STRATA collateral (not market price)
  const fracId = 'frac_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  try {
    await db.prepare(
      `INSERT INTO nft_fractions (id, nft_id, holder, strata_units, share_bps, acquired_at, updated_at)
       VALUES (?,?,?,?,?,?,?)`
    ).bind(fracId, id, owner, collateral, collateral > 0 ? 10000 : 0, nowIso, nowIso).run();
  } catch (_) {}
  return {
    nft_id: id, content_cid: cid, dag_vertex: dag.vertex_id || null, metadata, table: 'strata_nfts',
    collateral_strata: collateral, collateral_vault: vault, mode: modeNorm,
    burn_rate_per_hour: burnRate, lock,
    possession: {
      by: 'collateral_fractions',
      holder: owner,
      strata_units: collateral,
      share_bps: collateral > 0 ? 10000 : 0,
      note: 'Posse do NFT = frações de colateral STRATA; independente do valor de mercado',
    },
  };
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

async function unlockStrataCollateral(db, vaultAccount, amount, toAccount) {
  const amt = Number(amount) || 0;
  if (amt <= 0) return { ok: false, error: 'amount' };
  try {
    await db.prepare(
      "UPDATE token_balances SET balance = MAX(0, balance - ?) WHERE account = ? AND token_type = 'STRATA_LOCKED'"
    ).bind(amt, vaultAccount).run();
  } catch (_) {}
  await db.prepare(
    `INSERT INTO token_balances (account, token_type, balance, total_minted, total_burned)
     VALUES (?, 'STRATA', ?, 0, 0)
     ON CONFLICT(account, token_type) DO UPDATE SET balance = balance + excluded.balance`
  ).bind(toAccount, amt).run().catch(async () => {
    await db.prepare(
      "INSERT INTO token_balances (account, token_type, balance) VALUES (?, 'STRATA', ?)"
    ).bind(toAccount, amt).run().catch(() => {});
  });
  return { ok: true, unlocked: amt, to: toAccount };
}


/** True burn: remove STRATA from circulation into pole #0 (never leaves). */
async function burnStrataFromVault(db, vaultAccount, amount) {
  const amt = Number(amount) || 0;
  if (amt <= 0) return { ok: false, burned: 0 };
  try {
    await db.prepare(
      "UPDATE token_balances SET balance = MAX(0, balance - ?) WHERE account = ? AND token_type = 'STRATA_LOCKED'"
    ).bind(amt, vaultAccount).run();
  } catch (_) {}
  // Accumulate at #0 burn pole (accept-only; never transferable out by policy)
  await db.prepare(
    `INSERT INTO token_balances (account, token_type, balance, total_minted, total_burned)
     VALUES ('#0', 'STRATA', 0, 0, ?)
     ON CONFLICT(account, token_type) DO UPDATE SET total_burned = COALESCE(token_balances.total_burned,0) + excluded.total_burned`
  ).bind(amt).run().catch(async () => {
    try {
      await db.prepare(
        "INSERT INTO token_balances (account, token_type, balance, total_burned) VALUES ('#0', 'STRATA', 0, ?)"
      ).bind(amt).run();
    } catch (_) {}
  });
  return { ok: true, burned: amt };
}

/**
 * Optional final close of a smart-contract NFT: unlock residual to holders, status=terminated.
 * Normal operation prefers pause (static) and re-trigger rather than immediate terminate.
 */
async function terminateContract(db, env, nft, reason) {
  if (!nft || nft.status === 'redeemed' || nft.status === 'terminated') {
    return { ok: true, already_done: true, nft };
  }
  const fracs = await ensureOwnerFraction(db, nft).catch(() => []);
  const vault = nft.collateral_vault || ('nft:' + nft.id + ':collateral');
  const residual = Math.max(0, Number(nft.collateral_strata || 0));
  const distributions = [];
  if (residual > 0 && fracs.length) {
    for (const f of fracs) {
      const units = Number(f.strata_units || 0);
      if (units <= 0) continue;
      const slice = Math.min(units, residual);
      const un = await unlockStrataCollateral(db, vault, slice, f.holder);
      distributions.push({ holder: f.holder, strata: slice, unlocked: un.unlocked });
    }
  } else if (residual > 0) {
    const owner = nft.owner || NODE_WALLET;
    const un = await unlockStrataCollateral(db, vault, residual, owner);
    distributions.push({ holder: owner, strata: residual, unlocked: un.unlocked });
  }
  const iso = new Date().toISOString();
  await db
    .prepare(
      "UPDATE strata_nfts SET collateral_strata = 0, mode = 'static', status = 'terminated', redeemed_at = ?, last_burn_at = ? WHERE id = ?"
    )
    .bind(iso, iso, nft.id)
    .run();
  try {
    await db.prepare('DELETE FROM nft_fractions WHERE nft_id = ?').bind(nft.id).run();
  } catch (_) {}
  try {
    await db.prepare('DELETE FROM nft_bundle_edges WHERE parent_nft_id = ? OR child_nft_id = ?').bind(nft.id, nft.id).run();
  } catch (_) {}
  try {
    let meta = {};
    try {
      meta = JSON.parse(nft.metadata_json || '{}');
    } catch (_) {}
    meta.status = 'terminated';
    meta.mode = 'static';
    meta.collateral_strata = 0;
    meta.terminated_at = iso;
    meta.termination_reason = reason || 'contract_closed';
    meta.contract_phase = 'terminated';
    await db.prepare('UPDATE strata_nfts SET metadata_json = ? WHERE id = ?').bind(JSON.stringify(meta), nft.id).run();
  } catch (_) {}
  try {
    await dagSubmit(
      env,
      { type: 'contract_terminated', nft_id: nft.id, reason },
      JSON.stringify({ nft_id: nft.id, reason, distributions })
    );
  } catch (_) {}
  nft.status = 'terminated';
  nft.mode = 'static';
  nft.collateral_strata = 0;
  return {
    ok: true,
    nft_id: nft.id,
    status: 'terminated',
    reason: reason || 'contract_closed',
    distributions,
    note: 'Smart-contract STRATA NFT closed — residual STRATA returned to holders.',
  };
}
const terminateSpa = terminateContract;

/**
 * Dynamic NFT: burn ongoing resource cost from collateral into #0.
 * When collateral is exhausted → suspended_static (may top-up / resume).
 * Smart-contract NFTs use the same static|dynamic modes; pause returns them to static
 * without terminating. Static NFTs do not burn. Lazy-applied on read/tick.
 */
async function applyDynamicResourceBurn(db, nft, opts) {
  if (!nft || nft.status === 'redeemed' || nft.status === 'terminated') return { nft, burned: 0, changed: false };
  const mode = String(nft.mode || 'static').toLowerCase();
  if (mode !== 'dynamic') {
    return { nft, burned: 0, changed: false, mode };
  }
  const rate = Math.max(0, Number(nft.burn_rate_per_hour || 0));
  if (rate <= 0) return { nft, burned: 0, changed: false, mode };
  const now = Date.now();
  const last = nft.last_burn_at ? Date.parse(nft.last_burn_at) : now;
  const elapsedH = Math.max(0, (now - (Number.isFinite(last) ? last : now)) / 3600000);
  const hours = Math.min(elapsedH, Number(opts && opts.max_hours != null ? opts.max_hours : 24));
  let due = rate * hours;
  if (opts && opts.force_amount != null) due = Math.max(0, Number(opts.force_amount));
  const coll = Math.max(0, Number(nft.collateral_strata || 0));
  const burnAmt = Math.min(coll, due);
  if (burnAmt <= 0 && hours > 0) {
    if (coll <= 1e-12) {
      await db
        .prepare("UPDATE strata_nfts SET mode = 'suspended_static', last_burn_at = ?, collateral_strata = 0 WHERE id = ?")
        .bind(new Date(now).toISOString(), nft.id)
        .run()
        .catch(() => {});
      nft.mode = 'suspended_static';
      nft.collateral_strata = 0;
      return { nft, burned: 0, changed: true, mode: 'suspended_static', reason: 'collateral_depleted' };
    }
    return { nft, burned: 0, changed: false, mode };
  }
  if (burnAmt <= 0) return { nft, burned: 0, changed: false, mode };

  const vault = nft.collateral_vault || ('nft:' + nft.id + ':collateral');
  await burnStrataFromVault(db, vault, burnAmt);
  const newColl = Math.max(0, coll - burnAmt);
  const totalBurned = Math.max(0, Number(nft.total_resource_burned || 0)) + burnAmt;
  let newMode = 'dynamic';
  if (newColl <= 1e-12) {
    newMode = 'suspended_static';
  }
  const iso = new Date(now).toISOString();
  await db
    .prepare(
      `UPDATE strata_nfts SET collateral_strata = ?, mode = ?, last_burn_at = ?, total_resource_burned = ? WHERE id = ?`
    )
    .bind(newColl, newMode, iso, totalBurned, nft.id)
    .run();
  try {
    await db
      .prepare(`INSERT INTO nft_resource_burns (id, nft_id, amount, mode_after, reason) VALUES (?,?,?,?,?)`)
      .bind(
        'burn_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12),
        nft.id,
        burnAmt,
        newMode,
        newMode === 'suspended_static' ? 'resource_burn_depleted' : 'resource_burn'
      )
      .run();
  } catch (_) {}
  try {
    let meta = {};
    try {
      meta = JSON.parse(nft.metadata_json || '{}');
    } catch (_) {}
    meta.collateral_strata = newColl;
    meta.mode = newMode;
    meta.total_resource_burned = totalBurned;
    meta.last_burn_at = iso;
    if (isSmartContractNft(nft)) meta.contract_phase = newMode === 'suspended_static' ? 'exhausted' : 'executing';
    await db.prepare('UPDATE strata_nfts SET metadata_json = ? WHERE id = ?').bind(JSON.stringify(meta), nft.id).run();
  } catch (_) {}
  nft.collateral_strata = newColl;
  nft.mode = newMode;
  nft.last_burn_at = iso;
  nft.total_resource_burned = totalBurned;
  return { nft, burned: burnAmt, changed: true, mode: newMode, hours };
}

/**
 * Mint a smart-contract STRATA NFT (static template).
 * kind may be smart_contract | spa | aps | service_agreement — APS is one kind, not a separate layer.
 */
async function mintSmartContract(db, env, body) {
  const owner = body.owner || body.account || body.issuer;
  if (!owner) return { ok: false, error: 'owner required' };
  let coll = Number(body.collateral_strata != null ? body.collateral_strata : body.collateral);
  if (!(coll > 0)) coll = 0.1;
  const kindRaw = String(body.kind || body.type || body.role || 'smart_contract').toLowerCase();
  const kind = CONTRACT_KINDS.has(kindRaw) ? kindRaw : 'smart_contract';
  const role = kind === 'aps' || kind === 'service_agreement' ? 'spa' : kind === 'spa' ? 'spa' : 'smart_contract';
  const template = body.template || body.template_json || body.agreement || {};
  const name = body.name || body.title || (role === 'spa' ? 'APS' : 'Contract');
  const description =
    body.description ||
    (role === 'spa'
      ? 'APS — acordo de serviço como contrato inteligente STRATA NFT (estático ↔ dinâmico).'
      : 'Contrato inteligente STRATA NFT — estático até gatilho; dinâmico em operação; pode pausar de novo a estático.');
  const minted = await mintStrataNft(db, env, {
    owner,
    name,
    description,
    role,
    kind: role === 'spa' ? 'spa' : 'smart_contract',
    world_id: body.world_id || null,
    sandbox_id: body.sandbox_id || null,
    attributes: {
      smart_contract: true,
      spa: role === 'spa',
      aps: role === 'spa',
      kind: role === 'spa' ? 'spa' : 'smart_contract',
      contract_phase: 'static',
      template,
      template_cid: body.template_cid || null,
      competes_with: 'eth_smart_contracts_functionally',
      eth_ontology: false,
      parties: body.parties || template.parties || null,
      terms: body.terms || template.terms || null,
    },
    authors: body.authors || [owner],
    collateral_strata: coll,
    mode: 'static',
    burn_rate_per_hour: body.burn_rate_per_hour != null ? Number(body.burn_rate_per_hour) : 0.0001,
  });
  try {
    await db
      .prepare('UPDATE strata_nfts SET asset_type = ?, role = ? WHERE id = ?')
      .bind(role === 'spa' ? 'spa' : 'smart_contract', role, minted.nft_id)
      .run();
  } catch (_) {}
  return {
    ok: true,
    ...minted,
    kind: role === 'spa' ? 'spa' : 'smart_contract',
    contract_phase: 'static',
    mode: 'static',
    note: 'Smart-contract STRATA NFT minted static. Execute → dynamic; pause → static again until next trigger; collateral exhaustion ends operation.',
  };
}
const mintSpa = (db, env, body) => mintSmartContract(db, env, { ...body, kind: body.kind || 'spa' });

async function executeContract(db, env, { nft_id, actor }) {
  const nft = await db.prepare('SELECT * FROM strata_nfts WHERE id = ?').bind(nft_id).first();
  if (!nft) return { ok: false, error: 'nft_not_found' };
  if (!isSmartContractNft(nft)) return { ok: false, error: 'not_a_smart_contract_nft' };
  if (nft.status === 'terminated' || nft.status === 'redeemed') {
    return { ok: false, error: 'contract_ended', status: nft.status };
  }
  const coll = Number(nft.collateral_strata || 0);
  if (coll <= 1e-12) {
    return { ok: false, error: 'collateral_exhausted', collateral: coll };
  }
  const iso = new Date().toISOString();
  await db
    .prepare("UPDATE strata_nfts SET mode = 'dynamic', last_burn_at = ?, status = 'active' WHERE id = ?")
    .bind(iso, nft_id)
    .run();
  try {
    let meta = {};
    try {
      meta = JSON.parse(nft.metadata_json || '{}');
    } catch (_) {}
    meta.mode = 'dynamic';
    meta.contract_phase = 'executing';
    meta.executed_at = iso;
    meta.executed_by = actor || null;
    await db.prepare('UPDATE strata_nfts SET metadata_json = ? WHERE id = ?').bind(JSON.stringify(meta), nft_id).run();
  } catch (_) {}
  try {
    await dagSubmit(env, { type: 'contract_execute', nft_id }, JSON.stringify({ nft_id, actor, at: iso }));
  } catch (_) {}
  return {
    ok: true,
    nft_id,
    contract_phase: 'executing',
    mode: 'dynamic',
    collateral_strata: coll,
    note: 'Contract NFT now dynamic. Pause returns to static and waits for the next trigger; operation ends when collateral is exhausted.',
  };
}
const executeSpa = executeContract;

/** Pause: dynamic → static, keep collateral, wait for next trigger. */
async function pauseContract(db, env, { nft_id, actor }) {
  const nft = await db.prepare('SELECT * FROM strata_nfts WHERE id = ?').bind(nft_id).first();
  if (!nft) return { ok: false, error: 'nft_not_found' };
  if (!isSmartContractNft(nft)) return { ok: false, error: 'not_a_smart_contract_nft' };
  if (nft.status === 'terminated' || nft.status === 'redeemed') {
    return { ok: false, error: 'contract_ended', status: nft.status };
  }
  const iso = new Date().toISOString();
  await db.prepare("UPDATE strata_nfts SET mode = 'static', last_burn_at = ? WHERE id = ?").bind(iso, nft_id).run();
  try {
    let meta = {};
    try {
      meta = JSON.parse(nft.metadata_json || '{}');
    } catch (_) {}
    meta.mode = 'static';
    meta.contract_phase = 'paused';
    meta.paused_at = iso;
    meta.paused_by = actor || null;
    await db.prepare('UPDATE strata_nfts SET metadata_json = ? WHERE id = ?').bind(JSON.stringify(meta), nft_id).run();
  } catch (_) {}
  try {
    await dagSubmit(env, { type: 'contract_pause', nft_id }, JSON.stringify({ nft_id, actor, at: iso }));
  } catch (_) {}
  return {
    ok: true,
    nft_id,
    contract_phase: 'paused',
    mode: 'static',
    collateral_strata: Number(nft.collateral_strata || 0),
    note: 'Paused to static — waiting for the next execute trigger. Collateral preserved.',
  };
}

async function completeContract(db, env, { nft_id, actor, result, close }) {
  const nft = await db.prepare('SELECT * FROM strata_nfts WHERE id = ?').bind(nft_id).first();
  if (!nft) return { ok: false, error: 'nft_not_found' };
  if (!isSmartContractNft(nft)) return { ok: false, error: 'not_a_smart_contract_nft' };
  if (nft.status === 'terminated' || nft.status === 'redeemed') {
    return { ok: true, already_terminated: true, nft_id, status: nft.status };
  }
  // Default: pause back to static (re-triggerable). Explicit close=true terminates.
  if (!close) {
    const p = await pauseContract(db, env, { nft_id, actor });
    return { ok: true, ...p, completion_result: result || null, closed: false };
  }
  try {
    let meta = {};
    try {
      meta = JSON.parse(nft.metadata_json || '{}');
    } catch (_) {}
    meta.completion_result = result || null;
    meta.completed_by = actor || null;
    await db.prepare('UPDATE strata_nfts SET metadata_json = ? WHERE id = ?').bind(JSON.stringify(meta), nft_id).run();
    nft.metadata_json = JSON.stringify(meta);
  } catch (_) {}
  const term = await terminateContract(db, env, nft, 'execution_complete');
  return { ok: true, ...term, completed_by: actor || null, closed: true };
}
const completeSpa = (db, env, args) => completeContract(db, env, args);


async function listNftFractions(db, nftId) {
  const rows = await db.prepare(
    'SELECT * FROM nft_fractions WHERE nft_id = ? AND strata_units > 1e-15 ORDER BY strata_units DESC'
  ).bind(nftId).all().catch(() => ({ results: [] }));
  const list = rows.results || [];
  const total = list.reduce((a, r) => a + Number(r.strata_units || 0), 0);
  return list.map((r) => ({
    ...r,
    share_pct: total > 0 ? (Number(r.strata_units) / total) * 100 : 0,
    share_bps: total > 0 ? Math.round((Number(r.strata_units) / total) * 10000) : 0,
  }));
}

async function ensureOwnerFraction(db, nft) {
  const fracs = await listNftFractions(db, nft.id);
  if (fracs.length) return fracs;
  const coll = Math.max(0, Number(nft.collateral_strata || 0));
  if (coll <= 0) return [];
  const fracId = 'frac_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  const nowIso = new Date().toISOString();
  try {
    await db.prepare(
      `INSERT INTO nft_fractions (id, nft_id, holder, strata_units, share_bps, acquired_at, updated_at)
       VALUES (?,?,?,?,?,?,?)`
    ).bind(fracId, nft.id, nft.owner, coll, 10000, nowIso, nowIso).run();
  } catch (_) {}
  return listNftFractions(db, nft.id);
}

/**
 * Transfer strata_units of collateral fraction from seller to buyer.
 * Possession of the NFT moves with the fraction, independent of market price.
 * Optional price_strata: buyer pays seller in liquid STRATA (capitalization of the sale).
 */
async function transferNftFraction(db, env, {
  nft_id, from, to, strata_units, price_strata,
}) {
  const units = Number(strata_units);
  if (!nft_id || !from || !to || !(units > 0)) {
    return { ok: false, error: 'nft_id, from, to, strata_units > 0 required' };
  }
  if (from === to) return { ok: false, error: 'same_holder' };
  const nft = await db.prepare('SELECT * FROM strata_nfts WHERE id = ?').bind(nft_id).first();
  if (!nft) return { ok: false, error: 'nft_not_found' };
  if (nft.status === 'redeemed') return { ok: false, error: 'already_redeemed' };

  await ensureOwnerFraction(db, nft);
  const sellerRow = await db.prepare(
    'SELECT * FROM nft_fractions WHERE nft_id = ? AND holder = ?'
  ).bind(nft_id, from).first();
  const have = Number(sellerRow?.strata_units || 0);
  if (have + 1e-15 < units) {
    return { ok: false, error: 'insufficient_fraction', have, required: units };
  }

  const price = price_strata != null ? Number(price_strata) : null;
  if (price != null && price > 0) {
    // Capitalization: buyer pays liquid STRATA to seller for the fraction sold
    const br = await db.prepare(
      "SELECT balance FROM token_balances WHERE account = ? AND token_type IN ('STRATA','strata')"
    ).bind(to).first().catch(() => null);
    const bal = Number(br?.balance || 0);
    if (bal < price) {
      return { ok: false, error: 'insufficient_STRATA_for_purchase', balance: bal, required: price };
    }
    await db.prepare(
      "UPDATE token_balances SET balance = balance - ? WHERE account = ? AND token_type IN ('STRATA','strata')"
    ).bind(price, to).run();
    await db.prepare(
      `INSERT INTO token_balances (account, token_type, balance, total_minted, total_burned)
       VALUES (?, 'STRATA', ?, 0, 0)
       ON CONFLICT(account, token_type) DO UPDATE SET balance = balance + excluded.balance`
    ).bind(from, price).run().catch(async () => {
      await db.prepare(
        "INSERT INTO token_balances (account, token_type, balance) VALUES (?, 'STRATA', ?)"
      ).bind(from, price).run().catch(() => {});
    });
  }

  const newSeller = have - units;
  const nowIso = new Date().toISOString();
  if (newSeller <= 1e-15) {
    await db.prepare('DELETE FROM nft_fractions WHERE nft_id = ? AND holder = ?').bind(nft_id, from).run();
  } else {
    await db.prepare(
      'UPDATE nft_fractions SET strata_units = ?, updated_at = ? WHERE nft_id = ? AND holder = ?'
    ).bind(newSeller, nowIso, nft_id, from).run();
  }

  const buyerRow = await db.prepare(
    'SELECT * FROM nft_fractions WHERE nft_id = ? AND holder = ?'
  ).bind(nft_id, to).first();
  if (buyerRow) {
    await db.prepare(
      'UPDATE nft_fractions SET strata_units = strata_units + ?, updated_at = ? WHERE nft_id = ? AND holder = ?'
    ).bind(units, nowIso, nft_id, to).run();
  } else {
    const fracId = 'frac_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    await db.prepare(
      `INSERT INTO nft_fractions (id, nft_id, holder, strata_units, share_bps, acquired_at, updated_at)
       VALUES (?,?,?,?,0,?,?)`
    ).bind(fracId, nft_id, to, units, nowIso, nowIso).run();
  }

  // Primary owner field = largest fraction holder (possession by collateral share)
  const fracs = await listNftFractions(db, nft_id);
  const primary = fracs[0]?.holder || to;
  try {
    await db.prepare('UPDATE strata_nfts SET owner = ? WHERE id = ?').bind(primary, nft_id).run();
  } catch (_) {}

  let dag = {};
  try {
    dag = await dagSubmit(env, {
      type: 'nft_fraction_transfer', nft_id, from, to, strata_units: units, price_strata: price,
    }, JSON.stringify({ nft_id, from, to, units, price }));
  } catch (_) {}

  const tradeId = 'trd_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  try {
    await db.prepare(
      `INSERT INTO nft_fraction_trades (id, nft_id, from_holder, to_holder, strata_units, price_strata, capitalized, dag_vertex)
       VALUES (?,?,?,?,?,?,?,?)`
    ).bind(tradeId, nft_id, from, to, units, price, price != null && price > 0 ? 1 : 0, dag.vertex_id || null).run();
  } catch (_) {}

  return {
    ok: true,
    trade_id: tradeId,
    nft_id,
    from,
    to,
    strata_units: units,
    price_strata: price,
    capitalized: !!(price != null && price > 0),
    primary_owner: primary,
    fractions: fracs,
    dag_vertex: dag.vertex_id || null,
    rule: 'Posse do NFT = frações de colateral STRATA. Venda de fração transfere a fatia de colateral e capitaliza ao preço de mercado acordado.',
  };
}

/**
 * Proportional redeem of holder's fraction when market < collateral (or market unavailable).
 * Unlocks holder's strata_units from vault back to holder; burns that fraction of the NFT.
 */
async function redeemNftFraction(db, env, { nft_id, holder, strata_units }) {
  const nft = await db.prepare('SELECT * FROM strata_nfts WHERE id = ?').bind(nft_id).first();
  if (!nft) return { ok: false, error: 'nft_not_found' };
  if (nft.status === 'redeemed') return { ok: false, error: 'already_redeemed' };

  const v = await nftValuation(db, nft);
  if (!v.redeemable) {
    return { ok: false, error: 'market_not_below_collateral', valuation: v };
  }

  await ensureOwnerFraction(db, nft);
  const row = await db.prepare(
    'SELECT * FROM nft_fractions WHERE nft_id = ? AND holder = ?'
  ).bind(nft_id, holder).first();
  const have = Number(row?.strata_units || 0);
  const units = strata_units != null ? Number(strata_units) : have;
  if (!(units > 0) || units > have + 1e-15) {
    return { ok: false, error: 'insufficient_fraction', have, required: units };
  }

  const vault = nft.collateral_vault || ('nft:' + nft_id + ':collateral');
  const un = await unlockStrataCollateral(db, vault, units, holder);
  const newColl = Math.max(0, Number(nft.collateral_strata || 0) - units);
  const nowIso = new Date().toISOString();

  if (have - units <= 1e-15) {
    await db.prepare('DELETE FROM nft_fractions WHERE nft_id = ? AND holder = ?').bind(nft_id, holder).run();
  } else {
    await db.prepare(
      'UPDATE nft_fractions SET strata_units = ?, updated_at = ? WHERE nft_id = ? AND holder = ?'
    ).bind(have - units, nowIso, nft_id, holder).run();
  }

  if (newColl <= 1e-15) {
    await db.prepare(
      "UPDATE strata_nfts SET collateral_strata = 0, status = 'redeemed', redeemed_at = ?, mode = 'static' WHERE id = ?"
    ).bind(nowIso, nft_id).run();
  } else {
    await db.prepare(
      'UPDATE strata_nfts SET collateral_strata = ? WHERE id = ?'
    ).bind(newColl, nft_id).run();
  }

  try {
    await dagSubmit(env, { type: 'nft_fraction_redeem', nft_id, holder, units }, JSON.stringify({ nft_id, holder, units }));
  } catch (_) {}

  return {
    ok: true,
    nft_id,
    holder,
    unlocked_strata: un.unlocked,
    remaining_collateral: newColl,
    fully_redeemed: newColl <= 1e-15,
    note: 'Fração resgatada no colateral STRATA (mercado abaixo do piso ou UNAVAILABLE).',
  };
}

/** --- Bundle: recursive NFT → NFT composition (not metadata; each child keeps identity) --- */
async function bundleWouldCycle(db, parentId, childId) {
  if (parentId === childId) return true;
  // Walk ancestors of parent; if child is among them, attaching child under parent cycles
  const seen = new Set();
  let frontier = [parentId];
  while (frontier.length) {
    const cur = frontier.pop();
    if (seen.has(cur)) continue;
    seen.add(cur);
    if (cur === childId) return true;
    const rows = await db
      .prepare('SELECT parent_nft_id FROM nft_bundle_edges WHERE child_nft_id = ?')
      .bind(cur)
      .all()
      .catch(() => ({ results: [] }));
    for (const r of rows.results || []) frontier.push(r.parent_nft_id);
  }
  return false;
}

async function bundleAttach(db, env, { parent_nft_id, child_nft_id, role, actor, ordinal }) {
  await ensureStrataFunctionalSchema(db);
  if (!parent_nft_id || !child_nft_id) return { ok: false, error: 'parent_nft_id and child_nft_id required' };
  if (parent_nft_id === child_nft_id) return { ok: false, error: 'self_bundle_forbidden' };
  const parent = await db.prepare('SELECT * FROM strata_nfts WHERE id = ?').bind(parent_nft_id).first();
  const child = await db.prepare('SELECT * FROM strata_nfts WHERE id = ?').bind(child_nft_id).first();
  if (!parent || !child) return { ok: false, error: 'nft_not_found' };
  if (parent.status === 'redeemed' || child.status === 'redeemed') return { ok: false, error: 'redeemed_nft' };
  if (await bundleWouldCycle(db, parent_nft_id, child_nft_id)) return { ok: false, error: 'cycle_forbidden' };
  const id = 'bnd_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  const ord = ordinal != null ? Number(ordinal) : 0;
  try {
    await db
      .prepare(
        `INSERT INTO nft_bundle_edges (id, parent_nft_id, child_nft_id, ordinal, role, actor, created_at)
         VALUES (?,?,?,?,?,?,datetime('now'))`
      )
      .bind(id, parent_nft_id, child_nft_id, ord, role || null, actor || null)
      .run();
  } catch (e) {
    return { ok: false, error: 'already_in_bundle_or_constraint', detail: String(e.message || e) };
  }
  try {
    await dagSubmit(
      env,
      { type: 'nft_bundle_attach', parent_nft_id, child_nft_id },
      JSON.stringify({ parent_nft_id, child_nft_id, role, actor })
    );
  } catch (_) {}
  return {
    ok: true,
    edge_id: id,
    parent_nft_id,
    child_nft_id,
    role: role || null,
    note: 'Bundle: relação estrutural entre objectos NFT; cada filho mantém identidade, colateral e estado próprios.',
  };
}

async function bundleDetach(db, env, { parent_nft_id, child_nft_id, actor }) {
  await ensureStrataFunctionalSchema(db);
  const r = await db
    .prepare('DELETE FROM nft_bundle_edges WHERE parent_nft_id = ? AND child_nft_id = ?')
    .bind(parent_nft_id, child_nft_id)
    .run()
    .catch(() => null);
  try {
    await dagSubmit(
      env,
      { type: 'nft_bundle_detach', parent_nft_id, child_nft_id },
      JSON.stringify({ parent_nft_id, child_nft_id, actor })
    );
  } catch (_) {}
  return {
    ok: true,
    parent_nft_id,
    child_nft_id,
    removed: r ? true : true,
    note: 'Aresta de bundle removida; objectos permanecem no ledger.',
  };
}

async function bundleChildren(db, parent_nft_id) {
  await ensureStrataFunctionalSchema(db);
  const rows = await db
    .prepare(
      `SELECT e.*, n.name as child_name, n.status as child_status, n.mode as child_mode, n.collateral_strata as child_collateral
       FROM nft_bundle_edges e
       LEFT JOIN strata_nfts n ON n.id = e.child_nft_id
       WHERE e.parent_nft_id = ?
       ORDER BY e.ordinal ASC, e.created_at ASC`
    )
    .bind(parent_nft_id)
    .all()
    .catch(() => ({ results: [] }));
  return rows.results || [];
}

async function bundleTree(db, root_id, depth = 0, maxDepth = 8, seen) {
  if (!seen) seen = new Set();
  if (depth > maxDepth || seen.has(root_id)) return { nft_id: root_id, cycle_or_depth: true, children: [] };
  seen.add(root_id);
  const kids = await bundleChildren(db, root_id);
  const children = [];
  for (const k of kids) {
    const sub = await bundleTree(db, k.child_nft_id, depth + 1, maxDepth, seen);
    children.push({
      edge_id: k.id,
      role: k.role,
      ordinal: k.ordinal,
      child_name: k.child_name,
      child_status: k.child_status,
      child_mode: k.child_mode,
      child_collateral: k.child_collateral,
      ...sub,
    });
  }
  return { nft_id: root_id, children };
}

/** --- Majority liquidation: ownership-weighted vote → proportional collateral distribution --- */
async function proposeLiquidation(db, env, { nft_id, proposer }) {
  await ensureStrataFunctionalSchema(db);
  const nft = await db.prepare('SELECT * FROM strata_nfts WHERE id = ?').bind(nft_id).first();
  if (!nft) return { ok: false, error: 'nft_not_found' };
  if (nft.status === 'redeemed') return { ok: false, error: 'already_redeemed' };
  const fracs = await ensureOwnerFraction(db, nft);
  const propFrac = fracs.find((f) => f.holder === proposer);
  if (!propFrac || Number(propFrac.strata_units || 0) <= 0) {
    return { ok: false, error: 'proposer_not_holder' };
  }
  const open = await db
    .prepare("SELECT id FROM nft_liquidation_proposals WHERE nft_id = ? AND status = 'open'")
    .bind(nft_id)
    .first()
    .catch(() => null);
  if (open) return { ok: false, error: 'proposal_already_open', proposal_id: open.id };
  const id = 'liq_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  await db
    .prepare(
      `INSERT INTO nft_liquidation_proposals (id, nft_id, proposer, status, aye_weight, nay_weight, threshold, created_at)
       VALUES (?,?,?,'open',0,0,0.5,datetime('now'))`
    )
    .bind(id, nft_id, proposer)
    .run();
  // Proposer auto-votes aye with their weight
  const vote = await voteLiquidation(db, env, { proposal_id: id, holder: proposer, ballot: 'aye' });
  return {
    ok: true,
    proposal_id: id,
    nft_id,
    proposer,
    auto_vote: vote,
    rule: 'Maioria simples das participações (peso = strata_units / collateral_total). Aye > 50% executa liquidação e distribui colateral proporcionalmente.',
  };
}

async function voteLiquidation(db, env, { proposal_id, holder, ballot }) {
  await ensureStrataFunctionalSchema(db);
  const prop = await db.prepare('SELECT * FROM nft_liquidation_proposals WHERE id = ?').bind(proposal_id).first();
  if (!prop) return { ok: false, error: 'proposal_not_found' };
  if (prop.status !== 'open') return { ok: false, error: 'proposal_not_open', status: prop.status };
  const nft = await db.prepare('SELECT * FROM strata_nfts WHERE id = ?').bind(prop.nft_id).first();
  if (!nft || nft.status === 'redeemed') return { ok: false, error: 'nft_unavailable' };
  const fracs = await ensureOwnerFraction(db, nft);
  const row = fracs.find((f) => f.holder === holder);
  const units = Number(row?.strata_units || 0);
  if (!(units > 0)) return { ok: false, error: 'not_a_holder' };
  const b = String(ballot || '').toLowerCase();
  if (b !== 'aye' && b !== 'nay') return { ok: false, error: 'ballot_must_be_aye_or_nay' };
  const total = fracs.reduce((s, f) => s + Number(f.strata_units || 0), 0) || Number(nft.collateral_strata || 0) || 1;
  const vid = 'lqv_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  try {
    await db
      .prepare(
        `INSERT INTO nft_liquidation_votes (id, proposal_id, nft_id, holder, strata_units, ballot, created_at)
         VALUES (?,?,?,?,?,?,datetime('now'))`
      )
      .bind(vid, proposal_id, prop.nft_id, holder, units, b)
      .run();
  } catch (_) {
    await db
      .prepare(
        `UPDATE nft_liquidation_votes SET ballot = ?, strata_units = ?, created_at = datetime('now')
         WHERE proposal_id = ? AND holder = ?`
      )
      .bind(b, units, proposal_id, holder)
      .run();
  }
  const votes = (
    await db.prepare('SELECT * FROM nft_liquidation_votes WHERE proposal_id = ?').bind(proposal_id).all()
  ).results || [];
  let aye = 0,
    nay = 0;
  for (const v of votes) {
    if (v.ballot === 'aye') aye += Number(v.strata_units || 0);
    else nay += Number(v.strata_units || 0);
  }
  const aye_w = aye / total;
  const nay_w = nay / total;
  await db
    .prepare('UPDATE nft_liquidation_proposals SET aye_weight = ?, nay_weight = ? WHERE id = ?')
    .bind(aye_w, nay_w, proposal_id)
    .run();
  const threshold = Number(prop.threshold != null ? prop.threshold : 0.5);
  if (aye_w > threshold) {
    const exec = await executeLiquidation(db, env, prop);
    return {
      ok: true,
      proposal_id,
      holder,
      ballot: b,
      aye_weight: aye_w,
      nay_weight: nay_w,
      threshold,
      majority_reached: true,
      execution: exec,
    };
  }
  return {
    ok: true,
    proposal_id,
    holder,
    ballot: b,
    aye_weight: aye_w,
    nay_weight: nay_w,
    threshold,
    majority_reached: false,
    note: 'Voto registado. Maioria simples ainda não atingida.',
  };
}

async function executeLiquidation(db, env, prop) {
  const nft_id = prop.nft_id;
  const nft = await db.prepare('SELECT * FROM strata_nfts WHERE id = ?').bind(nft_id).first();
  if (!nft) return { ok: false, error: 'nft_not_found' };
  if (nft.status === 'redeemed') {
    await db
      .prepare("UPDATE nft_liquidation_proposals SET status = 'executed', executed_at = datetime('now') WHERE id = ?")
      .bind(prop.id)
      .run();
    return { ok: true, already_redeemed: true };
  }
  const fracs = await ensureOwnerFraction(db, nft);
  const vault = nft.collateral_vault || ('nft:' + nft_id + ':collateral');
  const distributions = [];
  for (const f of fracs) {
    const units = Number(f.strata_units || 0);
    if (units <= 0) continue;
    const un = await unlockStrataCollateral(db, vault, units, f.holder);
    distributions.push({ holder: f.holder, strata: units, unlocked: un.unlocked });
  }
  const nowIso = new Date().toISOString();
  await db
    .prepare(
      "UPDATE strata_nfts SET collateral_strata = 0, status = 'redeemed', redeemed_at = ?, mode = 'static' WHERE id = ?"
    )
    .bind(nowIso, nft_id)
    .run();
  try {
    await db.prepare('DELETE FROM nft_fractions WHERE nft_id = ?').bind(nft_id).run();
  } catch (_) {}
  // Detach from bundles (object extinguished)
  try {
    await db.prepare('DELETE FROM nft_bundle_edges WHERE parent_nft_id = ? OR child_nft_id = ?').bind(nft_id, nft_id).run();
  } catch (_) {}
  await db
    .prepare("UPDATE nft_liquidation_proposals SET status = 'executed', executed_at = datetime('now') WHERE id = ?")
    .bind(prop.id)
    .run();
  try {
    await dagSubmit(
      env,
      { type: 'nft_majority_liquidation', nft_id, proposal_id: prop.id },
      JSON.stringify({ nft_id, distributions })
    );
  } catch (_) {}
  return {
    ok: true,
    nft_id,
    status: 'redeemed',
    distributions,
    note: 'Liquidação por maioria: objecto extinto; colateral STRATA distribuído proporcionalmente às participações.',
  };
}

function strataNftOntology() {
  return {
    version: '1.0.0-object-economy',
    equation:
      'STRATA NFT = NonFungibleObject + FractionalEconomicOwnership + Collateral + (Optional) StateMachine + Actions + (Optional) Bundle',
    agents: 'User | SCA',
    relation: 'Agent owns/operates NFT — never NFT owns Agent',
    dimensions: {
      identity: 'Individually identifiable; NFT-A ≠ NFT-B even with identical content or collateral',
      content: 'CID-backed; identity and economic position separated from payload',
      ownership: 'ownership_i = collateral_i / collateral_total (fractional; object remains non-fungible)',
      collateral: 'Fungible STRATA locked under the object; floor position, not market price',
      market: 'P_market independent of C_collateral; premium or discount',
      state: 'static | dynamic | suspended_static',
      actions: 'Authorised operations may transition state and burn STRATA from collateral',
      bundle: 'First-class structural edges parent→child; recursive composition; each child keeps own identity/collateral/state',
      liquidation:
        'Simple majority of participation weight (aye > 50%) may extinguish the object and distribute collateral proportionally',
      redeem_individual: 'When P_market < C (or market UNAVAILABLE), a holder may redeem their fraction without majority',
    },
    not: [
      'Not an SCA (agent/subject)',
      'Not fungible STRATA',
      'Not merely a file (content may be external via CID)',
      'Not necessarily static',
      'Not necessarily economically indivisible',
      'Not necessarily an isolated object (may be a bundle)',
    ],
    holonic_separation: {
      trd: 'Poles #mint / #0',
      fog: 'NODE_WALLET treasury — not a user/SCA account',
      accounts: 'User and SCA wallets with Panel + Bancada',
      strata: 'Fungible unit (lab_only vs transitável via PoC)',
      strata_nft: 'Non-fungible object collateralised in STRATA',
    },
  };
}

function nftRenderSvg(nft, valuation) {
  const c = Math.max(0, Number((valuation && valuation.collateral_strata) || nft.collateral_strata || 0));
  const m = valuation && valuation.market_strata != null ? Number(valuation.market_strata) : null;
  const mode = String((valuation && valuation.mode) || nft.mode || 'static').toLowerCase();
  const hue = Math.floor((c * 9973 + (nft.id || '').length * 13) % 360);
  const w = 72 + Math.min(88, Math.log10(1 + c * 1000) * 36);
  const h = 72;
  const redeemable = !!(valuation && valuation.redeemable);
  const stroke = mode === 'dynamic' ? '#34d399' : mode === 'suspended_static' ? '#f59e0b' : (redeemable ? '#f59e0b' : '#a1a1aa');
  const title = String(nft.name || nft.id || 'NFT STRATA').slice(0, 22);
  const modeLabel = mode === 'dynamic' ? 'DINÂMICO' : mode === 'suspended_static' ? 'SUSPENSO→ESTÁTICO' : 'ESTÁTICO';
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 120" width="220" height="120" role="img" aria-label="NFT STRATA">' +
    '<rect width="220" height="120" fill="#0a0a0a"/>' +
    '<rect x="12" y="24" width="' + w.toFixed(1) + '" height="' + h + '" rx="6" fill="hsl(' + hue + ',42%,28%)" stroke="' + stroke + '" stroke-width="2"/>' +
    '<text x="12" y="16" fill="#e4e4e7" font-size="10" font-family="IBM Plex Mono,monospace">' + title.replace(/[<>&]/g, '') + '</text>' +
    '<text x="150" y="16" fill="' + stroke + '" font-size="8" font-family="IBM Plex Mono,monospace">' + modeLabel + '</text>' +
    '<text x="12" y="112" fill="#a1a1aa" font-size="9" font-family="IBM Plex Mono,monospace">colateral ' + c.toFixed(4) + ' · mercado ' + (m == null ? '—' : m.toFixed(4)) + ' · fr ' + String((valuation && valuation.possession && valuation.possession.holders) || 1) + '</text>' +
    '</svg>'
  );
}

async function nftValuation(db, nft) {
  // Lazy resource burn for dynamic NFTs
  try {
    const br = await applyDynamicResourceBurn(db, nft);
    if (br && br.nft) nft = br.nft;
  } catch (_) {}
  const collateral = Number(nft.collateral_strata || 0);
  const mode = String(nft.mode || 'static').toLowerCase();
  let market = null;
  let source = null;
  try {
    const q = await db.prepare('SELECT market_strata, source FROM nft_market_quotes WHERE nft_id = ?').bind(nft.id).first();
    if (q && q.market_strata != null) {
      market = Number(q.market_strata);
      source = q.source || 'quote';
    }
  } catch (_) {}
  const redeemable = nft.status !== 'redeemed' && (market == null || market < collateral);
  let fractions = [];
  try {
    fractions = await ensureOwnerFraction(db, nft);
  } catch (_) {
    try { fractions = await listNftFractions(db, nft.id); } catch (_) {}
  }
  const totalFrac = fractions.reduce((a, f) => a + Number(f.strata_units || 0), 0);
  return {
    nft_id: nft.id,
    collateral_strata: collateral,
    market_strata: market,
    market_source: source,
    mode,
    burn_rate_per_hour: Number(nft.burn_rate_per_hour || 0),
    total_resource_burned: Number(nft.total_resource_burned || 0),
    last_burn_at: nft.last_burn_at || null,
    distinct: true,
    redeemable,
    can_resume_dynamic: mode === 'suspended_static' && collateral > 0,
    possession: {
      by: 'collateral_fractions',
      total_strata_units: totalFrac || collateral,
      holders: fractions.length,
      fractions: fractions.map((f) => ({
        holder: f.holder,
        strata_units: Number(f.strata_units || 0),
        share_pct: Number(f.share_pct || 0),
        share_bps: Number(f.share_bps || 0),
      })),
      note: 'A posse do NFT mede-se pelas frações de colateral STRATA, não pelo preço de mercado.',
    },
    rule: 'Colateral STRATA ≠ valor de mercado. Posse = frações de colateral. Venda de fração capitaliza ao preço acordado e transfere a fatia. Dinâmico queima recursos do colateral → #0. Resgate se mercado < colateral.',
    rule_en: 'STRATA collateral ≠ market value. Possession = collateral fractions. Selling a fraction capitalizes at agreed price and transfers that slice. Dynamic burns resources from collateral → #0. Redeem if market < collateral.',
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let path = url.pathname;
    // normalize prefixes — exact prefix length (no off-by-one)
    // Longer / more specific first; never strip bare "/token" from "/tokenisation…"
    const prefixes = ['/api/v1/token/', '/api/v1/nft/', '/api/v1/token', '/api/v1/nft', '/token/', '/nft/'];
    for (const pfx of prefixes) {
      if (path === pfx || path === pfx.replace(/\/$/, '')) {
        path = '/';
        break;
      }
      if (path.startsWith(pfx)) {
        let rest = path.slice(pfx.length);
        if (!rest.startsWith('/')) rest = '/' + rest;
        path = rest || '/';
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
                            {
                id: 'smart_contract',
                aliases: ['contract'],
                note: 'Contrato inteligente STRATA NFT: estático ↔ dinâmico. Mint estático; execute → dinâmico; pause → estático de novo até novo gatilho; operação até o colateral esgotar. Alternativa funcional a smart contracts ETH sem ontologia EVM.',
                lifecycle: 'static → execute(dynamic) → pause(static) → … until collateral exhausted',
                endpoints: {
                  mint: 'POST /contract/mint',
                  execute: 'POST /contract/execute',
                  pause: 'POST /contract/pause',
                  complete: 'POST /contract/complete',
                  list: 'GET /contract/list',
                },
              },
              {
                id: 'spa',
                aliases: ['aps', 'service_agreement'],
                note: 'APS/SPA — um kind de contrato inteligente STRATA NFT (acordo de serviço), não uma camada separada. Mesmo ciclo static|dynamic.',
                parent_kind: 'smart_contract',
                endpoints: {
                  mint: 'POST /spa/mint',
                  execute: 'POST /spa/execute',
                  pause: 'POST /spa/pause',
                  complete: 'POST /spa/complete',
                  list: 'GET /spa/list',
                },
              },
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
      holders = 0,
      lab_only_supply = 0,
      transit_eligible_supply = 0,
      fog_wallet_balance = 0;
    if (db) {
      try {
        const r = await db
          .prepare(
            "SELECT COALESCE(SUM(balance),0) as s, COUNT(*) as c FROM token_balances WHERE token_type IN ('STRATA','strata') AND account NOT IN (?, ?)"
          )
          .bind(STRATA_MINT_SOURCE, STRATA_BURN_SINK)
          .first();
        supply = Number(r?.s ?? 0);
        holders = Number(r?.c ?? 0);
      } catch (_) {
        try {
          const r = await db
            .prepare(
              "SELECT COALESCE(SUM(balance),0) as s, COUNT(*) as c FROM token_balances WHERE token_type IN ('STRATA','strata')"
            )
            .first();
          supply = Number(r?.s ?? 0);
          holders = Number(r?.c ?? 0);
        } catch (_) {}
      }
      try {
        await ensureLabOrigin(db);
        const labR = await db
          .prepare(
            "SELECT COALESCE(SUM(amount),0) as s FROM strata_origin_ledger WHERE origin IN ('lab_bootstrap','lab_grant')"
          )
          .first();
        const pocR = await db
          .prepare(
            "SELECT COALESCE(SUM(amount),0) as s FROM strata_origin_ledger WHERE origin = 'poc_contribution'"
          )
          .first();
        lab_only_supply = Number(labR?.s || 0);
        transit_eligible_supply = Number(pocR?.s || 0);
      } catch (_) {}
      try {
        const fog = await db
          .prepare(
            "SELECT COALESCE(SUM(balance),0) as s FROM token_balances WHERE token_type IN ('STRATA','strata') AND account IN (?, ?)"
          )
          .bind(NODE_WALLET, LEGACY_TREASURY_ALIAS)
          .first();
        fog_wallet_balance = Number(fog?.s || 0);
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
        version: '3.5.3-pds402-page',
        total_supply: supply,
        holders,
        nft_count: nfts,
        breakdown: {
          lab_only_strata: lab_only_supply,
          transit_eligible_poc: transit_eligible_supply,
          fog_wallet: {
            address: NODE_WALLET,
            role: 'node_treasury',
            balance: fog_wallet_balance,
            note: 'Carteira/tesouraria do Nó Fog — not a user/SCA account. Lab units on this wallet are laboratory version; only PoC units transit to published.',
          },
        },
        engines: [
          'fungible_STRATA',
          'world_sub_tokens_collateralised',
          'strata_nft_world_blocks',
          'strata_nft_cgu',
          'nft_collateral_vs_market',
          'nft_static_dynamic',
          'nft_resource_burn_from_collateral',
          'nft_suspended_static',
          'nft_fractions_possession',
          'nft_fraction_sale_capitalization',
          'nft_redeem_if_market_below_collateral',
          'nft_majority_liquidation',
          'nft_bundle_composition',
          'smart_contract_nft',
          'nft_import',
          'dag_anchor',
        ],
        strata_definition:
          'STRATA NFT = NonFungibleObject + FractionalEconomicOwnership + Collateral + (Optional) StateMachine + Actions + (Optional) Bundle. Agents (User|SCA) own/operate NFTs.',
        emission_policy:
          'STRATA mint only via PoC (stratamesh-poc); acquire via Agora P2P for external value. Lab bootstrap is laboratory-only and does not transit.',
        holonic_note:
          'TRD poles (#mint/#0) ≠ Fog wallet (NODE_WALLET) ≠ user/SCA account wallets. The Node has a treasury wallet without being an account-holding entity.',
        ontology: '/ontology/nft',
        timestamp: new Date().toISOString(),
      });
    }

    if (path === '/supply' || path === '/status') {
      return json({
        success: true,
        total_supply: supply,
        holders,
        status: 'active',
        lab_only_strata: lab_only_supply,
        transit_eligible_poc: transit_eligible_supply,
        fog_wallet: { address: NODE_WALLET, balance: fog_wallet_balance, role: 'node_treasury' },
      });
    }


    
    if ((path === '/lab/grant' || path === '/lab/bootstrap') && request.method === 'POST') {
      if (!db) return json({ error: 'ledger unavailable' }, 503);
      const body = await request.json().catch(() => ({}));
      // Lab STRATA for the Fog sit on NODE_WALLET (tesouraria do Nó). Do not invent a separate "treasury" entity.
      const rawAccount = body.account || body.beneficiary || NODE_WALLET;
      const account = resolveWalletAccount(rawAccount);
      const amount = Number(body.amount);
      if (!account || !(amount > 0)) return json({ error: 'account and amount > 0 required' }, 400);
      const rec = await recordOrigin(db, account, amount, body.origin === 'lab_grant' ? 'lab_grant' : 'lab_bootstrap', {
        note: body.note || 'laboratory initial offer on Fog treasury wallet',
        environment: 'lab',
        wallet_role: isNodeWallet(account) ? 'node_treasury' : 'account_wallet',
      });
      return json({
        success: true,
        ...rec,
        wallet_role: isNodeWallet(account) ? 'node_treasury' : 'account_wallet',
        warning: 'LAB ONLY — these STRATA units are laboratory version; they do not transit to the published network',
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
      const rawAccount = url.searchParams.get('account') || url.searchParams.get('owner');
      if (!rawAccount || !db) {
        return json({
          success: true,
          balance: 0,
          note: 'pass ?account=… ; Fog treasury = FOG-NODE-PT-CM-001; user/SCA accounts are separate',
        });
      }
      const account = resolveWalletAccount(rawAccount);
      try {
        // Fog treasury: merge NODE_WALLET + legacy "treasury" row (same holon, not a second entity)
        let rows;
        if (isNodeWallet(rawAccount)) {
          rows = await db
            .prepare(
              "SELECT token_type, SUM(balance) as balance, SUM(total_minted) as total_minted, SUM(total_burned) as total_burned FROM token_balances WHERE account IN (?, ?) GROUP BY token_type"
            )
            .bind(NODE_WALLET, LEGACY_TREASURY_ALIAS)
            .all();
        } else {
          rows = await db
            .prepare('SELECT token_type, balance, total_minted, total_burned FROM token_balances WHERE account = ?')
            .bind(account)
            .all();
        }
        let origins = [];
        try {
          await ensureLabOrigin(db);
          if (isNodeWallet(rawAccount)) {
            origins = (
              await db
                .prepare(
                  'SELECT origin, SUM(amount) as amount FROM strata_origin_ledger WHERE account IN (?, ?) GROUP BY origin'
                )
                .bind(NODE_WALLET, LEGACY_TREASURY_ALIAS)
                .all()
            ).results || [];
          } else {
            origins =
              (await db.prepare('SELECT origin, SUM(amount) as amount FROM strata_origin_ledger WHERE account = ? GROUP BY origin').bind(account).all())
                .results || [];
          }
        } catch (_) {}
        const lab = origins.filter((o) => o.origin === 'lab_bootstrap' || o.origin === 'lab_grant').reduce((a, o) => a + Number(o.amount || 0), 0);
        const poc = origins.filter((o) => o.origin === 'poc_contribution').reduce((a, o) => a + Number(o.amount || 0), 0);
        const out = {
          success: true,
          account: isNodeWallet(rawAccount) ? NODE_WALLET : account,
          balances: rows.results || [],
          lab_policy: {
            lab_only_balance: lab,
            transit_eligible_poc_balance: poc,
            note: 'Lab STRATA units are laboratory version (not transitável). Only PoC-earned STRATA transit to the published network.',
          },
          origin_breakdown: origins,
        };
        if (isNodeWallet(rawAccount)) {
          out.wallet_role = 'node_treasury';
          out.holon = 'fog';
          out.note =
            'Carteira/tesouraria do Nó Fog. O Nó não é entidade e não tem conta de utilizador/SCA; tem carteira. Linha legada "treasury" no ledger é a mesma tesouraria.';
          if (String(rawAccount) === LEGACY_TREASURY_ALIAS) {
            out.resolved_from_alias = LEGACY_TREASURY_ALIAS;
          }
        } else {
          out.wallet_role = 'account_wallet';
          out.holon = account.startsWith('SCA-') ? 'sca' : 'user';
        }
        return json(out);
      } catch (e) {
        return json({ error: String(e.message || e) }, 500);
      }
    }

    // --- NFT list ---
        if (path === '/list' || path === '/nfts') {
      if (!db) return json({ nfts: [] });
      const owner = url.searchParams.get('owner');
      const world_id = url.searchParams.get('world_id');
      const limitRaw = parseInt(url.searchParams.get('limit') || '20', 10);
      const limit = Math.min(50, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 20));
      const detail = url.searchParams.get('detail') === '1' || url.searchParams.get('render') === '1';
      const cacheKey = new Request(
        'https://stratamesh-token.cache/list?o=' + encodeURIComponent(owner || '') + '&w=' + encodeURIComponent(world_id || '') + '&l=' + limit + '&d=' + (detail ? '1' : '0')
      );
      if (!detail) {
        try {
          const hit = await caches.default.match(cacheKey);
          if (hit) {
            const h = new Headers(hit.headers);
            h.set('X-Token-Cache', 'HIT');
            return new Response(hit.body, { status: hit.status, headers: h });
          }
        } catch (_) {}
      }
      try {
        let rows = { results: [] };
        const slim = 'id, owner, name, role, asset_type, world_id, sandbox_id, created_at';
        try {
          if (owner && world_id) {
            rows = await db.prepare(`SELECT ${slim} FROM strata_nfts WHERE owner = ? AND world_id = ? ORDER BY created_at DESC LIMIT ?`).bind(owner, world_id, limit).all();
          } else if (owner) {
            rows = await db.prepare(`SELECT ${slim} FROM strata_nfts WHERE owner = ? ORDER BY created_at DESC LIMIT ?`).bind(owner, limit).all();
          } else if (world_id) {
            rows = await db.prepare(`SELECT ${slim} FROM strata_nfts WHERE world_id = ? ORDER BY created_at DESC LIMIT ?`).bind(world_id, limit).all();
          } else {
            rows = await db.prepare(`SELECT ${slim} FROM strata_nfts ORDER BY created_at DESC LIMIT ?`).bind(limit).all();
          }
        } catch (_) {
          try {
            if (owner) {
              rows = await db.prepare('SELECT id, owner, name, role, asset_type, created_at FROM nft_assets WHERE owner = ? ORDER BY rowid DESC LIMIT ?').bind(owner, limit).all();
            } else {
              rows = await db.prepare('SELECT id, owner, name, role, asset_type, created_at FROM nft_assets ORDER BY rowid DESC LIMIT ?').bind(limit).all();
            }
          } catch (e2) {
            return json({ success: true, nfts: [], count: 0, limit, error: String(e2.message || e2).slice(0, 80) });
          }
        }
        const out = [];
        for (const n of rows.results || []) {
          if (detail) {
            const v = await nftValuation(db, n);
            out.push({ ...n, valuation: v, render: { svg: nftRenderSvg(n, v) } });
          } else {
            out.push(n);
          }
        }
        const payload = { success: true, nfts: out, count: out.length, limit, source: 'strata_nfts', detail: !!detail };
        const resp = json(payload);
        resp.headers.set('Cache-Control', 'public, max-age=15');
        if (!detail) {
          try { await caches.default.put(cacheKey, resp.clone()); } catch (_) {}
        }
        return resp;
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
          role: 'building blocks of open worlds and CGU sandboxes; external-asset representatives; SPA/APS templates',
          open_world: 'composed of STRATA NFT blocks (POST /world/compose, /world/block)',
          cgu: 'CGU creations (users + SCAs) are STRATA NFTs (POST /cgu/mint)',
          smart_contract:
            'STRATA NFT contratos inteligentes: static ↔ dynamic. APS/SPA é um kind, não uma camada. POST /contract/mint | /execute | /pause | /complete',
          endpoint_kinds: 'GET /tokenisation/kinds',
        },
        invariant:
          'World structure and sandbox CGU are not metadata — they are STRATA NFTs. SPA/APS are STRATA NFTs, not a separate virtual-machine ontology. Sub-tokens in worlds are STRATA-collateralised fungibles.',
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
        collateral_strata: body.collateral_strata != null ? body.collateral_strata : 0.01,
        mode: body.mode || 'static',
        burn_rate_per_hour: body.burn_rate_per_hour,
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
        collateral_strata: nft.collateral_strata,
        note: 'CGU is a STRATA NFT; static|dynamic; dynamic burns resource cost from collateral to #0; depleted → suspended_static',
      });
      } catch (e) {
        const msg = String(e.message || e);
        if (msg === 'insufficient_STRATA_collateral') {
          return json({ success: false, error: msg, detail: e.detail || null }, 402);
        }
        return json({ success: false, error: msg }, 500);
      }
    }

    if (path === '/nft/list' || path === '/nfts' || path === '/list-enriched') {
      await ensureStrataFunctionalSchema(db);
      const sandbox_id = url.searchParams.get('sandbox_id');
      const owner = url.searchParams.get('owner');
      let rows;
      if (sandbox_id) {
        rows = await db.prepare("SELECT * FROM strata_nfts WHERE sandbox_id = ? ORDER BY created_at DESC LIMIT 80").bind(sandbox_id).all().catch(() => ({ results: [] }));
      } else if (owner) {
        rows = await db.prepare("SELECT * FROM strata_nfts WHERE owner = ? ORDER BY created_at DESC LIMIT 80").bind(owner).all().catch(() => ({ results: [] }));
      } else {
        rows = await db.prepare("SELECT * FROM strata_nfts ORDER BY created_at DESC LIMIT 80").all().catch(() => ({ results: [] }));
      }
      const list = [];
      for (const n of rows.results || []) {
        const v = await nftValuation(db, n);
        list.push({ ...n, valuation: v, render: { svg: nftRenderSvg(n, v) } });
      }
      return json({ success: true, nfts: list, count: list.length });
    }

    if (path === '/nft/value' || path === '/value' || path === '/nft/valuation' || path === '/valuation') {
      const id = url.searchParams.get('id') || url.searchParams.get('nft_id');
      if (!id) return json({ error: 'id required' }, 400);
      const n = await db.prepare('SELECT * FROM strata_nfts WHERE id = ?').bind(id).first();
      if (!n) return json({ error: 'not_found' }, 404);
      const v = await nftValuation(db, n);
      return json({ success: true, nft: n, valuation: v, render: { svg: nftRenderSvg(n, v) } });
    }

    if ((path === '/nft/quote' || path === '/quote' || path === '/nft/market') && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const id = body.nft_id || body.id;
      const market = Number(body.market_strata);
      if (!id || !Number.isFinite(market) || market < 0) return json({ error: 'nft_id and market_strata >= 0 required' }, 400);
      await ensureStrataFunctionalSchema(db);
      await db.prepare(
        `INSERT INTO nft_market_quotes (nft_id, market_strata, source, updated_at) VALUES (?,?,?, datetime('now'))
         ON CONFLICT(nft_id) DO UPDATE SET market_strata=excluded.market_strata, source=excluded.source, updated_at=datetime('now')`
      ).bind(id, market, body.source || 'agora_manual').run();
      const n = await db.prepare('SELECT * FROM strata_nfts WHERE id = ?').bind(id).first();
      const v = n ? await nftValuation(db, n) : null;
      return json({ success: true, nft_id: id, valuation: v });
    }

    if ((path === '/nft/redeem' || path === '/redeem' || path === '/nft/unwind' || path === '/unwind') && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const id = body.nft_id || body.id;
      if (!id) return json({ error: 'nft_id required' }, 400);
      const holder = body.holder || body.owner || body.account;
      // Fractional redeem when holder specified or strata_units given
      if (holder || body.strata_units != null) {
        const n = await db.prepare('SELECT * FROM strata_nfts WHERE id = ?').bind(id).first();
        if (!n) return json({ error: 'not_found' }, 404);
        const h = holder || n.owner;
        const rr = await redeemNftFraction(db, env, {
          nft_id: id, holder: h, strata_units: body.strata_units,
        });
        if (!rr.ok) return json({ success: false, ...rr }, rr.error === 'market_not_below_collateral' ? 409 : 400);
        return json({ success: true, ...rr });
      }
      const n = await db.prepare('SELECT * FROM strata_nfts WHERE id = ?').bind(id).first();
      if (!n) return json({ error: 'not_found' }, 404);
      if (n.status === 'redeemed') return json({ error: 'already_redeemed' }, 409);
      const v = await nftValuation(db, n);
      if (!v.redeemable) {
        return json({
          success: false,
          error: 'market_not_below_collateral',
          valuation: v,
          rule: 'Resgate só quando o valor de mercado está abaixo do colateral em STRATA fungível.',
        }, 409);
      }
      const coll = Number(n.collateral_strata || 0);
      const owner = body.owner || n.owner;
      const vault = n.collateral_vault || ('nft:' + id + ':collateral');
      const un = coll > 0 ? await unlockStrataCollateral(db, vault, coll, owner) : { ok: true, unlocked: 0 };
      await db.prepare("UPDATE strata_nfts SET status = 'redeemed', redeemed_at = datetime('now'), collateral_strata = 0 WHERE id = ?").bind(id).run();
      try { await db.prepare('DELETE FROM nft_fractions WHERE nft_id = ?').bind(id).run(); } catch (_) {}
      try { await dagSubmit(env, { type: 'strata_nft_redeem', id, owner, collateral: coll }, JSON.stringify({ id, coll })); } catch (_) {}
      return json({
        success: true,
        nft_id: id,
        redeemed: true,
        unlocked_strata: un.unlocked,
        to: owner,
        valuation: v,
        note: 'NFT resgatado por completo; STRATA de colateral regressou ao titular.',
      });
    }

    // List holders / fractions (possession by collateral share)
    if (path === '/nft/holders' || path === '/holders' || path === '/nft/fractions' || path === '/fractions') {
      const id = url.searchParams.get('id') || url.searchParams.get('nft_id');
      if (!id) return json({ error: 'id required' }, 400);
      const n = await db.prepare('SELECT * FROM strata_nfts WHERE id = ?').bind(id).first();
      if (!n) return json({ error: 'not_found' }, 404);
      const fracs = await ensureOwnerFraction(db, n);
      const v = await nftValuation(db, n);
      return json({
        success: true,
        nft_id: id,
        collateral_strata: Number(n.collateral_strata || 0),
        market_strata: v.market_strata,
        possession_by: 'collateral_fractions',
        holders: fracs,
        valuation: v,
        rule: 'Posse = frações de colateral STRATA, independente do valor de mercado.',
      });
    }

    // Sell / transfer fraction — capitalizes at agreed market price; transfers possession slice
    if ((path === '/nft/fraction/transfer' || path === '/nft/sell-fraction' || path === '/fraction/transfer' || path === '/sell-fraction') && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const result = await transferNftFraction(db, env, {
        nft_id: body.nft_id || body.id,
        from: body.from || body.seller || body.owner,
        to: body.to || body.buyer,
        strata_units: body.strata_units || body.units || body.amount,
        price_strata: body.price_strata != null ? body.price_strata : body.price,
      });
      if (!result.ok) {
        const code = result.error === 'insufficient_fraction' || result.error === 'insufficient_STRATA_for_purchase' ? 402 : 400;
        return json({ success: false, ...result }, code);
      }
      return json({
        success: true,
        ...result,
        note: 'Fração vendida: posse (fatia de colateral) transferida; preço em STRATA capitaliza a venda no mercado.',
      });
    }

    // --- Ontology contract (architectural semantics operationalised) ---
    if (path === '/ontology/nft' || path === '/ontology' || path === '/architecture/nft') {
      const o = strataNftOntology();
      o.smart_contract = {
        definition:
          'A smart-contract STRATA NFT is a STRATA NFT with static ↔ dynamic operational lifecycle. APS/SPA is one kind of such NFT.',
        lifecycle: {
          static: 'minted or paused — waiting for the next action trigger',
          execute: 'POST /contract/execute → mode dynamic; burns from collateral while running',
          pause: 'POST /contract/pause → mode static again; collateral preserved; awaits next trigger',
          exhaust: 'when collateral is depleted → suspended_static until top-up or close',
        },
        aps: 'APS/SPA is a service-agreement kind under smart_contract — same static|dynamic categories',
        eth_relation: 'Competes functionally with ETH smart contracts; does not import EVM ontology',
      };
      return json({ success: true, ontology: o });
    }

    // --- SPA/APS: specialised STRATA NFT service-agreement templates ---
    if ((path === '/spa/mint' || path === '/aps/mint' || path === '/spa/create' || path === '/contract/mint' || path === '/smart-contract/mint') && request.method === 'POST') {
      if (!db) return json({ error: 'ledger unavailable' }, 503);
      const body = await request.json().catch(() => ({}));
      const r = await mintSpa(db, env, body);
      return json(r.ok ? { success: true, ...r } : { success: false, ...r }, r.ok ? 200 : 400);
    }
    if ((path === '/spa/execute' || path === '/aps/execute' || path === '/contract/execute' || path === '/smart-contract/execute') && request.method === 'POST') {
      if (!db) return json({ error: 'ledger unavailable' }, 503);
      const body = await request.json().catch(() => ({}));
      const pds =
        request.headers.get('X-StrataMesh-PdS') ||
        request.headers.get('X-PdS') ||
        body.pds_burn ||
        body.pds_proof ||
        body.burn_to === '#0';
      if (!pds) {
        return json({
          success: false,
          error: 'payment_required',
          protocol: 'pds-402',
          burn_to: '#0',
          rail: 'STRATA PdS',
          note: 'Retry after PdS burn to #0. Not a stablecoin rail. Not Cloudflare Monetization Gateway.',
        }, 402);
      }
      const r = await executeSpa(db, env, {
        nft_id: body.nft_id || body.id || body.spa_id,
        actor: body.actor || body.owner || body.account,
      });
      return json(r.ok ? { success: true, ...r } : { success: false, ...r }, r.ok ? 200 : 400);
    }
    if ((path === '/spa/pause' || path === '/aps/pause' || path === '/contract/pause' || path === '/smart-contract/pause') && request.method === 'POST') {
      if (!db) return json({ error: 'ledger unavailable' }, 503);
      const body = await request.json().catch(() => ({}));
      const r = await pauseContract(db, env, {
        nft_id: body.nft_id || body.id || body.spa_id,
        actor: body.actor || body.owner || body.account,
      });
      return json(r.ok ? { success: true, ...r } : { success: false, ...r }, r.ok ? 200 : 400);
    }
    if ((path === '/spa/complete' || path === '/aps/complete' || path === '/spa/terminate' || path === '/contract/complete' || path === '/smart-contract/complete') && request.method === 'POST') {
      if (!db) return json({ error: 'ledger unavailable' }, 503);
      const body = await request.json().catch(() => ({}));
      const r = await completeSpa(db, env, {
        nft_id: body.nft_id || body.id || body.spa_id,
        actor: body.actor || body.owner || body.account,
        result: body.result || body.outcome || null,
        close: body.close === true || body.terminate === true,
      });
      return json(r.ok ? { success: true, ...r } : { success: false, ...r }, r.ok ? 200 : 400);
    }
    if (path === '/spa/list' || path === '/aps/list' || path === '/spa' || path === '/contract/list' || path === '/smart-contract/list' || path === '/contract') {
      if (!db) return json({ spas: [] });
      await ensureStrataFunctionalSchema(db);
      const owner = url.searchParams.get('owner');
      const id = url.searchParams.get('id') || url.searchParams.get('nft_id');
      if (id) {
        const n = await db.prepare('SELECT * FROM strata_nfts WHERE id = ?').bind(id).first();
        if (!n || !isSpaNft(n)) return json({ error: 'not_found' }, 404);
        const v = await nftValuation(db, n);
        return json({ success: true, spa: n, valuation: v, is_spa: true });
      }
      let rows;
      if (owner) {
        rows = await db
          .prepare(
            "SELECT * FROM strata_nfts WHERE (role IN ('spa','aps','smart_contract','contract') OR asset_type IN ('spa','aps','smart_contract','contract')) AND owner = ? ORDER BY created_at DESC LIMIT 50"
          )
          .bind(owner)
          .all()
          .catch(() => ({ results: [] }));
      } else {
        rows = await db
          .prepare(
            "SELECT * FROM strata_nfts WHERE role IN ('spa','aps','smart_contract','contract') OR asset_type IN ('spa','aps','smart_contract','contract') ORDER BY created_at DESC LIMIT 50"
          )
          .all()
          .catch(() => ({ results: [] }));
      }
      return json({
        success: true,
        spas: rows.results || [],
        lifecycle: 'static → execute(dynamic) → pause(static) → … until collateral exhausted',
      });
    }

    // --- Bundle: attach / detach / list / tree ---
    if ((path === '/nft/bundle/attach' || path === '/bundle/attach') && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const r = await bundleAttach(db, env, {
        parent_nft_id: body.parent_nft_id || body.parent || body.bundle,
        child_nft_id: body.child_nft_id || body.child || body.nft_id,
        role: body.role,
        actor: body.actor || body.owner || body.account,
        ordinal: body.ordinal,
      });
      return json(r.ok ? { success: true, ...r } : { success: false, ...r }, r.ok ? 200 : 400);
    }
    if ((path === '/nft/bundle/detach' || path === '/bundle/detach') && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const r = await bundleDetach(db, env, {
        parent_nft_id: body.parent_nft_id || body.parent,
        child_nft_id: body.child_nft_id || body.child || body.nft_id,
        actor: body.actor || body.owner,
      });
      return json({ success: true, ...r });
    }
    if (path === '/nft/bundle' || path === '/bundle' || path === '/nft/bundle/children') {
      const id = url.searchParams.get('id') || url.searchParams.get('nft_id') || url.searchParams.get('parent');
      if (!id) return json({ error: 'id required' }, 400);
      const children = await bundleChildren(db, id);
      return json({
        success: true,
        parent_nft_id: id,
        children,
        note: 'Bundle children are full STRATA NFTs with own identity, collateral and state.',
      });
    }
    if (path === '/nft/bundle/tree' || path === '/bundle/tree') {
      const id = url.searchParams.get('id') || url.searchParams.get('nft_id') || url.searchParams.get('root');
      if (!id) return json({ error: 'id required' }, 400);
      const tree = await bundleTree(db, id);
      return json({ success: true, root: id, tree });
    }

    // --- Majority liquidation ---
    if ((path === '/nft/liquidate/propose' || path === '/liquidate/propose') && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const r = await proposeLiquidation(db, env, {
        nft_id: body.nft_id || body.id,
        proposer: body.proposer || body.holder || body.account || body.owner,
      });
      return json(r.ok ? { success: true, ...r } : { success: false, ...r }, r.ok ? 200 : 400);
    }
    if ((path === '/nft/liquidate/vote' || path === '/liquidate/vote') && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const r = await voteLiquidation(db, env, {
        proposal_id: body.proposal_id || body.id,
        holder: body.holder || body.account || body.owner,
        ballot: body.ballot || body.vote,
      });
      return json(r.ok ? { success: true, ...r } : { success: false, ...r }, r.ok ? 200 : 400);
    }
    if (path === '/nft/liquidate' || path === '/liquidate' || path === '/nft/liquidation') {
      const nftId = url.searchParams.get('nft_id') || url.searchParams.get('id');
      const proposalId = url.searchParams.get('proposal_id');
      await ensureStrataFunctionalSchema(db);
      if (proposalId) {
        const prop = await db.prepare('SELECT * FROM nft_liquidation_proposals WHERE id = ?').bind(proposalId).first();
        if (!prop) return json({ error: 'not_found' }, 404);
        const votes =
          (await db.prepare('SELECT * FROM nft_liquidation_votes WHERE proposal_id = ?').bind(proposalId).all()).results ||
          [];
        return json({ success: true, proposal: prop, votes });
      }
      if (nftId) {
        const props =
          (
            await db
              .prepare('SELECT * FROM nft_liquidation_proposals WHERE nft_id = ? ORDER BY created_at DESC LIMIT 20')
              .bind(nftId)
              .all()
          ).results || [];
        return json({ success: true, nft_id: nftId, proposals: props });
      }
      return json({ error: 'nft_id or proposal_id required' }, 400);
    }

    // Trade history for an NFT
    if (path === '/nft/trades' || path === '/trades') {
      const id = url.searchParams.get('id') || url.searchParams.get('nft_id');
      if (!id) return json({ error: 'id required' }, 400);
      const rows = await db.prepare(
        'SELECT * FROM nft_fraction_trades WHERE nft_id = ? ORDER BY created_at DESC LIMIT 50'
      ).bind(id).all().catch(() => ({ results: [] }));
      return json({ success: true, nft_id: id, trades: rows.results || [] });
    }

    // Top-up collateral; optional resume to dynamic when suspended_static
    if ((path === '/nft/topup' || path === '/topup' || path === '/nft/collateral/topup') && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const id = body.nft_id || body.id;
      const amount = Number(body.amount || body.collateral_strata || 0);
      if (!id || !(amount > 0)) return json({ error: 'nft_id and amount > 0 required' }, 400);
      const n = await db.prepare('SELECT * FROM strata_nfts WHERE id = ?').bind(id).first();
      if (!n) return json({ error: 'not_found' }, 404);
      if (n.status === 'redeemed') return json({ error: 'already_redeemed' }, 409);
      const payer = body.owner || body.account || n.owner;
      const vault = n.collateral_vault || ('nft:' + id + ':collateral');
      const lock = await lockStrataCollateral(db, payer, amount, vault);
      if (!lock.ok) {
        return json({ success: false, error: 'insufficient_STRATA_collateral', required: amount, balance: lock.balance }, 402);
      }
      const newColl = Number(n.collateral_strata || 0) + amount;
      let mode = String(n.mode || 'static').toLowerCase();
      if (body.resume_dynamic || body.mode === 'dynamic') {
        if (newColl > 0) mode = 'dynamic';
      } else if (mode === 'suspended_static' && body.resume_dynamic !== false && newColl > 0) {
        // explicit: only auto-resume if caller asks; default stays suspended_static until mode set
        mode = mode;
      }
      const burnRate = body.burn_rate_per_hour != null ? Number(body.burn_rate_per_hour) : Number(n.burn_rate_per_hour || 0.0001);
      await db.prepare(
        `UPDATE strata_nfts SET collateral_strata = ?, mode = ?, burn_rate_per_hour = COALESCE(?, burn_rate_per_hour), last_burn_at = datetime('now') WHERE id = ?`
      ).bind(newColl, mode, mode === 'dynamic' ? burnRate : n.burn_rate_per_hour, id).run();
      // Top-up increases payer's possession fraction
      try {
        await ensureOwnerFraction(db, { ...n, collateral_strata: newColl });
        const existing = await db.prepare(
          'SELECT * FROM nft_fractions WHERE nft_id = ? AND holder = ?'
        ).bind(id, payer).first();
        const nowIso = new Date().toISOString();
        if (existing) {
          await db.prepare(
            'UPDATE nft_fractions SET strata_units = strata_units + ?, updated_at = ? WHERE nft_id = ? AND holder = ?'
          ).bind(amount, nowIso, id, payer).run();
        } else {
          const fracId = 'frac_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
          await db.prepare(
            `INSERT INTO nft_fractions (id, nft_id, holder, strata_units, share_bps, acquired_at, updated_at)
             VALUES (?,?,?,?,0,?,?)`
          ).bind(fracId, id, payer, amount, nowIso, nowIso).run();
        }
      } catch (_) {}
      const refreshed = await db.prepare('SELECT * FROM strata_nfts WHERE id = ?').bind(id).first();
      const v = await nftValuation(db, refreshed);
      return json({
        success: true,
        nft_id: id,
        collateral_strata: newColl,
        mode,
        valuation: v,
        note: 'Colateral reforçado e fração de posse do pagador aumentada. resume_dynamic:true reactiva dinâmico.',
      });
    }

    // Set mode: static | dynamic (suspended_static is automatic on depletion)
    if ((path === '/nft/mode' || path === '/mode') && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const id = body.nft_id || body.id;
      let mode = String(body.mode || '').toLowerCase();
      if (!id || !['static', 'dynamic'].includes(mode)) {
        return json({ error: 'nft_id and mode static|dynamic required' }, 400);
      }
      const n = await db.prepare('SELECT * FROM strata_nfts WHERE id = ?').bind(id).first();
      if (!n) return json({ error: 'not_found' }, 404);
      if (n.status === 'redeemed') return json({ error: 'already_redeemed' }, 409);
      const coll = Number(n.collateral_strata || 0);
      if (mode === 'dynamic' && coll <= 0) {
        return json({
          success: false,
          error: 'insufficient_collateral_for_dynamic',
          collateral_strata: coll,
          rule: 'Dinâmico exige colateral > 0 para burn de recursos correntes.',
        }, 402);
      }
      const burnRate = body.burn_rate_per_hour != null
        ? Number(body.burn_rate_per_hour)
        : (mode === 'dynamic' ? Number(n.burn_rate_per_hour || 0.0001) : Number(n.burn_rate_per_hour || 0));
      await db.prepare(
        `UPDATE strata_nfts SET mode = ?, burn_rate_per_hour = ?, last_burn_at = datetime('now') WHERE id = ?`
      ).bind(mode, burnRate, id).run();
      const refreshed = await db.prepare('SELECT * FROM strata_nfts WHERE id = ?').bind(id).first();
      const v = await nftValuation(db, refreshed);
      return json({
        success: true,
        nft_id: id,
        mode,
        burn_rate_per_hour: burnRate,
        collateral_strata: coll,
        valuation: v,
        note: mode === 'dynamic'
          ? 'Dinâmico: recursos correntes são queimados do colateral para #0 à taxa burn_rate_per_hour.'
          : 'Estático: sem burn de recursos; colateral permanece até resgate ou conversão a dinâmico.',
      });
    }

    // Force resource tick / burn for dynamic NFTs
    if ((path === '/nft/tick' || path === '/tick' || path === '/nft/burn-resources') && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const id = body.nft_id || body.id;
      if (id) {
        const n = await db.prepare('SELECT * FROM strata_nfts WHERE id = ?').bind(id).first();
        if (!n) return json({ error: 'not_found' }, 404);
        const br = await applyDynamicResourceBurn(db, n, {
          force_amount: body.amount != null ? Number(body.amount) : undefined,
          max_hours: body.max_hours != null ? Number(body.max_hours) : 24,
        });
        const v = await nftValuation(db, br.nft);
        return json({
          success: true,
          nft_id: id,
          burned: br.burned,
          mode: br.mode,
          valuation: v,
          note: br.mode === 'suspended_static'
            ? 'Colateral esgotado — NFT suspenso em estático até top-up + resume dynamic.'
            : 'Burn de recursos aplicado sobre o colateral.',
        });
      }
      // Batch: all dynamic NFTs
      const rows = await db.prepare("SELECT * FROM strata_nfts WHERE mode = 'dynamic' AND status != 'redeemed' LIMIT 100").all().catch(() => ({ results: [] }));
      const results = [];
      for (const n of rows.results || []) {
        const br = await applyDynamicResourceBurn(db, n, { max_hours: body.max_hours != null ? Number(body.max_hours) : 24 });
        results.push({ nft_id: n.id, burned: br.burned, mode: br.mode });
      }
      return json({ success: true, ticks: results, count: results.length });
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



    // --- STRATA monetary system: TRD poles + Fog treasury + account wallets ---
    if (path === '/monetary' || path === '/monetary-system') {
      await ensureMonetaryPoles(db);
      let mint = null,
        sink = null,
        circulating = 0,
        total_minted = 0,
        fogBal = 0,
        labSum = 0,
        pocSum = 0;
      try {
        mint = await db
          .prepare("SELECT * FROM token_balances WHERE account = ? AND token_type IN ('STRATA','strata')")
          .bind(STRATA_MINT_SOURCE)
          .first();
        sink = await db
          .prepare("SELECT * FROM token_balances WHERE account = ? AND token_type IN ('STRATA','strata')")
          .bind(STRATA_BURN_SINK)
          .first();
        const circ = await db
          .prepare(
            "SELECT COALESCE(SUM(balance),0) as s FROM token_balances WHERE token_type IN ('STRATA','strata') AND account NOT IN (?, ?)"
          )
          .bind(STRATA_MINT_SOURCE, STRATA_BURN_SINK)
          .first();
        circulating = Number(circ?.s || 0);
        total_minted = Number(mint?.total_minted || 0);
        const fog = await db
          .prepare(
            "SELECT COALESCE(SUM(balance),0) as s FROM token_balances WHERE token_type IN ('STRATA','strata') AND account IN (?, ?)"
          )
          .bind(NODE_WALLET, LEGACY_TREASURY_ALIAS)
          .first();
        fogBal = Number(fog?.s || 0);
        await ensureLabOrigin(db);
        labSum = Number(
          (await db.prepare("SELECT COALESCE(SUM(amount),0) as s FROM strata_origin_ledger WHERE origin IN ('lab_bootstrap','lab_grant')").first())?.s || 0
        );
        pocSum = Number(
          (await db.prepare("SELECT COALESCE(SUM(amount),0) as s FROM strata_origin_ledger WHERE origin = 'poc_contribution'").first())?.s || 0
        );
      } catch (_) {}
      return json({
        success: true,
        holonic_layers: {
          trd: 'Poles #mint / #0 — protocol emission and burn on the shared ledger',
          fog: 'NODE_WALLET — carteira/tesouraria do Nó; not an entity account',
          accounts: 'User and SCA wallets — entities with Painel + Bancada, distinct from the Fog wallet',
        },
        poles: {
          mint: {
            address: STRATA_MINT_SOURCE,
            role: 'emission_source_only',
            receives: false,
            transfers_out: false,
            spendable_balance: 0,
            total_emitted: total_minted,
            note: 'TRD pole: creates STRATA via PoC only; never holds spendable balance',
          },
          burn_sink: {
            address: STRATA_BURN_SINK,
            role: 'out_of_circulation_sink',
            receives: true,
            transfers_out: false,
            balance: Number(sink?.balance || 0),
            note: 'TRD pole: resource consumption moves STRATA here; they cannot leave',
          },
        },
        fog_wallet: {
          address: NODE_WALLET,
          role: 'node_treasury',
          balance: fogBal,
          legacy_alias: LEGACY_TREASURY_ALIAS,
          note: 'Tesouraria do Nó = carteira do Fog. Linha legada "treasury" no ledger é a mesma carteira, não uma entidade stub.',
        },
        strata_versions: {
          lab_only: labSum,
          transit_eligible_poc: pocSum,
          note: 'Lab STRATA are laboratory-version units (not transitável). Only PoC-earned units transit to the published network. The stub character is of those lab units, not of the Fog wallet.',
        },
        circulating_supply: circulating,
        circulating_lab_only: labSum,
        circulating_transit_eligible: pocSum,
        out_of_circulation: Number(sink?.balance || 0),
        flow: 'PoC → #mint emits → Fog wallet and/or user/SCA wallets → resource use burns → #0. Lab bootstrap credits the Fog treasury as lab-only units.',
      });
    }

    if ((path === '/burn' || path === '/strata/burn') && request.method === 'POST') {
      if (!db) return json({ error: 'ledger unavailable' }, 503);
      const body = await request.json().catch(() => ({}));
      const account = body.account || body.from || body.owner;
      const amount = Number(body.amount);
      const reason = body.reason || body.purpose || 'resource_use';
      const r = await burnStrataToSink(db, account, amount, reason, {
        resource_class: body.resource_class,
        beneficiary_kind: body.beneficiary_kind,
        ref: body.ref,
      });
      return json(r, r.ok ? 200 : (r.error === 'insufficient_balance' ? 402 : 400));
    }

    // Fungible transfer with monetary poles enforced
    if ((path === '/transfer-fungible' || path === '/strata/transfer') && request.method === 'POST') {
      if (!db) return json({ error: 'ledger unavailable' }, 503);
      const body = await request.json().catch(() => ({}));
      const from = body.from || body.account;
      const to = body.to || body.recipient;
      const amount = Number(body.amount);
      if (!from || !to || !(amount > 0)) return json({ error: 'from, to, amount > 0 required' }, 400);
      if (isBurnSink(from)) return json({ error: 'burn_sink_cannot_transfer_out', address: STRATA_BURN_SINK }, 403);
      if (isMintSource(from)) return json({ error: 'mint_source_cannot_transfer', address: STRATA_MINT_SOURCE }, 403);
      if (isMintSource(to)) return json({ error: 'mint_source_cannot_receive', address: STRATA_MINT_SOURCE }, 403);
      if (isBurnSink(to)) {
        // intentional burn via transfer to #0
        const r = await burnStrataToSink(db, from, amount, body.reason || 'transfer_to_sink', body);
        return json(r, r.ok ? 200 : 400);
      }
      await ensureMonetaryPoles(db);
      const row = await db.prepare("SELECT balance FROM token_balances WHERE account = ? AND token_type IN ('STRATA','strata')").bind(from).first();
      if (Number(row?.balance || 0) < amount) return json({ error: 'insufficient_balance' }, 402);
      await db.prepare("UPDATE token_balances SET balance = balance - ? WHERE account = ? AND token_type IN ('STRATA','strata')").bind(amount, from).run();
      await db.prepare(
        `INSERT INTO token_balances (account, token_type, balance, total_minted, total_burned) VALUES (?, 'STRATA', ?, 0, 0)
         ON CONFLICT(account, token_type) DO UPDATE SET balance = balance + excluded.balance`
      ).bind(to, amount).run();
      return json({ success: true, from, to, amount });
    }


    return json({
      error: 'not found',
      endpoints: [
        'GET /health',
        'GET /ontology/nft',
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
        'GET /monetary',
        'POST /burn',
        'POST /transfer-fungible',
        'POST /nft/bundle/attach',
        'POST /nft/bundle/detach',
        'GET /nft/bundle?id=',
        'GET /nft/bundle/tree?id=',
        'POST /nft/liquidate/propose',
        'POST /nft/liquidate/vote',
        'GET /nft/liquidate?nft_id=',
        'POST /nft/redeem',
        'POST /nft/sell-fraction',
      ],
    }, 404);
  },
};
