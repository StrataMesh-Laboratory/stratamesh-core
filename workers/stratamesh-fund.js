/**
 * stratamesh-fund — fund.calhegasmorais.pt
 * v0.4.6 — grantor exec summaries + challenge ranking. GitHub Sponsors + per-recipient; pooled fund later.
 *
 * GitHub = evidence · Fund = stats + payout routing
 * No STRATA / no GDA in V0 · no AI impact scores
 */
const VERSION = "0.4.6-grantor-brief";
const ORG = "StrataMesh-Laboratory";
const REPOS = [
  { owner: ORG, name: "stratamesh-core", role: "Protocol core" },
  { owner: ORG, name: "stratamesh-laboratory", role: "Lab charter & posture" },
  { owner: ORG, name: "calhegas-morais-node", role: "Reference Fog Node registry" },
  { owner: ORG, name: "stratamesh-impact-fund", role: "This fund application" },
];

const OPERATOR = {
  github_login: "amcmorais",
  github_user_id: 121771985,
  display_name: "André M. Calhegas Morais",
  method: "eni_pagamentos",
  status: "active",
  widget_url: "https://calhegasmorais.pt/pagamentos",
  widget_note:
    "AMCM ENI payment portal — unique bank-transfer instruction (IBAN not published). Purpose: donation to the Calhegas Morais Node / StrataMesh project.",
  payment_intent_purpose: "donation",
  contact: "geral@eni.calhegasmorais.pt",
};


const SPONSORS_LOGIN = "amcmorais";
const SPONSORS_URL = "https://github.com/sponsors/amcmorais";
const SPONSORS_BUTTON = "https://github.com/sponsors/amcmorais/button";
const SPONSORS_CARD = "https://github.com/sponsors/amcmorais/card";
const SPONSORS_SETUP = "https://github.com/sponsors/accounts";
const SPONSORS_ORG = "StrataMesh-Laboratory";
const SPONSORS_ORG_URL = "https://github.com/sponsors/StrataMesh-Laboratory";
const CHALLENGE_REPOS = [
  { owner: ORG, name: "stratamesh-impact-fund" },
  { owner: ORG, name: "stratamesh-core" },
];
const CHALLENGE_LABEL = "impact-challenge";
const FUND_REPO = "stratamesh-impact-fund";
const POSTED_CHALLENGE_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const RANKING_NOTE = "No grantee deliveries until /accept + evidence PR.";
const SUMMARY_CACHE_MS = 30 * 60 * 1000;
const RANKING_CACHE_MS = 10 * 60 * 1000;

const PREPAID = [
  {
    id: "manual_grantor_card",
    name: "Grantor-selected prepaid",
    kind: "prepaid_card",
    status: "operational_process",
    description:
      "Grantor buys a prepaid product and ships to the contributor’s confirmed public-domain email (registered at claim).",
  },
  {
    id: "wise_receive",
    name: "Wise receive path",
    kind: "registered_account",
    status: "operational_process",
    description: "Contributor registers a Wise receive identifier after claim; Fund stores opaque id only.",
  },
];

const METHODOLOGY = {
  version: "0.1",
  title: "Descriptive GitHub contribution statistics (not scientific impact)",
  currency: "EUR",
  metrics: {
    commits: 1.0,
    repos_touched: 0.5,
  },
  notes: "V0 uses public GitHub contributor totals as evidence. Human grantor decides allocation. No AI scoring.",
  requires_human_approval: true,
};

const SECURITY = {
  "Content-Security-Policy":
    "default-src 'self'; img-src 'self' data: https://avatars.githubusercontent.com https://github.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com data:; script-src 'self' 'unsafe-inline'; connect-src 'self' https://api.github.com; frame-src https://github.com; frame-ancestors 'none'",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": status === 200 ? "public, max-age=30" : "no-store",
      ...SECURITY,
    },
  });
}

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=30",
      ...SECURITY,
    },
  });
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function css() {
  return `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500&family=IBM+Plex+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&display=swap');
:root{--bg:#0a0a0b;--fg:#e8e6e3;--muted:#8a8780;--line:#1c1c1f;--line2:#2a2a2e;--accent:#c4b5a0;--card:#111113;--ok:#6b8f71;--warn:#c4a35a}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font-family:'IBM Plex Sans',system-ui,sans-serif;font-weight:300;line-height:1.55;min-height:100vh}
a{color:var(--accent);text-decoration:none}a:hover{color:var(--fg)}
.wrap{max-width:880px;margin:0 auto;padding:0 1.25rem 3.5rem}
.top{position:sticky;top:0;z-index:20;background:rgba(10,10,11,.92);backdrop-filter:blur(10px);border-bottom:1px solid var(--line);margin:0 -1.25rem 1.75rem;padding:0 1.25rem}
.top-inner{display:flex;justify-content:space-between;align-items:center;gap:1rem;min-height:48px;flex-wrap:wrap}
.brand{font-family:'IBM Plex Mono',monospace;font-size:.62rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.brand strong{color:var(--fg);font-weight:500}
.nav{font-family:'IBM Plex Mono',monospace;font-size:.65rem;letter-spacing:.08em;display:flex;flex-wrap:wrap;gap:.15rem .85rem}
.nav a{color:var(--muted)}.nav a:hover,.nav a.active{color:var(--fg)}.nav .sep{opacity:.35}
.kicker{font-family:'IBM Plex Mono',monospace;font-size:.62rem;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);margin:0 0 .65rem}
h1{font-family:'Instrument Serif',Georgia,serif;font-weight:400;font-size:clamp(1.85rem,4.5vw,2.55rem);letter-spacing:-.02em;line-height:1.15;margin:0 0 .55rem}
h2{font-family:'IBM Plex Mono',monospace;font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;font-weight:500;margin:0 0 .75rem;padding-bottom:.45rem;border-bottom:1px solid var(--line)}
.lead{font-size:1.02rem;color:var(--muted);max-width:40rem;margin:0 0 1.25rem}
.muted{color:var(--muted)}.mono{font-family:'IBM Plex Mono',monospace;font-size:.78rem}
.actions{display:flex;flex-wrap:wrap;gap:.55rem;margin:1.1rem 0 1.5rem}
.btn{display:inline-block;font-family:'IBM Plex Mono',monospace;font-size:.68rem;letter-spacing:.06em;text-transform:uppercase;padding:.55rem .9rem;border:1px solid var(--line2);border-radius:3px;background:transparent;color:var(--fg);font-weight:500}
.btn:hover{border-color:var(--accent)}.btn.primary{background:var(--card);border-color:var(--accent)}
.section{margin:1.35rem 0}
.card{background:var(--card);border:1px solid var(--line);border-radius:4px;padding:1rem 1.1rem;margin:1rem 0}
.grid{display:grid;gap:.75rem;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));margin:1rem 0 1.35rem}
.stat-box{border:1px solid var(--line);border-radius:4px;padding:.85rem 1rem;background:var(--card)}
.stat{font-family:'IBM Plex Mono',monospace;font-size:1.25rem;font-weight:500}
.stat-label{font-family:'IBM Plex Mono',monospace;font-size:.62rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-top:.25rem}
.pill{display:inline-block;font-family:'IBM Plex Mono',monospace;font-size:.62rem;letter-spacing:.08em;text-transform:uppercase;padding:.25rem .5rem;border:1px solid var(--line2);border-radius:2px;color:var(--muted)}
.pill.ok{border-color:#2a3a2c;color:var(--ok)}.pill.warn{border-color:#3a3420;color:var(--warn)}
table{width:100%;border-collapse:collapse;font-size:.9rem}
th,td{text-align:left;padding:.55rem .4rem;border-bottom:1px solid var(--line);vertical-align:top}
th{font-family:'IBM Plex Mono',monospace;font-size:.62rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:500}
.avatar{width:28px;height:28px;border-radius:50%;vertical-align:middle;margin-right:.45rem;border:1px solid var(--line)}
.note{font-size:.88rem;border-left:2px solid var(--line2);padding:.45rem 0 .45rem .85rem;margin:1rem 0;color:var(--muted)}
.steps{margin:.4rem 0 0;padding-left:1.15rem;color:var(--muted)}.steps li{margin:.35rem 0}
footer{margin-top:2.75rem;padding-top:1.25rem;border-top:1px solid var(--line);font-size:.8rem;color:var(--muted)}
footer .mono{font-size:.65rem;margin-top:.4rem}
.sponsor-panel{margin:1.1rem 0 0;border:1px solid var(--line);border-radius:4px;background:var(--card);overflow:hidden}
.sponsor-panel-inner{padding:1.1rem 1.15rem 1.15rem}
.sponsor-panel .sp-kicker{font-family:'IBM Plex Mono',monospace;font-size:.62rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin:0 0 .45rem}
.sponsor-panel .sp-title{font-family:'Instrument Serif',Georgia,serif;font-size:1.35rem;font-weight:400;letter-spacing:-.01em;margin:0 0 .35rem;color:var(--fg)}
.sponsor-panel .sp-desc{color:var(--muted);font-size:.92rem;margin:0 0 1rem;max-width:36rem}
.sponsor-panel .sp-actions{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center}
.sponsor-panel .sp-btn{display:inline-flex;align-items:center;gap:.4rem;font-family:'IBM Plex Mono',monospace;font-size:.68rem;letter-spacing:.06em;text-transform:uppercase;padding:.6rem 1rem;border:1px solid var(--accent);border-radius:3px;background:var(--accent);color:var(--bg);font-weight:500;text-decoration:none}
.sponsor-panel .sp-btn:hover{filter:brightness(1.08);color:var(--bg)}
.sponsor-panel .sp-btn.ghost{background:transparent;color:var(--fg);border-color:var(--line2)}
.sponsor-panel .sp-btn.ghost:hover{border-color:var(--accent);color:var(--accent)}
.sponsor-panel .sp-meta{margin:.9rem 0 0;padding-top:.75rem;border-top:1px solid var(--line);font-family:'IBM Plex Mono',monospace;font-size:.62rem;letter-spacing:.04em;color:var(--muted);line-height:1.5}
.sponsor-panel .sp-dot{display:inline-block;width:6px;height:6px;border-radius:50%;margin-right:.35rem;vertical-align:middle}
.sponsor-panel .sp-dot.live{background:var(--ok)}
.sponsor-panel .sp-dot.pending{background:var(--warn)}
.sponsor-panel .sp-dot.off{background:var(--line2)}
input,select{width:100%;max-width:28rem;background:var(--card);border:1px solid var(--line2);color:var(--fg);padding:.55rem .7rem;border-radius:3px;font:inherit;margin:.35rem 0 .75rem}
label{font-family:'IBM Plex Mono',monospace;font-size:.65rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);display:block}
.err{color:#c47a6a;font-size:.88rem}.okmsg{color:var(--ok);font-size:.88rem}
`.trim();
}

