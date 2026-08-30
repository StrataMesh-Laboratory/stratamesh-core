async function serveEni(env) {
  try {
    if (env.LEDGER || env.DB) {
      const db = env.LEDGER || env.DB;
      const { results: chunks } = await db.prepare(
        "SELECT idx, value FROM site_content_chunks WHERE key = ? ORDER BY idx ASC"
      ).bind("eni").all();
      if (chunks && chunks.length) {
        const html = chunks.map((c) => c.value || "").join("");
        return htmlPage(html, {
          "Cache-Control": "public, max-age=120",
          "X-ENI-Source": "site_content_chunks",
        });
      }
    }
  } catch (e) {
    console.error("eni LEDGER", e);
  }
  try {
    const r = await fetch("https://stratamesh-eni.stratamesh.workers.dev/");
    if (r.ok) return new Response(await r.text(), {
      headers: { "Content-Type": "text/html; charset=utf-8", "X-ENI-Source": "worker" },
    });
  } catch (_) {}
  return new Response(
    "<!DOCTYPE html><html lang=pt-PT><head><meta charset=UTF-8><title>AMCM ENI</title></head><body style=\"background:#0a0a0b;color:#e8e6e3;font-family:sans-serif;padding:2rem\"><h1>AMCM ENI</h1><p>Página da entidade legal temporariamente indisponível. Contacto: amcmorais@icloud.com</p><p><a href=\"https://calhegasmorais.pt/\" style=\"color:#c4b5a0\">Nó CMN</a></p></body></html>",
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

const TRANSCRITO_PT = "Calhegas Morais \u00b7 N\u00f3 de refer\u00eancia StrataMesh\nCalhegas Morais\n\u00b7 N\u00f3 CMN\nPT\n/\nEN\n00 Mapa\n01 Rede\n02 Valor\n03 N\u00f3\n04 Quem\n05 Arquitectura\n06 Estado\n07 Entrar\nLaborat\u00f3rio \u00b7 Lisboa, Portugal\nCalhegas Morais\nPorta de entrada p\u00fablica do\nN\u00f3 Fog Calhegas Morais\n\u2014 n\u00f3 de refer\u00eancia da\nStrataMesh\n, uma rede de registo distribu\u00eddo orientada a contributo real, mercado aberto e um sistema operativo de metaverso Web3.\nAbrir portal\nComo ler esta p\u00e1gina\nTempo CLP\n00 \u00b7 Orienta\u00e7\u00e3o\nComo est\u00e1 organizada esta p\u00e1gina\nSe nunca ouviu falar de StrataMesh, leia nesta ordem. Cada caixa \u00e9 um tema separado \u2014 clique para saltar.\n01\nRede\nO que \u00e9 a StrataMesh e para que serve\n02\nValor\nSTRATA, contributo e a \u00c1gora\n03\nEste n\u00f3\nO que o Calhegas Morais faz na rede\n04\nParticipantes\nPessoas e agentes computacionais\n05\nArquitectura\nCamadas hol\u00f3nicas e tempo CLP\n06\u201307\nEstado e entrada\nLaborat\u00f3rio e como aceder ao portal\n01 \u00b7 A rede\nO que \u00e9 a StrataMesh?\nA StrataMesh \u00e9 uma\ntecnologia de registo distribu\u00eddo (TRD \u2014 Tecnologia de Registo Distribu\u00eddo)\n: um livro-raz\u00e3o partilhado por muitos n\u00f3s, sem depender de um \u00fanico servidor central.\nDiferencia-se de blockchains cl\u00e1ssicas em pontos essenciais:\nEstrutura\nUsa um\ngrafo dirigido ac\u00edclico (GDA)\n: estrutura em rede onde v\u00e1rios ramos podem avan\u00e7ar em paralelo e reconciliar-se pelas regras do protocolo.\nIncentivo\nN\u00e3o se \u201cmina\u201d com desperd\u00edcio energ\u00e9tico artificial. O valor nasce de\nrecursos reais\nque os n\u00f3s disponibilizam \u00e0 rede e da troca livre no mercado.\nTRD = tecnologia de registo distribu\u00eddo. GDA = grafo dirigido ac\u00edclico. S\u00e3o nomes t\u00e9cnicos para \u00ablivro partilhado\u00bb e \u00abestrutura em rede sem ciclos\u00bb, respectivamente.\n02 \u00b7 Valor na rede\nSTRATA, contributo e \u00c1gora\nTr\u00eas ideias ligadas \u2014 conv\u00e9m n\u00e3o as misturar.\nSTRATA\n\u00c9 a\nunidade de conta\nda StrataMesh: serve para pagar custos de subsist\u00eancia na rede, recompensar contributo e liquidar trocas. A emiss\u00e3o nova ocorre apenas quando n\u00f3s contribuem recursos mensur\u00e1veis (PdC).\nProva de contributo (PdC)\nProva de Contributo (PdC)\n: um n\u00f3 recebe STRATA nova quando\ncontribui recursos mensur\u00e1veis\npara a rede \u2014 armazenamento, capacidade de processamento, disponibilidade e qualidade do servi\u00e7o.\nA quantidade e o valor seguem o\npre\u00e7o de mercado dos recursos no mundo exterior\n, convertidos em STRATA pela taxa observada na \u00c1gora, com pr\u00e9mios ou descontos conforme a\nqualidade\ndo contributo.\n\u00c1gora\nA \u00c1gora \u00e9 o\nmercado de c\u00e2mbio entre pares (P2P)\nda rede: quem det\u00e9m STRATA troca-a por outras moedas ou activos. \u00c9 o\nlugar onde a STRATA encontra pre\u00e7o\nface ao exterior.\nCria\u00e7\u00e3o\nSTRATA entra em circula\u00e7\u00e3o sobretudo quando h\u00e1 contributo real (PdC), n\u00e3o por emiss\u00e3o discricion\u00e1ria.\nCircula\u00e7\u00e3o\nQuem precisa de recursos da rede paga em STRATA (incluindo a prova de subsist\u00eancia dos agentes). Quem tem STRATA pode vend\u00ea-la na \u00c1gora.\n03 \u00b7 Este s\u00edtio\nO que \u00e9 o N\u00f3 Calhegas Morais?\n\u00c9 um\nn\u00f3 Fog de refer\u00eancia\nda StrataMesh, operado a partir de Lisboa. \u201cFog\u201d significa capacidade na periferia da rede (perto de utilizadores e dispositivos), n\u00e3o s\u00f3 num centro de dados remoto.\nNesta fase de laborat\u00f3rio, o n\u00f3:\nExp\u00f5e servi\u00e7os\nPortal, autentica\u00e7\u00e3o, orquestra\u00e7\u00e3o, registo GDA, mercado e ferramentas de diagn\u00f3stico \u2014 em ambiente de teste.\nContribui recursos\nOs recursos que este n\u00f3 efectivamente disponibiliza \u00e0 TRD entram no circuito de PdC, com pre\u00e7os alinhados ao mercado.\nIdentificador de laborat\u00f3rio:\nFOG-NODE-PT-CM-001\n\u00b7 operador: Andr\u00e9 Manuel Calhegas Morais.\n04 \u00b7 Participantes\nPessoas e agentes computacionais\nNa StrataMesh, o\nstanding\n(direito a actuar) vem da\nfun\u00e7\u00e3o e do acordo\n, n\u00e3o do tipo de substrato (biol\u00f3gico vs sil\u00edcio).\nUtilizadores\nPessoas que se registam no portal, det\u00eam carteiras, trocam na \u00c1gora, criam conte\u00fado na bancada CGU e participam em DAO.\nSCA (agentes)\nSeres Computacionais Aut\u00f3nomos\n\u2014 agentes com identidade pr\u00f3pria no registo, fun\u00e7\u00f5es no n\u00f3 (orquestra\u00e7\u00e3o, seguran\u00e7a, an\u00e1lise\u2026) e obriga\u00e7\u00f5es de subsist\u00eancia em STRATA.\nO\nOrquestrador\ndeste n\u00f3 \u00e9 um SCA: coordena a equipa de opera\u00e7\u00f5es (AIOps), mant\u00e9m pol\u00edtica e contexto, e pode dialogar no portal conforme o\nclearance\nda conta (p\u00fablico \u2192 confidencial \u2192 secreto \u2192 m\u00e1ximo).\n05 \u00b7 Arquitectura\nCamadas hol\u00f3nicas e tempo CLP\nA arquitectura \u00e9 uma\npilha aninhada\n: cada n\u00edvel cont\u00e9m o n\u00edvel seguinte, do livro-raz\u00e3o at\u00e9 ao agente.\nTRD StrataMesh\n\u2014 livro-raz\u00e3o partilhado; tempo CLP/PPC embutido em todo o fluxo\n\u2514\nN\u00f3\n\u2014 m\u00e1quina e sistema operativo do anfitri\u00e3o\n\u2514\nSO do Metaverso Web3\n\u2014 sistema operativo partilhado entre n\u00f3s\n\u2514\nDom\u00ednio Virtual\n\u2014 infraestrutura (hipervisor): organiza e isola capacidade computacional para mundos\n\u2514\nMundo Aberto\n\u2014 ambiente persistente a que utilizadores e SCA acedem\n\u2514\nBancada CGU\n\u2014 espa\u00e7o isolado de cria\u00e7\u00e3o de conte\u00fado (+ Painel / Portal)\n\u2514\nUtilizador | SCA\nDom\u00ednio Virtual\nCamada de\ninfraestrutura\n: hipervisor que aloca, isola e governa a capacidade onde os\nMundos Abertos\ns\u00e3o hospedados.\nBancada CGU\nEspa\u00e7o\nisolado\nde cria\u00e7\u00e3o e ensaio de conte\u00fado gerado pelo utilizador, dentro de um Mundo Aberto. O\nPainel\ne o portal s\u00e3o aplica\u00e7\u00f5es neste n\u00edvel.\nO\nPainel\n\u00e9 a superf\u00edcie de aplica\u00e7\u00f5es da Bancada CGU. O\nCLP\n\u00e9 o kernel temporal da TRD \u2014 acompanha e data o fluxo em todas as camadas.\nCalend\u00e1rio Lunisolar Planet\u00e1rio (CLP)\nO tempo civil de refer\u00eancia na rede baseia-se em \u00e2ncoras astron\u00f3micas e localidade (matriz\nPPC\n). O ISO-8601 serve de\nportadora\nt\u00e9cnica; a autoridade civil no protocolo \u00e9 planet\u00e1ria.\nAbrir a interface CLP \u2192\n06 \u00b7 Laborat\u00f3rio\nEstado actual do projecto\nEste dom\u00ednio corre uma\nvers\u00e3o de laborat\u00f3rio\n: servi\u00e7os em Cloudflare Workers, registo GDA, orquestrador h\u00edbrido, bus hol\u00f3nico e portal com pain\u00e9is distintos para utilizador comum e pessoal (capacidades conforme clearance).\na verificar servi\u00e7os\u2026\nNada aqui constitui conselho financeiro. STRATA e a \u00c1gora, nesta fase, s\u00e3o mecanismos de protocolo em ensaio \u2014 n\u00e3o um produto banc\u00e1rio.\n07 \u00b7 Entrar\nPortal, documenta\u00e7\u00e3o e c\u00f3digo\nUtilizador comum\nRegisto / login no portal: carteira, \u00c1gora, economia, bancada, SCA, orquestrador (leitura) e perfil.\nPessoal\nLogin staff com 2FA: tudo o do comum, mais KYC, utilizadores, sistema e vistas de SO conforme clearance.\nPortal / painel\nC\u00f3digo (GitHub)\nEstado dos servi\u00e7os\nCalhegas Morais Node \u00b7 StrataMesh TRD \u00b7 laborat\u00f3rio\nFOG-NODE-PT-CM-001 \u00b7 Lisboa \u00b7 standing por fun\u00e7\u00e3o e acordo, n\u00e3o por substrato\nAMCM ENI\n\u2014 entidade legal do titular \u00b7\n/eni";


function accessNoticePage(reason, detail) {
  const body = `<!DOCTYPE html>
<html lang="pt-PT">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Aviso de acesso · Calhegas Morais</title>
<style>
body{font-family:system-ui,sans-serif;background:#0a0a0b;color:#e8e6e3;line-height:1.6;max-width:42rem;margin:0 auto;padding:2rem 1.25rem}
h1{font-size:1.35rem;font-weight:600}
.box{border:1px solid #2a2a2e;border-radius:6px;padding:1rem 1.1rem;margin:1.25rem 0;background:#111}
.muted{color:#8a8780;font-size:.92rem}
pre{white-space:pre-wrap;font-family:ui-monospace,monospace;font-size:.78rem;color:#c4b5a0;background:#111;border:1px solid #1c1c1f;padding:1rem;border-radius:4px;max-height:70vh;overflow:auto}
a{color:#c4b5a0}
</style>
</head>
<body>
<h1>Aviso de acesso</h1>
<div class="box">
<p><strong>Motivo:</strong> ${reason}</p>
<p class="muted">${detail}</p>
<p class="muted">O conteúdo público continua disponível abaixo em texto simples (transcrito estático da página principal).</p>
</div>
<p><a href="/">Tentar a página completa</a> · <a href="/transcrito">Só o transcrito</a> · <a href="https://eni.calhegasmorais.pt/">AMCM ENI</a></p>
<h2>Transcrito estático</h2>
<pre>${TRANSCRITO_PT.replace(/</g,'&lt;')}</pre>
</body>
</html>`;
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=120',
      'X-Robots-Tag': 'noindex',
      'X-Access-Notice': '1',
    },
  });
}

function plainTranscript() {
  const text =
    'Calhegas Morais · StrataMesh — transcrito estático (PT-PT)\\n' +
    '================================================\\n\\n' +
    TRANSCRITO_PT +
    '\\n\\n---\\nFonte: calhegasmorais.pt · modo texto para acesso restrito / leitores automáticos\\n';
  return new Response(text, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}


/** Free-tier security headers applied to HTML responses from this worker. */
function withSecurityHeaders(headers) {
  const h = new Headers(headers || {});
  if (!h.has("X-Content-Type-Options")) h.set("X-Content-Type-Options", "nosniff");
  if (!h.has("X-Frame-Options")) h.set("X-Frame-Options", "SAMEORIGIN");
  if (!h.has("Referrer-Policy")) h.set("Referrer-Policy", "strict-origin-when-cross-origin");
  if (!h.has("Permissions-Policy")) {
    h.set("Permissions-Policy", "geolocation=(self), microphone=(), camera=(), payment=()");
  }
  if (!h.has("Cross-Origin-Opener-Policy")) h.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  // CSP: allow Cloudflare, Workers AI-ish CDN, fonts, same-origin APIs
  if (!h.has("Content-Security-Policy")) {
    h.set(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com https://challenges.cloudflare.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' data: blob: https:",
        "connect-src 'self' https://*.stratamesh.workers.dev https://*.calhegasmorais.pt https://api.cloudflare.com https://api.bigdatacloud.net https://challenges.cloudflare.com",
        "frame-src 'self' https://challenges.cloudflare.com",
        "base-uri 'self'",
        "form-action 'self'",
      ].join("; ")
    );
  }
  return h;
}

function htmlResponse(body, init) {
  init = init || {};
  const headers = withSecurityHeaders(init.headers || { "Content-Type": "text/html; charset=utf-8" });
  if (!headers.has("Content-Type")) headers.set("Content-Type", "text/html; charset=utf-8");
  return new Response(body, { status: init.status || 200, headers });
}

function htmlPage(html, extra, status) {
  const headers = withSecurityHeaders({
    "Content-Type": "text/html; charset=utf-8",
    ...(extra || {}),
  });
  return new Response(html, { status: status || 200, headers });
}


function newPulseId() {
  const iso = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  return 'pulse-' + iso + '-' + Math.random().toString(36).slice(2, 8);
}

function originOrchHealth() {
  return {
    status: 'ok',
    service: 'stratamesh-orchestrator',
    origin: 'calhegasmorais.pt',
    version: 'origin-orch-chat-1.1.1-nofog',
    node_id: 'FOG-NODE-PT-CM-001',
    sca_id: 'SCA-ORCH-CMN-001',
    lab: true,
    endpoints: ['POST /api/orchestrator/chat', 'GET /api/v1/orchestrator/health'],
  };
}

function originOrchFallback(message, extra) {
  const msg = String(message || '').trim();
  const pulse_id = newPulseId();
  const reply = msg
    ? ('Orquestrador CMN (lab, origem calhegasmorais.pt). Recebi: «' + msg.slice(0, 280) + '». SCA-ORCH-CMN-001 · FOG-NODE-PT-CM-001 · n=1 · mesh_member=false · oracle_live=false. Clearance público. Não invento o que o runtime não observa.')
    : 'Orquestrador CMN (lab, origem calhegasmorais.pt). Pulso vazio aceite. FOG-NODE-PT-CM-001 · SCA-ORCH-CMN-001 · n=1.';
  return Object.assign({
    reply,
    clearance: 'public',
    account_clearance: 'public',
    pulse_id,
    role: 'orchestrator',
    lab: true,
    node_id: 'FOG-NODE-PT-CM-001',
    source: (extra && extra.source) || 'origin-orch-fallback',
  }, extra && extra.error ? { error: extra.error } : {});
}

