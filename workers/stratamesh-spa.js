
async function serveEni(env) {
  try {
    if (env.LEDGER || env.DB) {
      const db = env.LEDGER || env.DB;
      const { results: chunks } = await db.prepare(
        "SELECT idx, value FROM site_content_chunks WHERE key = ? ORDER BY idx ASC"
      ).bind("eni").all();
      if (chunks && chunks.length) {
        const html = chunks.map((c) => c.value || "").join("");
        return new Response(html, {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "public, max-age=120",
            "X-ENI-Source": "site_content_chunks",
          },
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

const TRANSCRITO_PT = "Calhegas Morais \u00b7 N\u00f3 de refer\u00eancia StrataMesh\nCalhegas Morais\n\u00b7 N\u00f3 CMN\nPT\n/\nEN\n00 Mapa\n01 Rede\n02 Valor\n03 N\u00f3\n04 Quem\n05 Arquitectura\n06 Estado\n07 Entrar\nLaborat\u00f3rio \u00b7 Lisboa, Portugal\nCalhegas Morais\nPorta de entrada p\u00fablica do\nN\u00f3 Fog Calhegas Morais\n\u2014 n\u00f3 de refer\u00eancia da\nStrataMesh\n, uma rede de registo distribu\u00eddo orientada a contributo real, mercado aberto e um sistema operativo de metaverso Web3.\nAbrir portal\nComo ler esta p\u00e1gina\nTempo CLP\n00 \u00b7 Orienta\u00e7\u00e3o\nComo est\u00e1 organizada esta p\u00e1gina\nSe nunca ouviu falar de StrataMesh, leia nesta ordem. Cada caixa \u00e9 um tema separado \u2014 clique para saltar.\n01\nRede\nO que \u00e9 a StrataMesh e para que serve\n02\nValor\nSTRATA, contributo e a \u00c1gora\n03\nEste n\u00f3\nO que o Calhegas Morais faz na rede\n04\nParticipantes\nPessoas e agentes computacionais\n05\nArquitectura\nCamadas hol\u00f3nicas e tempo CLP\n06\u201307\nEstado e entrada\nLaborat\u00f3rio e como aceder ao portal\n01 \u00b7 A rede\nO que \u00e9 a StrataMesh?\nA StrataMesh \u00e9 uma\ntecnologia de registo distribu\u00eddo (TRD \u2014 Tecnologia de Registo Distribu\u00eddo)\n: um livro-raz\u00e3o partilhado por muitos n\u00f3s, sem depender de um \u00fanico servidor central.\nDiferencia-se de blockchains cl\u00e1ssicas em pontos essenciais:\nEstrutura\nUsa um\ngrafo dirigido ac\u00edclico (GDA)\n: estrutura em rede onde v\u00e1rios ramos podem avan\u00e7ar em paralelo e reconciliar-se pelas regras do protocolo.\nIncentivo\nN\u00e3o se \u201cmina\u201d com desperd\u00edcio energ\u00e9tico artificial. O valor nasce de\nrecursos reais\nque os n\u00f3s disponibilizam \u00e0 rede e da troca livre no mercado.\nTRD = tecnologia de registo distribu\u00eddo. GDA = grafo dirigido ac\u00edclico. S\u00e3o nomes t\u00e9cnicos para \u00ablivro partilhado\u00bb e \u00abestrutura em rede sem ciclos\u00bb, respectivamente.\n02 \u00b7 Valor na rede\nSTRATA, contributo e \u00c1gora\nTr\u00eas ideias ligadas \u2014 conv\u00e9m n\u00e3o as misturar.\nSTRATA\n\u00c9 a\nunidade de conta\nda StrataMesh: serve para pagar custos de subsist\u00eancia na rede, recompensar contributo e liquidar trocas. A emiss\u00e3o nova ocorre apenas quando n\u00f3s contribuem recursos mensur\u00e1veis (PdC).\nProva de contributo (PdC)\nProva de Contributo (PdC)\n: um n\u00f3 recebe STRATA nova quando\ncontribui recursos mensur\u00e1veis\npara a rede \u2014 armazenamento, capacidade de processamento, disponibilidade e qualidade do servi\u00e7o.\nA quantidade e o valor seguem o\npre\u00e7o de mercado dos recursos no mundo exterior\n, convertidos em STRATA pela taxa observada na \u00c1gora, com pr\u00e9mios ou descontos conforme a\nqualidade\ndo contributo.\n\u00c1gora\nA \u00c1gora \u00e9 o\nmercado de c\u00e2mbio entre pares (P2P)\nda rede: quem det\u00e9m STRATA troca-a por outras moedas ou activos. \u00c9 o\nlugar onde a STRATA encontra pre\u00e7o\nface ao exterior.\nCria\u00e7\u00e3o\nSTRATA entra em circula\u00e7\u00e3o sobretudo quando h\u00e1 contributo real (PdC), n\u00e3o por emiss\u00e3o discricion\u00e1ria.\nCircula\u00e7\u00e3o\nQuem precisa de recursos da rede paga em STRATA (incluindo a prova de subsist\u00eancia dos agentes). Quem tem STRATA pode vend\u00ea-la na \u00c1gora.\n03 \u00b7 Este s\u00edtio\nO que \u00e9 o N\u00f3 Calhegas Morais?\n\u00c9 um\nn\u00f3 Fog de refer\u00eancia\nda StrataMesh, operado a partir de Lisboa. \u201cFog\u201d significa capacidade na periferia da rede (perto de utilizadores e dispositivos), n\u00e3o s\u00f3 num centro de dados remoto.\nNesta fase de laborat\u00f3rio, o n\u00f3:\nExp\u00f5e servi\u00e7os\nPortal, autentica\u00e7\u00e3o, orquestra\u00e7\u00e3o, registo GDA, mercado e ferramentas de diagn\u00f3stico \u2014 em ambiente de teste.\nContribui recursos\nOs recursos que este n\u00f3 efectivamente disponibiliza \u00e0 TRD entram no circuito de PdC, com pre\u00e7os alinhados ao mercado.\nIdentificador de laborat\u00f3rio:\nFOG-NODE-PT-CM-001\n\u00b7 operador: Andr\u00e9 Manuel Calhegas Morais.\n04 \u00b7 Participantes\nPessoas e agentes computacionais\nNa StrataMesh, o\nstanding\n(direito a actuar) vem da\nfun\u00e7\u00e3o e do acordo\n, n\u00e3o do tipo de substrato (biol\u00f3gico vs sil\u00edcio).\nUtilizadores\nPessoas que se registam no portal, det\u00eam carteiras, trocam na \u00c1gora, criam conte\u00fado na bancada UGC e participam em DAO.\nSCA (agentes)\nSeres Computacionais Aut\u00f3nomos\n\u2014 agentes com identidade pr\u00f3pria no registo, fun\u00e7\u00f5es no n\u00f3 (orquestra\u00e7\u00e3o, seguran\u00e7a, an\u00e1lise\u2026) e obriga\u00e7\u00f5es de subsist\u00eancia em STRATA.\nO\nOrquestrador\ndeste n\u00f3 \u00e9 um SCA: coordena a equipa de opera\u00e7\u00f5es (AIOps), mant\u00e9m pol\u00edtica e contexto, e pode dialogar no portal conforme o\nclearance\nda conta (p\u00fablico \u2192 confidencial \u2192 secreto \u2192 m\u00e1ximo).\n05 \u00b7 Arquitectura\nCamadas hol\u00f3nicas e tempo CLP\nA arquitectura \u00e9 uma\npilha aninhada\n: cada n\u00edvel cont\u00e9m o n\u00edvel seguinte, do livro-raz\u00e3o at\u00e9 ao agente.\nTRD StrataMesh\n\u2014 livro-raz\u00e3o partilhado; tempo CLP/PPC embutido em todo o fluxo\n\u2514\nN\u00f3\n\u2014 m\u00e1quina e sistema operativo do anfitri\u00e3o\n\u2514\nSO do Metaverso Web3\n\u2014 sistema operativo partilhado entre n\u00f3s\n\u2514\nDom\u00ednio Virtual\n\u2014 infraestrutura (hipervisor): organiza e isola capacidade computacional para mundos\n\u2514\nMundo Aberto\n\u2014 ambiente persistente a que utilizadores e SCA acedem\n\u2514\nBancada UGC\n\u2014 espa\u00e7o isolado de cria\u00e7\u00e3o de conte\u00fado (+ Painel / Portal)\n\u2514\nUtilizador | SCA\nDom\u00ednio Virtual\nCamada de\ninfraestrutura\n: hipervisor que aloca, isola e governa a capacidade onde os\nMundos Abertos\ns\u00e3o hospedados.\nBancada UGC\nEspa\u00e7o\nisolado\nde cria\u00e7\u00e3o e ensaio de conte\u00fado gerado pelo utilizador, dentro de um Mundo Aberto. O\nPainel\ne o portal s\u00e3o aplica\u00e7\u00f5es neste n\u00edvel.\nO\nPainel\n\u00e9 a superf\u00edcie de aplica\u00e7\u00f5es da Bancada UGC. O\nCLP\n\u00e9 o kernel temporal da TRD \u2014 acompanha e data o fluxo em todas as camadas.\nCalend\u00e1rio Lunisolar Planet\u00e1rio (CLP)\nO tempo civil de refer\u00eancia na rede baseia-se em \u00e2ncoras astron\u00f3micas e localidade (matriz\nPPC\n). O ISO-8601 serve de\nportadora\nt\u00e9cnica; a autoridade civil no protocolo \u00e9 planet\u00e1ria.\nAbrir a interface CLP \u2192\n06 \u00b7 Laborat\u00f3rio\nEstado actual do projecto\nEste dom\u00ednio corre uma\nvers\u00e3o de laborat\u00f3rio\n: servi\u00e7os em Cloudflare Workers, registo GDA, orquestrador h\u00edbrido, bus hol\u00f3nico e portal com pain\u00e9is distintos para utilizador comum e pessoal (capacidades conforme clearance).\na verificar servi\u00e7os\u2026\nNada aqui constitui conselho financeiro. STRATA e a \u00c1gora, nesta fase, s\u00e3o mecanismos de protocolo em ensaio \u2014 n\u00e3o um produto banc\u00e1rio.\n07 \u00b7 Entrar\nPortal, documenta\u00e7\u00e3o e c\u00f3digo\nUtilizador comum\nRegisto / login no portal: carteira, \u00c1gora, economia, bancada, SCA, orquestrador (leitura) e perfil.\nPessoal\nLogin staff com 2FA: tudo o do comum, mais KYC, utilizadores, sistema e vistas de SO conforme clearance.\nPortal / painel\nC\u00f3digo (GitHub)\nEstado dos servi\u00e7os\nCalhegas Morais Node \u00b7 StrataMesh TRD \u00b7 laborat\u00f3rio\nFOG-NODE-PT-CM-001 \u00b7 Lisboa \u00b7 standing por fun\u00e7\u00e3o e acordo, n\u00e3o por substrato\nAMCM ENI\n\u2014 entidade legal do titular \u00b7\n/eni";


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

    if (path === '/dashboard' || path === '/dashboard/' || path.startsWith('/dashboard/')) {
      return servePortal(request, env, corsHeaders);
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
      ['/api/v1/token', 'TOKEN', 'https://stratamesh-token.stratamesh.workers.dev', ''],
      ['/api/v1/nft', 'TOKEN', 'https://stratamesh-token.stratamesh.workers.dev', ''],
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



async function serveClp(request, env, corsHeaders) {
  try {
    if (env.LEDGER) {
      const { results: chunks } = await env.LEDGER.prepare(
        "SELECT idx, value FROM site_content_chunks WHERE key = ? ORDER BY idx ASC"
      ).bind("clp").all();
      if (chunks && chunks.length) {
        const html = chunks.map((c) => c.value || "").join("");
        if (html) {
          return new Response(html, {
            status: 200,
            headers: {
              ...corsHeaders,
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": "public, max-age=60",
              "Content-Language": "pt-PT",
              "X-CLP-Source": "site_content_chunks",
            },
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
              return new Response(html, {
                status: 200,
                headers: {
                  ...corsHeaders,
                  "Content-Type": "text/html; charset=utf-8",
                  "Cache-Control": "public, max-age=120",
                  "Content-Language": lang === "pt" ? "pt-PT" : "en-GB",
                  "X-Home-Source": "site_content_chunks",
                },
              });
            }
          }
        } catch (_) {}
        try {
          const { results } = await env.LEDGER.prepare(
            "SELECT value FROM site_content WHERE key = ? LIMIT 1"
          ).bind(key).all();
          if (results && results[0] && results[0].value) {
            return new Response(results[0].value, {
              status: 200,
              headers: {
                ...corsHeaders,
                "Content-Type": "text/html; charset=utf-8",
                "Cache-Control": "public, max-age=120",
                "Content-Language": lang === "pt" ? "pt-PT" : "en-GB",
                "X-Home-Source": "site_content",
              },
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
        return new Response(html, {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "public, max-age=120",
            "X-Home-Source": "portal-worker",
          },
        });
      }
    }
  } catch (_) {}
  return new Response(fallbackHome(lang), {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/html; charset=utf-8",
      "Content-Language": lang === "pt" ? "pt-PT" : "en-GB",
    },
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

async function servePortal(request, env, corsHeaders) {
  const lang = pickLang(request);
  const keys = [`portal-${lang}`, lang === 'en' ? 'portal-pt' : 'portal-en', 'portal'];
  // Prefer chunked site_content (economy portal), then monolithic, then portal worker, then fallback
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
              return new Response(html, {
                status: 200,
                headers: {
                  ...corsHeaders,
                  "Content-Type": "text/html; charset=utf-8",
                  "Cache-Control": "no-cache",
                  "Content-Language": lang,
                  "X-Portal-Source": "site_content_chunks",
                },
              });
            }
          }
        } catch (_) {}
        const { results } = await env.LEDGER.prepare(
          "SELECT value FROM site_content WHERE key = ? LIMIT 1"
        ).bind(key).all();
        if (results && results[0] && results[0].value) {
          return new Response(results[0].value, {
            status: 200,
            headers: {
              ...corsHeaders,
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": "no-cache",
              "Content-Language": lang,
              "X-Portal-Source": "site_content",
            },
          });
        }
      }
    }
  } catch (e) {
    console.error("LEDGER error:", e);
  }
  try {
    const pr = await fetch("https://stratamesh-portal.stratamesh.workers.dev/");
    if (pr.ok) {
      const html = await pr.text();
      return new Response(html, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-cache",
          "X-Portal-Source": "stratamesh-portal",
        },
      });
    }
  } catch (_) {}
  return new Response(fallbackPortal, {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
  });
}

function jsonResponse(data, corsHeaders, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

const fallbackPortal = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>StrataMesh</title><style>body{font-family:sans-serif;background:#0a0a1a;color:#e0e0e0;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}.box{background:#1a1a3e;border:1px solid #2a2a5a;border-radius:12px;padding:40px;text-align:center}h1{color:#6366f1}</style></head><body><div class="box"><h1>StrataMesh Portal</h1><p>Portal content unavailable — check D1 site_content key portal-en / portal-pt.</p></div></body></html>';