function shell({ lang, path, title, active, body }) {
  const pt = lang === "pt";
  const enQ = pt ? "" : "?lang=en";
  const homeHref = pt ? "/" : "/en";
  const nav = `
    <nav class="nav" aria-label="primary">
      <a href="${homeHref}" class="${active === "home" ? "active" : ""}">${pt ? "Início" : "Home"}</a>
      <span class="sep">·</span>
      <a href="/contributors${enQ}" class="${active === "contributors" ? "active" : ""}">${pt ? "Contribuidores" : "Contributors"}</a>
      <span class="sep">·</span>
      <a href="/challenges${enQ}" class="${active === "challenges" ? "active" : ""}">${pt ? "Desafios" : "Challenges"}</a>
      <span class="sep">·</span>
      <a href="/claim${enQ}" class="${active === "claim" ? "active" : ""}">${pt ? "Reclamar" : "Claim"}</a>
      <span class="sep">·</span>
      <a href="${pt ? "/en" : "/"}">${pt ? "EN" : "PT"}</a>
      <span class="sep">·</span>
      <a href="https://calhegasmorais.pt/">Nó</a>
      <span class="sep">·</span>
      <a href="https://github.com/StrataMesh-Laboratory/stratamesh-impact-fund">GitHub</a>
    </nav>`;
  return `<!DOCTYPE html>
<html lang="${pt ? "pt-PT" : "en-GB"}">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${esc(title)}</title>
  <meta name="description" content="${pt ? "Fundo StrataMesh — evidência GitHub, GitHub Sponsors e grants por recipiente." : "StrataMesh fund — GitHub evidence, GitHub Sponsors, and per-recipient grants."}"/>
  <link rel="canonical" href="https://fund.calhegasmorais.pt${path.split("?")[0]}"/>
  <style>${css()}</style>
</head>
<body>
  <div class="wrap">
    <header class="top"><div class="top-inner">
      <a class="brand" href="${homeHref}" style="text-decoration:none"><strong>StrataMesh</strong> · Impact Fund</a>
      ${nav}
    </div></header>
    ${body}
    <footer>
      AMCM ENI · <a href="https://github.com/StrataMesh-Laboratory">StrataMesh Laboratory</a> · lab<br/>
      <div class="mono">stratamesh-fund ${VERSION} · GitHub evidence · no STRATA in V0</div>
    </footer>
  </div>
</body>
</html>`;
}

function ghHeaders(env) {
  const h = {
    Accept: "application/vnd.github+json",
    "User-Agent": "stratamesh-impact-fund",
  };
  if (env && env.GITHUB_TOKEN) h.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
  return h;
}

async function kvGet(env, key) {
  if (!env.FUND_KV) return null;
  try {
    const raw = await env.FUND_KV.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

async function kvPut(env, key, value, expirationTtl) {
  if (!env.FUND_KV) return false;
  try {
    const opts = expirationTtl ? { expirationTtl: expirationTtl } : {};
    await env.FUND_KV.put(key, JSON.stringify(value), opts);
    return true;
  } catch (_) {
    return false;
  }
}

async function kvGetFresh(env, key, maxAgeMs) {
  const v = await kvGet(env, key);
  if (!v || !v.cached_at) return null;
  const t = Date.parse(v.cached_at);
  if (!t || Date.now() - t > maxAgeMs) return null;
  return v;
}

async function kvListClaims(env) {
  if (!env.FUND_KV) return [];
  try {
    const list = await env.FUND_KV.list({ prefix: "claim:" });
    const out = [];
    for (const k of list.keys || []) {
      const v = await kvGet(env, k.name);
      if (v) out.push(v);
    }
    return out;
  } catch (_) {
    return [];
  }
}


async function ghGraphQL(env, query, variables) {
  const headers = ghHeaders(env);
  headers["Content-Type"] = "application/json";
  try {
    const r = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers,
      body: JSON.stringify({ query, variables: variables || {} }),
    });
    const j = await r.json().catch(() => ({}));
    return { ok: r.ok && !j.errors, json: j, status: r.status };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

async function sponsorsStatus(env) {
  const q = `query($login:String!,$org:String!){
    user(login:$login){
      login
      sponsorsListing { url shortDescription isPublic }
    }
    organization(login:$org){
      login
      sponsorsListing { url shortDescription isPublic }
    }
  }`;
  const res = await ghGraphQL(env, q, { login: SPONSORS_LOGIN, org: SPONSORS_ORG });
  const user = res.ok && res.json && res.json.data ? res.json.data.user : null;
  const org = res.ok && res.json && res.json.data ? res.json.data.organization : null;
  const userListing = user && user.sponsorsListing ? user.sponsorsListing : null;
  const orgListing = org && org.sponsorsListing ? org.sponsorsListing : null;
  // Live to the public only when isPublic; submitted-but-not-approved => pending
  const userLive = !!(userListing && userListing.isPublic);
  const orgLive = !!(orgListing && orgListing.isPublic);
  const orgPending = !!(orgListing && !orgListing.isPublic);
  const userPending = !!(userListing && !userListing.isPublic);
  return {
    user: {
      login: SPONSORS_LOGIN,
      active: userLive,
      pending: userPending,
      url: userListing && userListing.url ? userListing.url : SPONSORS_URL,
      button: SPONSORS_BUTTON,
      card: SPONSORS_CARD,
      isPublic: userListing ? userListing.isPublic : null,
      shortDescription: userListing ? userListing.shortDescription : null,
    },
    organization: {
      login: SPONSORS_ORG,
      active: orgLive,
      pending: orgPending,
      url: orgListing && orgListing.url ? orgListing.url : SPONSORS_ORG_URL,
      setup_url: SPONSORS_SETUP,
      isPublic: orgListing ? orgListing.isPublic : null,
      shortDescription: orgListing ? orgListing.shortDescription : null,
      legal_umbrella:
        "StrataMesh Laboratory exists under AMCM ENI (same payout/tax profile as the operator contributor @amcmorais). Org Sponsors uses the ENI umbrella; awaiting GitHub staff approval to go public.",
      note: orgLive
        ? "Organisation Sponsors is public."
        : orgPending
          ? "Organisation profile submitted — pending GitHub staff approval (not public yet). Same AMCM ENI account data as @amcmorais. Use @amcmorais Sponsors or ENI /pagamentos until live."
          : "Org Sponsors not submitted — enable at github.com/sponsors/accounts.",
    },
    active: userLive || orgLive,
    preferred_url: orgLive ? (orgListing.url || SPONSORS_ORG_URL) : SPONSORS_URL,
    preferred_login: orgLive ? SPONSORS_ORG : SPONSORS_LOGIN,
    note: orgLive && userLive
      ? "Sponsors public for @amcmorais and StrataMesh-Laboratory (AMCM ENI umbrella)."
      : userLive && orgPending
        ? "Sponsors public for @amcmorais. StrataMesh-Laboratory listing submitted — pending GitHub staff approval (isPublic:false). Legal/payout umbrella: AMCM ENI."
        : userLive
          ? "Sponsors public for @amcmorais (AMCM ENI operator). Org listing not public yet."
          : "No public Sponsors listing — use ENI /pagamentos.",
  };
}

function classifyEnvelope({ budget_hint, funded }) {
  const raw = String(budget_hint || "").trim();
  const fundedTrue = funded === true;
  const looksUnfunded =
    !raw ||
    raw === "—" ||
    raw === "-" ||
    /^0(\b|[^\d]|$)/.test(raw) ||
    /no current funding|unfunded|sem financiamento|n[aã]o depositado|not deposited|not treasury/i.test(raw);
  const bareNumber = /^\d+([.,]\d+)?$/.test(raw);
  const out = { funded: false, treasury: false };

  if (fundedTrue && raw && !looksUnfunded) {
    out.funded = true;
    out.budget_hint = raw;
    out.budget_display_pt = raw + " · envelope (não tesouraria)";
    out.budget_display_en = raw + " · envelope (not treasury)";
    return out;
  }

  if (bareNumber && !fundedTrue) {
    out.budget_hint = "0 — no current funding yet";
    out.budget_display_pt = "0 · sem financiamento";
    out.budget_display_en = "0 · no current funding yet";
    out.withheld_bare_number = true;
    return out;
  }

  if (looksUnfunded) {
    out.budget_hint = "0 — no current funding yet";
    out.budget_display_pt = "0 · sem financiamento";
    out.budget_display_en = "0 · no current funding yet";
    return out;
  }

  out.budget_hint = raw;
  out.budget_display_pt = "proposto · não depositado";
  out.budget_display_en = "proposed · not deposited";
  return out;
}

function parseChallengeBody(body) {
  const text = String(body || "");
  let budget = null;
  let funded = null;
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (/budget envelope|## budget/i.test(lines[i]) && i + 1 < lines.length) {
      budget = lines[i + 1].trim();
    }
    const inline = lines[i].match(/^\s*(?:##\s*)?funded\s*[:\-]?\s*(true|false|yes|no|0|1)\s*$/i);
    if (inline) {
      funded = /^(true|yes|1)$/i.test(inline[1]);
    } else if (/^##\s*funded\b/i.test(lines[i]) && i + 1 < lines.length && funded == null) {
      const v = lines[i + 1].trim().toLowerCase();
      if (/^(true|false|yes|no|0|1)$/.test(v)) funded = /^(true|yes|1)$/.test(v);
    }
  }
  const metrics = [];
  for (const line of lines) {
    const m = line.match(/^\s*-\s*\[([ xX])\]\s*(.+)/);
    if (m) metrics.push({ done: m[1].toLowerCase() === "x", text: m[2].trim() });
  }
  const envelope = classifyEnvelope({ budget_hint: budget, funded });
  return {
    budget_hint: envelope.budget_hint,
    budget_display_pt: envelope.budget_display_pt,
    budget_display_en: envelope.budget_display_en,
    funded: envelope.funded,
    treasury: false,
    withheld_bare_number: !!envelope.withheld_bare_number,
    metrics_total: metrics.length,
    metrics_done: metrics.filter((x) => x.done).length,
    metrics,
  };
}

async function listChallenges(env) {
  const headers = ghHeaders(env);
  const items = [];
  for (const r of CHALLENGE_REPOS) {
    const url =
      "https://api.github.com/repos/" +
      r.owner +
      "/" +
      r.name +
      "/issues?state=open&labels=" +
      encodeURIComponent(CHALLENGE_LABEL) +
      "&per_page=50";
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) continue;
      const list = await res.json();
      if (!Array.isArray(list)) continue;
      for (const issue of list) {
        if (issue.pull_request) continue;
        const labels = (issue.labels || []).map((l) => (typeof l === "string" ? l : l.name));
        let phase = "open";
        if (labels.includes("challenge-delivered")) phase = "delivered";
        else if (labels.includes("challenge-accepted")) phase = "accepted";
        else if (labels.includes("challenge-open")) phase = "open";
        const parsed = parseChallengeBody(issue.body);
        items.push({
          id: r.name + "#" + issue.number,
          number: issue.number,
          title: issue.title,
          html_url: issue.html_url,
          repo: r.owner + "/" + r.name,
          state: issue.state,
          phase,
          labels,
          created_at: issue.created_at,
          updated_at: issue.updated_at,
          user: issue.user ? issue.user.login : null,
          assignees: (issue.assignees || []).map((a) => a.login),
          comments: issue.comments,
          budget_hint: parsed.budget_hint,
          budget_display_pt: parsed.budget_display_pt,
          budget_display_en: parsed.budget_display_en,
          funded: !!parsed.funded,
          treasury: false,
          withheld_bare_number: !!parsed.withheld_bare_number,
          metrics_total: parsed.metrics_total,
          metrics_done: parsed.metrics_done,
          metrics: parsed.metrics,
          accept_hint: "Comment /accept on the issue or request assignment",
        });
      }
    } catch (_) {}
  }
  items.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  return {
    challenges: items,
    open_count: items.filter((c) => c.phase === "open").length,
    accepted_count: items.filter((c) => c.phase === "accepted").length,
    treasury: false,
    envelope_rule:
      "A budget figure is not treasury. V0 has no deposited/pledged/reserved EUR. Bare integers without Funded:true are withheld. Public default: 0 — no current funding yet.",
    principle:
      "The fund is stratified into open problems. Grantor chooses which challenge to fund. Grantee(s) accept and deliver against objective metrics agreed with the grantor. Rails: GitHub Sponsors + ENI /pagamentos. No envelope is cash until Funded:true + rail receipt.",
  };
}

async function discoverContributors(env) {
  const byId = new Map();
  const headers = ghHeaders(env);
  let api_ok = 0;
  let api_fail = 0;

  for (const r of REPOS) {
    try {
      const url = `https://api.github.com/repos/${r.owner}/${r.name}/contributors?per_page=100&anon=false`;
      const res = await fetch(url, { headers });
      if (!res.ok) {
        api_fail++;
        continue;
      }
      api_ok++;
      const list = await res.json();
      if (!Array.isArray(list)) continue;
      for (const c of list) {
        if (!c || c.type === "Bot") continue;
        const prev = byId.get(c.id) || {
          github_user_id: c.id,
          github_login: c.login,
          avatar_url: c.avatar_url,
          profile_url: c.html_url,
          contributions: 0,
          repositories: [],
        };
        prev.contributions += Number(c.contributions) || 0;
        if (!prev.repositories.includes(r.name)) prev.repositories.push(r.name);
        byId.set(c.id, prev);
      }
    } catch (_) {
      api_fail++;
    }
  }

  // ensure operator present
  if (![...byId.values()].some((c) => c.github_login === OPERATOR.github_login)) {
    byId.set(OPERATOR.github_user_id, {
      github_user_id: OPERATOR.github_user_id,
      github_login: OPERATOR.github_login,
      avatar_url: "https://avatars.githubusercontent.com/u/121771985?v=4",
      profile_url: "https://github.com/amcmorais",
      display_name: OPERATOR.display_name,
      contributions: 0,
      repositories: REPOS.map((r) => r.name),
    });
  }

  const claims = await kvListClaims(env);
  const claimByLogin = Object.fromEntries(claims.map((c) => [String(c.github_login).toLowerCase(), c]));

  const contributors = [...byId.values()]
    .map((c) => {
      const login = c.github_login;
      if (login === OPERATOR.github_login || c.github_user_id === OPERATOR.github_user_id) {
        return {
          ...c,
          display_name: c.display_name || OPERATOR.display_name,
          claimed: true,
          payout: {
            method: OPERATOR.method,
            status: OPERATOR.status,
            widget_url: OPERATOR.widget_url,
            widget_note: OPERATOR.widget_note,
            payment_intent_purpose: OPERATOR.payment_intent_purpose,
            contact: OPERATOR.contact,
          },
        };
      }
      const claim = claimByLogin[String(login).toLowerCase()];
      if (claim) {
        return {
          ...c,
          claimed: true,
          claim_status: claim.status || "pending_review",
          contact_email_domain: claim.email_domain || null,
          payout: {
            method: claim.payout_method || "registered_account",
            status: claim.status || "pending_review",
            note: "Claim registered — opaque payout details held for grantor review",
          },
        };
      }
      return {
        ...c,
        claimed: false,
        payout: { method: null, status: "claimable", options: ["registered_account", "prepaid_card"] },
      };
    })
    .sort((a, b) => (b.contributions || 0) - (a.contributions || 0));

  const total_contributions = contributors.reduce((s, c) => s + (c.contributions || 0), 0);
  return {
    contributors,
    aggregate: {
      contributors: contributors.length,
      contributions: total_contributions,
      repositories: REPOS.length,
      claimed: contributors.filter((c) => c.claimed).length,
      github_api_ok: api_ok,
      github_api_fail: api_fail,
      authenticated: !!(env && env.GITHUB_TOKEN),
    },
  };
}

function isAcceptComment(body) {
  return /^\s*\/accept\b/i.test(String(body || ""));
}

function firstSentence(text) {
  const t = String(text || "").trim();
  if (!t) return "";
  const m = t.match(/^[^.!?]+[.!?]/);
  const s = m ? m[0] : t;
  return s.length > 220 ? s.slice(0, 217) + "…" : s;
}

function challengeIssueUrl(number) {
  return "https://github.com/" + ORG + "/" + FUND_REPO + "/issues/" + number;
}

async function ghJson(env, url) {
  try {
    const res = await fetch(url, { headers: ghHeaders(env) });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data: data };
  } catch (e) {
    return { ok: false, status: 0, data: null, error: String(e.message || e) };
  }
}