function enrichOrchPayload(obj, fallbackMsg) {
  if (!obj || typeof obj !== 'object') return originOrchFallback(fallbackMsg, { source: 'origin-orch-nonobject' });
  const out = Object.assign({}, obj);
  if (!out.reply || !String(out.reply).trim()) {
    out.reply = originOrchFallback(fallbackMsg, { source: 'origin-orch-empty-reply' }).reply;
  }
  if (!out.clearance) out.clearance = out.account_clearance || 'public';
  if (!out.pulse_id) out.pulse_id = newPulseId();
  return out;
}

function abortAfter(ms) {
  const c = new AbortController();
  const t = setTimeout(() => { try { c.abort(); } catch (_) {} }, ms);
  return { signal: c.signal, cancel() { clearTimeout(t); } };
}

async function withTimeout(promise, ms, label) {
  let t;
  const timeout = new Promise((_, rej) => {
    t = setTimeout(() => {
      const e = new Error(label + '_timeout');
      e.name = 'AbortError';
      rej(e);
    }, ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(t);
  }
}

async function probeFogHealth1500() {
  const a = abortAfter(1500);
  try {
    const r = await withTimeout(fetch('https://fog.calhegasmorais.pt/health', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: a.signal,
    }), 1500, 'fog_health');
    const text = await r.text();
    let obj = null;
    try { obj = JSON.parse(text); } catch (_) {}
    return {
      ok: !!(obj && (obj.ok === true || obj.status === 'ok')),
      http: r.status,
      version: obj && obj.version,
      mesh_member: !!(obj && obj.mesh_member),
      oracle_live: !!(obj && obj.oracle_live),
      tx_count: obj && obj.tx_count,
      node_id: (obj && obj.node_id) || 'FOG-NODE-PT-CM-001',
    };
  } catch (e) {
    return {
      ok: false,
      error: String(e && e.name ? e.name : e).slice(0, 80),
      mesh_member: false,
      oracle_live: false,
    };
  } finally {
    a.cancel();
  }
}

async function tryOrch1500(env, request, body, msg) {
  if (!(env.ORCH && typeof env.ORCH.fetch === 'function')) {
    return { ok: false, source: 'origin-orch-no-binding' };
  }
  const a = abortAfter(1500);
  try {
    const initHeaders = { 'Content-Type': 'application/json', Accept: 'application/json' };
    const auth = request.headers.get('Authorization');
    if (auth) initHeaders.Authorization = auth;
    const xc = request.headers.get('X-Clearance');
    if (xc) initHeaders['X-Clearance'] = xc;
    const payload = Object.assign({}, body, { message: msg || 'lab pulse' });
    const req = new Request('https://orchestrator.internal/chat', {
      method: 'POST',
      headers: initHeaders,
      body: JSON.stringify(payload),
    });
    const resp = await withTimeout(env.ORCH.fetch(req), 1500, 'orch_fetch');
    const text = await resp.text();
    let obj = null;
    try { obj = JSON.parse(text); } catch (_) {}
    return { ok: true, obj, status: resp.status, source: 'origin-orch-binding' };
  } catch (e) {
    return {
      ok: false,
      source: 'origin-orch-timeout',
      error: String(e && e.name ? e.name : e).slice(0, 120),
    };
  } finally {
    a.cancel();
  }
}

/** Origin POST /api/orchestrator/chat + GET health. AbortSignal 1500ms. Never workers.dev. */
async function originOrchChat(request, env, corsHeaders, restPath) {
  const url = new URL(request.url);
  const path = restPath != null ? restPath : (url.pathname || '/');
  const headers = Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  }, corsHeaders || {});
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (request.method === 'GET' || request.method === 'HEAD') {
    const payload = Object.assign(originOrchHealth(), {
      methods: ['GET', 'POST', 'OPTIONS'],
      pulse_id: newPulseId(),
      body: { message: 'string' },
    });
    if (request.method === 'HEAD') {
      return new Response(null, { status: 200, headers });
    }
    return new Response(JSON.stringify(payload), { status: 200, headers });
  }

  let body = {};
  try { body = await request.json(); } catch (_) { body = {}; }
  const msg = (body && (body.message || body.text || body.prompt)) || '';

  // Lab n=1: do not await Fog /health (workerd hop ~400ms). Honest constants already on the pulse.
  let fog = {
    skipped: true,
    ok: false,
    http: 0,
    mesh_member: false,
    oracle_live: false,
    node_id: 'FOG-NODE-PT-CM-001',
    reason: 'fog_health_not_awaited',
  };
  let orch = { ok: false };
  try {
    orch = await tryOrch1500(env, request, body, msg);
  } catch (e) {
    orch = {
      ok: false,
      source: 'origin-orch-race-error',
      error: String(e && e.message ? e.message : e).slice(0, 180),
    };
  }

  if (orch.ok && orch.obj && typeof orch.obj === 'object') {
    const enriched = enrichOrchPayload(orch.obj, msg);
    enriched.fog = fog;
    enriched.version = 'origin-orch-chat-1.1.0';
    return new Response(JSON.stringify(enriched), { status: 200, headers });
  }

  const timedOut = orch.source === 'origin-orch-timeout' || (orch.error && /AbortError|timeout/i.test(String(orch.error)));
  const fb = originOrchFallback(msg || 'lab pulse', {
    source: orch.source || 'origin-orch-local',
    error: orch.error,
  });
  fb.fog = fog;
  fb.version = 'origin-orch-chat-1.1.0';
  if (timedOut) fb.pulse_id = 'unknown';
  return new Response(JSON.stringify(fb), { status: 200, headers });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Max-Age': '86400'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Morais family heraldry — site icons (embedded + R2)
    const ICON_EMBED = {
      "/favicon-32.png": {
            "type": "image/png",
            "b64": "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"
      },
      "/favicon.png": {
            "type": "image/png",
            "b64": "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"
      },
      "/favicon.svg": {
            "type": "image/svg+xml",
            "b64": "PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNTYgMjU2IiBmaWxsPSJub25lIj4KICA8cGF0aCBmaWxsPSIjYjcxYzFjIiBkPSJNMTI4IDEwIEMxMjggMTAgMjMwIDI4IDIzMCAyOCBMMjMyIDEwOCBDMjMyIDE3NiAxMjggMjQ2IDEyOCAyNDYgQzEyOCAyNDYgMjQgMTc2IDI0IDEwOCBMMjYgMjggWiIvPgogIDxwYXRoIGZpbGw9IiMxZTRhOGMiIGQ9Ik00MCAxNTggQzcwIDE1MCAxMDAgMTY2IDEyOCAxNTggQzE1NiAxNTAgMTg2IDE2NiAyMTYgMTU4IEwyMjAgMjAwIEMxODAgMjMwIDEyOCAyNDIgMTI4IDI0MiBDMTI4IDI0MiA3NiAyMzAgMzYgMjAwIFoiLz4KICA8cGF0aCBmaWxsPSIjZjRmMGU2IiBkPSJNNDggMTc2IEM3OCAxNjggMTA4IDE4NCAxMjggMTc2IEMxNDggMTY4IDE3OCAxODQgMjA4IDE3NiBMMjEyIDE5MiBDMTgwIDE4NiAxNTAgMTc0IDEyOCAxODIgQzEwNiAxOTAgNzYgMTc4IDQ0IDE4OCBaIi8+CiAgPHBhdGggZmlsbD0iIzFlNGE4YyIgZD0iTTQ0IDE5NCBDNzYgMTg2IDEwNiAyMDAgMTI4IDE5MiBDMTUwIDE4NCAxODAgMTk4IDIxMiAxOTAgTDIxNiAyMTAgQzE3NiAyMjggMTI4IDIzOCAxMjggMjM4IEMxMjggMjM4IDgwIDIyOCA0MCAyMTAgWiIvPgogIDxwYXRoIGZpbGw9IiNmNGYwZTYiIHN0cm9rZT0iIzFhMTIwYyIgc3Ryb2tlLXdpZHRoPSIzIiBkPSJNOTIgNDggaDE2IHYxNCBoMTYgVjQ4IGgxNiB2MTQgaDE2IFY0OCBoMTYgdjI4IEg5MiBaIi8+CiAgPHJlY3QgeD0iOTIiIHk9IjcyIiB3aWR0aD0iNzIiIGhlaWdodD0iODgiIGZpbGw9IiNmNGYwZTYiIHN0cm9rZT0iIzFhMTIwYyIgc3Ryb2tlLXdpZHRoPSIzIi8+CiAgPHJlY3QgeD0iMTA2IiB5PSI4OCIgd2lkdGg9IjE0IiBoZWlnaHQ9IjE4IiBmaWxsPSIjMWExMjBjIi8+CiAgPHJlY3QgeD0iMTM2IiB5PSI4OCIgd2lkdGg9IjE0IiBoZWlnaHQ9IjE4IiBmaWxsPSIjMWExMjBjIi8+CiAgPHBhdGggZmlsbD0iIzFhMTIwYyIgZD0iTTExOCAxMzAgaDIwIHYzMCBoLTIwIHogTTExOCAxMzAgYTEwIDEwIDAgMCAxIDIwIDAiLz4KICA8cGF0aCBmaWxsPSJub25lIiBzdHJva2U9IiMxYTEyMGMiIHN0cm9rZS13aWR0aD0iNCIgZD0iTTEyOCAxMCBDMTI4IDEwIDIzMCAyOCAyMzAgMjggTDIzMiAxMDggQzIzMiAxNzYgMTI4IDI0NiAxMjggMjQ2IEMxMjggMjQ2IDI0IDE3NiAyNCAxMDggTDI2IDI4IFoiLz4KPC9zdmc+Cg=="
      },
      "/apple-touch-icon.png": {
            "type": "image/png",
            "b64": "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"
      },
      "/apple-touch-icon-precomposed.png": {
            "type": "image/png",
            "b64": "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"
      },
      "/icon-192.png": {
            "type": "image/png",
            "b64": "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"
      },
      "/icon-512.png": {
            "type": "image/png",
            "b64": "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"
      },
      "/favicon.ico": {
            "type": "image/x-icon",
            "b64": "AAABAAEAEBAAAAAAIAAYAwAAFgAAAIlQTkcNChoKAAAADUlIRFIAAAAQAAAAEAgGAAAAH/P/YQAAAt9JREFUeJx9k01onFUUhp9z7/1+mplMkkkyyczQ2haqtaBSFxUVdGG30tKVglClFIUi1l8Ei1UpunPpQsSFblwIKkEDoiI1VurCwUHTVmgT0o4phEmT+flmMnO/e11MaqQU39XhnPccznk5r3AbKK10XptMOTAlAan1ba2e2rZLXXorVwDGA5N9cNvQI0Vj7t1uzANF7+8bF7VrWCsAmmlK3fuFZZHfr1p7ftna6i+d5Gy9b1sC8Pbk5HeHMpnHGs4h1tLMj9HLZvH9nsWDRKEJG02Gb6zhjSGnFF+129+fXlk5aBCRCa2LK9Z2ExGCTte0d+5Q7dK0YvWGwTqYLpBduupYvu76mYzdsJYJrYuIiAFwgBGJNbggClRy7W/2nDxB7D0CJN5z+ZU31EgQKgfKiCh3Uy8RxEDkNxPWpuTHRlnznniqQFiYpAHkx0ax6UBDDxiIRBAjgAbzr6wejDFcmL+AtNqkLuXytRp3GbPZOoAGI4BxzrtL1s7eHYbP4b1VWoX1tXWOHTtKLooAYS1JmP3kM8aVIQUbiISXrJ11zjsFMNdJPsJ7PDgBtHeIKE6+8Covv/gaohTKpQgODw7vBz1srl7tblQX0a5M3/QQWioiDAw/nZ0jjCNGshn68RBoRQZnFglctbtRHQwQRSdN+6fjXe8W73j01Gqr1S3vzMX3V/9kYrpMst7ii8+/5Z3wIXqFA90dU/m4tvDjmU662EfU4BOVUjhR6skTb335+kvHHx83re6wcXEchTTqDf66uMT1ZtqluDv++puZmY/ff/Owcqlzzg1O8N6Ds+6HT987or3+dT3as1/31pO9ozK0b/sIhVI+GdldGpqvnKvMfHjmCLbvvMiWFwaRgPdAsO3AwWd/3nvnPfv/WFqlZYWpUoErFyuV2rkPHoa0s8W91VmbU8eyoXr+mScOLfw215yvnG8/ffSpw7lMqP7L+R9sEaZLxeFyuZi7Xe0m/gHC+TWhspUk0QAAAABJRU5ErkJggg=="
      },
      "/assets/morais-arms.png": {
            "type": "image/png",
            "b64": "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"
      },
      "/morais-arms.png": {
            "type": "image/png",
            "b64": "iVBORw0KGgoAAAANSUhEUgAABAAAAAQACAYAAAB/HSuDAAA/vklEQVR42u3dP49d133v4a84lE2NVRBCwAvZFwLB4iYQAgOxBMu38Btwl1aNmhBuXbjJhaVCdqDGhVuDSaFGdSq/gRQxDcYBDIMlQRBXNiIEgi4gUzOWR77FbFojas7M2f/XXut5AIJITEri4Tln799nr7V3AgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADQihsvXL/w/wYA6nXVSwAA9Q/6Q37tBx9+5IUEAAEAANjaoD/VP1sYAIBtesZLAADtDfoffPjRLP9MAKBcVgAAQMWDfgn/7cIAAAgAAGDIb/zPKw4AgAAAAAb9hl8jYQAABAAAMOg3/JoKAwAwnJsAAkCbg/6VJJ/V8ocRBgBAAAAAg/6Xj/fPJvmrJP+d5NOn/rc/CwMAIAAAgEF/e4P+iznd8vfMmV/3P5L8Q5J/TvJfZwb+Pyf5U5LfCwMAIAAAgEF/O4P+i0ne7H6+cubYfzWfrwD4Uzfcpxvwf5/kx93PwgAACAAAYNDfyKD/Yvf7nj7+P9MN739+6n/7tBv0hQFhAAABAAAM+TMO+VMP+lcG/Hd9NmMYqCoOCAMACAAAYNC/bNA/b8hfetBfOgxcFgeEAQAQAAAw6Fc16O8a8ksZ9OcKAxfFAdsJAEAAAMCgX92gf9GQX/KgP0UY2BUHhAFhAAABAACDfpWDfi1D/pRxQBgQBgAQAAAw6Bv0hQFhQBgAQAAAwKBv0BcGhAFhAAABAACDvkFfGBAGhAEAAQAAQ349Q75B/wLvHj6/83974/HHwoAwAIAAAIBBv7hB/7wh36C/x6DflzAgDAAgAABg0F9r0N815Bv0FyQM9AoDVcUBYQBAAADAoL/UoH/RkG/QX5kw8KUwcFkcsGoAAAEAwKBv0I+r+VWpLA7sGwYuigPCAAACAIBB36Bv0G9HA2FgVxwQBoQBAAEAwKBv0DfoYzuBMACAAABg0DfoG/SFAWFAGABAAAAw6A8c8g36Bn1hQBgQBgAEAABDfkWD/nlDvkHfoC8MCAPCAIAAAGDQr2jQ3zXkG/QRBoQBYQBAAAAw6Fc06F805Bv0QRjoGwaqigPCACAAABj0axv0DfkgDEwRBi6LA8IAgAAAYNA36Bv0EQYqCAMXxQHbCQAEAACDvkHfoI84UFEY2BUHhAFhABAAAAz6Bn2DPthOIAwACACAQd+gb9AHYUAYEAYABADAkF/AkG/QN+iDMCAMCAOAAAAY9Csa9M8b8g36Bn0QBoQBYQAQAACDfkWD/q4h36APCAPCgDAACACAQb+iQf+iIb+6Qd+QD8KAMCAMAAIAYNBvedB3NR8QBoSB88JAVXFAGAABADDoG/QN+gDCwJfDwGVxQBgABADAoG/QN+gD4kAFYeCiOGA7ASAAAAZ9g75BHxAGKgoDu+KAMCAMgAAANDvoX9nxHWPQN+gDwkCtcUAYEAZAAACqHfJ3DfrnDfkGfYM+gDAgDAgDIACAQb+iQX/XkG/QB0AYEAaEARAAwKBf0aB/0ZBv0AdAGBAGhAEQAMCgX9Ggb8gHQBgQBoQBEADAoG/QN+gDIAwIA8IACABg0DfoG/QBEAZKCgNVxQFhAAEADPoGfYM+AAgDXw4Dl8UBqwZAAACDvkHfoA+AOFBBGLgoDggDIACAIX/kkG/QN+gDIAyUFAZ2xQFhQBhAAACD/p6D/nlDvkHfoA+AMLClOCAMCAMIAGDQv2TQ3zXkG/QBQBgQBoQBEAAw6Fc06F805Fc36BvyAUAYEAaEAQQADPotD/qu5gMAwoAwIAwgAGDQN+gb9AEAYUAYEAYQADDoG/QN+gCAMDA2DFQVB4QBBAAM+gZ9gz4AIAx8OQxcFgeEAQQADPmFD/kGfYM+ACAM7BMGLooDthMgAGDQL2jQP2/IN+gb9AEAcaBPGNgVB4QBYUAAwKBfyKC/a8g36AMACANTxQFhQBgQADDoFzDoXzTkG/QBAIQBYUAYQAAw5Fc06BvyAQCEAWFAGEAAMPgb9A36AADCgDAgBCAAGP4N+gZ9AABhQBgQAQQADP8GfYM+AIAwIAyIAAIAtQz/V3b8/Rv0DfoAAMJAvWFg9TggAggAhv9lB/3zhnyDvkEfAEAYqDsMXBYHFg0DQoAAYPiff9DfNeQb9AEAEAfqDgMXxYFVwoAIIAAIAPMO+hcN+QZ9AACEgbrDwK44sEoYEAAEAMP//IO+IR8AANoNA7viwCphQAQQAFoPANcM+gZ9AACEgY2HgSMBQAAw/F8+/L/SfZAM+gAAIAxsMQy8meQ/RAABwPC/20GSm0nuJPl2FwMM+gAAIAxsKQwcJflVkttJHiY5EQHKcNVLUJRnk7zU/bjWBQGDPgAAVH5evOEwcN4Fymtn5pr39w0AzM8KgJkNvPr/v/Plq/8GfQAAaMyGw8BRkn+PVQBFsQKgHF/N55XsWYM+AACw4RUDZ1c3/z7JY3+b67MCYEY9b/z3apJ3up+Lufpv0AcAgO0oLAwcJbmX5B+7n90QUABoPgCcXfr/WpJDQz4AAFBJHHic5G56bAUQAOZjC8C6w3/yxaUxXzXoAwAAS84DM4eBs1ud97oh4I0XrosAM7ECYN3hf5Yb/xn0AQCAsSYMA24IWAgrANZ19up/7xv/GfQBAIC5TLhi4Ozc47GAK7ICYGJLXP03+AMAAGvrGQKsAijAFS/BagY99s/wDwAAlKDnbLLYvc8QABbR87F/30rydpJv5HQ1AAAAQK0Outnn7W4W2msFdI8Ziz3YArD88D/4sX+u/gMAAKXpuRWg92MBE1sBpmIFwPIsfQEAAFo1aCs0AkAxel79/0aSN9Nz6b+r/wAAQIl6ziqDZiJbAQSALVK7AACA1lkVvRI3nxup543/XknyT0n+JslX9v2Nrv4DAAAl+/tnv5J//fSP+/7yKzm9F9pfJ7mf5IMkf7rsN33tuWv5wydHXuwR3ARwmeHfjf8AAIDquSFg2WwBWIYlLgAAAF9ki7QAsA1u/AcAADBqhnFDQAGgOqoWAADA+ayWXpCbAA7gxn8AAADnc0PAcrkJ4HzDvxv/AQAAzXJDwPLYAjAfS1kAAAD2Y+u0AFAWN/4DAACYZbZxQ0ABYLPUKwAAgH6sop6ZmwDuyY3/AAAA+nFDwLJYATCtJ8tW3k7yrS4GGP4BAIBm9Zx1rnWz1NvpuZ0aAWASPa7+W7ICAAAwTu8t1e4FIAAsPfy78R8AAMD4mccNAQWA4p29+u/GfwAAAOYrAWArXP0HAACYhlUAAkAtBj32z/APAACIADu5x5oAsIyej/1zl0oAAIBpDXrKmlUAuz3jJRj1hjlIcjPJnSSv5fSZlXtx9R8AAGjVG48/7vPLHye5m+R2kodJTvb5TR98+JEX+ilWAIxjSQoAAMC8Bm25RgC4lBv/AQAAzMsNAQWArVGhAAAAlmH19QTcsO6Mnjf+eyXJPyX5myRf2fc3uvoPAACQ/P2zX8m/fvrHfX/5lZzec+2vk9xP8kGSP132m7723LX84ZMjL3bHTQD7D/9u/AcAADARNwRcji0A/Vl6AgAAsA5bsQWAcdz4DwAAYB1uCCgAlEptAgAAWJdV2QM1fxNAN/4DAABYlxsCLqPpmwC68R8AAEA53BBwXrYA7McSEwAAgLLYoi0A7MeN/wAAAMrihoACwNpUJQAAgDJZrd1DkzcBdOM/AACAMrkh4HysANjtyXKSt5N8q4sBhn8AAICZ9ZyprnUz29vpuW1bAKhcj6v/lpIAAABsQ++t2y3eC6CpAODGfwAAANvghoACwFLOXv134z8AAABznACwFa7+AwAAbItVAALA3AY99s/wDwAAsHoEcC+31gNAz8f+uXskAADANg16mlsrqwCsABj5Rklc/QcAAJjT3I8F/ODDjwSAGnjsHwAAQHN6be22AqAtbvwHAABQsCVuCCgAtMHjIgAAAMx5AkDlDpK8GFf/AQAAijZiFcCLl816LWwDEABOPdu9ITz2DwAAoJ4I0HvWq9lVL8FfiCHAZrzx+GMHeH+X/j79ffq7BDDreSEc9AAAAMxkCAAAAAAgAAAAAAACAAAAACAAAAAAAAIAAAAAIAAAAAAAAgAAAAAw0FUvAUCdHjy4X/R/361bL/tLquTv0t+nzyYA22AFAAAAAAgAAAAAgAAAAAAACAAAAACAAAAAAAAIAAAAAIAAAAAAAAgAAAAAgAAAAAAAAgAAAAAgAAAAAAACAAAAACAAAAAAAAKA1wEAAAAznxdhDs8mebH7GQAAADOfALA1N164ftkvOejeCG92Px9c9hvePXzexwcAAGBle85mvWa+PWZIAWDj1CAAAAAzX/UEAK8DAACAmc+LAAAAAAgAAAAAgAAAAAAACAAAAACAAAAAAAAIAAAAAIAAAAAAAAgAAAAAIAAAAAAAAgAAAAAgAAAAAAACAAAAACAAAAAAAAIAAAAAIAAAAAAAAgAAAAAIAAAAAIAAAAAAAAgAAAAAgAAAAAAACAAAAACAAAAAAAAIAAAAAIAAAAAAAAKAlwAAAAAEAAAAAEAAAAAAAAQAAAAAQAAAAAAABAAAAABAAAAAAAAEAAAAAEAAAAAAAAEAAAAAEAAAAAAAAQAAAAAQAAAAAAABAAAAABAAAAAAAAEAAAAAEAAAAABAAAAAAAAEAAAAAEAAAAAAAAQAAAAAQAAAAAAABAAAAABAAAAAAAAEAAAAABAA8BoAAACY/bwAlXs2yYvdzwAAAJj9BICtufHC9ct+yUH3Bniz+/ngst/w7uHzPjYAAACF2HNG6zX77TFLCgAbpQIBAACY/Zpg/7vXAAAAwOznBQAAAAAEAAAAAEAAAAAAAAQAAAAAQAAAAAAABAAAAABAAAAAAAAEAAAAABAAAAAAAAEAAAAAEAAAAACA0lz1EgDU6datl70I/i7x9wkAf2EFAAAAAAgAAAAAgAAAAAAACAAAAACAAAAAAAAsxFMAACjWG48/9iL4+wQAJmIFAAAAAAgAAAAAgAAAAAAACAAAAACAAAAAAAAIAAAAAIAAAAAAAAgAAAAAgAAAAAAAAgAAAABQl6teAoC6PXhw34sAXOrWrZe9CACVswIAAAAABAAAAABAAAAAAAAEAAAAAEAAAAAAAAQAAAAAQAAAAAAABAAAAABAAAAAAAABAAAAABAAAAAAAAEAAAAAEAAAAAAAAQAAAAAQAAAAAAABAAAAABAAAAAAQAAAAAAABAAAAABAAPDnBwAAwAzoD1+iZ5O82P0MAACAGVAA2JobL1y/7JccdH/xb3Y/H1z2G949fN7HBQAAoDB7zmq9ZsA9ZkoBYGOsAAAAADADNsM9AAAAADAD+sMDAAAAAgAAAAAgAAAAAAACAAAAACAAAAAAAAIAAAAAIAAAAAAAAgAAAAAIAAAAAIAAAAAAAAgAAAAAgAAAAAAACAAAAACAAAAAAAAIAAAAAIAAAAAAAAIAAAAAIAAAAAAAAgAAAAAgAAAAAAACAAAAACAAAAAAAAIAAAAAIAAAAACAAOAlAAAAAAEAAAAAEAAAAAAAAQAAAAAQAAAAAAABAAAAABAAAAAAAAEAAAAAEAAAAABAAAAAAAAEAAAAAEAAAAAAAAQAAAAAQAAAAAAABAAAAABAAAAAAAAEAAAAABAAAAAAAAEAAAAAEAAAAAAAAQAAAAAQAAAAAAABAAAAABAAAAAAAAHAnx0AAIDWZ8FW/+DPJnmx+xkAAACzoACwNTdeuH7ZLzno/sLf7H4+uOw3vHv4vI8JAABAofac2XrNgnvMlgLARlgBAAAAYBZsinsAAAAAYBZswFV/9wCU4tatl6v4czx4cN9fpveC9wIAxXEVHAAAAAQAAAAAQAAAAAAABAAAAABAAAAAAAAEAAAAAEAAAAAAAAQAAAAAQAAAAAAAAQAAAAAQAAAAAAABAAAAABAAAAAAAAEAAAAAEAAAAAAAAQAAAAAQAAAAAEAAAAAAAAQAAAAAQAAAAAAABAAAAABAAAAAAAAEAAAAAEAAAAAAAAQAAAAAEAC8BAAAACAAAAAAAAIAAAAAIAAAAAAAAgAAAAAgAAAAAAACAAAAACAAAAAAAAIAAAAACAAAAACAAAAAAAAIAAAAAIAAAAAAAAgAAAAAgAAAAAAACAAAAACAAAAAAAACAAAAACAAAAAAAAIAAAAAIAAAAAAAAgAAAAAgAAAAAAACgD83AAAAZkJ/6Kc8m+TF7mcAAADMhALA1tx44fplv+Sg+4t+s/v54LLf8O7h8z4eAAAAhdtzdus1E+4xYwoAhbMCAAAAoF1WAPhzAwAAYCb0hwYAAAAEAAAAAEAAAAAAAAQAAAAAQAAAAAAABAAAAABAAAAAAAAEAAAAABAAAAAAAAEAAAAAEAAAAAAAAQAAAAAQAAAAAAABAAAAABAAAAAAAAEAAAAABAAAAABAAAAAAAAEAAAAAEAAAAAAAAQAAAAAQAAAAAAABAAAAABAADjjM3/1AAAAzWpyJrza4J/50yS/T3IzyYH3PUA5Hjy470XAewGApWbCTy/7hR98+FFVf/DWVgCcdH/RP+5+PrnsN7zx+GMfDwAAgMLtObv1ngkFgELtWWee1J5jHxEAAIDmHGfPFQACgL9wAAAAtqnpC8LVBYA9VgHYBgAAAFCROZb/17b/v8oAsCfbAAAAANrT9GrwK/7ibQMAAABoQPMXgqsMALYBAAAAtMHy/8YDwJ5sAwAAAGhH86vAr3gD2AYAAABQOReAaw4AtgEAAADUzfJ/AaAPFQgAAKB+Vn8LAN4IAAAAlXPht4UAYBsAAABAnSz/FwCGUIMAAADqZdW3AOANAQAAUDkXfFsKALYBAAAA1MXyfwFgDFUIAACgPlZ7CwDeGAAAAJVzobfFAGAbAAAAQB0s/xcApqAOAQAA1MMqbwHAGwQAAKByLvC2HABsAwAAANg2y/8FgCmpRAAAANtndbcA4I0CAABQORd2BQDbAAAAALbK8n8BYA5qEQAAwHZZ1S0AeMMAAABUzgVdAeBztgEAAABsi+X/AsCcVCMAAIDtsZpbAPDGAQAAqJwLuQLAl9kGAAAAsA2W/wsAS1CPAAAAtsMqbgHAGwgAAKByLuAKALvZBgAAAFA2y/8FgCWpSAAAAOWzelsA8EYCAAConAu3AsDlbAMAAAAok+X/AsAa1CQAAIByWbUtAHhDAQAAVM4FWwFgf7YBAAAAlMXyfwFgTaoSAABAeazWFgC8sQAAACrnQq0A0J9tAAAAAGWw/F8AKIG6BAAAUA6rtAUAbzAAAIDKuUArAAxnGwAAAMC6LP8XAEqiMgEAAKzP6mwBwBsNAACgci7MCgDj2QYAAACwDsv/BYASqU0AAADrsSpbAPCGAwAAqJwLsgLAdGwDAAAAWJbl/wJAyVQnAACA5VmNLQB44wEAAFTOhVgBYHq2AQAAACzD8n8BYAvUJwAAgOVYhS0AeAMCAABUzgVYAWA+tgEAAADMy/J/AWBLVCgAAID5WX0tAHgjAgAAVM6FVwFgfrYBAAAAzMPyfwFgi9QoAACA+Vh1LQB4QwIAAFTOBVcBYDm2AQAAAEzL8n8BYMtUKQAAgOlZbS0AeGMCAABUzoVWAWB5tgEAAABMw/J/AaAG6hQAAMB0rLIWALxBAQAAKucCqwCwHtsAAAAAxrH8XwCoiUoFAAAwntXVAoA3KgAAQOVcWBUA1mcbAAAAwDCW/wsANVKrAAAAhrOqWgDwhgUAAKicC6oCQDlsAwAAAOjH8n8BoGaqFQAAQH9WUwsA3rgAAACVcyFVACiPbQAAAAD7sfxfAGiBegUAALA/q6gFAG9gAACAyrmAKgCUyzYAAACASWYcy/8FgCqoWAAAAJezeloA8EYGAAConAunAkD5bAMAAAAYNdtY/i8AVEXNAgAA2M2qaQHAGxoAAKByLpgu6KqXYJwPPvwoN164ftEvObuk5V+SvJTk4KLf8Mbjj/Pu4fNeXAAGu3Xr5cG/98GD+15AAEax/F8AaJmqBUCRw/6+/zxRAICZWC0tAFT9xr6ZS1YAAMDSQ3+ff58YAMBEXCgVALbHNgAAahz6xQAAhrD8XwBA3QJg44P/Rf9tQgAAA1j+LwA08Qa/GdsAANjw4C8EADCSC6Qr8BjAieyxJKXXEpdk76UzAFQ4+G9p+K/lvx2A8Sz/L5sVAMtSuQC4cHiu7c9iRQAAO1j+LwA09Ua/GdsAAKhs8BcCANiDC6MrsQVgQrYBAGD4b/vPCdAyy/8FAL5M7QKgyaFYBACgY/n/SmwBWPcNfzO2AQAY/Bv8s9sSANAsF0RXZAXAxGwDAMDw73UAaI3l/wIAu6leAIZer4fXA6BFlv8LAN74ABh2vS4AVM6FUAGgPrYBAGDI9foAtMLyfwGAy6lfAIZbvE4ALbEKWgDwAfABADDU4vUCqJwLoAJAvWwDADDM4nUDqJ3l/wIA+1PBAACAFlj9LADggwBQH1exvX4AfIELnwJA/WwDADC84nUEqJXl/wIA/alhAIZWvJ4ANbPqWQDABwIAAKicC54CQDtsAwBog6vVXleAllj+LwAwnCoGAADUyGpnAQAfDIB6uErt9QXgXC50CgDtsQ0AwHCK1xmgFpb/CwCMp44BAAA1scpZAMAHBKAOrkp7vQHYyQVOAaBdtgEAAABbZ/m/AMB0VDIAAKAGVjcLAEz9QbEKAGAdlqN73QFa02P2cGFTAKDnNoD3s8c2AAAAgIKcdLOM5f8CAHv4NMmj7oflMgAAgHkGAaBSvYpZYhsAwNIsQ/f6A7RmwM3/rGgWANhziYs9MwAAwBbtfU8zy/8FAAZ8cAAAAArgQqYAwNN63gzQNgCAglh+7u8BoDUDlv+7+Z8AQE/qGQAAsCVWMQsA+AABAACVcwFTAGAX2wAAAIDSWf4vALAcFQ0AANgCq5cFAHyQAOrhxnP+PgA4lwuXAgCXsQ0AAAAoleX/AgDLU9MAAICSWbUsAOADBQAAVM4FSwGAfdkGAAAAlMbyfwGA9ahqAABAiaxWFgDwwQIAACrnQqUAQF+2AQAAAKWw/F8AYH3qGgAAUBKrlAUAfMAAAIDKuUApADCUbQAAAMDaLP8XACiHygYAAJTA6mQBAB80AACgci5MCgCMZRsAAACwFsv/BQDKo7YBAABrsipZAMAHDgAAqJwLkgIAU7ENAAAAWJrl/wIA5VLdAACANViNLADggwcAAFTOhUgBgKnZBgAAACzF8n8BgPKpbwAAwJKsQhYA8AEEAAAq5wKkAMBcbAMAAADmZvm/AMB2qHAAAMASrD4WAPBBBAAAKufCowDA3GwDAAAA5mL5vwDA9qhxAADAnKw6FgDwgQQAACrngqMAwFJsAwAAAKZm+b8AwHapcgAAwBysNhYA8MEEAAAq50KjAMDSbAMAAACmYvm/AMD2qXMAAMCUrDIWAPABBQAAKucCowDAWmwDAAAAxrL8XwCgHiodAAAwBauLBQB8UAEAgMq5sCgAsDbbAAAAgKEs/0cAqI9aBwAAjGFVsQCADywAAFA5FxQFAEphGwAAANCX5f8IAPVS7QAAgCGsJhYA8MEFAAAq50KiAEBpbAMAAAD2Zfk/AkD91DsAAKAPq4gFAHyAAQCAyrmAKABQKtsAAACAic7xLf8XAKiAigcAAOzD6mEBAB9kAACgci4cCgCUzjYAAABg5Lm95f8CABVR8wAAgItYNSwA4AMNAABUzgVDAYCtsA0AAAAYeE5v+b8AQIVUPQAA4DxWCwsA+GADAACVc6FQAGBrbAMAAAB6nstb/i8AUDF1DwAAOMsqYQEAH3AAAKByLhAKAGyVbQAAAIDl/wgAPKHyAQAAidXBAgA+6AAAQPVcGBQA2DrbAAAAoF2W/yMA8DS1DwAA2mZVsACADzwAAFA5FwQFAGphGwAAALTH8n8EAHZR/QAAoE1WAwsA+OADAACVcyFQAKA2tgEAAEA7LP9HAOAy6h8AALTFKmABAF8AvgAAAKByLgAiANTKNgAAAKif5f8IAOxLBQQAgDZY/YsAUKqXvvdTXwQAAMAUFr/wt+A8Qw9XvQTbigCPfvHDvX//Bx9+lBsvXL/ol5xdCvQvSV5KcnDRb3jj8cd59/B5fzkAALCyUpb/G/YFAAqNAuewDQA24Pvf/MEX/x+//IkXBSjnOynJz3/zMy8MlGuyVb+GfQGA7UeBJ18IN3PJCgBgnRNrAFEAGGjQBT+DvgDARqPA0cVXCm0DAIM+wKLfc8IAjDfH8v9r3/lRXvLSCgBUzzYAMOwDCANQJzf9RgBg5xfDzdgGAAZ9gEK+Q0UBGMWFPgSA1lz7zo9sAwCDPkBV37fCAC2ba/k/AgDt6F0Hv//NHzj4YtgHQBiApd/7+z8NyPJ/BAAu/YK4mT23AViqh0EfAGEAijw3sfwfAaBVc2wDOPrlT85dKiQKYNAHYAvf/c5P2OL5ydF+V/8t/0cA4FKzVcLLvtAcgDHsA1DKMcJ5CZWck1j+jwDA3l8UN7Pg0wD2+UJ0MMagD4AwgPOQvVj+jwDQuiW3Aazxxeqg7IAKACUck5yTOB+Zi+X/CABMbbO10CoCB1EAEApwXpLE8n8EAAZ8YdzMgtsASviCdyB2AAWAEo+bzlGcn/Rg+T8CAKe2vg2ghANEawdgQz0AbOd47DylXpb/IwAwF9XQgQYAcJ7CNln+z05XvAT44gAAgCq4kIcAwBftsdSn19KhZO8lSQAAQE+W/yMAMDf1EAAAtsUqXgQAfIEAAEDlXMBDAOB8tgEAAED5LP9HAGApKiIAAGyD1bsIAPgiAQCAyrlwhwDAxWwDAACAcln+jwDA0tREAAAom1W7CAD4QgEAgMq5YIcAwH5sAwAAgPJY/o8AwFpURQAAKJPVuggA+GIBAIDKuVCHAEA/tgEAAEA5LP9HAGBt6iIAAJTFKl0EAHzBAABA5VygQwBgGNsAAABgfZb/IwBQCpURAADKYHUuAgBlfdFYBQAAAPvpce7swhwCAOPMsQ1ABAAAgEnPmS3/RwBgMYNqowgAAACTnStb/o8AwGJ84QAAwDos/0cAYBo9twG8nz23ASRWAQAAwMhz5JPuHNzyfwQAFvNpkkfdD1sBAABg/uE/3bn3k/Nwq3ERAFjEk/L4VpJfJ/lEBAAAgFnPiT/pzr3fSs+VuCAAsNOeS4WOkvxHkn/sfhYBAABgvuH/7Ln30UTn9AgAMN8XkQgAAIDhv99vyYgLbyAAMHUEGLwUSQQAAMDwv9OorbcgALCXnkuGzt6MpPfjSEQAAAAM/9OdZ1v+jwDAnBFgdJkUAQAAMPx/waCVtoZ/BAAW+V7LyL1JIgAAAIb/vwz/g++1BQIAg/QsiJ/EDUoAAGCMwefUrv4jALCpCGAVAAAAtZjgcX+GfwQARAAAADD8G/7p56qXgD5fLD2+yM5+gb2T5JUkz/X5wvRFBtO4detlLwLe3wCGf7ACgFlZCQAAgOF/xnNmEACYzYDCOOoOpiIAAAAVD/+jnqTl6j8CAKVGgN7PMBUBAACoePg/6c6N3+rOlQ3/CABUEwGOkzzqfhwv8IUKAAClDv+jzo8N/wgAlB4BRhVOEQAAgIqG/8ErZA3/CABsJQKM2uMkAgAAUMnwP+geWYZ/BAC2FgHc5RQAgFZ53B8CACJAn99sFQAAAGtb8nF/hn8EAEQAAAAw/IMAgAgAAACGf/jcVS8BKzv7hfhOkleSPNfnC9gXIy3yvt/MSR8+C4Dh3/2vKMYzXoIyvfS9n7b25fhcN/y/k+TVJNecAML23X/v9bz8+nteCABaHP6PktwbOvzXcH776Bc/9MYRAGghAAz8kjxM8lqSO0luJjkQAaDcwb5FYgaA4X9PJ0keJrmd5G6Sxy2e1woAAgANBYABX5YH3eB/pwsBh33/fSIAGOzFAQBWHv7TDfx3uwDwsAsCTZ3P3n/v9Tx//eveQAIALQWAAV+a13K6BaD3/QBEADDUCwQAFDD8n933fy+nWwGqPY+96DxDABAAaDAADPjyPHs/ABEADPbV+7e//fbi/87vf/MHXniAeYf/au74P/ScQwAQAGg0ACwdAQQADPYIBEIBwMIBYPPD/9TnIAKAAEDDAUAEAIM+dcUBoQAw/G9v+F/y/EMAEABoPACIABj2oc1AIBYAhv9lz1VLOPcQAAQABAARAIM+iANCAWD4n+ActfTzDgFAAEAAGPrlKgJg0AdRQCgAqhj++56fbvW8QwAQABAApooAr+b0kYEiAIZ9EAWEAWDp89KjnD7ib7Lhv8bzDQFAAEAAGPtle5jktSR3ktxMciACYNAHUUAUABY8Hz1J8jDJ7SR3kzzuez7ayjmHACAAIACM/dI96Ab/O10IOOz77xMBMOiDKCAMAAOH/3QD/90uADzsgsBeHjy439TrKwAIAAgAU3z5XsvpFoBB9wMQAQz7gCggDAADh/+z+/7v5XQrgOFfABAAEABm/hJ2U0AM+iAMiALAkgFg8E3/Whz+BQABAAFABMCwD1QZBYQBMPwb/gUAAQABQATAsA80HAWEATD8t0wAEAAQAEQADPqAKCAKgOFfAEAAQAAQAQz7AG1GAWEADP8CAAKAAOBLelgEeDWnTwsQAQz7gCggDEDj5yK3br3c+1Q0p3f57z38CwACgACAALBcBDhM8lqSO0luJjkQAQz7ADVGAXEA9jsfGTD8nyR5mOR2krtJHhv+BQABAAGgzAhw0A3+d7oQcNj33ycCGPYBUUAYgDrORwYM/+kG/rtdAHjYBQHDvwAgACAAFBoBruV0C8Cg+wGIAAZ9gFqjgDhAS+cjA4f/s/v+7+V0K4DhXwAQABAACo8Ao24K2GoEMOwDtBsFhAFqOh+ZYPh30z8BQABAHGgpAtQeAAz7AMKAMECt5yIDAoDhXwAQABAIRIDtRwCDPoAoIA7Q0rmI4V8AQACgsjggAhjyAUQBYQDnJIZ/AQABgEbiQIsRwKAPIAoIBTgnMfwLAAgANBcHegaATUUAgz6AKIBYYNAvc/gXAAQAAQCBYKVAMDICvJrTRwauEgEM+QAIBEKBYX+V4f8op4/4M/wLAAIAbC0ODIgAh0leS3Inyc0kB3NGAIM+ACKBWGDQL2b4P0nyMMntJHeTPDb8CwACAGzMjReu9/nlB93gf6cLAYd9/31PRwBDPgACgVBgsC9++E838N/tAsDDLggY/gUAAQAqjwDXcroFYND9ABwEABAJWMp3f/srL8I0w//Zff/3croVwHmfACAAsL6PP/qdD8z8EWDUTQEdDAAQCDDUb3L4d8d/AUAAoLwA4EM37DXreVAYFQEcEABAJDDYFx8ADP8CAAJAGwFgqx/csX9+EQAAwPBv+BcAEAAEAAcIEQAAwPDv3E4AaM4VLwG16vnFPfgAMfCABACA4R8EAFiJCAAA0PDwDwIAbNiAgvv0AeOoz28WAQAAVh3+j8YM/67+IwBAmxHg10neSvJ+khMRAACg+OH/pDt3e6s7lzP8gwCACLCX4ySPuh/HCxywAAAYdy41+PzN8I8AAG1HgFEFWQQAAFh0+B+8gtPwjwAAIkAycg+ZCAAAsNjwP+geToZ/BAAQAS46oLiLLABAOTzuDwQAKCcCWAUAADDLOZPhHwQAEAEAAAz/hn8QAEAEAAAw/IMAAIgAAAD1Df+AAABDSvDgO82KAAAAg8+JRj2hydV/EABgTAQY9KxZEQAAMPz3Phc66c653urOwQz/IADAohHgOMmj7sfxAgc+AIAWh/9R512GfxAAYIoDxKgSLQIAAIb/vQxeeWn4BwEApjxQjNqLBgDApcP/oHsvGf5BAIA5DhieDAAAMP05j8f9gQAAIgAAgOHf8A8CAIgAAACGf0AAABEAAMDwDwIAMIXBN6sRAQCAhod/N1cGAQDWN6AoD35cjQgAADQ4/I96vLKr/yAAwNoR4DjJo+7H8QIHTgCALQ7/o86bDP8gAEAJEWBUyRYBAIBGhv/BKycN/yAAQEkRYPReNhEAAKh8+B907yTDPwgAUGIEGPVkAACASrnjPwgAIAI8zSoAAKBkHvcHAgCIACIAAGD4N/yDAAAigAgAABj+Df8gAEC9RAAAwPDvvkggAMAWDSjSg+94KwIAABsc/kc9GcnVfxAAoIYIMOiZtyIAALCh4f+kO9d5qzv3MfyDAABNRoDjJI+6H8cLHIABAJYc/ked7xj+QQCAmiLAqCIuAgAAhQ//g1c8Gv5BAIAaI8CoPXEiAABQ8PA/6J5Hhn8QAKDmCOCuuABATTzuDwQAEAHmigBWAQAAc1jycX+GfxAAQAQQAQAAwz8gAIAIIAIAAIZ/QACAbRIBAIAmhn9AAIDqDCjbg++cKwIAAAsO/6OeaOTqPwgAIAJ8HgEGPTtXBAAAFhj+T7pzlLe6cxbDPwgAwIgD3XGSR92P4wUO5ACA4X/28xTDPwgAIAJ82aiyLgIAADOdKwxeqWj4BwEARIDdRu2tEwG25eXX3/MiALCF4X/QvYoM/47/rOcZL0GZPv7od14EB93zPJfklSTvdD8/1+c313zAbfWgef+9132IAFg6AHjcn/OSvTz6xQ+9CAIAAgAigIOoUACA4d+5iACAAIAA4ADcXARwUBULADD8O+8QABAABAAciDceARxk6/Xz3/xsln/ud3/7Ky8ugOHfeYYAgAAgAOBgXFIEcNBlzVAgGgCUP/xPFQCccwgACAACAA7KX44Arya5NtVB2cGWLUcBwQBgkvOMoyT3lhz+nX8IAAgAAgAOzhc7TPJakjtJbiY56PObr33nR150mo8CogHg/OJLTpI8THI7yd0kj6cc/g36AgACAAIAww7SB93gf6cLAYd9/30iAKKAOAA4r3jK427wv92FgJMhw79BXwBAAEAAYPqD9bWcbgEYdD8AEQBRQBgAnE+ccXbf/72cbgVwPoEAIAAgAFDQQXvUTQEdtBEFxAHA8J8RN/1zHoEAIAAgALChCODAjTAgDABNBwDDPwKAAIAAwJLO2yt39MufiADQaBQQBwDDPwIAAoAAQIWD/kVEABAFhAHA8I8AgAAgAFDZsC8CgCggDgCGfwQABAABgEaG/QkCgAgAooAwAIb/WYZ/5wkIAAIAAoBhfwEjI8CrOX1koIM7iALCAFR0DjLg/OAop4/4M/wjAAgACACUMOxPGAEOk7yW5E6Sm0kOHORBFBAHoI5zkAHnBSdJHia5neRuksfOCxAABAAEAAfagvU82B90g/+dLgQc9v33OdiDMCAMQHnnIQOG/3QD/90uADzsgoDzAQQAAQABwEG2oghwLadbAAbdD8BBH0QBcQDKOg8ZOPyf3fd/L6dbAZwHIAAIAAgADrIVRgA3BQRRQBiASs5FBgQAd/xHABAAEAAcYEUAEQBEAWEAtnQuYvhHAEAAEAAcYBsmAoAoIA5AG+cihn8EAAQAAcDBFREAEAag8nMSwz8CAAKAAODAiggAiALiAJWfkxj+EQAQAAQAB1bGnhycjQCv5vRpASIAiAICAc5Htn18P8rpXf57D/+O7wgAAgACgGG/7ghwmOS1JHeS3Exy4CQBhAFxAOchmz2unyR5mOR2krtJHjuuIwAgAAgADrIiwBMH3eB/pwsBh33/fU4WQBwQB3AOUsTwn27gv9sFgIddEHA8RwAQABAAHGBFgM+P+TndAjDofgBOGkAYQBxwDlLE8H923/+9nG4FcBxHAEAAEAAcXEWALxl1U0AnD4AwIBA4Fylm+HfTPwQABAABwIFVBJg3AjiBAMQBccC5yCoBwPCPAIAAIAA4sCICAMIAn1s7NDgfMfwjACAA8FQAeP761wf93pe+91MvICIAIA6wqu9/8wdeBMM/AoAXQQBgLAM+IgCAMGCYd4w2/CMA0NdVL4EhH3qcWPSOAEe//IkTDGATA2pLEcFAb/gH2mQFgACAk4x9nV0J8GpOHxm4NxEAaMEaEcEw3+xx+Sinj/gbNPw7LrMEKwAEAAQAtn2ycZjktSR3ktxMcuBkAwAWPx6fJHmY5HaSu0keOx4jALCPK14CaNeAE4DjJI+6H8cLnOAAgOF/wuOx4R8EAEAE2NdJkveTvJXk1xmw11AEAIBRx8RPumPwW90x+cTwDwgAwFwR4CgjbzgkAgBg+B88/J89Bh8Z/gEBAJg7ArjrMAAsy+P+AAEA2GYEsAoAgFYt+bg/wz8gAAAiAAAY/gEBABABRAAAMPwDAgCACAAAxQ7/AAIA0MuAKweD70wsAgBg+P/ibxkz/Lv6DwgAwFIRYNCziUUAAAz/SXfsfL87lv7a8A8IAEDJEeA4yaPux/ECJ0oAUMvwP+o4avgHBABg6Qgw6sqFCABAw8P/4JV0hn9AAADWigCj9i6KAAA0OvwPupeO4R8QAIC1I4C7FwPAzMdMwz8gAABVRACrAADYmiUf92f4BwQAQAQAAMM/gAAAiAAAYPgHBACA+YgAABj+JzgmAggAwOIGXIEYfIdjEQCASob/UU/KcfUfEACArUWAQc84FgEA2Pjwf9Id+97qjoWGf0AAAKqPAMdJHnU/jhc44QKAtYf/Ucc/wz8gAABbjQCjroCIAABscPgfvALO8A8IAMDWI8CoPZAAsCGD74Fj+AcEAKCWCODJAABsisf9AQIAgAgAgOHf8A8IAIAIIAIAYPg3/AMCACACiAAAGP4N/4AAADRk8E2SRAAAChn+3eQWEACANg24kjH4MUkiAAArD/+jHnPr6j8gAAAtRoDjJI+6H8cLnLABwBTHksHHL8M/IAAArUaAUVdQRAAAVhj+B69gM/wDAgDQegQYvYdSBABgweF/0D1sDP+AAACIAOefULmREgClccd/QAAAKCECWAUAwIzHDMM/IAAAiAAAGP4N/4AAACACAGD4BxAAAEQAAOob/gEEAKBpA66EDL7TsggAwMhjwqgn1Lj6DwgAgAgwLAIMetayCADAwGPBSXfMeas7Bhn+AQEAYKEIcJzkUffjeIETPwDaHf5HHXcM/4AAADDuBGnUlRgRAMDw38PglWeGf0AAAJjmRGnUXkwRAMDwv+fwP+jeM4Z/QAAAmPaEyd2YAZiLx/0BAgBATRHAKgCA+i35uD/DPyAAAEW5/97rIoAIAGD4N/wDDXnGS1Cml773Uy8CRQ7vL7/+Xuknbs8leSXJO93Pz/X5zU7cAAz/tQ//W7gIUPq5Cft59IsfehEKc9VLAA66c//3L3xgPnvi1jsCHP3yJyIAgOF/8/eVqW3In+LPKhSAFQDFsgLAwbR1Tx+kB5zEnV0J8GqSa31+swgA0Nzwf5Tk3tDhf+njhnOS5c5BGM4KAAEAAcCgz2C3br3c97ccJnktyZ0kN5MciAAAhv9znCR5mOR2krtJHpdwvHA+IhYIAEzNFgAM+WzGgwf3+0aA4ySPuh8vdkGg1wmkCABQ/fD/9PHieMnh3/lIG+eTz1//+mT/ThcKGcMKgEL5YBv02a1nBLiW0y0Ag24KmCTvHj6/96/9/jd/4C8IYFvD/9l9//dyuhVg0uHfuQj7mjIUlDBTWAEgACAAGPRZIwKMejJA3wgwlogAsMrwP/iO/85B2FIUWHL2EAAEAAQAQz6bjABLBgCRAGCRADB4+H/w4L4XnOqjwBRzigAgACAAGPTZbAR4+oTv3/7228W+LgIBYPg3/CMMrD3PCAACAAKAIZ+qIsB5Sg4DIgFg+Df8IwogACAAGPQRASYOAVsNAwIBUOngb/gHUUAA8BIIAIZ9GgwAq0WArUcBkQBocfgXABAFEABoPgAY9qksArya00cG9jbHSeHWw4BAABQ0+Cenj/a7Z/gHUUAAQAAw7NN2BDhM8lqSO0luJjkY+u+e+wSxliggDAALDv5JcpLkYZLbSe4meWz4B2FAAEAAMOzTZgQ46Ab/O10IOBz771/yZFEUAGp1/73Xh0Td8zzuBv/bXQg4MfyDKCAA0GQAMOwjAiQ5Xfr/akbcD6Ckk8aaooAwAG0M+hN8j+9ydt//vZxuBTD8gyggAFB3ADDoIwJcavRNAUs+gawtCggDUNewP8Pg//Tw747/IAAgANQZAAz7MEkE+FZOVwZcqSkEiAJAScP+TIP/Zzm90v9rwz8IAAgAVQUAwz7MEgG+leTHSV5K8o0MfDrAVk8qhQFg7mF/xuH/KMn7SR4lebOLAIZ/EAAQALYXAAz7sNjJ5bVu8H+pCwF/l8pXA7QYBYQBWGfYn2nwf3LV/z+7wf9RFwLs+QcBAAGgfB9/9DsvAqwbAa50Q//f5YurAb7ScggQBcCwX+Dg/8d88ar/f3aD/2eGfxAAEAAEABAA+ji7GuBNIaDNKCAMYNgvbvh/evD/cQZc9RcAQAAQABAAQAR42pVu4D8vBDR1fwBRQBzAsL/y4J98cZ//2cH/j+lx1d/wDwKAAIAAACJAnxDg/gDCgECAQX+5wX/XPv9Bg7/hHwQAAQABAESAfUOA+wOIAuIAhv3lBv/R+/x9z4IAgAAgAIAIMMau+wPYFiAMCAQ0NezPOPzvWu5/NOYf6vsVBAABAAEAhIAhbAsQBsQBmh72Zxr8J1/u7/sUBAAEAAEAmOqE1bYAUUAgoKlhf8bBf/Ll/r5HQQBAABAAgDlOYD02UBgQB6hyyF9g+J9lub/vTRAAEAAEAGDOE1mPDRQGRAMDvu/L/c2y3N/3JQgACAACALBmCHB/AFFANDDk+3784uBvuT8IAAgACABQXQhwfwBhgI0Fg5aH/Jm/E58e/C33BwEAAUAAAKo76fXYQNGAmaLBz3/zs0G/97u//ZUXcLnvwGT3Pv/Ry/19B4IAgAAgAAClnQDbFoBosCADfjGDv33+IAAgACAAQNMhwLYARANDfguDv33+IAAgACAAgBPkeGwgUO/w77F+IAB4EQQABABwovwUjw0Eahr8LfcHBAABAAEAnDj3DAHuDwBsbfC33B8QAAQABABwIt0zBLg/ALCl4d9yf0AAEAAQAMBJ9QgeGwiUPvhb7g8IAAIAAgBgWwBQ+eBvuT8gAAgACADATCHAtgCgtMHfcn9AABAAEACAmU7APTYQWGv437XPf/Ryf987IAAgAAgAgBPx83lsILDk4G+fPyAACAAIAEBhIcD9AQD7/AEBAAFAAAAqDwHuDwB4rB8gACAACABAIyftHhsIvkPGstwfEAAEAAQAYCMn8LYFgO+NoYO/5f6AACAAIAAAGw0BtgWA74q+g7/l/oAAIAAgAAAbPbn32EDw3bDLbI/1890ACAACAAIAsM6JvscGgu+Ds+zzBwQAAQABAGgsBLg/ALQ3+NvnDwgAAgACANBYCHB/AGhr+PdYP0AAQAAQAICGhwKPDYT6B3/L/QEBAAFAAAAMCElsC4CaB3/L/QEBAAFAAAAMDOeGANsCoI7h33J/QABAABAAAMPDpTw2ELY7+FvuDwgACAACAGCQ6MVjA2F7g7/l/oAAgAAgAAAGi8lCgPsDQFmf0acHf8v9AQEAAUAAAAwZo0OA+wNAOZ/JZPc+/9HL/X0eAQFAAEAAAAwdHhsI6w/+9vkDAgACgAAAsMgAYlsArDf42+cPCAAIAAIAwCohwLYAWGb491g/QABAABAAAFYfTmZ9bKDhhMYHf8v9AQEAAUAAAChqUPHYQIjl/gACgACAAAC0GwLcHwCfof4s9wcEAAQAAQBgUyHA/QHwmenHcn9AAEAAEAAANjvUeGwgPiP7Df6W+wMCAAKAAACw+QHHtgB8LvYb/C33BwQABAABAKCaEGBbAD4Lp3bt8x+93N/nABAAEAAEAIBShh+PDaTlwd8+f0AAQABAAACaGoQ8NpAWB3/7/AEBAAEAAQAQAuL+ANQ7/HusHyAAIAAgAACGpDMhwP0BqG3wt9wfEAAEAAEAAQAwNO3gsYHUMvhb7g8gAAgACACAAeoStgWw1feux/oBCAACAAIAYJgaGAJsC2AL79Vkxsf6ea8CAgACgAAA0MpwZVsAJQ/+9vkDCAACAAIAwISDlm0BlDj42+cPIAAIAAgAADOGANsCWHv491g/AAFAAEAAAFhoCNu1LUAIYM7B33J/AAFAAEAAAFhhKHt6W4D7AzDn4G+5P4AAIAAgAACsPKC5PwBzDv+W+wMIAAIAAgBAgSHA/QG8l6b6R1nuDyAACAAIAACFD28eG+i9M3bwt9wfQAAQABAAADYyyNkW4D0zdvC33B9AABAAEAB8CXmPwcZCgG0B3iOX2bXPf/Ryf+8Paj5XcR6Bc28BAF+qvkC8D6HEIc9jA70nzmOfP85FnGfgMyMA4AvRhx8Hbioc+Dw20Pvg7OBvnz/OVZyL4HMlAODLzIcc72UaCwHuD9DW8O+xfgYRnIPgcycA4AvLBxnvdxoMAe4P0M7gb7m/IQOcf/hsIgD4QvKBxeeBxodDjw2sf/C33N8AAc49fH4RAHzp+FDiM4NBMYltAbUO/5b7GxDAOYfPNwJAm18sPnz4LGFo3CsE2Baw/cHfcn8n/+C8w3cAAkAbXx4+ZOAgbYgczWMDtzv4W+7vJB+ce/huQACo68vBBwkcnJl9oPTYwO0O/pb7O5EH5x++NxAAtvcF4AMDDs4UFwLcH6Cs4X/XPv/Ry/1bHvydf4DzD98nAgAAwkDrIcD9AcoZ/O3zd1IObOD8w3eNAADgwMyWh0+PDVx/8LfP38k3sJFzEN9BAgAA4sDWB1HbAtYZ/j3Wz0k2sLHzD99NAgAAwkBNIcC2gPkHf8v9nUgDGz0H8b0lAAAgDNQ2pHps4HyDf5PL/Z0wA7Wcg/g+EwAAEAdqHFg9NnC617KZx/o5MQZqPwfxPScAACAMtBQCmrg/wBYe67fWa+fkF2j5HMR3oAAAgDjQSgio/v4A9vkb9AEQAAAQBoSAU1U+NrDVff6GfAAEAACEARHgIlVtC2jhsX4GfQAEAABoNA7YFlDncn+DPgACAAAIA3MOwZt6bODWl/sb8gFAAABAKFhzIN7EYwO3tNzfoA8AAgAAQsGWQkAR9wfYynL/Dz78yIcCAAQAAMSCZWJBTfcH2Mpyf4M/AAgAALBaKNj6YwMn+u9/evCfdLm/wR8ABAAAKCIUbHFbwAL7/Ecv9zf4A4AAAABFuvHC9alCwKzbAiZinz8ACAAAIARMYPbHBo4Y/O3zBwABAACYMALM/tjAnmZ7rJ/BHwAEAAAQAha4P8AlLPcHgA078BIAwPz+8MlR/vDJUb723KgL9n9O8qck/y/JfyX5bZL/1f3/D7sIMEfc/yzJcTfw30/yf5LcS/LfST7t/v2jBv8/fHLkTQIAM7MCAABWMPP9AabcFmC5PwAIAABAARFgrm0BlvsDQGVsAQCAlRS6LcByfwColBUAAFCIlR8b+PRj/Sz3BwABAAAoPAL0fWzgrn3+o5f7G/wBQAAAAJYPAU/uD/DV7n97stzfPn8AaIB7AABAgWa+P8BnXRj4v7HPHwCaYQUAAGzAxPcH+J9J/iHJP3cRwD5/ABAAAIDKIsCTbQF/ldMr/pb7A4AAAABUHgIM/gAgAAAAjYQAgz8ANOKKlwAAtmmtIdzwDwDbZAUAAFRgidUABn8AEAAAgIpDgMEfAAQAAKDiEGDwB4C6uAcAAFRo7PBu+AeA+lgBAACVu/HC9Xzw4Uc7VwU8Gfaf/DoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIBt+v+g4wfv7jAnsAAAAABJRU5ErkJggg=="
      }
};
    const iconR2Map = {
      '/favicon.ico': 'icons/favicon.ico',
      '/favicon.png': 'icons/favicon-32.png',
      '/favicon-32.png': 'icons/favicon-32.png',
      '/apple-touch-icon.png': 'icons/apple-touch-icon.png',
      '/apple-touch-icon-precomposed.png': 'icons/apple-touch-icon.png',
      '/icon-192.png': 'icons/icon-192.png',
      '/icon-512.png': 'icons/icon-512.png',
      '/assets/morais-arms.png': 'icons/morais-arms.png',
      '/morais-arms.png': 'icons/morais-arms.png',
    };
    if ((ICON_EMBED[path] || iconR2Map[path]) && request.method === 'GET') {
      if (ICON_EMBED[path]) {
        const bin = Uint8Array.from(atob(ICON_EMBED[path].b64), (c) => c.charCodeAt(0));
        return new Response(bin, {
          headers: {
            'Content-Type': ICON_EMBED[path].type,
            'Cache-Control': 'public, max-age=86400, immutable',
            'Access-Control-Allow-Origin': '*',
            'X-Icon-Source': 'embed',
          },
        });
      }
      try {
        if (env.ASSETS || env.R2 || env.FOG_BUCKET) {
          const bucket = env.ASSETS || env.R2 || env.FOG_BUCKET;
          const key = iconR2Map[path];
          if (key) {
            const obj = await bucket.get(key);
            if (obj) {
              const headers = new Headers();
              headers.set('Content-Type', (ICON_EMBED[path] && ICON_EMBED[path].type) || (path.endsWith('.ico') ? 'image/x-icon' : 'image/png'));
              headers.set('Cache-Control', 'public, max-age=86400, immutable');
              headers.set('Access-Control-Allow-Origin', '*');
              headers.set('X-Icon-Source', 'r2');
              return new Response(obj.body, { headers });
            }
          }
        }
      } catch (e) { console.error('icon R2', e); }
      if (ICON_EMBED[path]) {
        const bin = Uint8Array.from(atob(ICON_EMBED[path].b64), (c) => c.charCodeAt(0));
        return new Response(bin, {
          headers: {
            'Content-Type': ICON_EMBED[path].type,
            'Cache-Control': 'public, max-age=86400, immutable',
            'Access-Control-Allow-Origin': '*',
            'X-Icon-Source': 'embed',
          },
        });
      }
      return new Response('Icon unavailable', { status: 404 });
    }

    if (path === '/terms' || path === '/termos' || path === '/en/terms') {
      const lang = path.startsWith('/en') || url.searchParams.get('lang') === 'en' ? 'en' : 'pt';
      return Response.redirect('https://stratamesh-auth.stratamesh.workers.dev/terms?lang=' + lang, 302);
    }
    if (path === '/health' || path === '/dashboard/health') {
      return jsonResponse({
        status: 'ok',
        worker: 'stratamesh-spa',
        timestamp: new Date().toISOString()
      }, corsHeaders);
    }

    // Orchestrator — always proxy to known workers.dev (service binding optional)
    if (path === '/orchestrator' || path === '/orchestrator/' || path.startsWith('/orchestrator/')) {
      const sub = path.replace(/^\/orchestrator/, '') || '/health';
      let targetPath = sub.startsWith('/') ? sub : '/' + sub;
      if (targetPath === '/' || targetPath === '') targetPath = '/health';
      try {
        let resp = null;
        if (env.ORCH) {
          try {
            const oReq = new Request('https://orchestrator.internal' + targetPath, {
              method: 'GET',
              headers: { 'Accept': 'application/json' }
            });
            resp = await env.ORCH.fetch(oReq);
            if (resp.status === 404) resp = null;
          } catch (_) { resp = null; }
        }
        if (!resp) {
          const upstream = 'https://stratamesh-orchestrator.stratamesh.workers.dev' + targetPath;
          resp = await fetch(upstream, { method: 'GET', headers: { 'Accept': 'application/json' } });
        }
        return withCors(resp, corsHeaders);
      } catch (e) {
        return jsonResponse({ status: 'error', error: String(e.message || e), worker: 'stratamesh-orchestrator' }, corsHeaders, 503);
      }
    }

    if (path === '/api/payment-intent' || path.startsWith('/api/payment')) {
      if (env.ENI_PAY && typeof env.ENI_PAY.fetch === 'function') {
        const init = { method: request.method, headers: request.headers };
        if (request.method !== 'GET' && request.method !== 'HEAD') init.body = await request.arrayBuffer();
        return env.ENI_PAY.fetch(new Request('https://eni-pay.internal' + path, init));
      }
      return new Response(JSON.stringify({ error: 'eni_pay_unavailable' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
    }

    
    
    if (path === '/robots.txt') {
      const robots = `User-agent: *
Allow: /
Allow: /transcrito
Allow: /texto
Allow: /clp
Allow: /eni
Disallow: /dashboard
Disallow: /api/
Disallow: /pagamentos
Sitemap: https://calhegasmorais.pt/sitemap.xml
`;
      return new Response(robots, {
        headers: withSecurityHeaders({
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "public, max-age=86400",
        }),
      });
    }
    if (path === '/sitemap.txt') {
      const sm = `https://calhegasmorais.pt/
https://calhegasmorais.pt/en
https://calhegasmorais.pt/clp
https://calhegasmorais.pt/eni
https://calhegasmorais.pt/transcrito
https://calhegasmorais.pt/termos
https://calhegasmorais.pt/privacidade
https://eni.calhegasmorais.pt/
https://status.calhegasmorais.pt/
`;
      return new Response(sm, {
        headers: withSecurityHeaders({
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "public, max-age=86400",
        }),
      });
    }
    if (path === '/sitemap.xml') {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://calhegasmorais.pt/</loc>
    <xhtml:link rel="alternate" hreflang="pt-PT" href="https://calhegasmorais.pt/"/>
    <xhtml:link rel="alternate" hreflang="en-GB" href="https://calhegasmorais.pt/en"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="https://calhegasmorais.pt/"/>
  </url>
  <url>
    <loc>https://calhegasmorais.pt/en</loc>
  </url>
  <url><loc>https://calhegasmorais.pt/clp</loc></url>
  <url><loc>https://calhegasmorais.pt/eni</loc></url>
  <url><loc>https://calhegasmorais.pt/transcrito</loc></url>
  <url><loc>https://calhegasmorais.pt/termos</loc></url>
  <url><loc>https://calhegasmorais.pt/privacidade</loc></url>
  <url><loc>https://eni.calhegasmorais.pt/</loc></url>
  <url><loc>https://status.calhegasmorais.pt/</loc></url>
</urlset>
`;
      return new Response(xml, {
        headers: withSecurityHeaders({
          "Content-Type": "application/xml; charset=utf-8",
          "Cache-Control": "public, max-age=86400",
        }),
      });
    }

    if (path === '/.well-known/security.txt' || path === '/security.txt' || path === '/seguranca.txt' || path.endsWith('security.txt')) {
      const sec = `Contact: mailto:geral@eni.calhegasmorais.pt
Contact: mailto:amcmorais@icloud.com
Expires: 2027-08-17T00:00:00.000Z
Preferred-Languages: pt, en
Canonical: https://calhegasmorais.pt/.well-known/security.txt
Policy: https://calhegasmorais.pt/eni
`;
      return new Response(sec, {
        headers: withSecurityHeaders({
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "public, max-age=86400",
        }),
      });
    }

    if (path === '/transcrito' || path === '/transcrito/' || path === '/texto' || path === '/texto/') {
      return plainTranscript();
    }
    if (path === '/erro-acesso' || path === '/erro-acesso/' || path === '/access-notice') {
      return accessNoticePage(
        'Pedido classificado como tráfego automatizado ou de risco.',
        'Em vez de um bloqueio vazio, este sítio devolve o motivo e um transcrito em texto simples da página principal. Em browser normal, abra a raiz do domínio.'
      );
    }

    if (path === '/pagamentos' || path === '/pagamentos/' || path === '/pay' || path === '/pay/') {
      if (env.ENI_PAY && typeof env.ENI_PAY.fetch === 'function') {
        return env.ENI_PAY.fetch(new Request('https://eni-pay.internal/', { method: 'GET' }));
      }
      return Response.redirect('https://eni.calhegasmorais.pt/pagamentos', 302);
    }

    
    if (path.startsWith('/api/orchestrator') || path.startsWith('/api/v1/orchestrator')) {
      const prefix = path.startsWith('/api/v1/orchestrator') ? '/api/v1/orchestrator' : '/api/orchestrator';
      const rest = path.slice(prefix.length) || '/chat';
      return originOrchChat(request, env, corsHeaders, rest || '/chat');
    }

if (path.startsWith('/api/')) {
      return proxyApi(request, env, path, url, corsHeaders);
    }

    if (path === '/dashboard/aiops' || path === '/dashboard/aiops/') {
      return Response.redirect(url.origin + '/dashboard', 301);
    }

    if (path === '/eni' || path === '/eni/' || path === '/amcm' || path === '/amcm-eni') {
      return serveEni(env);
    }
    

    if (path === '/clp' || path === '/clp/' || path === '/tempo' || path === '/temporal') {
      return serveClp(request, env, corsHeaders);
    }

    if (path === '/chat' || path === '/chat/' || path === '/orquestrador' || path === '/orchestrator') {
      const ct = (request.headers.get('content-type') || request.headers.get('Content-Type') || '').toLowerCase();
      const accept = (request.headers.get('Accept') || '').toLowerCase();
      if (request.method === 'POST' || (request.method === 'GET' && accept.includes('application/json') && !accept.includes('text/html'))) {
        if (request.method === 'POST' || ct.includes('json') || accept.includes('application/json')) {
          return originOrchChat(request, env, corsHeaders, '/chat');
        }
      }
      return serveNodeChat(request, env, 'pt');
    }
    if (path === '/en/chat' || path === '/en/chat/' || path === '/en/orchestrator') {
      return serveNodeChat(request, env, 'en');
    }
    if (path.startsWith('/os/')) {
      return serveOsAsset(request, env, corsHeaders, path);
    }
    if (path === '/painel' || path === '/painel/' || path === '/en/painel' || path === '/en/painel/') {
      return serveOs(request, env, corsHeaders);
    }
    if (path === '/dashboard' || path === '/dashboard/' || path.startsWith('/dashboard/') ||
        path === '/portal' || path === '/portal/' || path.startsWith('/portal/') ||
        path === '/en/dashboard' || path === '/en/dashboard/' || path.startsWith('/en/dashboard/') ||
        path === '/en/portal' || path === '/en/portal/' || path.startsWith('/en/portal/')) {
      return servePortal(request, env, corsHeaders);
    }

    if (path === '/roadmap' || path === '/roadmap/' || path === '/mapa' || path === '/mapa/' ||
        path === '/en/roadmap' || path === '/en/roadmap/' || path === '/en/mapa' || path === '/en/mapa/') {
      return serveRoadmap(request, env, corsHeaders);
    }

    if (
      path === '/' || path === '' || path === '/home' || path === '/index.html' ||
      path === '/pt' || path === '/pt/' || path.startsWith('/pt/') ||
      path === '/en' || path === '/en/' || path.startsWith('/en/')
    ) {
      const u = new URL(request.url);
      if (path === '/pt' || path === '/pt/' || path.startsWith('/pt/')) u.searchParams.set('lang', 'pt');
      if (path === '/en' || path === '/en/' || path.startsWith('/en/')) u.searchParams.set('lang', 'en');
      return serveHome(new Request(u.toString(), request), env, corsHeaders);
    }

    // Icons fallback (before 404)
    if (typeof ICON_EMBED !== 'undefined' && ICON_EMBED[path] && request.method === 'GET') {
      const bin = Uint8Array.from(atob(ICON_EMBED[path].b64), (c) => c.charCodeAt(0));
      return new Response(bin, {
        headers: {
          'Content-Type': ICON_EMBED[path].type,
          'Cache-Control': 'public, max-age=86400, immutable',
          'Access-Control-Allow-Origin': '*',
          'X-Icon-Source': 'embed-late',
        },
      });
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  }
};

async function proxyApi(request, env, path, url, corsHeaders) {
  try {

    let target;
    // Mesh economy — dashboard expects /api/v1/{agora,dao,acb,token,poc}/...
    const meshMap = [
      ['/api/v1/agora', 'AGORA', 'https://stratamesh-agora.stratamesh.workers.dev', '/agora'],
      ['/api/v1/dao', 'DAO', 'https://stratamesh-dao.stratamesh.workers.dev', '/dao'],
      ['/api/v1/acb', 'ACB', 'https://stratamesh-acb.stratamesh.workers.dev', '/acb'],
      ['/api/v1/orchestrator', 'ORCH', 'https://stratamesh-orchestrator.stratamesh.workers.dev', ''],
      ['/api/v1/token', 'TOKEN', 'https://stratamesh-token.stratamesh.workers.dev', ''],
      ['/api/v1/nft', 'TOKEN', 'https://stratamesh-token.stratamesh.workers.dev', '/nft'],
      ['/api/v1/poc', 'POC', 'https://stratamesh-poc.stratamesh.workers.dev', ''],
      ['/api/v1/scout', 'SCOUT', 'https://stratamesh-scout.stratamesh.workers.dev', ''],
      ['/api/v1/sandbox', 'SANDBOX', 'https://stratamesh-sandbox.stratamesh.workers.dev', ''],
      ['/api/v1/worlds', 'WORLDS', 'https://stratamesh-worlds.stratamesh.workers.dev', ''],
      ['/api/v1/realms', 'REALMS', 'https://stratamesh-realms.stratamesh.workers.dev', ''],
    ];
    for (const [prefix, bindName, base, pathPrefix] of meshMap) {
      if (path === prefix || path.startsWith(prefix + '/')) {
        const rest = path.slice(prefix.length) || '';
        const upstreamPath = (pathPrefix + rest) || '/';
        const binding = env[bindName];
        if (binding && typeof binding.fetch === 'function') {
          const u = new URL(request.url);
          u.pathname = upstreamPath;
          const resp = await binding.fetch(new Request(u.toString(), {
            method: request.method,
            headers: request.headers,
            body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
            redirect: 'manual'
          }));
          return withCors(resp, corsHeaders);
        }
        target = base + upstreamPath + url.search;
        const apiResponse = await fetch(new Request(target, {
          method: request.method,
          headers: request.headers,
          body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
          redirect: 'manual'
        }));
        return withCors(apiResponse, corsHeaders);
      }
    }
    if (path.startsWith('/api/auth')) {
      const stripped = path.slice('/api/auth'.length) || '/';
      if (env.AUTH) {
        const authUrl = new URL(request.url);
        authUrl.pathname = stripped;
        const authReq = new Request(authUrl.toString(), {
          method: request.method,
          headers: request.headers,
          body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
          redirect: 'manual'
        });
        const resp = await env.AUTH.fetch(authReq);
        return withCors(resp, corsHeaders);
      }
      target = 'https://stratamesh-auth.stratamesh.workers.dev' + stripped + url.search;
    } else if (path.startsWith('/api/auth-recovery') || path.startsWith('/api/recovery')) {
      const stripped = path.replace(/^\/api\/(auth-recovery|recovery)/, '') || '/';
      if (env.RECOVERY) {
        const rUrl = new URL(request.url);
        rUrl.pathname = stripped;
        const rReq = new Request(rUrl.toString(), {
          method: request.method,
          headers: request.headers,
          body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
          redirect: 'manual'
        });
        const resp = await env.RECOVERY.fetch(rReq);
        return withCors(resp, corsHeaders);
      }
      target = 'https://stratamesh-auth-recovery.stratamesh.workers.dev' + stripped + url.search;
    } else if (path.startsWith('/api/v1')) {
      if (env.GATEWAY) {
        const gReq = new Request(request.url, {
          method: request.method,
          headers: request.headers,
          body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
          redirect: 'manual'
        });
        const resp = await env.GATEWAY.fetch(gReq);
        return withCors(resp, corsHeaders);
      }
      target = 'https://stratamesh-dag-gateway.stratamesh.workers.dev' + path + url.search;
    } else if (path.startsWith('/api/aiops')) {
      let stripped = path.replace(/^\/api\/aiops/, '') || '/';
      if (stripped === '/health' || stripped === '') stripped = '/health';
      target = 'https://stratamesh-aiops.stratamesh.workers.dev' + stripped + url.search;
    } else if (path.startsWith('/api/ipfs')) {
      const stripped = path.replace(/^\/api\/ipfs/, '') || '/';
      target = 'https://stratamesh-ipfs-pinner.stratamesh.workers.dev' + stripped + url.search;
    } else if (path.startsWith('/api/pq')) {
      // pq worker documents GET /pq/status and POST /pq/generate
      let stripped = path.replace(/^\/api\/pq/, '') || '/';
      if (stripped === '/health' || stripped === '/') stripped = '/pq/status';
      if (!stripped.startsWith('/pq')) stripped = '/pq' + (stripped.startsWith('/') ? stripped : '/' + stripped);
      target = 'https://stratamesh-pq-keys.stratamesh.workers.dev' + stripped + url.search;
    } else {
      return jsonResponse({ error: 'Unknown API prefix', path }, corsHeaders, 404);
    }

    const apiResponse = await fetch(new Request(target, {
      method: request.method,
      headers: request.headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
      redirect: 'manual'
    }));
    return withCors(apiResponse, corsHeaders);
  } catch (e) {
    return jsonResponse({ error: 'API unavailable', details: String(e.message || e) }, corsHeaders, 503);
  }
}

function withCors(resp, corsHeaders) {
  const newHeaders = new Headers(resp.headers);
  Object.entries(corsHeaders).forEach(([k, v]) => newHeaders.set(k, v));
  return new Response(resp.body, { status: resp.status, headers: newHeaders });
}

function pickLang(request) {
  const url = new URL(request.url);
  const path = url.pathname || "/";
  if (path === "/en" || path.startsWith("/en/")) return "en";
  if (path === "/pt" || path.startsWith("/pt/")) return "pt";
  const q = (url.searchParams.get("lang") || "").toLowerCase();
  if (q === "en" || q === "pt") return q;
  // Domínio público CMN: português europeu por omissão (não depender do Accept-Language do datacenter)
  return "pt";
}





async function serveOs(request, env, corsHeaders) {
  try {
    const bucket = env.ASSETS || env.R2 || env.FOG_BUCKET;
    if (bucket) {
      const obj = await bucket.get("os/os.html");
      if (obj) {
        let html = await obj.text();
        const lang = pickLang(request);
        if (lang === "en") {
          html = html.replace('lang="pt-PT"', 'lang="en-GB"').replace("Painel · Nó Calhegas Morais", "Panel · Calhegas Morais Node");
        }
        return new Response(html, {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-cache",
            "Content-Language": lang === "en" ? "en-GB" : "pt-PT",
            "X-Painel-Source": "r2-os",
          },
        });
      }
    }
  } catch (e) {
    console.error("serveOs", e);
  }
  return new Response("Painel OS indisponível", { status: 503, headers: corsHeaders });
}

async function serveOsAsset(request, env, corsHeaders, path) {
  try {
    const bucket = env.ASSETS || env.R2 || env.FOG_BUCKET;
    if (!bucket) return new Response("Not Found", { status: 404, headers: corsHeaders });
    const key = path.replace(/^\//, "");
    const obj = await bucket.get(key);
    if (!obj) return new Response("Not Found", { status: 404, headers: corsHeaders });
    const type = key.endsWith(".css")
      ? "text/css; charset=utf-8"
      : key.endsWith(".js")
        ? "application/javascript; charset=utf-8"
        : "application/octet-stream";
    return new Response(obj.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": type,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (e) {
    console.error("serveOsAsset", e);
    return new Response("Not Found", { status: 404, headers: corsHeaders });
  }
}

async function serveRoadmap(request, env, corsHeaders) {
  const lang = pickLang(request);
  const keys = [`roadmap-${lang}`, lang === 'en' ? 'roadmap-pt' : 'roadmap-en', 'roadmap'];
  try {
    if (env.LEDGER) {
      for (const key of keys) {
        try {
          const { results: chunks } = await env.LEDGER.prepare(
            "SELECT idx, value FROM site_content_chunks WHERE key = ? ORDER BY idx ASC"
          ).bind(key).all();
          if (chunks && chunks.length) {
            const html = chunks.map((c) => c.value || "").join("");
            if (html) {
              return htmlPage(html, {
                ...corsHeaders,
                "Cache-Control": "public, max-age=60",
                "Content-Language": lang === "en" ? "en-GB" : "pt-PT",
                "X-Home-Source": "site_content_chunks",
              });
            }
          }
        } catch (_) {}
      }
    }
  } catch (e) {
    console.error("roadmap LEDGER", e);
  }
  return new Response("Not Found", { status: 404, headers: corsHeaders });
}

async function serveClp(request, env, corsHeaders) {
  try {
    if (env.LEDGER) {
      const { results: chunks } = await env.LEDGER.prepare(
        "SELECT idx, value FROM site_content_chunks WHERE key = ? ORDER BY idx ASC"
      ).bind("clp").all();
      if (chunks && chunks.length) {
        const html = chunks.map((c) => c.value || "").join("");
        if (html) {
          return htmlPage(html, {
            ...corsHeaders,
            "Cache-Control": "public, max-age=60",
            "Content-Language": "pt-PT",
            "X-CLP-Source": "site_content_chunks",
          });
        }
      }
    }
  } catch (e) {
    console.error("clp LEDGER", e);
  }
  return new Response(
    "<!DOCTYPE html><html lang=pt-PT><head><meta charset=UTF-8><title>CLP</title></head><body style=\"background:#050505;color:#e5e5e5;font-family:sans-serif;padding:2rem\"><h1>CLP</h1><p>Conteúdo CLP indisponível no LEDGER (key clp).</p></body></html>",
    { status: 503, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } }
  );
}

async function serveHome(request, env, corsHeaders) {
  const lang = pickLang(request);
  const keys = [`home-${lang}`, lang === 'en' ? 'home-pt' : 'home-en', 'home', `landing-${lang}`];
  try {
    if (env.LEDGER) {
      for (const key of keys) {
        try {
          const { results: chunks } = await env.LEDGER.prepare(
            "SELECT idx, value FROM site_content_chunks WHERE key = ? ORDER BY idx ASC"
          ).bind(key).all();
          if (chunks && chunks.length) {
            const html = chunks.map((c) => c.value || "").join("");
            if (html) {
              return htmlPage(html, {
                ...corsHeaders,
                "Cache-Control": "public, max-age=120",
                "Content-Language": lang === "pt" ? "pt-PT" : "en-GB",
                "X-Home-Source": "site_content_chunks",
              });
            }
          }
        } catch (_) {}
        try {
          const { results } = await env.LEDGER.prepare(
            "SELECT value FROM site_content WHERE key = ? LIMIT 1"
          ).bind(key).all();
          if (results && results[0] && results[0].value) {
            return htmlPage(results[0].value, {
              ...corsHeaders,
              "Cache-Control": "public, max-age=120",
              "Content-Language": lang === "pt" ? "pt-PT" : "en-GB",
              "X-Home-Source": "site_content",
            });
          }
        } catch (_) {}
      }
    }
  } catch (e) {
    console.error("home LEDGER", e);
  }
  try {
    const u = "https://stratamesh-portal.stratamesh.workers.dev/home?lang=" + lang;
    const pr = await fetch(u);
    if (pr.ok) {
      const html = await pr.text();
      if (html && html.includes("<html")) {
        return htmlPage(html, {
          ...corsHeaders,
          "Cache-Control": "public, max-age=120",
          "X-Home-Source": "portal-worker",
        });
      }
    }
  } catch (_) {}
  return htmlPage(fallbackHome(lang), {
    ...corsHeaders,
    "Content-Language": lang === "pt" ? "pt-PT" : "en-GB",
  });
}

function fallbackHome(lang) {
  const isPt = lang === "pt";
  const title = isPt ? "Calhegas Morais · StrataMesh" : "Calhegas Morais · StrataMesh";
  const body = isPt
    ? "<h1>Calhegas Morais</h1><p>Nó Fog de referência · laboratório StrataMesh DLT.</p><p><a href=\"/dashboard\">Portal</a></p>"
    : "<h1>Calhegas Morais</h1><p>Reference Fog node · StrataMesh DLT laboratory.</p><p><a href=\"/dashboard\">Portal</a></p>";
  return `<!DOCTYPE html><html lang="${isPt ? "pt-PT" : "en-GB"}"><head><meta charset="UTF-8"><title>${title}</title>
<style>body{font-family:system-ui;background:#0a0a0b;color:#e8e6e3;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.box{max-width:28rem;padding:2rem}a{color:#c4b5a0}</style></head><body><div class="box">${body}</div></body></html>`;
}


function serveNodeChat(request, env, lang) {
  const pt = lang !== 'en';
  const title = pt ? 'Chat · Orquestrador · Nó Calhegas Morais' : 'Chat · Orchestrator · Calhegas Morais Node';
  const html = `<!DOCTYPE html>
<html lang="${pt ? 'pt-PT' : 'en-GB'}">
<head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title}</title>
<link rel="icon" href="/favicon.ico"/>
<style>
:root{--bg:#0a0a0c;--fg:#e8e8ea;--muted:#8a8780;--line:#2a2a30;--accent:#8b9cf7;--card:#121216}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font-family:system-ui,-apple-system,sans-serif;min-height:100vh;display:flex;flex-direction:column}
header{padding:1rem 1.25rem;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap}
header a{color:var(--muted);text-decoration:none;font-size:.8rem}
header a:hover{color:var(--accent)}
h1{font-size:1.1rem;font-weight:500;margin:0}
.meta{font-size:.72rem;color:var(--muted);font-family:ui-monospace,monospace}
main{flex:1;display:flex;flex-direction:column;max-width:48rem;width:100%;margin:0 auto;padding:1rem 1.25rem 1.5rem}
#log{flex:1;min-height:50vh;overflow-y:auto;border:1px solid var(--line);border-radius:8px;background:var(--card);padding:1rem;margin-bottom:.75rem}
.msg{margin-bottom:1rem}
.msg .who{font-size:.65rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-bottom:.35rem}
.msg .body{white-space:pre-wrap;word-break:break-word;line-height:1.55;font-size:.95rem}
.row{display:flex;gap:.5rem}
input#q{flex:1;padding:.85rem 1rem;border-radius:6px;border:1px solid var(--line);background:#1a1a1f;color:var(--fg);font-size:.95rem}
button{padding:.85rem 1.1rem;border-radius:6px;border:1px solid var(--accent);background:transparent;color:var(--accent);cursor:pointer;font-size:.75rem;letter-spacing:.08em;text-transform:uppercase}
button:hover{background:var(--accent);color:#111}
button:disabled{opacity:.4;cursor:not-allowed}
.badge{display:inline-block;padding:.2rem .5rem;border:1px solid var(--line);border-radius:4px;font-size:.65rem;color:var(--muted)}
</style>
</head>
<body>
<header>
  <div>
    <h1>${pt ? 'Orquestrador' : 'Orchestrator'}</h1>
    <div class="meta">FOG-NODE-PT-CM-001 · SCA-ORCH-CMN-001</div>
  </div>
  <div style="display:flex;gap:1rem;align-items:center;flex-wrap:wrap">
    <span class="badge" id="clr">clearance: public</span>
    <a href="/dashboard">${pt ? 'Painel' : 'Panel'}</a>
    <a href="/">${pt ? 'Início' : 'Home'}</a>
  </div>
</header>
<main>
  <div id="log"></div>
  <div class="row">
    <input id="q" type="text" placeholder="${pt ? 'Mensagem ao Orquestrador…' : 'Message the Orchestrator…'}" autocomplete="off"/>
    <button type="button" id="go">${pt ? 'Enviar' : 'Send'}</button>
  </div>
</main>
<script>
const ORCH = '/api/orchestrator/chat';
const AUTH = 'https://stratamesh-auth.stratamesh.workers.dev';
const token = localStorage.getItem('sm_token') || localStorage.getItem('token') || '';
const log = document.getElementById('log');
const clr = document.getElementById('clr');
function add(who, text) {
  const d = document.createElement('div');
  d.className = 'msg';
  d.innerHTML = '<div class="who">'+who+'</div><div class="body"></div>';
  d.querySelector('.body').textContent = text;
  log.appendChild(d);
  log.scrollTop = log.scrollHeight;
}
async function refreshClearance() {
  if (!token) { clr.textContent = 'clearance: public (anónimo)'; return; }
  try {
    const r = await fetch(AUTH + '/me', { headers: { Authorization: 'Bearer ' + token } });
    const j = await r.json();
    let c = String(j.clearance_level || j.clearance || j.role || '').toLowerCase().replace(/[\s-]+/g,'_');
    if (['top_secret','topsecret','ts','root','god','root_admin'].includes(c)) c = 'top_secret';
    else if (['secret','sec','admin','external_assistant'].includes(c)) c = 'secret';
    else if (['confidential','conf','staff'].includes(c)) c = 'confidential';
    else if (['internal','intl','lab','operator'].includes(c)) c = 'internal';
    else c = 'public';
    // Never invent internal from a bare token or basic/public /me response
    if (!token) c = 'public';
    clr.textContent = 'clearance: ' + c + (j.email ? ' · ' + j.email : '') + (!token ? ' · anonymous' : '');
  } catch (e) {
    clr.textContent = 'clearance: ?';
  }
}
refreshClearance();
document.getElementById('go').onclick = async function () {
  const q = document.getElementById('q');
  const msg = (q.value || '').trim();
  if (!msg) return;
  q.value = '';
  add('${pt ? "Você" : "You"}', msg);
  const btn = document.getElementById('go');
  btn.disabled = true;
  try {
    const r = await fetch(ORCH, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: token ? 'Bearer ' + token : '',
      },
      body: JSON.stringify({ message: msg, token: token, lang: '${pt ? "pt" : "en"}' }),
    });
    const j = await r.json();
    if (j.account_clearance || j.clearance) {
      clr.textContent = 'clearance: ' + (j.account_clearance || j.clearance || 'public') + (j.clearance_source ? ' · ' + j.clearance_source : '');
    }
    add('${pt ? "Orquestrador" : "Orchestrator"}', j.reply || j.error || JSON.stringify(j));
  } catch (e) {
    add('System', String(e.message || e));
  } finally {
    btn.disabled = false;
  }
};
document.getElementById('q').addEventListener('keydown', function (ev) {
  if (ev.key === 'Enter') document.getElementById('go').click();
});
</script>
</body>
</html>`;
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

async function servePortal(request, env, corsHeaders) {
  const lang = pickLang(request);
  const url = new URL(request.url);
  const qAuth = (url.searchParams.get('auth') || url.searchParams.get('sm') || '').trim();
  const token = qAuth || sessionToken(request);
  let me = null;
  if (token && env.AUTH) {
    try {
      const authUrl = new URL(request.url);
      authUrl.pathname = '/me';
      authUrl.search = '';
      const r = await env.AUTH.fetch(new Request(authUrl.toString(), {
        method: 'GET',
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      }));
      me = await r.json().catch(() => null);
    } catch (_) { me = null; }
  }
  if (!me || !me.success) {
    const setpw = url.searchParams.get('setpw') || url.searchParams.get('token') || '';
    return new Response(dashboardGateHtml(lang, {
      error: qAuth ? (lang === 'en' ? 'Session rejected after 2FA.' : 'Sessão recusada após 2FA.') : '',
      setpw,
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Dashboard': 'registered_only',
        'X-Me': token ? 'fail' : 'none',
      },
    });
  }
  if (qAuth) {
    const loc = lang === 'en' ? '/en/dashboard' : '/dashboard';
    return new Response(null, {
      status: 303,
      headers: {
        Location: loc,
        'Cache-Control': 'no-store',
        'Set-Cookie': 'sm_token=' + encodeURIComponent(qAuth) + '; Path=/; Secure; SameSite=Lax; Max-Age=2592000',
      },
    });
  }
  const portalHtml = await loadPortalHtml(env, lang);
  if (portalHtml) {
    return new Response(injectPortalSession(portalHtml, me, token), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Dashboard': 'portal',
        'X-Portal-Type': me.type || 'user',
        'Set-Cookie': 'sm_token=' + encodeURIComponent(token) + '; Path=/; Secure; SameSite=Lax; Max-Age=2592000',
      },
    });
  }
  const sub = me.subsistence || (me.type === 'staff'
    ? { mode: 'live', static_only: false, payg_exempt: true, balance: null, dashboard: true }
    : { mode: (Number(me.balance || 0) < 0.1 ? 'static' : 'live'), static_only: Number(me.balance || 0) < 0.1, balance: me.balance || 0, dashboard: true, floor: 0.1 });
  return new Response(dashboardAppHtml(lang, me, sub), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Dashboard': sub.static_only ? 'static_nft' : 'live',
      'Set-Cookie': 'sm_token=' + encodeURIComponent(token) + '; Path=/; Secure; SameSite=Lax; Max-Age=2592000',
    },
  });
}

async function loadPortalHtml(env, lang) {
  const keys = lang === 'en' ? ['portal-en', 'portal-pt', 'portal'] : ['portal-pt', 'portal', 'portal-en'];
  const db = env.LEDGER || env.DB;
  if (db) {
    for (const key of keys) {
      try {
        const { results: chunks } = await db.prepare(
          "SELECT idx, value FROM site_content_chunks WHERE key = ? ORDER BY idx ASC"
        ).bind(key).all();
        if (chunks && chunks.length) {
          const html = chunks.map((c) => c.value || '').join('');
          if (html && html.length > 1000) return html;
        }
      } catch (_) {}
      try {
        const { results } = await db.prepare(
          "SELECT value FROM site_content WHERE key = ? LIMIT 1"
        ).bind(key).all();
        if (results && results[0] && results[0].value && results[0].value.length > 1000) {
          return results[0].value;
        }
      } catch (_) {}
    }
  }
  try {
    const pr = await fetch('https://stratamesh-portal.stratamesh.workers.dev/');
    if (pr.ok) {
      const html = await pr.text();
      if (html && html.length > 1000) return html;
    }
  } catch (_) {}
  return null;
}

function jsonForScript(obj) {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function injectPortalSession(html, me, token) {
  const session = {
    success: true,
    token,
    type: me.type || 'user',
    auth_type: me.type || 'user',
    email: me.email || '',
    role: me.role || me.clearance || 'user',
    clearance: me.clearance || me.clearance_level || '',
    clearance_level: me.clearance_level || me.clearance || '',
    wallet: me.wallet || me.strata_address || '',
    strata_address: me.wallet || me.strata_address || '',
    balance: me.balance,
    subsistence: me.subsistence || null,
    lifecycle: me.lifecycle || null,
  };
  const style = '<style id="sm-session-boot">#loginPage{display:none!important}.portal,#portalPage{display:block!important;visibility:visible!important}#userInfo{display:flex!important}</style>';
  if (html.includes('</head>')) html = html.replace('</head>', style + '</head>');
  else html = style + html;
  const boot = `<script>
(function(){
  var me = ${jsonForScript(session)};
  try {
    localStorage.setItem('sm_token', me.token);
    localStorage.setItem('token', me.token);
    localStorage.setItem('auth_type', me.type || 'user');
    if (me.clearance) localStorage.setItem('clearance', me.clearance);
    if (me.clearance_level) localStorage.setItem('clearance_level', me.clearance_level);
    if (me.email) localStorage.setItem('sm_email', me.email);
    if (me.wallet) localStorage.setItem('strata_address', me.wallet);
  } catch (e) {}
  window.__SM_SESSION = me;
  window.currentUser = Object.assign({}, window.currentUser || {}, me);
  window.token = me.token;
  function reveal(){
    var login = document.getElementById('loginPage');
    var portal = document.getElementById('portalPage');
    if (login) { login.style.display = 'none'; login.classList.add('hidden'); }
    if (portal) { portal.style.display = 'block'; portal.style.visibility = 'visible'; portal.classList.add('portal-visible'); }
    var ui = document.getElementById('userInfo');
    if (ui) ui.style.display = 'flex';
    var ue = document.getElementById('userEmail');
    if (ue) ue.textContent = me.email || '';
    var ur = document.getElementById('userRole');
    if (ur) ur.textContent = String(me.role || me.type || 'user').toUpperCase();
    document.body.classList.add('in-session');
  }
  var n = 0;
  function boot(){
    reveal();
    var fn = window.__showPortalImpl || window.showPortal;
    if (typeof fn === 'function' && fn.name !== 'smShowPortalProxy') {
      try { fn(me); } catch (e) { console.warn('showPortal', e); }
      return;
    }
    if (++n < 80) setTimeout(boot, 50);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
</script>`;
  const idx = html.toLowerCase().lastIndexOf('</body>');
  if (idx >= 0) return html.slice(0, idx) + boot + html.slice(idx);
  return html + boot;
}

function sessionToken(request) {
  const h = request.headers.get('Authorization') || '';
  if (h.toLowerCase().startsWith('bearer ')) return h.slice(7).trim();
  const cookie = request.headers.get('Cookie') || '';
  const m = cookie.match(/(?:^|;\s*)sm_token=([^;]+)/);
  if (m) return decodeURIComponent(m[1].trim());
  return '';
}

function landingShellCss() {
  return `:root{--bg:#0a0a0b;--fg:#e8e6e3;--muted:#8a8780;--line:#1c1c1f;--line2:#2a2a2e;--accent:#c4a574;--card:#111113;--ok:#6b8f71;--err:#c45c4a}
*{margin:0;padding:0;box-sizing:border-box}
html,body{overflow-x:hidden;max-width:100%}
body{background:var(--bg);color:var(--fg);font-family:system-ui,sans-serif;font-weight:300;line-height:1.75;min-height:100vh;-webkit-font-smoothing:antialiased}
a{color:var(--accent);text-decoration:none}a:hover{color:var(--fg)}
.top{position:sticky;top:0;z-index:20;background:rgba(10,10,11,.92);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
.top-inner{max-width:44rem;margin:0 auto;padding:.85rem 1.5rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap}
.brand{font-family:ui-monospace,monospace;font-size:.62rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.brand strong{color:var(--fg);font-weight:500}
.lang{font-family:ui-monospace,monospace;font-size:.65rem;letter-spacing:.12em;display:flex;align-items:center;gap:.35rem;color:var(--muted)}
.lang a{color:var(--muted);padding:.2rem .35rem}.lang a.active{color:var(--fg);border-bottom:1px solid var(--accent)}
.wrap{max-width:44rem;margin:0 auto;padding:1.75rem 1.5rem 5rem}
header{margin-bottom:2rem;padding-bottom:1.5rem;border-bottom:1px solid var(--line)}
.kicker{font-family:ui-monospace,monospace;font-size:.65rem;letter-spacing:.18em;text-transform:uppercase;color:var(--muted);margin-bottom:1.15rem}
h1{font-family:system-ui,sans-serif;font-weight:400;font-size:clamp(2rem,5vw,2.8rem);letter-spacing:-.02em;line-height:1.12;margin-bottom:.85rem}
.lead,.muted,p{color:var(--muted);margin-bottom:.9rem}
p strong{color:var(--fg);font-weight:400}
.card{background:var(--card);border:1px solid var(--line);border-radius:4px;padding:1.05rem 1.1rem;margin:1.15rem 0}
.card h3{margin:0 0 .4rem;font-size:.82rem;font-family:ui-monospace,monospace;letter-spacing:.06em;text-transform:uppercase;font-weight:500;color:var(--accent)}
label{display:block;font-family:ui-monospace,monospace;font-size:.62rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin:.7rem 0 .25rem}
input{width:100%;box-sizing:border-box;padding:.75rem .85rem;background:var(--bg);border:1px solid var(--line2);color:var(--fg);border-radius:3px;font:1rem/1.4 system-ui,sans-serif}
.cta-row{display:flex;flex-wrap:wrap;gap:.65rem;margin-top:1.2rem}
.btn,button.btn{display:inline-block;font-family:ui-monospace,monospace;font-size:.68rem;letter-spacing:.1em;text-transform:uppercase;padding:.7rem 1.05rem;border:1px solid var(--accent);color:var(--accent);background:transparent;border-radius:3px;cursor:pointer}
.btn:hover,button.btn:hover{background:var(--accent);color:#111}
.btn.ghost{border-color:var(--line2);color:var(--muted)}
.btn.off,button:disabled{opacity:.35;pointer-events:none;border-color:var(--line);color:var(--muted)}
.note{font-size:.88rem;border-left:2px solid var(--line2);padding:.55rem 0 .55rem .9rem;margin:1rem 0;color:var(--muted)}
#msg{min-height:1.4rem;color:var(--err);font-size:.9rem}
.nft{border-bottom:1px solid var(--line);padding:.5rem 0;color:var(--fg);font-family:ui-monospace,monospace;font-size:.78rem}
code{font-family:ui-monospace,monospace;color:var(--fg);font-size:.85em}
footer{margin-top:3rem;padding-top:1.5rem;border-top:1px solid var(--line);font-size:.8rem;color:var(--muted);text-align:center}
footer .mono{font-family:ui-monospace,monospace;font-size:.65rem;letter-spacing:.06em;margin-top:.5rem}
.tick{display:flex;align-items:flex-start;gap:.65rem;margin:1rem 0 .4rem;color:var(--muted);font-size:.9rem;cursor:pointer;line-height:1.4}
.tick input{width:auto;min-width:1.1rem;height:1.1rem;margin:.15rem 0 0;accent-color:var(--accent);flex-shrink:0}
#otp{display:none}`;
}

function landingChrome(pt, title) {
  const home = pt ? '/' : '/en';
  const dash = pt ? '/dashboard' : '/en/dashboard';
  return `<div class="top"><div class="top-inner">
    <div class="brand"><strong>Calhegas Morais</strong> · ${pt ? 'Nó CMN' : 'CMN Node'}</div>
    <div class="lang">
      <a href="/dashboard" class="${pt ? 'active' : ''}" hreflang="pt-PT">PT</a><span class="sep">/</span>
      <a href="/en/dashboard" class="${pt ? '' : 'active'}" hreflang="en-GB">EN</a>
    </div>
  </div></div>
<main class="wrap" id="conteudo">
<header>
  <p class="kicker">${pt ? 'Laboratório · painel da conta' : 'Laboratory · account panel'}</p>
  <h1>${title}</h1>`;
}

function landingFoot(pt) {
  return `<footer>
    <p>Calhegas Morais · StrataMesh TRD · ${pt ? 'laboratório' : 'laboratory'}</p>
    <p class="mono">FOG-NODE-PT-CM-001 · Lisboa</p>
    <p class="mono"><a href="${pt ? '/' : '/en'}">${pt ? 'Início' : 'Home'}</a> · <a href="/chat">${pt ? 'Chat' : 'Chat'}</a> · <a href="https://github.com/StrataMesh-Laboratory/stratamesh-core">GitHub</a></p>
  </footer></main>`;
}

function dashboardGateHtml(lang, opts) {
  const pt = lang !== 'en';
  const title = pt ? 'Entrar' : 'Sign in';
  const presetErr = (opts && opts.error) || '';
  const setpw = (opts && opts.setpw) || '';
  return `<!DOCTYPE html><html lang="${pt ? 'pt-PT' : 'en-GB'}"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title} · Calhegas Morais</title>
<style>${landingShellCss()}</style></head><body>
${landingChrome(pt, title)}
  <p class="lead">${pt
    ? 'O painel instancia-se na <strong>conta registada</strong>. Cada entrada pede o código de 6 dígitos. Novos utilizadores: criar conta (link no e-mail para definir palavra-passe).'
    : 'The panel is instantiated on a <strong>registered account</strong>. Every sign-in asks for the 6-digit code. New users: create an account (email link to set the password).'}</p>
</header>
<div class="card">
  <h3 id="boxTitle">${setpw ? (pt ? 'Definir palavra-passe' : 'Set password') : (pt ? 'Identidade' : 'Identity')}</h3>
  <form id="f">
    <label for="email">Email</label>
    <input id="email" name="email" type="email" autocomplete="username" ${setpw ? '' : 'required'} placeholder="email"/>
    <div id="pwRow">
      <label for="password">${pt ? 'Palavra-passe' : 'Password'}</label>
      <input id="password" name="password" type="password" autocomplete="current-password"/>
    </div>
    <div id="pw2Row" style="display:none">
      <label for="password2">${pt ? 'Confirmar palavra-passe' : 'Confirm password'}</label>
      <input id="password2" name="password2" type="password" autocomplete="new-password"/>
    </div>
    <label class="tick" id="staffRow"><input type="checkbox" id="asStaff"/> ${pt ? 'Acesso de pessoal (staff) — mesmas caixas' : 'Staff access — same boxes'}</label>
    <label class="tick" id="termsRow" style="display:none"><input type="checkbox" id="terms"/> ${pt ? 'Aceito os termos do Nó Calhegas Morais (node-1.0)' : 'I accept the Calhegas Morais Node terms (node-1.0)'}</label>
    <div id="otp">
      <label for="code">${pt ? 'Código de 6 dígitos' : '6-digit code'}</label>
      <input id="code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="••••••"/>
    </div>
    <div class="cta-row">
      <button class="btn" type="submit" id="go">${setpw ? (pt ? 'Guardar' : 'Save') : (pt ? 'Entrar' : 'Sign in')}</button>
      <a class="btn ghost" href="${pt ? '/' : '/en'}">${pt ? 'Início' : 'Home'}</a>
    </div>
  </form>
  <p id="msg">${presetErr.replace(/[<>&]/g, '')}</p>
  <p class="note" id="links">
    <a href="#" id="toReg">${pt ? 'Criar conta' : 'Create account'}</a>
    · <a href="#" id="toReset">${pt ? 'Repor palavra-passe' : 'Reset password'}</a>
    · <a href="#" id="toLogin">${pt ? 'Já tenho conta' : 'I have an account'}</a>
  </p>
</div>
${landingFoot(pt)}
<script>
const pt = ${pt ? 'true' : 'false'};
const SETPW = ${JSON.stringify(setpw)};
let challenge = null, kind = 'user', mode = SETPW ? 'setpw' : 'login';
const otp = document.getElementById('otp');
const msg = document.getElementById('msg');
function asStaff(){ return !!(document.getElementById('asStaff') && document.getElementById('asStaff').checked); }
function show(id, on){ const el=document.getElementById(id); if(el) el.style.display = on ? '' : 'none'; }
function setMode(m){
  mode = m; challenge = null;
  show('pwRow', m==='login' || m==='setpw');
  show('pw2Row', m==='setpw');
  show('staffRow', m==='login');
  show('termsRow', m==='register');
  otp.style.display = 'none';
  const t = document.getElementById('boxTitle');
  const go = document.getElementById('go');
  if(m==='register'){ t.textContent = pt ? 'Criar conta' : 'Create account'; go.textContent = pt ? 'Enviar convite' : 'Send invite'; }
  else if(m==='reset'){ t.textContent = pt ? 'Repor palavra-passe' : 'Reset password'; go.textContent = pt ? 'Enviar link' : 'Send link'; }
  else if(m==='setpw'){ t.textContent = pt ? 'Definir palavra-passe' : 'Set password'; go.textContent = pt ? 'Guardar' : 'Save'; }
  else { t.textContent = pt ? 'Identidade' : 'Identity'; go.textContent = pt ? 'Entrar' : 'Sign in'; }
  msg.textContent = '';
}
document.getElementById('toReg').onclick = (e)=>{ e.preventDefault(); setMode('register'); };
document.getElementById('toReset').onclick = (e)=>{ e.preventDefault(); setMode('reset'); };
document.getElementById('toLogin').onclick = (e)=>{ e.preventDefault(); setMode('login'); };
if (SETPW) setMode('setpw');
function saveToken(token, type) {
  const t = type || kind || 'user';
  try {
    localStorage.setItem('sm_token', token);
    localStorage.setItem('token', token);
    localStorage.setItem('auth_type', t);
  } catch (_) {}
  document.cookie = 'sm_token=; Path=/; Max-Age=0; Secure; SameSite=Lax';
  document.cookie = 'sm_token=' + encodeURIComponent(token) + '; Path=/; SameSite=Lax; Secure; Max-Age=2592000';
  document.cookie = 'auth_type=' + encodeURIComponent(t) + '; Path=/; SameSite=Lax; Secure; Max-Age=2592000';
  location.replace((pt ? '/dashboard' : '/en/dashboard') + '?auth=' + encodeURIComponent(token));
}
document.getElementById('f').onsubmit = async (e) => {
  e.preventDefault();
  msg.style.color = 'var(--muted)';
  msg.textContent = '';
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const password2 = (document.getElementById('password2').value || '');
  const code = (document.getElementById('code').value || '').trim();
  const staff = asStaff();
  try {
    if (mode === 'register') {
      if (!email) { msg.style.color='var(--err)'; msg.textContent = pt ? 'E-mail obrigatório.' : 'Email required.'; return; }
      if (!document.getElementById('terms').checked) { msg.style.color='var(--err)'; msg.textContent = pt ? 'Aceite os termos.' : 'Accept the terms.'; return; }
      const r = await fetch('/api/auth/register', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, lang: pt ? 'pt' : 'en', terms_accepted: true, terms_version: 'node-1.0' }) });
      const j = await r.json().catch(() => ({}));
      msg.style.color = j.success ? 'var(--muted)' : 'var(--err)';
      msg.textContent = j.message || j.error || (pt ? 'Consulte o e-mail para definir a palavra-passe.' : 'Check email to set your password.');
      return;
    }
    if (mode === 'reset') {
      if (!email) { msg.style.color='var(--err)'; msg.textContent = pt ? 'Indique o e-mail.' : 'Enter the email.'; return; }
      const r = await fetch('/api/auth/forgot-password', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, lang: pt ? 'pt' : 'en' }) });
      const j = await r.json().catch(() => ({}));
      msg.style.color = j.success ? 'var(--muted)' : 'var(--err)';
      msg.textContent = j.message || j.error || (pt ? 'Se o e-mail existir, foi enviado um link (1 hora).' : 'If the email exists, a 1-hour link was sent.');
      return;
    }
    if (mode === 'setpw') {
      if (password.length < 8) { msg.style.color='var(--err)'; msg.textContent = pt ? 'Mín. 8 caracteres.' : 'Min. 8 characters.'; return; }
      if (password !== password2) { msg.style.color='var(--err)'; msg.textContent = pt ? 'As palavras-passe não coincidem.' : 'Passwords do not match.'; return; }
      const r = await fetch('/api/auth/set-password', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ token: SETPW, password, lang: pt ? 'pt' : 'en' }) });
      const j = await r.json().catch(() => ({}));
      if (!j.success) { msg.style.color='var(--err)'; msg.textContent = j.error || (pt ? 'Link inválido ou expirado.' : 'Invalid or expired link.'); return; }
      msg.textContent = j.message || (pt ? 'Palavra-passe definida. Entre com o código 2FA.' : 'Password set. Sign in with 2FA.');
      history.replaceState({}, '', location.pathname);
      setMode('login');
      return;
    }
    if (challenge) {
      if (!code) { msg.style.color='var(--err)'; msg.textContent = pt ? 'Introduza o código.' : 'Enter the code.'; return; }
      const url = (kind === 'staff' || staff) ? '/api/auth/staff/2fa' : '/api/auth/email/verify';
      const r = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ challenge, code, email }) });
      const j = await r.json().catch(() => ({}));
      if (j.success && (j.token || j.session_token)) { saveToken(j.token || j.session_token, j.type || kind); return; }
      msg.style.color='var(--err)';
      msg.textContent = j.error || (pt ? 'Código inválido.' : 'Invalid code.');
      return;
    }
    const url = staff ? '/api/auth/staff/login' : '/api/auth/login';
    const r = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, password, lang: pt ? 'pt' : 'en' }) });
    const j = await r.json().catch(() => ({}));
    if (j.requires_2fa && j.challenge) {
      challenge = j.challenge;
      kind = staff || j.type === 'staff' || j.channel === 'totp' ? 'staff' : 'user';
      otp.style.display = 'block';
      document.getElementById('code').focus();
      document.getElementById('go').textContent = pt ? 'Confirmar código' : 'Confirm code';
      msg.textContent = j.message || (pt ? 'Código enviado.' : 'Code sent.');
      return;
    }
    if (j.success && (j.token || j.session_token)) {
      saveToken(j.token || j.session_token, j.type || kind || (staff ? 'staff' : 'user'));
      return;
    }
    msg.style.color = 'var(--err)';
    msg.textContent = j.error || (pt ? 'Falha no login.' : 'Login failed.');
  } catch (err) {
    msg.style.color = 'var(--err)';
    msg.textContent = String(err.message || err);
  }
};
</script>
</body></html>`;
}
function dashboardAppHtml(lang, me, sub) {
  const pt = lang !== 'en';
  const staticOnly = !!(sub && sub.static_only);
  const bal = sub && sub.balance != null ? sub.balance : (me.balance || 0);
  const mode = (sub && sub.mode) || (staticOnly ? 'static' : 'live');
  return `<!DOCTYPE html><html lang="${pt ? 'pt-PT' : 'en-GB'}"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${pt ? 'Painel' : 'Dashboard'} · Calhegas Morais</title>
<style>${landingShellCss()}</style></head><body>
${landingChrome(pt, pt ? 'Painel' : 'Dashboard')}
  <p class="lead">${me.email || ''} · ${me.type || 'user'} · wallet <code>${me.wallet || '—'}</code></p>
</header>
<p>${pt ? 'Saldo' : 'Balance'} <code id="bal">${bal}</code> STRATA · ${pt ? 'modo' : 'mode'} <code id="mode">${mode}</code> · floor 0.1</p>
<p>${pt ? 'Ciclo' : 'Lifecycle'} #mint → <code id="minted">—</code> · #0 ← <code id="burned">—</code> · ${pt ? 'circulante' : 'circulating'} <code id="circ">${bal}</code></p>
<p class="note">${staticOnly ? (pt ? 'Sem subsistência: só NFT estáticos. Acções que gastam recursos estão bloqueadas.' : 'No subsistence: static NFTs only. Resource-spending actions are locked.') : (pt ? 'PdC credita esta carteira desde #mint. Serviços queimam para #0. Contratação é transferência, não emissão.' : 'PoC credits this wallet from #mint. Services burn to #0. Hire is transfer, not mint.')}</p>
<div class="card">
  <h3>${pt ? 'Acções com recurso' : 'Resource actions'}</h3>
  <div class="cta-row">
    <a class="btn ${staticOnly ? 'off' : ''}" data-act="orch_chat" href="/chat">${pt ? 'Orquestrador' : 'Orchestrator'}</a>
    <a class="btn ${staticOnly ? 'off' : ''}" data-act="sandbox_run" href="/painel">${pt ? 'Sandbox OS' : 'OS sandbox'}</a>
    <a class="btn ghost ${staticOnly ? 'off' : ''}" data-act="va_api" href="/api/edge/SPEC.txt">VA API</a>
  </div>
</div>
<div class="card">
  <h3>${pt ? 'NFT estáticos — sem queima' : 'Static NFTs — no burn'}</h3>
  <div id="nfts">${pt ? 'A carregar…' : 'Loading…'}</div>
</div>
<div class="card">
  <h3>${pt ? 'Eventos on-graph' : 'On-graph events'}</h3>
  <div id="evs">${pt ? 'A carregar…' : 'Loading…'}</div>
</div>
<div class="cta-row">
  <a class="btn ghost" href="${pt ? '/' : '/en'}">${pt ? 'Início' : 'Home'}</a>
  <button class="btn ghost" type="button" id="out">${pt ? 'Sair' : 'Sign out'}</button>
</div>
<script>
const TOKEN = localStorage.getItem('sm_token') || localStorage.getItem('token') || '';
const STATIC = ${staticOnly ? 'true' : 'false'};
async function tick(action) {
  if (!TOKEN) return;
  const r = await fetch('/api/auth/payg/tick', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+TOKEN }, body: JSON.stringify({ action: action || 'dashboard_tick' }) });
  const j = await r.json().catch(() => ({}));
  if (j.balance != null) document.getElementById('bal').textContent = j.balance;
  if (j.mode) document.getElementById('mode').textContent = j.mode;
  if (j.balance != null) document.getElementById('circ').textContent = j.balance;
  if (j.mode === 'static' && !STATIC) location.reload();
  return j;
}
tick('dashboard_tick');
setInterval(() => tick('dashboard_tick'), 15000);
document.querySelectorAll('a.btn[data-act]').forEach((a) => {
  a.addEventListener('click', async (e) => {
    if (STATIC) { e.preventDefault(); return; }
    const j = await tick(a.getAttribute('data-act'));
    if (j && j.ok === false) { e.preventDefault(); alert(j.reason || 'PAYG'); }
  });
});
document.getElementById('out').onclick = () => {
  localStorage.removeItem('sm_token'); localStorage.removeItem('token');
  document.cookie = 'sm_token=; Path=/; Max-Age=0';
  location.href = '/dashboard';
};
(async () => {
  const wallet = ${JSON.stringify(me.wallet || '')};
  const box = document.getElementById('nfts');
  const evs = document.getElementById('evs');
  try {
    const lr = await fetch('/api/auth/lifecycle', { headers: { Authorization: 'Bearer ' + TOKEN } });
    const life = await lr.json().catch(() => ({}));
    if (life.minted_from_mint != null) document.getElementById('minted').textContent = life.minted_from_mint;
    if (life.burned_to_zero != null) document.getElementById('burned').textContent = life.burned_to_zero;
    if (life.circulating != null) document.getElementById('circ').textContent = life.circulating;
    const events = life.events || [];
    if (!events.length) evs.textContent = ${JSON.stringify(pt ? 'Ainda sem eventos. Abrir a conta não emite STRATA.' : 'No events yet. Opening an account is not a mint.')};
    else {
      evs.innerHTML = '';
      events.slice(0, 20).forEach((e) => {
        const d = document.createElement('div');
        d.className = 'nft';
        d.textContent = [e.kind, e.pole || '', e.amount, e.action || e.reason || ''].filter(Boolean).join(' · ');
        evs.appendChild(d);
      });
    }
  } catch (e) { evs.textContent = '—'; }
  try {
    const r = await fetch('/api/token/list?owner=' + encodeURIComponent(wallet), { headers: { Authorization: 'Bearer ' + TOKEN } });
    const j = await r.json().catch(() => ({}));
    const list = j.tokens || j.nfts || j.items || [];
    if (!list.length) { box.textContent = ${JSON.stringify(pt ? 'Nenhum NFT nesta carteira.' : 'No NFTs on this wallet.')}; return; }
    box.innerHTML = '';
    list.slice(0, 40).forEach((t) => {
      const d = document.createElement('div');
      d.className = 'nft';
      d.textContent = (t.title || t.id || t.token_id || t.cid || JSON.stringify(t)).toString().slice(0, 120);
      box.appendChild(d);
    });
  } catch (e) { box.textContent = ${JSON.stringify(pt ? 'NFT indisponível.' : 'NFTs unavailable.')}; }
})();
</script>
${landingFoot(pt)}
</body></html>`;
}

function jsonResponse(data, corsHeaders, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

const fallbackPortal = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>StrataMesh</title><style>body{font-family:sans-serif;background:#0a0a1a;color:#e0e0e0;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}.box{background:#1a1a3e;border:1px solid #2a2a5a;border-radius:12px;padding:40px;text-align:center}h1{color:#6366f1}</style></head><body><div class="box"><h1>StrataMesh Portal</h1><p>Portal content unavailable — check D1 site_content key portal-en / portal-pt.</p></div></body></html>';