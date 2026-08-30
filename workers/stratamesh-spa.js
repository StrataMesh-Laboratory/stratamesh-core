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
      '/favicon-32.png': { type: 'image/png', b64: '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' },
      '/favicon.png': { type: 'image/png', b64: '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' },
      '/apple-touch-icon.png': { type: 'image/png', b64: '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' },
      '/apple-touch-icon-precomposed.png': { type: 'image/png', b64: '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' },
      '/icon-192.png': { type: 'image/png', b64: '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' },
      '/favicon.ico': { type: 'image/x-icon', b64: 'AAABAAEAEBAAAAAAIAAaAwAAFgAAAIlQTkcNChoKAAAADUlIRFIAAAAQAAAAEAgGAAAAH/P/YQAAAuFJREFUeJxV089vFHUYx/H3d2ZnZne6043uLxda3SXgbyQgm1joBqIxUozATeQgxoMHQ/wLjMaTBxNC9CTxwMWjPy6NiYdWi6S1yRIFCyUmdNMUKixdsdudnfnOd+brAdm4nz/glc+T53kEgNZaa+DGhQssXbyI6boIwJIR8dYWhmkQhJIXjk6x6/RpAIQQAiAFMHf+PLlr1+lcuUKwvIxjWSRBwFKtRq5ex1AKnZJcv9vm9k8/oyLJw6QAjOlpyvO/EpdLjFcqSCHIdruU6nX2fvE5oueDZaNkiOgHXFqYHwZc02Rl8iA/HnuDTKeDdLOUrv7OTr+HkAluBEoGpE2D2EnjOM4woIKAWqvF6NQRquUKKzJk59ot0rZDO/6HHy59zVi+SqQET1d2EMhgGEBKkiBgsdmksL/OwuUm1c4G28tlvmt+w/TCNM9texEpJfPeIvsfeWYAGAAkCYmKmZiYwLIsGo0GhXyBzlaHe5s+Ne8ptIrxUmlyeoRe2B8GhBAkSYJt28SRIjeawxQCGSnyzmN4KRdkgpcaQYuERKnhEbTWaEPgOA6uEPStFAiBl8lSTOfZdDz+DG9jonl992uIe/Fwg0QItFLEUnLu7FlWWy0MNDqGl57fy9HJQ7QLircPn2Lf2G780B8GwmKJO4cayFKFuT+W6EaS9YkGG56HZ1g8/ug4loiwTRs/8DEMYxjIvnWS+7favPr9V3y6rcSzM/PsuzqDiSS430d1Q4j7ZBKL1ZVVisXiABAAoVb6zCvnUDPXMCp12o5LsTXHyFSew59M8tvaMl9G3/Km/TJPdsZ499Q7uBlXDACdJLp1Z4OPP5tlJLWdjJ0ltgVm/xeOnKix3Fun72/x18o6Z46/x47x6uCZxIMzSLQQAumv8eFHi8zOdul10+zZc5MP3q/z90ZIyjI5cPAA2cIoWmsMw/hfgwfhP5TNzZtcbq4SKcloLkepXKb2RJWHKxdCDBr8C6MgOpCOec7JAAAAAElFTkSuQmCC' },
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
    return new Response(dashboardGateHtml(lang, { error: qAuth ? (lang === 'en' ? 'Session rejected after 2FA.' : 'Sessão recusada após 2FA.') : '' }), {
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
  window.currentUser = me;
  window.token = me.token;
  function boot(){
    try {
      if (typeof showPortal === 'function') { showPortal(me); return; }
    } catch (e) {}
    setTimeout(boot, 40);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
</script></body>`;
  if (html.includes('</body>')) return html.replace('</body>', boot);
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
  return `<!DOCTYPE html><html lang="${pt ? 'pt-PT' : 'en-GB'}"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title} · Calhegas Morais</title>
<style>${landingShellCss()}</style></head><body>
${landingChrome(pt, title)}
  <p class="lead">${pt
    ? 'O painel instancia-se na <strong>conta registada</strong>. Anónimos não têm painel. Depois da palavra-passe, o Nó pede o código de 6 dígitos (e-mail ou app).'
    : 'The panel is instantiated on a <strong>registered account</strong>. Anonymous visitors have none. After the password, the Node asks for the 6-digit code (email or app).'}</p>
</header>
<div class="card">
  <h3>${pt ? 'Identidade' : 'Identity'}</h3>
  <form id="f">
    <label for="email">Email</label>
    <input id="email" name="email" type="email" autocomplete="username" required placeholder="email"/>
    <label for="password">${pt ? 'Palavra-passe' : 'Password'}</label>
    <input id="password" name="password" type="password" autocomplete="current-password" required/>
    <label class="tick"><input type="checkbox" id="asStaff"/> ${pt ? 'Acesso de pessoal (staff) — não é conta comum' : 'Staff login — not a common-user account'}</label>
    <div id="otp">
      <label for="code">${pt ? 'Código de 6 dígitos' : '6-digit code'}</label>
      <input id="code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="••••••"/>
    </div>
    <div class="cta-row">
      <button class="btn" type="submit" id="go">${pt ? 'Entrar' : 'Sign in'}</button>
      <a class="btn ghost" href="${pt ? '/' : '/en'}">${pt ? 'Início' : 'Home'}</a>
    </div>
  </form>
  <p id="msg">${presetErr.replace(/[<>&]/g, '')}</p>
  <p class="note">${pt ? 'Com o visto de pessoal, o Nó usa /staff/login (2FA e-mail ou TOTP) e abre o painel completo. Sem o visto, entra como utilizador comum.' : 'With the staff tick, the Node uses /staff/login (email or TOTP 2FA) and opens the full panel. Unticked = common user.'}</p>
</div>
${landingFoot(pt)}
<script>
const pt = ${pt ? 'true' : 'false'};
let challenge = null, kind = 'user';
const otp = document.getElementById('otp');
const msg = document.getElementById('msg');
function asStaff(){ return !!(document.getElementById('asStaff') && document.getElementById('asStaff').checked); }
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
  const dest = (pt ? '/dashboard' : '/en/dashboard') + '?auth=' + encodeURIComponent(token);
  location.replace(dest);
}
document.getElementById('f').onsubmit = async (e) => {
  e.preventDefault();
  msg.textContent = '';
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const code = (document.getElementById('code').value || '').trim();
  const staff = asStaff();
  try {
    if (challenge) {
      if (!code) { msg.textContent = pt ? 'Introduza o código.' : 'Enter the code.'; return; }
      const url = (kind === 'staff' || staff) ? '/api/auth/staff/2fa' : '/api/auth/email/verify';
      const r = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ challenge, code, email }) });
      const j = await r.json().catch(() => ({}));
      if (j.success && (j.token || j.session_token)) { saveToken(j.token || j.session_token, j.type || kind); return; }
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
      msg.style.color = 'var(--muted)';
      msg.textContent = j.message || (pt ? 'Código enviado.' : 'Code sent.');
      return;
    }
    if (j.success && (j.token || j.session_token)) { saveToken(j.token || j.session_token, j.type || (staff ? 'staff' : 'user')); return; }
    msg.style.color = 'var(--err)';
    msg.textContent = j.error || (pt ? 'Falha no login.' : 'Login failed.');
  } catch (err) {
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