function pushSubstance(list, item) {
  if (!item || !item.html_url) return;
  const title = String(item.title || "").split("\n")[0].trim().slice(0, 160);
  list.push({
    repo: item.repo || "",
    title: title || "(no title returned)",
    html_url: item.html_url,
    kind: item.kind,
    at: item.at || null,
  });
}

function dedupeSubstance(list, limit) {
  const seen = new Set();
  const out = [];
  const sorted = (list || []).slice().sort(function (a, b) {
    return String(b.at || "").localeCompare(String(a.at || ""));
  });
  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i];
    const k = String(s.kind) + ":" + String(s.html_url);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({
      repo: s.repo,
      title: s.title,
      html_url: s.html_url,
      kind: s.kind,
    });
    if (out.length >= (limit || 8)) break;
  }
  return out;
}

async function fetchSubstance(env, login) {
  const cacheKey = "gh:substance:" + String(login).toLowerCase();
  const cached = await kvGetFresh(env, cacheKey, SUMMARY_CACHE_MS);
  if (cached && cached.substance) {
    return { substance: cached.substance, evidence_at: cached.evidence_at, cached: true };
  }

  const raw = [];
  const headers = ghHeaders(env);

  await Promise.all(
    REPOS.map(async function (r) {
      try {
        const url =
          "https://api.github.com/repos/" +
          r.owner +
          "/" +
          r.name +
          "/commits?author=" +
          encodeURIComponent(login) +
          "&per_page=3";
        const res = await fetch(url, { headers: headers });
        if (!res.ok) return;
        const list = await res.json();
        if (!Array.isArray(list)) return;
        for (let i = 0; i < list.length; i++) {
          const c = list[i];
          const msg = c.commit && c.commit.message ? c.commit.message : "";
          const at = c.commit && c.commit.author && c.commit.author.date ? c.commit.author.date : null;
          pushSubstance(raw, {
            repo: r.name,
            title: msg,
            html_url: c.html_url,
            kind: "commit",
            at: at,
          });
          if (i === 0 && c.sha) {
            try {
              const prUrl =
                "https://api.github.com/repos/" +
                r.owner +
                "/" +
                r.name +
                "/commits/" +
                c.sha +
                "/pulls";
              const prRes = await fetch(prUrl, { headers: headers });
              if (prRes.ok) {
                const prs = await prRes.json();
                if (Array.isArray(prs)) {
                  for (let j = 0; j < prs.length; j++) {
                    const pr = prs[j];
                    pushSubstance(raw, {
                      repo: r.name,
                      title: pr.title,
                      html_url: pr.html_url,
                      kind: "pr",
                      at: pr.updated_at || pr.closed_at || at,
                    });
                  }
                }
              }
            } catch (_) {}
          }
        }
      } catch (_) {}
    }),
  );

  try {
    const q = "author:" + login + " org:" + ORG + " type:pr";
    const url =
      "https://api.github.com/search/issues?q=" + encodeURIComponent(q) + "&per_page=5&sort=updated";
    const pack = await ghJson(env, url);
    const items = pack.ok && pack.data && Array.isArray(pack.data.items) ? pack.data.items : [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const repoUrl = String(it.repository_url || "");
      const repo = repoUrl.split("/").pop() || "";
      pushSubstance(raw, {
        repo: repo,
        title: it.title,
        html_url: it.html_url,
        kind: "pr",
        at: it.updated_at,
      });
    }
  } catch (_) {}

  try {
    const url =
      "https://api.github.com/users/" + encodeURIComponent(login) + "/events/public?per_page=20";
    const pack = await ghJson(env, url);
    const events = pack.ok && Array.isArray(pack.data) ? pack.data : [];
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      const full = ev.repo && ev.repo.name ? ev.repo.name : "";
      if (full.indexOf(ORG + "/") !== 0) continue;
      const shortRepo = full.split("/")[1] || full;
      const payload = ev.payload || {};
      if (ev.type === "PushEvent") {
        const commits = payload.commits || [];
        for (let j = 0; j < commits.length; j++) {
          const c = commits[j];
          pushSubstance(raw, {
            repo: shortRepo,
            title: c.message,
            html_url: "https://github.com/" + full + "/commit/" + c.sha,
            kind: "commit",
            at: ev.created_at,
          });
        }
      } else if (ev.type === "PullRequestEvent" && payload.pull_request) {
        const pr = payload.pull_request;
        pushSubstance(raw, {
          repo: shortRepo,
          title: pr.title,
          html_url: pr.html_url,
          kind: "pr",
          at: ev.created_at,
        });
      } else if (ev.type === "IssuesEvent" && payload.issue) {
        const issue = payload.issue;
        pushSubstance(raw, {
          repo: shortRepo,
          title: issue.title,
          html_url: issue.html_url,
          kind: "issue",
          at: ev.created_at,
        });
      }
    }
  } catch (_) {}

  const substance = dedupeSubstance(raw, 8);
  const pack = {
    cached_at: new Date().toISOString(),
    evidence_at: new Date().toISOString(),
    substance: substance,
  };
  await kvPut(env, cacheKey, pack, Math.floor(SUMMARY_CACHE_MS / 1000));
  return { substance: substance, evidence_at: pack.evidence_at, cached: false };
}

function interpretExecutive(opts) {
  const login = opts.login;
  const stats = opts.stats || {};
  const substance = opts.substance || [];
  const opened = opts.openedChallenges || [];
  const activity = opts.activity || null;
  const deliveries = opts.deliveries || [];
  const isOperator = !!opts.isOperator;
  const repos = stats.repositories || [];
  const repoList = repos.length ? repos.join(", ") : "none listed";
  const n = stats.contributions || 0;
  const claimed = !!stats.claimed;

  const cites = substance.slice(0, 6).map(function (s) {
    return s.kind + " “" + s.title + "” in " + s.repo + " <" + s.html_url + ">";
  });

  const en = [];
  const pt = [];

  if (isOperator) {
    en.push(
      "@" +
        login +
        " is the laboratory operator (claimed; payout rail ENI /pagamentos). Grantor of posted challenges, not a ranked grantee.",
    );
    pt.push(
      "@" +
        login +
        " é o operador do laboratório (reclamado; rail de desembolso ENI /pagamentos). Grantor dos desafios publicados, não um grantee no ranking.",
    );
  } else if (claimed) {
    en.push("@" + login + " has a registered claim on this fund.");
    pt.push("@" + login + " tem um claim registado neste fundo.");
  } else {
    en.push("@" + login + " is unclaimed on this fund (no payout rail registered).");
    pt.push("@" + login + " não reclamou perfil neste fundo (sem rail de desembolso registado).");
  }

  en.push(
    "GitHub contributor totals (org repos in scope): " +
      n +
      " contribution" +
      (n === 1 ? "" : "s") +
      " across " +
      repos.length +
      " repositor" +
      (repos.length === 1 ? "y" : "ies") +
      " (" +
      repoList +
      "). These are GitHub’s contributor counts, not an impact score.",
  );
  pt.push(
    "Totais GitHub (repos no âmbito): " +
      n +
      " contribuiç" +
      (n === 1 ? "ão" : "ões") +
      " em " +
      repos.length +
      " repositório" +
      (repos.length === 1 ? "" : "s") +
      " (" +
      repoList +
      "). São contagens da API GitHub, não um score de impacto.",
  );

  if (cites.length) {
    en.push("Substance from public GitHub evidence (recent commit/PR/issue titles): " + cites.join("; ") + ".");
    pt.push(
      "Substância a partir de evidência GitHub pública (títulos recentes de commit/PR/issue): " +
        cites.join("; ") +
        ".",
    );
  } else {
    en.push(
      "No recent public commit, pull request, or issue titles were returned by the GitHub API for @" +
        login +
        " on in-scope repositories. Evidence missing.",
    );
    pt.push(
      "A API GitHub não devolveu títulos recentes de commit, pull request ou issue para @" +
        login +
        " nos repositórios no âmbito. Evidência em falta.",
    );
  }

  if (opened.length) {
    const nums = opened.map(function (x) {
      return "#" + x;
    }).join(", ");
    en.push(
      "Opened challenges " +
        nums +
        " on " +
        FUND_REPO +
        " as grantor. Opening a challenge is not grantee delivery and does not enter the delivery ranking.",
    );
    pt.push(
      "Abriu os desafios " +
        nums +
        " em " +
        FUND_REPO +
        " como grantor. Abrir um desafio não é entrega de grantee e não entra no ranking de entregas.",
    );
  }

  if (activity && activity.comments) {
    const iss = (activity.issues || [])
      .map(function (i) {
        return "#" + i.number;
      })
      .filter(function (v, i, a) {
        return a.indexOf(v) === i;
      })
      .join(", ");
    en.push(
      "Challenge-issue activity (comments, not delivery): " +
        activity.comments +
        " comment(s) on " +
        (iss || "listed issues") +
        ".",
    );
    pt.push(
      "Actividade em issues de desafio (comentários, não entrega): " +
        activity.comments +
        " comentário(s) em " +
        (iss || "issues listados") +
        ".",
    );
  } else {
    en.push("No comments on posted challenge issues #1–#9 were found for @" + login + ".");
    pt.push("Não foram encontrados comentários de @" + login + " nos desafios publicados #1–#9.");
  }

  if (deliveries.length) {
    en.push(
      "Challenge deliveries recorded: " +
        deliveries
          .map(function (d) {
            return d.challenge + " score " + d.score;
          })
          .join("; ") +
        ".",
    );
    pt.push(
      "Entregas de desafio registadas: " +
        deliveries
          .map(function (d) {
            return d.challenge + " score " + d.score;
          })
          .join("; ") +
        ".",
    );
  } else {
    en.push("No grantee delivery on posted challenges (requires /accept + evidence PR).");
    pt.push("Nenhuma entrega de grantee nos desafios publicados (exige /accept + PR de evidência).");
  }

  en.push(
    "This brief interprets GitHub evidence for grantors. It is not a STRATA score, not treasury, and not a measure of euro value.",
  );
  pt.push(
    "Este resumo interpreta evidência GitHub para grantors. Não é um score STRATA, não é tesouraria, nem uma medida de valor em euros.",
  );

  return { executive_en: en.join(" "), executive_pt: pt.join(" ") };
}

function extractLinkedPrs(timeline) {
  const out = [];
  const list = Array.isArray(timeline) ? timeline : [];
  for (let i = 0; i < list.length; i++) {
    const ev = list[i];
    if (ev.event !== "cross-referenced" && ev.event !== "connected") continue;
    const src = ev.source && ev.source.issue ? ev.source.issue : null;
    if (!src || !src.pull_request) continue;
    out.push({
      title: src.title || "",
      html_url: src.html_url,
      number: src.number,
      user: src.user && src.user.login ? src.user.login : null,
    });
  }
  return out;
}

async function fetchIssueComments(env, number) {
  const url =
    "https://api.github.com/repos/" +
    ORG +
    "/" +
    FUND_REPO +
    "/issues/" +
    number +
    "/comments?per_page=100";
  const pack = await ghJson(env, url);
  return pack.ok && Array.isArray(pack.data) ? pack.data : [];
}

async function fetchIssueTimeline(env, number) {
  const url =
    "https://api.github.com/repos/" + ORG + "/" + FUND_REPO + "/issues/" + number + "/timeline?per_page=100";
  const pack = await ghJson(env, url);
  return pack.ok && Array.isArray(pack.data) ? pack.data : [];
}

async function buildRanking(env, prefetched) {
  const cached = await kvGetFresh(env, "gh:ranking:v1", RANKING_CACHE_MS);
  if (cached && cached.payload) return cached.payload;

  const ch = prefetched && prefetched.challenges ? prefetched : await listChallenges(env);
  const byNumber = {};
  const listed = ch.challenges || [];
  for (let i = 0; i < listed.length; i++) {
    const c = listed[i];
    if (c.repo && String(c.repo).indexOf(FUND_REPO) !== -1) byNumber[c.number] = c;
  }

  const packs = await Promise.all(
    POSTED_CHALLENGE_NUMBERS.map(async function (n) {
      const comments = await fetchIssueComments(env, n);
      const meta0 = byNumber[n];
      const labeled =
        meta0 && (meta0.phase === "accepted" || meta0.phase === "delivered");
      const acceptedHere =
        labeled ||
        comments.some(function (c) {
          return isAcceptComment(c.body);
        });
      const timeline = acceptedHere ? await fetchIssueTimeline(env, n) : [];
      return { n: n, comments: comments, timeline: timeline };
    }),
  );

  const deliveryRows = [];
  const activityByLogin = new Map();
  let openCount = 0;

  for (let i = 0; i < packs.length; i++) {
    const pack = packs[i];
    const n = pack.n;
    const meta = byNumber[n] || {
      number: n,
      id: FUND_REPO + "#" + n,
      html_url: challengeIssueUrl(n),
      title: null,
      phase: "open",
      user: null,
      assignees: [],
      metrics_done: 0,
      metrics_total: 0,
      funded: false,
      repo: ORG + "/" + FUND_REPO,
    };
    if ((meta.phase || "open") === "open") openCount++;

    const comments = pack.comments || [];
    const linkedPrs = extractLinkedPrs(pack.timeline);
    const acceptComments = comments.filter(function (c) {
      return isAcceptComment(c.body);
    });
    const accepted =
      meta.phase === "accepted" ||
      meta.phase === "delivered" ||
      (meta.labels || []).indexOf("challenge-accepted") !== -1 ||
      (meta.labels || []).indexOf("challenge-delivered") !== -1 ||
      acceptComments.length > 0;

    const grantees = new Set();
    for (let a = 0; a < acceptComments.length; a++) {
      const u = acceptComments[a].user && acceptComments[a].user.login;
      if (u) grantees.add(u);
    }
    const assignees = meta.assignees || [];
    for (let a = 0; a < assignees.length; a++) {
      const login = assignees[a];
      if (!login) continue;
      if (login === meta.user && acceptComments.length === 0) continue;
      grantees.add(login);
    }

    const metrics_done = meta.metrics_done || 0;
    const hasLinked = linkedPrs.length > 0;
    const score = (accepted ? 1 : 0) + (hasLinked ? 1 : 0) + metrics_done;

    if (accepted && hasLinked && grantees.size) {
      grantees.forEach(function (login) {
        deliveryRows.push({
          login: login,
          challenge: meta.id,
          number: n,
          title: meta.title,
          html_url: meta.html_url,
          accepted: true,
          linked_prs: linkedPrs,
          metrics_done: metrics_done,
          metrics_total: meta.metrics_total || 0,
          funded: !!meta.funded,
          score: score,
        });
      });
    }

    for (let c = 0; c < comments.length; c++) {
      const comment = comments[c];
      const login = comment.user && comment.user.login;
      if (!login) continue;
      if (comment.user && comment.user.type === "Bot") continue;
      const key = String(login).toLowerCase();
      const rec = activityByLogin.get(key) || {
        login: login,
        comments: 0,
        issues: [],
        role: login === OPERATOR.github_login ? "grantor_operator" : "commenter",
      };
      rec.comments += 1;
      rec.issues.push({
        number: n,
        title: meta.title,
        html_url: comment.html_url || meta.html_url,
        issue_url: meta.html_url,
      });
      activityByLogin.set(key, rec);
    }
  }

  const deliveries = deliveryRows.sort(function (a, b) {
    return (b.score || 0) - (a.score || 0);
  });
  const activity = Array.from(activityByLogin.values())
    .map(function (a) {
      return {
        login: a.login,
        comments: a.comments,
        score: a.comments,
        issues: a.issues,
        role: a.role,
        kind: "activity",
        note: "Issue comments, not grantee delivery.",
        html_url: "https://github.com/" + a.login,
      };
    })
    .sort(function (a, b) {
      return (b.score || 0) - (a.score || 0);
    });

  const payload = {
    generated_at: new Date().toISOString(),
    challenges_open: openCount,
    challenges_listed: POSTED_CHALLENGE_NUMBERS.length,
    deliveries: deliveries,
    activity: activity,
    note: RANKING_NOTE,
    rules: {
      deliveries:
        "accepted (/accept or challenge-accepted) + linked evidence PR + metrics_done. Opening a challenge as grantor does not count.",
      activity:
        "Comments on challenge issues excluding the original issue body. Labeled activity, not delivery.",
      no_ai_scores: true,
      no_strata: true,
      no_treasury: true,
    },
  };
  await kvPut(
    env,
    "gh:ranking:v1",
    { cached_at: payload.generated_at, payload: payload },
    Math.floor(RANKING_CACHE_MS / 1000),
  );
  return payload;
}

function openedChallengeNumbers(challenges, login) {
  const out = [];
  const list = challenges || [];
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (c.user !== login) continue;
    if (!c.repo || String(c.repo).indexOf(FUND_REPO) === -1) continue;
    if (POSTED_CHALLENGE_NUMBERS.indexOf(c.number) === -1) continue;
    out.push(c.number);
  }
  out.sort(function (a, b) {
    return a - b;
  });
  return out;
}

async function enrichContributor(env, contributor, ctx) {
  const login = contributor.github_login;
  const ranking = (ctx && ctx.ranking) || { deliveries: [], activity: [] };
  const challenges = (ctx && ctx.challenges) || [];
  const subPack = await fetchSubstance(env, login);
  const opened = openedChallengeNumbers(challenges, login);
  const isOperator = login === OPERATOR.github_login || contributor.github_user_id === OPERATOR.github_user_id;
  const activity =
    (ranking.activity || []).find(function (a) {
      return String(a.login).toLowerCase() === String(login).toLowerCase();
    }) || null;
  const deliveries = (ranking.deliveries || []).filter(function (d) {
    return String(d.login).toLowerCase() === String(login).toLowerCase();
  });
  const stats = {
    contributions: contributor.contributions || 0,
    repositories: contributor.repositories || [],
    claimed: !!contributor.claimed,
    operator: isOperator,
  };
  const brief = interpretExecutive({
    login: login,
    stats: stats,
    substance: subPack.substance,
    openedChallenges: opened,
    activity: activity,
    deliveries: deliveries,
    isOperator: isOperator,
  });
  return Object.assign({}, contributor, {
    summary: {
      stats: stats,
      substance: subPack.substance,
      executive_pt: brief.executive_pt,
      executive_en: brief.executive_en,
      evidence_at: subPack.evidence_at,
    },
  });
}

async function contributorsWithSummaries(env) {
  const data = await discoverContributors(env);
  const ch = await listChallenges(env);
  const ranking = await buildRanking(env, ch);
  const contributors = await Promise.all(
    (data.contributors || []).map(function (c) {
      return enrichContributor(env, c, { ranking: ranking, challenges: ch.challenges });
    }),
  );
  return {
    contributors: contributors,
    aggregate: data.aggregate,
    ranking: ranking,
    challenges: ch.challenges,
  };
}

function rankingSectionHtml(lang, ranking) {
  const pt = lang === "pt";
  const r = ranking || {};
  const deliveries = r.deliveries || [];
  const activity = r.activity || [];
  const delRows = deliveries.length
    ? deliveries
        .map(function (d) {
          const prs = (d.linked_prs || [])
            .map(function (p) {
              return '<a href="' + esc(p.html_url) + '" rel="noopener">PR#' + esc(p.number) + "</a>";
            })
            .join(" · ");
          return (
            "<tr><td><a href=\"/contributors/" +
            esc(d.login) +
            (pt ? "" : "?lang=en") +
            '">@' +
            esc(d.login) +
            "</a></td><td><a href=\"" +
            esc(d.html_url) +
            '" rel="noopener">' +
            esc(d.challenge) +
            "</a></td><td class=\"mono\">" +
            esc(d.score) +
            "</td><td class=\"mono\">" +
            (prs || "—") +
            "</td></tr>"
          );
        })
        .join("")
    : '<tr><td colspan="4" class="muted">' +
      (pt
        ? "Nenhuma entrega de grantee ainda. 0 /accept, 0 financed, métricas por marcar nos 9 desafios. O ranking não trata o autor do issue (grantor) como se tivesse resolvido o desafio."
        : "No grantee deliveries yet. 0 /accept, 0 funded, metrics unchecked on all 9 challenges. Ranking does not treat the issue author (grantor) as having solved the challenge.") +
      "</td></tr>";
  const actRows = activity.length
    ? activity
        .map(function (a) {
          const links = (a.issues || [])
            .map(function (i) {
              return '<a href="' + esc(i.html_url) + '" rel="noopener">#' + esc(i.number) + "</a>";
            })
            .filter(function (v, i, arr) {
              return arr.indexOf(v) === i;
            })
            .join(" · ");
          const role =
            a.role === "grantor_operator"
              ? '<div class="muted">' + (pt ? "grantor / operador — actividade, não entrega" : "grantor / operator — activity, not delivery") + "</div>"
              : "";
          return (
            "<tr><td><a href=\"https://github.com/" +
            esc(a.login) +
            '" rel="noopener">@' +
            esc(a.login) +
            "</a>" +
            role +
            '</td><td class="mono">' +
            esc(a.comments) +
            "</td><td class=\"mono\">" +
            (links || "—") +
            "</td></tr>"
          );
        })
        .join("")
    : '<tr><td colspan="3" class="muted">' +
      (pt ? "Sem comentários nos desafios #1–#9 (excluindo o corpo original)." : "No comments on challenges #1–#9 (excluding the original issue body).") +
      "</td></tr>";
  return (
    '<div class="section">' +
    "<h2>Ranking</h2>" +
    '<p class="lead">' +
    (pt
      ? "Ranking só de trabalho ligado aos desafios publicados (#1–#9 neste repositório). Abrir um desafio como grantor não conta como entrega de grantee. Sem scores de IA, sem STRATA, sem tesouraria."
      : "Ranking from work linked to posted challenges (#1–#9 on this repository) only. Opening a challenge as grantor does not count as grantee delivery. No AI scores, no STRATA, no treasury.") +
    "</p>" +
    '<p class="note">' +
    esc(r.note || RANKING_NOTE) +
    "</p>" +
    "<h2>" +
    (pt ? "Entregas" : "Deliveries") +
    "</h2>" +
    '<div class="card" style="padding:0;overflow:auto"><table><thead><tr>' +
    "<th>" +
    (pt ? "Grantee" : "Grantee") +
    "</th><th>" +
    (pt ? "Desafio" : "Challenge") +
    "</th><th>Score</th><th>" +
    (pt ? "Evidência" : "Evidence") +
    "</th></tr></thead><tbody>" +
    delRows +
    "</tbody></table></div>" +
    "<h2>" +
    (pt ? "Actividade (não é entrega)" : "Activity (not delivery)") +
    "</h2>" +
    '<p class="muted">' +
    (pt
      ? "Comentários nas issues dos desafios, excluindo o corpo original. Isto não é ranking de entrega."
      : "Comments on challenge issues, excluding the original issue body. This is not a delivery ranking.") +
    "</p>" +
    '<div class="card" style="padding:0;overflow:auto"><table><thead><tr>' +
    "<th>" +
    (pt ? "Quem" : "Who") +
    "</th><th>" +
    (pt ? "Comentários" : "Comments") +
    "</th><th>" +
    (pt ? "Evidência" : "Evidence") +
    "</th></tr></thead><tbody>" +
    actRows +
    "</tbody></table></div>" +
    '<p class="mono muted"><a href="/api/v1/ranking">GET /api/v1/ranking</a></p>' +
    "</div>"
  );
}


function resolveLang(url, path) {
  const q = url.searchParams.get("lang");
  if (q === "en") return "en";
  if (q === "pt") return "pt";
  if (path === "/en" || path.startsWith("/en/")) return "en";
  return "pt";
}


function sponsorsEmbedHtml(sp) {
  const u = (sp && sp.user) || {};
  const o = (sp && sp.organization) || {};
  const url = (sp && sp.preferred_url) || (u.active ? u.url : null) || SPONSORS_URL;
  function statusLabel(x) {
    if (x && x.active) return "live";
    if (x && x.pending) return "pending approval";
    return "not submitted";
  }
  function dotClass(x) {
    if (x && x.active) return "live";
    if (x && x.pending) return "pending";
    return "off";
  }
  const desc = u.active
    ? "Support open contribution on StrataMesh Laboratory via GitHub Sponsors. Operator rail under AMCM ENI."
    : "GitHub Sponsors not public yet — use ENI /pagamentos for EUR grants.";
  let meta =
    '<span class="sp-dot ' +
    dotClass(u) +
    '"></span>@' +
    esc(u.login || SPONSORS_LOGIN) +
    " · " +
    statusLabel(u) +
    "&nbsp;&nbsp;&nbsp;<span class=\"sp-dot " +
    dotClass(o) +
    '"></span>' +
    esc(SPONSORS_ORG) +
    " · " +
    statusLabel(o);
  if (o && o.pending) {
    meta += " · AMCM ENI umbrella (staff review)";
  }
  return (
    '<div class="sponsor-panel">' +
    '<div class="sponsor-panel-inner">' +
    '<p class="sp-kicker">GitHub Sponsors</p>' +
    '<p class="sp-title">Fund the laboratory</p>' +
    '<p class="sp-desc">' +
    esc(desc) +
    "</p>" +
    '<div class="sp-actions">' +
    '<a class="sp-btn" href="' +
    esc(url) +
    '" rel="noopener">Sponsor @' +
    esc(u.login || SPONSORS_LOGIN) +
    "</a>" +
    '<a class="sp-btn ghost" href="https://calhegasmorais.pt/pagamentos" rel="noopener">ENI /pagamentos</a>' +
    (o && o.active
      ? '<a class="sp-btn ghost" href="' +
        esc(o.url || SPONSORS_ORG_URL) +
        '" rel="noopener">Sponsor org</a>'
      : "") +
    "</div>" +
    '<p class="sp-meta">' +
    meta +
    "</p>" +
    "</div></div>"
  );
}

function homePage(lang, agg, sp) {
  const pt = lang === "pt";
  const path = pt ? "/" : "/en";
  const enQ = pt ? "" : "?lang=en";
  const a = agg || {};
  const body = `
    <p class="kicker">${pt ? "V0 operacional · evidência GitHub" : "Operational V0 · GitHub evidence"}</p>
    <h1>StrataMesh Impact Fund</h1>
    <p class="lead">${
      pt
        ? "Por agora o Impact Fund segue o GitHub Sponsors e cada recipiente individualmente. O fundo agrupado será libertado mais tarde. Evidência pública no GitHub."
        : "For now the Impact Fund follows GitHub Sponsors and each recipient individually. The pooled fund will be released later. Public GitHub evidence."
    }</p>
    <div class="actions">
      <a class="btn primary" href="https://calhegasmorais.pt/pagamentos" rel="noopener">${pt ? "Donativo (operador)" : "Donate (operator)"}</a>
      <a class="btn" href="/contributors${enQ}">${pt ? "Contribuidores" : "Contributors"}</a>
      <a class="btn" href="/claim${enQ}">${pt ? "Reclamar perfil" : "Claim profile"}</a>
    </div>
    <div class="grid">
      <div class="stat-box"><div class="stat">${a.contributors != null ? a.contributors : "…"}</div><div class="stat-label">${pt ? "contribuidores" : "contributors"}</div></div>
      <div class="stat-box"><div class="stat">${a.contributions != null ? a.contributions : "…"}</div><div class="stat-label">${pt ? "contribuições GH" : "GH contributions"}</div></div>
      <div class="stat-box"><div class="stat">${a.repositories != null ? a.repositories : REPOS.length}</div><div class="stat-label">${pt ? "repositórios" : "repositories"}</div></div>
      <div class="stat-box"><div class="stat">${a.claimed != null ? a.claimed : "…"}</div><div class="stat-label">${pt ? "com payout" : "with payout"}</div></div>
    </div>
    <p class="note">${
      pt
        ? "Não há pool de grants neste corte. Grantors usam GitHub Sponsors (@amcmorais) ou pagam cada contribuidor na conta registada. Fundo agrupado: mais tarde."
        : "No grant pool this cut. Grantors use GitHub Sponsors (@amcmorais) or pay each contributor on their registered account. Pooled fund later."
    }</p>
    <div class="section">
      <h2>${pt ? "Como funciona" : "How it works"}</h2>
      <ol class="steps">
        <li>GitHub → estatísticas por contribuidor nos repos StrataMesh-Laboratory</li>
        <li>${pt ? "Reclamar perfil (login público + email) ou operador via /pagamentos" : "Claim profile (public login + email) or operator via /pagamentos"}</li>
        <li>${pt ? "O grantor escolhe GitHub Sponsors ou paga cada recipiente; o fundo agrupado ainda não está aberto" : "The grantor chooses GitHub Sponsors or pays each recipient; the pooled fund is not open yet"}</li>
      </ol>
    </div>
    <div class="section">
      <h2>${pt ? "Repositórios" : "Repositories"}</h2>
      <table>
        <thead><tr><th>Repo</th><th>Role</th></tr></thead>
        <tbody>
          ${REPOS.map((r) => `<tr><td><a href="https://github.com/${r.owner}/${r.name}">${esc(r.name)}</a></td><td class="muted">${esc(r.role)}</td></tr>`).join("")}
        </tbody>
      </table>
    </div>
    
    <div class="section">
      <h2>${pt ? "Rails de financiamento" : "Funding rails"}</h2>
      <div class="actions">
        <a class="btn primary" href="${esc((sp && sp.preferred_url) || SPONSORS_URL)}" rel="noopener">GitHub Sponsors</a>
        <a class="btn" href="https://calhegasmorais.pt/pagamentos" rel="noopener">ENI /pagamentos (EUR)</a>
        <a class="btn" href="/challenges${enQ}">${pt ? "Problemas abertos" : "Open problems"}</a>
      </div>
      ${sponsorsEmbedHtml(sp)}
      <p class="note">${
        pt
          ? "Desafios estratificam o fundo. Sponsors @amcmorais público. Org StrataMesh-Laboratory submetida — aguarda aprovação do staff GitHub (guarda-chuva AMCM ENI, mesmos dados de conta). /pagamentos disponível."
          : "Challenges stratify the fund. @amcmorais Sponsors is public. Org StrataMesh-Laboratory submitted — awaiting GitHub staff approval (AMCM ENI umbrella, same account data). /pagamentos available."
      }</p>
    </div>
    <div class="section">
      <h2>API</h2>
      <p class="mono muted">GET /api/v1/health · /contributors · /ranking · /repositories · /payout-methods · /claim (POST)</p>
    </div>`;
  return shell({ lang, path, title: "StrataMesh Impact Fund", active: "home", body });
}

function contributorsPage(lang, data) {
  const pt = lang === "pt";
  const path = pt ? "/contributors" : "/contributors?lang=en";
  const enQ = pt ? "" : "?lang=en";
  const list = (data && data.contributors) || [];
  const rows = list
    .map((c) => {
      const pay = c.payout || {};
      let status = `<span class="pill">claimable</span>`;
      if (pay.status === "active") status = `<span class="pill ok">${esc(pay.method)}</span>`;
      else if (pay.status === "pending_review") status = `<span class="pill warn">pending</span>`;
      const link =
        pay.method === "eni_pagamentos"
          ? `<a href="${esc(pay.widget_url)}">/pagamentos</a>`
          : c.claimed
            ? `<span class="muted">${esc(pay.status || "claimed")}</span>`
            : `<a href="/claim?${pt ? "" : "lang=en&"}login=${encodeURIComponent(c.github_login)}">${pt ? "Reclamar" : "Claim"}</a>`;
      const brief = c.summary ? (pt ? c.summary.executive_pt : c.summary.executive_en) : "";
      const excerpt = firstSentence(brief);
      return `<tr>
        <td>${c.avatar_url ? `<img class="avatar" src="${esc(c.avatar_url)}" alt="" width="28" height="28"/>` : ""}
          <a href="/contributors/${esc(c.github_login)}${enQ}">@${esc(c.github_login)}</a>
          ${excerpt ? `<div class="muted" style="font-size:.82rem;margin-top:.3rem">${esc(excerpt)}</div>` : ""}</td>
        <td class="mono">${c.contributions != null ? c.contributions : 0}</td>
        <td class="muted">${esc((c.repositories || []).join(", "))}</td>
        <td>${status}<div style="margin-top:.35rem">${link}</div></td>
      </tr>`;
    })
    .join("");

  const body = `
    <p class="kicker">${pt ? "evidência GitHub ao vivo" : "live GitHub evidence"}</p>
    <h1>${pt ? "Contribuidores" : "Contributors"}</h1>
    <p class="lead">${
      pt
        ? "Agregado a partir da API GitHub dos repositórios da organização. O resumo de uma linha interpreta totais + substância pública — não é um score de valor."
        : "Aggregated from the GitHub API across organization repositories. The one-line brief interprets totals + public substance — not a value score."
    }</p>
    <div class="card" style="padding:0;overflow:auto">
      <table>
        <thead><tr>
          <th>${pt ? "Contribuidor" : "Contributor"}</th>
          <th>${pt ? "Contribuições" : "Contributions"}</th>
          <th>${pt ? "Repos" : "Repos"}</th>
          <th>${pt ? "Desembolso" : "Payout"}</th>
        </tr></thead>
        <tbody>${rows || `<tr><td colspan="4" class="muted">${pt ? "Sem dados." : "No data."}</td></tr>`}</tbody>
      </table>
    </div>
    <p class="note mono">auth GH: ${(data && data.aggregate && data.aggregate.authenticated) ? "yes" : "no"} · api ${data && data.aggregate ? data.aggregate.github_api_ok + "/" + (data.aggregate.github_api_ok + data.aggregate.github_api_fail) : "?"}</p>
    <div class="actions">
      <a class="btn primary" href="/claim${enQ}">${pt ? "Reclamar perfil" : "Claim profile"}</a>
      <a class="btn" href="/api/v1/contributors">JSON</a>
    </div>`;
  return shell({ lang, path, title: pt ? "Contribuidores · Impact Fund" : "Contributors · Impact Fund", active: "contributors", body });
}

function detailPage(lang, profile) {
  const pt = lang === "pt";
  const login = profile.github_login;
  const pay = profile.payout || {};
  const sum = profile.summary || null;
  let briefBlock = "";
  if (sum) {
    const exec = pt ? sum.executive_pt : sum.executive_en;
    const items = (sum.substance || [])
      .slice(0, 8)
      .map((s) => `<li><span class="mono">${esc(s.kind)}</span> · <a href="${esc(s.html_url)}" rel="noopener">${esc(s.title)}</a> <span class="muted">${esc(s.repo)}</span></li>`)
      .join("");
    briefBlock = `
      <div class="section">
        <h2>${pt ? "Resumo para grantors" : "Grantor brief"}</h2>
        <p>${esc(exec)}</p>
        ${items ? `<ul class="steps">${items}</ul>` : `<p class="muted">${pt ? "Sem títulos de evidência GitHub devolvidos pela API." : "No GitHub evidence titles returned by the API."}</p>`}
        <p class="mono muted">${pt ? "interpretação de evidência GitHub · não é score de valor" : "GitHub-evidence interpretation · not a value score"} · ${esc(sum.evidence_at || "")}</p>
      </div>`;
  }
  let payBlock = "";
  if (pay.method === "eni_pagamentos") {
    payBlock = `
      <div class="section"><h2>${pt ? "Desembolso (operador)" : "Payout (operator)"}</h2>
      <p class="muted">${esc(pay.widget_note || "")}</p>
      <div class="actions">
        <a class="btn primary" href="${esc(pay.widget_url)}" rel="noopener">${pt ? "Abrir /pagamentos" : "Open /pagamentos"}</a>
        <a class="btn" href="mailto:${esc(pay.contact || "")}">${esc(pay.contact || "")}</a>
      </div></div>`;
  } else if (profile.claimed) {
    payBlock = `
      <div class="section"><h2>${pt ? "Claim registado" : "Claim registered"}</h2>
      <p class="mono">${esc(pay.method)} · ${esc(pay.status)}</p>
      <p class="muted">${esc(pay.note || "")}</p></div>`;
  } else {
    payBlock = `
      <div class="section"><h2>${pt ? "Sem conta ligada" : "No payout linked"}</h2>
      <div class="actions"><a class="btn primary" href="/claim?${pt ? "" : "lang=en&"}login=${encodeURIComponent(login)}">${pt ? "Reclamar" : "Claim"}</a></div></div>`;
  }
  const body = `
    <p class="kicker">${profile.claimed ? (pt ? "reclamado" : "claimed") : (pt ? "descoberta GH" : "GH discovery")}</p>
    <h1>${profile.avatar_url ? `<img class="avatar" src="${esc(profile.avatar_url)}" width="28" height="28" alt=""/>` : ""} @${esc(login)}</h1>
    <p class="muted"><a href="${esc(profile.profile_url || "https://github.com/" + login)}">GitHub</a>${profile.display_name ? " · " + esc(profile.display_name) : ""}</p>
    <div class="grid">
      <div class="stat-box"><div class="stat">${profile.contributions || 0}</div><div class="stat-label">${pt ? "contribuições" : "contributions"}</div></div>
      <div class="stat-box"><div class="stat">${(profile.repositories || []).length}</div><div class="stat-label">repos</div></div>
      <div class="stat-box"><div class="stat mono" style="font-size:.85rem">${esc(pay.method || pay.status || "—")}</div><div class="stat-label">payout</div></div>
    </div>
    <p class="muted">${esc((profile.repositories || []).join(", "))}</p>
    ${briefBlock}
    ${payBlock}`;
  return shell({ lang, path: `/contributors/${login}`, title: `@${login} · Impact Fund`, active: "contributors", body });
}


function challengesPage(lang, data, sponsors, ranking) {
  const pt = lang === "pt";
  const path = pt ? "/challenges" : "/challenges?lang=en";
  const list = (data && data.challenges) || [];
  const sp = sponsors || {};
  const rows = list
    .map((c) => {
      const phase = c.phase || "open";
      const pill =
        phase === "accepted"
          ? '<span class="pill warn">accepted</span>'
          : phase === "delivered"
            ? '<span class="pill ok">delivered</span>'
            : '<span class="pill">open</span>';
      const metrics =
        c.metrics_total > 0 ? c.metrics_done + "/" + c.metrics_total : "—";
      return `<tr>
        <td><a href="${esc(c.html_url)}" rel="noopener">${esc(c.title)}</a>
          <div class="mono muted">${esc(c.id)}</div></td>
        <td>${pill}</td>
        <td class="mono">${esc((pt ? c.budget_display_pt : c.budget_display_en) || c.budget_hint || "0 · sem financiamento")}</td>
        <td class="mono">${metrics}</td>
        <td>${(c.assignees || []).map((a) => "@" + esc(a)).join(", ") || '<span class="muted">—</span>'}</td>
      </tr>`;
    })
    .join("");
  const body = `
    <p class="kicker">${pt ? "problemas abertos · sem tesouraria V0" : "open problems · V0 has no treasury"}</p>
    <h1>${pt ? "Desafios de impacto" : "Impact challenges"}</h1>
    <p class="lead">${
      pt
        ? "Cada desafio permanece aberto até um contribuidor ou equipa aceitar e servir a solução contra métricas objectivas acordadas entre grantor e grantees. O grantor escolhe qual projecto/desafio financiar."
        : "Each challenge stays open until a contributor or team accepts and delivers against objective metrics agreed between grantor and grantees. The grantor chooses which project/challenge to fund."
    }</p>
    <div class="grid">
      <div class="stat-box"><div class="stat">${(data && data.open_count) != null ? data.open_count : list.length}</div><div class="stat-label">${pt ? "abertos" : "open"}</div></div>
      <div class="stat-box"><div class="stat">${(data && data.accepted_count) || 0}</div><div class="stat-label">${pt ? "aceites" : "accepted"}</div></div>
      <div class="stat-box"><div class="stat mono" style="font-size:.8rem">${(sp.user && sp.user.active) ? "live" : ((sp.user && sp.user.pending) ? "pending" : "—")}</div><div class="stat-label">@amcmorais</div></div>
      <div class="stat-box"><div class="stat mono" style="font-size:.8rem">${(sp.organization && sp.organization.active) ? "live" : ((sp.organization && sp.organization.pending) ? "pending" : "—")}</div><div class="stat-label">org</div></div>
    </div>
    <div class="actions">
      <a class="btn primary" href="${esc((sp && sp.preferred_url) || SPONSORS_URL)}" rel="noopener">GitHub Sponsors</a>
      <a class="btn" href="https://calhegasmorais.pt/pagamentos" rel="noopener">/pagamentos</a>
      <a class="btn" href="https://github.com/StrataMesh-Laboratory/stratamesh-impact-fund/issues/new?template=funded-problem.yml" rel="noopener">${pt ? "Abrir desafio" : "Open challenge"}</a>
    </div>
    ${sponsorsEmbedHtml(sp)}
    <p class="note">${esc((sp && sp.note) || "")}</p>
    <p class="note">${
      pt
        ? "Nenhum valor na coluna Orçamento é tesouraria. V0 não tem EUR depositado, pledged ou reservado. Estado honesto até um grantor depositar e o issue marcar Funded: true: 0 · sem financiamento."
        : "No figure in the Budget column is treasury. V0 has no deposited, pledged, or reserved EUR. Honest state until a grantor deposits and the issue marks Funded: true: 0 · no current funding yet."
    }</p>
    <div class="card" style="padding:0;overflow:auto">
      <table>
        <thead><tr>
          <th>${pt ? "Problema" : "Problem"}</th>
          <th>${pt ? "Fase" : "Phase"}</th>
          <th>${pt ? "Orçamento" : "Budget"}</th>
          <th>${pt ? "Métricas" : "Metrics"}</th>
          <th>${pt ? "Grantees" : "Grantees"}</th>
        </tr></thead>
        <tbody>${rows || `<tr><td colspan="5" class="muted">${pt ? "Sem desafios abertos." : "No open challenges."}</td></tr>`}</tbody>
      </table>
    </div>
    ${rankingSectionHtml(lang, ranking)}
    <div class="section">
      <h2>${pt ? "Como funciona" : "How it works"}</h2>
      <ol class="steps">
        <li>${pt ? "Grantor abre um Issue com métricas e financia via Sponsors ou /pagamentos (referência #issue)." : "Grantor opens an Issue with metrics and funds via Sponsors or /pagamentos (reference #issue)."}</li>
        <li>${pt ? "Contribuidor comenta /accept — desafio passa a aceite." : "Contributor comments /accept — challenge becomes accepted."}</li>
        <li>${pt ? "Entrega com evidência; grantor confirma métricas; issue fecha e o grant é libertado." : "Delivery with evidence; grantor confirms metrics; issue closes and the grant is released."}</li>
      </ol>
    </div>`;
  return shell({ lang, path, title: pt ? "Desafios · Impact Fund" : "Challenges · Impact Fund", active: "challenges", body });
}

function claimPage(lang, prefillLogin) {
  const pt = lang === "pt";
  const path = pt ? "/claim" : "/claim?lang=en";
  const body = `
    <p class="kicker">${pt ? "registo de perfil · V0" : "profile registration · V0"}</p>
    <h1>${pt ? "Reclamar perfil" : "Claim profile"}</h1>
    <p class="lead">${
      pt
        ? "Regista o teu login GitHub público e um email de contacto (preferência: domínio público). O grantor usa isto para desembolso. Sem OAuth nesta fase — verificação por existência do utilizador na API GitHub."
        : "Register your public GitHub login and a contact email (prefer public-domain). The grantor uses this for payout. No OAuth in this phase — verified via GitHub user API existence."
    }</p>
    <form id="claimForm" class="section">
      <label>GitHub login</label>
      <input name="github_login" required pattern="[A-Za-z0-9-]{1,39}" value="${esc(prefillLogin || "")}" placeholder="username"/>
      <label>Email</label>
      <input name="email" type="email" required placeholder="you@example.com"/>
      <label>${pt ? "Método de desembolso preferido" : "Preferred payout method"}</label>
      <select name="payout_method">
        <option value="registered_account">registered_account (Wise / IBAN opaque id)</option>
        <option value="prepaid_card">prepaid_card (grantor ships to email)</option>
      </select>
      <label>${pt ? "Notas (opcional)" : "Notes (optional)"}</label>
      <input name="notes" maxlength="200" placeholder="${pt ? "ex. Wise tag" : "e.g. Wise tag"}"/>
      <div class="actions">
        <button class="btn primary" type="submit">${pt ? "Submeter claim" : "Submit claim"}</button>
      </div>
      <p id="claimMsg" class="muted"></p>
    </form>
    <p class="note">${pt ? "O operador AMCM usa /pagamentos — não precisa deste formulário." : "Operator AMCM uses /pagamentos — no need for this form."}</p>
    <script>
    document.getElementById('claimForm').addEventListener('submit', async function(e){
      e.preventDefault();
      var fd=new FormData(e.target);
      var body={github_login:fd.get('github_login'),email:fd.get('email'),payout_method:fd.get('payout_method'),notes:fd.get('notes')};
      var msg=document.getElementById('claimMsg');
      msg.textContent='…'; msg.className='muted';
      try{
        var r=await fetch('/api/v1/claim',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
        var j=await r.json();
        if(r.ok && j.ok){ msg.className='okmsg'; msg.textContent=${pt ? "'Claim registado: '" : "'Claim registered: '"}+(j.github_login||'')+' · '+ (j.status||''); }
        else { msg.className='err'; msg.textContent=(j && (j.error||j.message)) || ('HTTP '+r.status); }
      }catch(err){ msg.className='err'; msg.textContent=String(err.message||err); }
    });
    </script>`;
  return shell({ lang, path, title: pt ? "Reclamar · Impact Fund" : "Claim · Impact Fund", active: "claim", body });
}

async function handleClaim(env, body) {
  const login = String(body.github_login || body.login || "")
    .trim()
    .replace(/^@/, "");
  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  const payout_method = body.payout_method === "prepaid_card" ? "prepaid_card" : "registered_account";
  if (!/^[A-Za-z0-9-]{1,39}$/.test(login)) return { error: "invalid_github_login", status: 400 };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "invalid_email", status: 400 };
  if (login.toLowerCase() === OPERATOR.github_login) {
    return { error: "operator_uses_pagamentos", status: 400, widget_url: OPERATOR.widget_url };
  }
  // verify GitHub user exists
  const res = await fetch(`https://api.github.com/users/${encodeURIComponent(login)}`, { headers: ghHeaders(env) });
  if (res.status === 404) return { error: "github_user_not_found", status: 404 };
  if (!res.ok) return { error: "github_lookup_failed", status: 502, http: res.status };
  const user = await res.json();
  if (!env.FUND_KV) return { error: "kv_not_bound", status: 503 };

  const record = {
    github_login: user.login,
    github_user_id: user.id,
    avatar_url: user.avatar_url,
    profile_url: user.html_url,
    email_domain: email.split("@")[1] || null,
    // store email hashed-ish lightly for grantor — V0 stores full email in KV (operator-only access path later)
    email,
    payout_method,
    notes: String(body.notes || "").slice(0, 200),
    status: "pending_review",
    claimed_at: new Date().toISOString(),
  };
  await kvPut(env, "claim:" + String(user.login).toLowerCase(), record);
  return {
    ok: true,
    github_login: user.login,
    github_user_id: user.id,
    status: "pending_review",
    payout_method,
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let path = url.pathname.replace(/\/+$/, "") || "/";
    const lang = resolveLang(url, path);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    if (path === "/api/v1/health" || path === "/health") {
      const sp = await sponsorsStatus(env);
      const ch = await listChallenges(env);
      return json({
        ok: true,
        service: "stratamesh-fund",
        version: VERSION,
        phase: "v0-sponsors-challenges",
        github_token_bound: !!env.GITHUB_TOKEN,
        kv_bound: !!env.FUND_KV,
        principle: "GitHub is the evidence layer; the Fund stratifies capital into open measurable challenges; Sponsors + ENI are the payment rails.",
        sponsors: {
          active: sp.active,
          preferred_url: sp.preferred_url,
          preferred_login: sp.preferred_login,
          user: sp.user,
          organization: sp.organization,
        },
        challenges: { open: ch.open_count, accepted: ch.accepted_count, total_listed: ch.challenges.length },
        treasury: false,
        envelope_rule: ch.envelope_rule,
        operator_payout: { login: OPERATOR.github_login, method: OPERATOR.method, widget_url: OPERATOR.widget_url },
      });
    }

    if (path === "/api/v1/repositories") {
      return json({
        organization: ORG,
        repositories: REPOS.map((r) => ({ ...r, url: `https://github.com/${r.owner}/${r.name}` })),
      });
    }

    if (path === "/api/v1/payout-methods") {
      return json({
        methods: [
          {
            id: "eni_pagamentos",
            who: "operator",
            operational: true,
            widget_url: OPERATOR.widget_url,
          },
          {
            id: "registered_account",
            who: "contributor_after_claim",
            operational: true,
            description: "POST /api/v1/claim then grantor uses registered details",
          },
          {
            id: "prepaid_card",
            who: "grantor_choice",
            operational: true,
            description: "Grantor ships prepaid to claimed email",
          },
        ],
      });
    }

    if (path === "/api/v1/prepaid-providers") {
      return json({ providers: PREPAID });
    }

    if (path === "/api/v1/methodology/current") {
      return json(METHODOLOGY);
    }

    if (path === "/api/v1/epochs") {
      const data = await discoverContributors(env);
      const live = {
        id: "live-evidence",
        status: "open",
        frozen: false,
        as_of: new Date().toISOString(),
        aggregate: data.aggregate,
        note: "Not a grant epoch — live evidence snapshot only.",
      };
      return json({ epochs: [live] });
    }

    if (path === "/api/v1/contributors") {
      const data = await contributorsWithSummaries(env);
      return json({
        phase: "v0-operational",
        aggregate: data.aggregate,
        contributors: data.contributors,
      });
    }

    if (path.startsWith("/api/v1/contributors/")) {
      const key = decodeURIComponent(path.split("/").pop());
      const data = await contributorsWithSummaries(env);
      const found = data.contributors.find(
        (c) => String(c.github_login).toLowerCase() === key.toLowerCase() || String(c.github_user_id) === key,
      );
      if (!found) return json({ error: "not_found", github_login: key }, 404);
      return json(found);
    }

    if (path === "/api/v1/ranking" || path === "/api/v1/challenge-ranking") {
      const ranking = await buildRanking(env);
      return json(ranking);
    }

    if (path === "/api/v1/claim" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const result = await handleClaim(env, body);
      const status = result.status && result.status >= 400 ? result.status : result.ok ? 200 : 400;
      const { status: _s, ...rest } = result;
      return json(rest, status >= 400 ? status : 200);
    }

    
    if (path === "/api/v1/sponsors") {
      const sp = await sponsorsStatus(env);
      return json(sp);
    }

    if (path === "/api/v1/challenges") {
      const ch = await listChallenges(env);
      return json(ch);
    }

    if (path === "/api/v1/challenges/" || path.startsWith("/api/v1/challenges/")) {
      const ch = await listChallenges(env);
      const key = decodeURIComponent(path.replace(/^\/api\/v1\/challenges\/?/, ""));
      if (!key) return json(ch);
      const found = ch.challenges.find((c) => c.id === key || String(c.number) === key || c.id.endsWith("#" + key));
      if (!found) return json({ error: "not_found", key }, 404);
      return json(found);
    }

    if (path === "/api/v1/claims") {
      const claims = await kvListClaims(env);
      // redact emails in public list
      return json({
        claims: claims.map((c) => ({
          github_login: c.github_login,
          github_user_id: c.github_user_id,
          status: c.status,
          payout_method: c.payout_method,
          email_domain: c.email_domain,
          claimed_at: c.claimed_at,
        })),
      });
    }

    // pages
    if (path === "/" || path === "/pt") {
      const [data, sp] = await Promise.all([discoverContributors(env), sponsorsStatus(env)]);
      return html(homePage("pt", data.aggregate, sp));
    }
    if (path === "/en") {
      const [data, sp] = await Promise.all([discoverContributors(env), sponsorsStatus(env)]);
      return html(homePage("en", data.aggregate, sp));
    }
    if (path === "/contributors") {
      const data = await contributorsWithSummaries(env);
      return html(contributorsPage(lang, data));
    }
    if (path.startsWith("/contributors/")) {
      const key = decodeURIComponent(path.split("/").pop() || "");
      const data = await contributorsWithSummaries(env);
      let found = data.contributors.find((c) => c.github_login.toLowerCase() === key.toLowerCase());
      if (!found && key.toLowerCase() === "amcmorais") {
        found = data.contributors.find((c) => c.github_login === OPERATOR.github_login);
      }
      if (!found) {
        return html(
          shell({
            lang,
            path: `/contributors/${key}`,
            title: "404 · Impact Fund",
            active: "contributors",
            body: `<h1>404</h1><p class="muted">@${esc(key)}</p><a class="btn" href="/contributors">Back</a>`,
          }),
          404,
        );
      }
      return html(detailPage(lang, found));
    }
    
    if (path === "/challenges") {
      const [data, sp] = await Promise.all([listChallenges(env), sponsorsStatus(env)]);
      const ranking = await buildRanking(env, data);
      return html(challengesPage(lang, data, sp, ranking));
    }
    if (path === "/claim") {
      return html(claimPage(lang, url.searchParams.get("login") || ""));
    }
    if (path === "/robots.txt") {
      return new Response("User-agent: *\nAllow: /\n", { headers: { "Content-Type": "text/plain" } });
    }
    return json({ error: "not_found", path }, 404);
  },
};
