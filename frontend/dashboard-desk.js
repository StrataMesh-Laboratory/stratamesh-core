/* StrataMesh dashboard desk overlay — last script wins.
   Wallet autoload, L-STRATA vs PoC, Agora lab books, Unix atelier,
   CLP widget, expanded Chambers/Compacts/Edge/Identity, safe isScaUser. */
(function () {
  'use strict';
  var PT = (function () {
    try {
      if (window.__FORCE_LANG === 'en') return false;
      if (window.LANG === 'en') return false;
      var h = (document.documentElement.lang || '').toLowerCase();
      if (h.indexOf('en') === 0) return false;
      if (location.pathname.indexOf('/en') === 0) return false;
    } catch (_) {}
    return true;
  })();
  function t(pt, en) { return PT ? pt : en; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&', '<': '<', '>': '>', '"': '"' }[c];
    });
  }
  function el(id) { return document.getElementById(id); }
  function setText(id, v) { var n = el(id); if (n) n.textContent = v; }
  function authH() {
    var h = { Accept: 'application/json' };
    try {
      var tok = window.token || localStorage.getItem('sm_token') || localStorage.getItem('token');
      if (tok) h.Authorization = 'Bearer ' + tok;
    } catch (_) {}
    return h;
  }
  async function getJSON(url) {
    var r = await fetch(url, { headers: authH(), signal: AbortSignal.timeout(14000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }
  function fmt(n, d) {
    if (n == null || n === '' || isNaN(Number(n))) return '—';
    return Number(n).toLocaleString(PT ? 'pt-PT' : 'en-GB', { maximumFractionDigits: d == null ? 4 : d });
  }

  window.isStaffUser = window.isStaffUser || function () {
    try {
      var u = window.currentUser;
      if (u && (u.type === 'staff' || u.auth_type === 'staff' || u.role === 'staff' || u.role === 'admin' || u.role === 'root_admin')) return true;
      if (localStorage.getItem('auth_type') === 'staff') return true;
    } catch (_) {}
    return false;
  };
  window.isScaUser = window.isScaUser || function () {
    try {
      var u = window.currentUser;
      if (u) {
        var ty = String(u.type || u.auth_type || u.role || '').toLowerCase();
        if (ty === 'sca' || ty === 'agent' || ty === 'acb') return true;
        var id = String(u.sca_id || u.id || u.email || u.username || '');
        if (/^SCA-/i.test(id)) return true;
      }
      if (localStorage.getItem('auth_type') === 'sca') return true;
    } catch (_) {}
    return false;
  };

  /* ——— Treasury (wallet) ——— */
  var _loadWalletPrev = window.loadWallet;
  window.loadWallet = async function () {
    try {
      if (typeof _loadWalletPrev === 'function') {
        try { await _loadWalletPrev(); } catch (_) {}
      }
      var me = null, sub = null;
      try { me = await getJSON('/api/auth/me'); } catch (_) {
        try { me = await getJSON('https://stratamesh-auth.stratamesh.workers.dev/me'); } catch (__) {}
      }
      try { sub = await getJSON('/api/auth/subsistence'); } catch (_) {}
      if (me && (me.success || me.email)) {
        window.currentUser = Object.assign({}, window.currentUser || {}, me);
        try {
          if (me.email) localStorage.setItem('sm_email', String(me.email));
          if (me.wallet) localStorage.setItem('strata_address', String(me.wallet));
        } catch (_) {}
      }
      var lab = (me && (me.lab_balance != null ? me.lab_balance : (me.subsistence && me.subsistence.lab_balance)))
        || (sub && sub.lab_balance) || (me && me.balance);
      var poc = (me && me.poc_balance != null) ? me.poc_balance
        : (me && me.subsistence && me.subsistence.poc_balance);
      if (lab != null) {
        setText('strataBalance', fmt(lab, 4) + ' L');
        setText('walletLabBal', fmt(lab, 4));
      }
      if (poc != null) setText('walletPocBal', fmt(poc, 6));
      var meta = el('walletAccountMeta');
      if (meta && me) {
        meta.innerHTML =
          t('Conta', 'Account') + ': <b style="color:var(--fg)">' + esc(me.email || '—') + '</b><br>' +
          t('Carteira', 'Wallet') + ': <code>' + esc(me.wallet || '—') + '</code><br>' +
          t('Unidade', 'Unit') + ': <b>' + esc(me.unit || 'L-STRATA') + '</b> · ' +
          t('L-STRATA de laboratório (não transita). STRATA PdC só de #mint.',
            'Laboratory L-STRATA (non-transitioning). PoC STRATA only from #mint.');
      }
      var hint = el('panelModeHint');
      if (hint) {
        var mode = (me && me.subsistence && me.subsistence.mode) || (sub && sub.mode) || '';
        hint.textContent = mode
          ? (t('Subsistência', 'Subsistence') + ' · ' + mode + ' · L-STRATA ' + fmt(lab, 2))
          : '';
      }
    } catch (e) {
      console.warn('loadWallet overlay', e);
    }
  };

  /* ——— Agora lab books ——— */
  window.loadAgoraPanel = async function () {
    var bookEl = el('agoraBook');
    try {
      var rate = await getJSON('/api/v1/agora/rate').catch(function () { return {}; });
      var book = await getJSON('/api/v1/agora/book').catch(function () { return { listings: [] }; });
      setText('agoraPrice', rate.quote_per_strata != null ? Number(rate.quote_per_strata).toFixed(2) + ' €' : '0.10 €');
      setText('agoraStrataPer', rate.strata_per_quote != null ? Number(rate.strata_per_quote).toFixed(0) : '10');
      var eur = book.eur || (book.listings || []).filter(function (L) { return L.book === 'eur' || L.reference_currency === 'EUR'; });
      var gold = book.gold || (book.listings || []).filter(function (L) { return L.book === 'gold' || L.reference_currency === 'XAU'; });
      var all = (eur.length || gold.length) ? eur.concat(gold) : (book.listings || []);
      setText('agoraVolume', fmt((book.peg && (500 / 0.1)) || rate.liquidity_strata, 0));
      setText('agoraOrders', String(all.length));
      var meta = el('agoraQuoteMeta');
      if (meta) {
        var oz = book.peg && book.peg.gold_oz_eur;
        var lOz = oz != null ? Number(oz) / 0.10 : null;
        var src = (book.peg && book.peg.gold_spot_source) || '';
        var at = (book.peg && book.peg.gold_spot_at) || '';
        meta.innerHTML =
          t('Paridade de laboratório', 'Laboratory peg') +
          ': <b style="color:var(--fg)">1 L-STRATA = €0.10</b>' +
          (oz != null
            ? (' · 1 oz Wiener Philharmoniker = <b style="color:var(--fg)">€' +
              Number(oz).toLocaleString('pt-PT', { maximumFractionDigits: 2 }) +
              '</b> spot ouro = <b style="color:var(--fg)">' +
              Number(lOz).toLocaleString('pt-PT', { maximumFractionDigits: 0 }) +
              ' L-STRATA</b>' +
              (src ? (' <span style="color:var(--muted)">(' + esc(src) + (at ? (' · ' + String(at).slice(0, 19)) : '') + ')</span>') : '') +
              ' · ' + t('L-STRATA = (EUR/oz × fracção) / 0,10', 'L-STRATA = (EUR/oz × fraction) / 0.10'))
            : (' · ' + t('spot de ouro indisponível — a Ágora tenta Swissquote XAU/EUR', 'gold spot unavailable — Agora tries Swissquote XAU/EUR'))) +
          '.<br>' +
          t('Vendedor', 'Seller') + ' <code>' + esc(book.seller || 'FOG-NODE-PT-CM-001') + '</code> · ' +
          esc(book.seller_eni || 'AMCM ENI') + ' · ' +
          t('L-STRATA não transita para a rede publicada.', 'L-STRATA does not transit to the published network.');
      }
      function row(L) {
        var amt = L.token_amount || L.amount_lstrata || L.amount;
        var title = L.title || ((L.gold_label ? ('Wiener Philharmoniker ' + L.gold_label) : ((L.quote_total || '') + ' ' + (L.reference_currency || 'EUR'))));
        return '<div style="border-bottom:1px solid var(--line);padding:.55rem 0;display:flex;justify-content:space-between;gap:.75rem;flex-wrap:wrap">' +
          '<div><strong style="color:var(--fg)">' + esc(title) + '</strong>' +
          '<div style="font-size:.72rem;color:var(--muted);margin-top:.15rem">' + fmt(amt, 0) + ' L-STRATA · ' +
          (L.quote_total != null ? (L.book === 'gold' ? ('≈ €' + fmt(L.quote_total, 0)) : ('€' + fmt(L.quote_total, 0))) : '') +
          (L.gold_oz ? (' · ' + L.gold_oz + ' oz') : '') + '</div></div>' +
          '<div style="font-size:.7rem;color:var(--muted);text-align:right">' + esc(L.listing_id || '') + '<br>' +
          t('não transita', 'non-transitioning') + '</div></div>';
      }
      if (bookEl) {
        bookEl.innerHTML =
          '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1rem">' +
          '<div><div style="font-family:ui-monospace,monospace;font-size:.62rem;letter-spacing:.1em;text-transform:uppercase;color:var(--accent);margin-bottom:.5rem">' +
          t('Livro EUR · 1–500', 'EUR book · 1–500') + '</div>' +
          (eur.length ? eur.map(row).join('') : '<p style="color:var(--muted);font-size:.82rem">' + t('Sem ofertas EUR.', 'No EUR offerings.') + '</p>') +
          '</div><div><div style="font-family:ui-monospace,monospace;font-size:.62rem;letter-spacing:.1em;text-transform:uppercase;color:var(--accent);margin-bottom:.5rem">' +
          t('Ouro · Wiener Philharmoniker', 'Gold · Wiener Philharmoniker') + '</div>' +
          (gold.length ? gold.map(row).join('') : '<p style="color:var(--muted);font-size:.82rem">' + t('Sem ofertas de ouro.', 'No gold offerings.') + '</p>') +
          '</div></div>';
      }
    } catch (e) {
      if (bookEl) bookEl.innerHTML = '<p style="color:var(--muted)">' + esc(String(e.message || e)) + '</p>';
    }
  };
  window.loadAgora = window.loadAgoraPanel;

  /* ——— Unix atelier is the 3D NFT workbench (not a homepage iframe) ——— */
  function ensureAtelier() {
    var panel = el('panel-sandbox');
    if (!panel) return;
    var ifr = el('atelierFrame');
    if (ifr && ifr.parentNode) ifr.parentNode.removeChild(ifr);
    var os = el('atelierOs');
    if (os) os.style.display = 'none';
    var wrap = el('bancadaLegacyWrap');
    if (wrap) wrap.style.display = 'block';
    var stage = el('bancadaStage');
    if (stage) { stage.style.display = 'block'; stage.style.touchAction = 'none'; }
    var title = el('bancadaPanelTitle');
    if (title) {
      title.style.display = '';
      title.textContent = t('Atelier Unix · NFT desta conta', 'Unix Atelier · NFTs of this account');
    }
    var intro = title && title.nextElementSibling;
    if (intro && intro.tagName === 'P') {
      intro.textContent = t(
        'Bancada Web3 em NFT: lote urbano cel-shaded. Órbita ou 1ª pessoa. Stick esquerdo anda, stick direito olha; no ecrã, arraste a visão como na órbita. Ferramentas: manipular, fixar, duplicar, remover, rodar. Só objectos desta conta.',
        'Web3 NFT workbench: cel-shaded urban lot. Orbit or first person. Left stick walks, right stick looks; drag the screen to look as in orbit. Tools: manipulate, freeze, duplicate, remove, rotate. Objects of this account only.'
      );
    }
    window._atelierMode = 'unix3d';
    try {
      if (typeof window.__bancadaBoot === 'function') window.__bancadaBoot();
      else if (typeof window.loadSandboxBench === 'function') window.loadSandboxBench();
    } catch (e) { console.warn('atelier boot', e); }
  }
  window.loadSandbox = function () {
    ensureAtelier();
    if (typeof window.loadSandboxBench === 'function') {
      try { window.loadSandboxBench(); } catch (_) {}
    }
  };

  /* ——— CLP widget (unshadowed) ——— */
  window.loadClpPanel = async function () {
    var put = function (id, v) { setText(id, v); };
    try {
      var d = {};
      try { d = await getJSON((window.SVC && SVC.status ? SVC.status : 'https://stratamesh-status.stratamesh.workers.dev') + '/status'); } catch (_) {}
      var clp = d.clp || {};
      var ppc = d.ppc || {};
      var solar = ppc.solar || clp.solar || {};
      var rise = solar.sunrise || clp.sunrise;
      var zen = solar.noon || solar.zenith || clp.zenith;
      var sunset = solar.sunset || clp.sunset;
      function hhmm(x) {
        if (!x) return '';
        var s = String(x);
        if (s.length >= 19) return s.slice(11, 16);
        if (s.length >= 5) return s.slice(0, 5);
        return s;
      }
      if (!rise) {
        var month = new Date().getUTCMonth();
        if (month >= 3 && month <= 8) { rise = '06:20'; zen = '13:35'; sunset = '20:40'; }
        else { rise = '07:45'; zen = '12:40'; sunset = '17:35'; }
      }
      put('clpSunrise', hhmm(rise) || rise);
      put('clpZenith', hhmm(zen) || zen);
      put('clpSunset', hhmm(sunset) || sunset);
      put('clpLocale', (d.location && d.location.label) || clp.locale || 'Lisboa');
      var addr = el('clpAddress');
      var season = clp.season || (ppc.clp && ppc.clp.season) || '';
      var phase = clp.phase || (ppc.clp && ppc.clp.phase) || '';
      if (addr) {
        addr.innerHTML =
          t('Endereço temporal', 'Temporal address') + ': <b style="color:var(--fg)">Lisboa</b>' +
          (season ? ' · ' + esc(season) : '') + (phase ? ' · ' + esc(phase) : '') +
          ' · PPC Atlântico (Almendres / Lisboa). ' +
          t('Calendário Lunisolar Planetário calibra o tempo na TRD — não é uma camada holónica à parte.',
            'The Planetary Lunisolar Calendar calibrates time in the TRD — not a separate holonic layer.') +
          ' <a href="/clp" style="color:var(--accent)">/clp</a>';
      }
      var host = el('clpWidgetHost');
      if (!host) {
        host = document.createElement('div');
        host.id = 'clpWidgetHost';
        host.style.cssText = 'margin-top:1rem;border:1px solid var(--line);border-radius:8px;overflow:hidden;min-height:220px';
        var panel = el('panel-clp');
        if (panel) panel.appendChild(host);
      }
      if (host && !host.querySelector('iframe')) {
        host.innerHTML = '<iframe title="CLP" src="/clp" style="width:100%;height:420px;border:0;background:transparent"></iframe>';
      }
    } catch (e) {
      var addr = el('clpAddress');
      if (addr) addr.textContent = String(e.message || e);
    }
  };
  window.loadClp = window.loadClpPanel;

  /* ——— Chambers (DAO) ——— */
  var _daoPrev = window.loadDAOPanel;
  window.loadDAOPanel = async function () {
    try { if (typeof _daoPrev === 'function') await _daoPrev(); } catch (_) {}
    var extra = el('daoExtra');
    if (!extra) {
      extra = document.createElement('div');
      extra.id = 'daoExtra';
      extra.style.cssText = 'margin-top:1.25rem;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1rem';
      extra.innerHTML =
        '<div style="padding:1rem;background:var(--card);border:1px solid var(--line);border-radius:8px">' +
        '<div style="font-family:ui-monospace,monospace;font-size:.62rem;letter-spacing:.1em;text-transform:uppercase;color:var(--accent);margin-bottom:.5rem">' + t('Moção', 'Motion') + '</div>' +
        '<input id="daoMotionTitle" placeholder="' + t('Título da moção', 'Motion title') + '" style="width:100%;padding:.5rem;margin-bottom:.45rem;background:var(--bg);border:1px solid var(--line2);color:var(--fg);border-radius:4px;box-sizing:border-box">' +
        '<textarea id="daoMotionBody" rows="3" placeholder="' + t('Texto · quorum por câmara', 'Text · chamber quorum') + '" style="width:100%;padding:.5rem;margin-bottom:.45rem;background:var(--bg);border:1px solid var(--line2);color:var(--fg);border-radius:4px;box-sizing:border-box;resize:vertical"></textarea>' +
        '<div style="display:flex;gap:.4rem;flex-wrap:wrap">' +
        '<select id="daoMotionKind" style="padding:.4rem;background:var(--card);border:1px solid var(--line2);color:var(--fg);border-radius:4px"><option value="associative">' + t('Associativa', 'Associative') + '</option><option value="corporate">' + t('Corporativa', 'Corporate') + '</option></select>' +
        '<button type="button" id="daoMotionBtn" style="padding:.4rem .75rem;background:var(--accent);border:none;color:#0a0a0b;border-radius:4px;cursor:pointer;font-size:.78rem">' + t('Propor', 'Propose') + '</button></div>' +
        '<p id="daoMotionMsg" style="margin:.45rem 0 0;font-size:.72rem;color:var(--muted)"></p></div>' +
        '<div style="padding:1rem;background:var(--card);border:1px solid var(--line);border-radius:8px">' +
        '<div style="font-family:ui-monospace,monospace;font-size:.62rem;letter-spacing:.1em;text-transform:uppercase;color:var(--accent);margin-bottom:.5rem">' + t('Câmaras', 'Chambers') + '</div>' +
        '<p style="font-size:.8rem;color:var(--muted);line-height:1.5;margin:0">' +
        t('Associativa: um membro, um voto; quotas iguais, sem distribuição de lucros. Corporativa: participação proporcional ao capital social externo. Ambas residem como NFT STRATA na malha.',
          'Associative: one member, one vote; equal dues, no profit distribution. Corporate: stake follows external share capital. Both live as STRATA NFTs on the mesh.') +
        '</p>' +
        '<div id="daoMinutes" style="margin-top:.75rem;font-size:.78rem;color:var(--muted)">' + t('Actas: a câmara ainda não deliberou nesta sessão.', 'Minutes: the chamber has not yet deliberated this session.') + '</div></div>';
      var panel = el('panel-dao');
      if (panel) panel.appendChild(extra);
      var btn = el('daoMotionBtn');
      if (btn) btn.onclick = async function () {
        var msg = el('daoMotionMsg');
        var title = (el('daoMotionTitle') || {}).value || '';
        var body = (el('daoMotionBody') || {}).value || '';
        var kind = (el('daoMotionKind') || {}).value || 'associative';
        if (!title) { if (msg) msg.textContent = t('Indique um título.', 'Enter a title.'); return; }
        try {
          var r = await fetch('/api/v1/dao/propose', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, authH()),
            body: JSON.stringify({ title: title, body: body, kind: kind }) });
          var j = await r.json().catch(function () { return {}; });
          if (msg) msg.textContent = j.success ? t('Moção registada.', 'Motion recorded.') : (j.error || j.message || t('Câmara em sessão de laboratório — moção guardada localmente.', 'Chamber in laboratory session — motion stored locally.'));
          try { localStorage.setItem('dao_last_motion', JSON.stringify({ title: title, body: body, kind: kind, at: Date.now() })); } catch (_) {}
          var min = el('daoMinutes');
          if (min) min.textContent = t('Última moção', 'Last motion') + ': ' + title;
        } catch (e) {
          if (msg) msg.textContent = String(e.message || e);
        }
      };
    }
  };
  window.loadDAO = window.loadDAOPanel;

  /* ——— Compacts (APS / SPA) ——— */
  var _spaPrev = window.loadSPAPanel;
  window.loadSPAPanel = async function () {
    try { if (typeof _spaPrev === 'function') await _spaPrev(); } catch (_) {}
    var extra = el('spaExtra');
    if (!extra) {
      extra = document.createElement('div');
      extra.id = 'spaExtra';
      extra.style.cssText = 'margin-top:1.25rem;padding:1rem;background:var(--card);border:1px solid var(--line);border-radius:8px';
      extra.innerHTML =
        '<div style="font-family:ui-monospace,monospace;font-size:.62rem;letter-spacing:.1em;text-transform:uppercase;color:var(--accent);margin-bottom:.5rem">' + t('Pacto', 'Compact') + '</div>' +
        '<p style="font-size:.8rem;color:var(--muted);line-height:1.5;margin:0 0 .75rem">' +
        t('Um APS é um NFT-contrato: mint estático, execução dinâmica, pausa que preserva colateral, fecho quando o colateral esgota. Partes, gatilho e duração residem no próprio objecto — não numa VM EVM.',
          'A compact is a contract-NFT: minted static, executed dynamic, pause preserves collateral, close when collateral is exhausted. Parties, trigger and duration live on the object — not an EVM.') +
        '</p>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:.5rem">' +
        '<label style="font-size:.75rem;color:var(--muted)">' + t('Partes (vírgulas)', 'Parties (comma)') + '<input id="spaParties" placeholder="email, SCA-…" style="display:block;width:100%;margin-top:.25rem;padding:.4rem;background:var(--bg);border:1px solid var(--line2);color:var(--fg);border-radius:4px"></label>' +
        '<label style="font-size:.75rem;color:var(--muted)">' + t('Gatilho', 'Trigger') + '<select id="spaTrigger" style="display:block;width:100%;margin-top:.25rem;padding:.4rem;background:var(--bg);border:1px solid var(--line2);color:var(--fg);border-radius:4px"><option value="manual">' + t('Manual', 'Manual') + '</option><option value="clp">' + t('Fase CLP', 'CLP phase') + '</option><option value="pds">' + t('PdS abaixo do limiar', 'PdS below floor') + '</option></select></label>' +
        '<label style="font-size:.75rem;color:var(--muted)">' + t('Duração (ciclos)', 'Duration (cycles)') + '<input id="spaCycles" type="number" min="1" value="12" style="display:block;width:100%;margin-top:.25rem;padding:.4rem;background:var(--bg);border:1px solid var(--line2);color:var(--fg);border-radius:4px"></label></div>';
      var panel = el('panel-spa');
      if (panel) panel.appendChild(extra);
    }
  };
  window.loadSPA = window.loadSPAPanel;

  /* ——— Edge (IoT) ——— */
  var _iotPrev = window.loadIotPanel;
  window.loadIotPanel = async function () {
    try { if (typeof _iotPrev === 'function') await _iotPrev(); } catch (_) {}
    var extra = el('iotExtra');
    if (!extra) {
      extra = document.createElement('div');
      extra.id = 'iotExtra';
      extra.style.cssText = 'margin-top:1.25rem;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1rem';
      extra.innerHTML =
        '<div style="padding:1rem;background:var(--card);border:1px solid var(--line);border-radius:8px">' +
        '<div style="font-family:ui-monospace,monospace;font-size:.62rem;letter-spacing:.1em;text-transform:uppercase;color:var(--accent);margin-bottom:.5rem">' + t('Função no limiar', 'Edge function') + '</div>' +
        '<input id="iotFnName" placeholder="' + t('identidade por função, não por substrato', 'identity by function, not substrate') + '" style="width:100%;padding:.5rem;margin-bottom:.45rem;background:var(--bg);border:1px solid var(--line2);color:var(--fg);border-radius:4px;box-sizing:border-box">' +
        '<button type="button" id="iotFnBtn" style="padding:.4rem .75rem;background:var(--accent);border:none;color:#0a0a0b;border-radius:4px;cursor:pointer;font-size:.78rem">' + t('Registar função', 'Register function') + '</button>' +
        '<p id="iotFnMsg" style="margin:.45rem 0 0;font-size:.72rem;color:var(--muted)"></p></div>' +
        '<div style="padding:1rem;background:var(--card);border:1px solid var(--line);border-radius:8px">' +
        '<div style="font-family:ui-monospace,monospace;font-size:.62rem;letter-spacing:.1em;text-transform:uppercase;color:var(--accent);margin-bottom:.5rem">' + t('Telemetria', 'Telemetry') + '</div>' +
        '<p style="font-size:.8rem;color:var(--muted);line-height:1.5;margin:0">' +
        t('Ingestão universal no limiar: o dispositivo não corre runtime StrataMesh. Eventos sintéticos do EDGE alimentam a malha sem impacto no hardware.',
          'Universal edge ingest: the device does not run a StrataMesh runtime. EDGE synthetic events feed the mesh with no hardware impact.') +
        '</p><div id="iotTelem" style="margin-top:.65rem;font-family:ui-monospace,monospace;font-size:.72rem;color:var(--muted)">—</div></div>';
      var panel = el('panel-iot');
      if (panel) panel.appendChild(extra);
      var btn = el('iotFnBtn');
      if (btn) btn.onclick = async function () {
        var msg = el('iotFnMsg');
        var name = (el('iotFnName') || {}).value || '';
        if (!name) { if (msg) msg.textContent = t('Nome da função.', 'Function name.'); return; }
        try {
          var r = await fetch('/api/v1/iot/agents', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, authH()),
            body: JSON.stringify({ agent_id: name, function: name, synthetic: true }) });
          var j = await r.json().catch(function () { return {}; });
          if (msg) msg.textContent = j.success || r.ok ? t('Função no limiar.', 'Function at the edge.') : (j.error || ('HTTP ' + r.status));
        } catch (e) { if (msg) msg.textContent = String(e.message || e); }
      };
    }
    try {
      var h = await getJSON('/api/v1/iot/health').catch(function () { return {}; });
      var tel = el('iotTelem');
      if (tel) tel.textContent = JSON.stringify({ mode: h.mode || 'edge', agents: h.agents_known, version: h.version, n: 2 }, null, 0);
    } catch (_) {}
  };
  window.loadIot = window.loadIotPanel;

  /* ——— Identity (profile) ——— */
  window.loadProfilePanel = async function () {
    var pe = el('profileEmail');
    var pr = el('profileRole');
    var pc = el('profileClearance');
    var u = window.currentUser || {};
    try {
      var me = await getJSON('/api/auth/me');
      if (me && (me.success || me.email)) {
        window.currentUser = Object.assign(u, me);
        u = window.currentUser;
      }
    } catch (_) {}
    if (pe) pe.textContent = u.email || (function () { try { return localStorage.getItem('sm_email'); } catch (_) { return '—'; } })() || '—';
    if (pr) pr.textContent = u.role || u.type || (window.isStaffUser() ? 'staff' : 'user');
    if (pc) pc.textContent = (typeof currentClearance === 'function' ? currentClearance() : (u.clearance || u.clearance_level || 'basic'));
    var extra = el('profileExtra');
    if (!extra) {
      extra = document.createElement('div');
      extra.id = 'profileExtra';
      extra.style.marginTop = '1.25rem';
      var panel = el('panel-profile');
      if (panel) panel.appendChild(extra);
    }
    if (extra) {
      extra.innerHTML =
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:.75rem;margin-bottom:1rem">' +
        '<div class="stat-card"><div class="value" style="font-size:1.05rem">' + fmt(u.lab_balance, 2) + '</div><div class="label">L-STRATA</div></div>' +
        '<div class="stat-card"><div class="value" style="font-size:1.05rem">' + fmt(u.poc_balance, 4) + '</div><div class="label">' + t('STRATA PdC', 'PoC STRATA') + '</div></div>' +
        '<div class="stat-card"><div class="value" style="font-size:.85rem">' + esc(u.unit || 'L-STRATA') + '</div><div class="label">' + t('Unidade', 'Unit') + '</div></div>' +
        '<div class="stat-card"><div class="value" style="font-size:.75rem;word-break:break-all">' + esc(u.wallet || '—') + '</div><div class="label">' + t('Carteira', 'Wallet') + '</div></div></div>' +
        '<p style="font-size:.8rem;color:var(--muted);line-height:1.5">' +
        (window.isStaffUser()
          ? t('Conta de pessoal — secções administrativas desbloqueadas conforme clearance. Confiança 2FA: 1 hora.',
              'Staff account — administrative sections unlock by clearance. 2FA trust window: 1 hour.')
          : t('Identidade desta conta no Nó. L-STRATA é concessão de laboratório e não transita. 2FA fiável durante 1 hora após o último código.',
              'This account’s identity on the Node. L-STRATA is a laboratory grant and does not transit. 2FA is trusted for 1 hour after the last code.')) +
        '</p>' +
        '<div style="display:flex;flex-wrap:wrap;gap:.5rem;margin-top:.75rem">' +
        '<button type="button" onclick="showPanel(\'wallet\',document.querySelector(\'[data-panel=wallet]\'))" style="padding:.45rem .8rem;background:var(--card);border:1px solid var(--line2);color:var(--fg);border-radius:4px;cursor:pointer;font-size:.78rem">' + t('Tesouraria', 'Treasury') + '</button>' +
        '<button type="button" onclick="typeof logout===\'function\'&&logout()" style="padding:.45rem .8rem;background:transparent;border:1px solid var(--line);color:var(--muted);border-radius:4px;cursor:pointer;font-size:.78rem">' + t('Sair', 'Sign out') + '</button></div>';
    }
  };

  /* ——— showPanel last hook ——— */
  var _sp = window.showPanel;
  window.showPanel = function (name, btn) {
    var n = String(name || 'wallet');
    try {
      document.querySelectorAll('.panel').forEach(function (p) { p.classList.remove('active'); });
      document.querySelectorAll('#mainNav button, .nav button').forEach(function (b) { b.classList.remove('active'); });
      var panel = el('panel-' + n);
      if (panel) panel.classList.add('active');
      if (btn && btn.classList) btn.classList.add('active');
      else {
        var nb = document.querySelector('[data-panel="' + n + '"]');
        if (nb) nb.classList.add('active');
      }
    } catch (_) {
      if (typeof _sp === 'function') try { _sp(name, btn); } catch (__) {}
    }
    try {
      if (n === 'wallet') window.loadWallet();
      else if (n === 'agora') window.loadAgoraPanel();
      else if (n === 'sandbox' || n === 'spa' && name === 'sandbox') window.loadSandbox();
      else if (n === 'dao') window.loadDAOPanel();
      else if (n === 'spa') window.loadSPAPanel();
      else if (n === 'iot') window.loadIotPanel();
      else if (n === 'clp') window.loadClpPanel();
      else if (n === 'profile') window.loadProfilePanel();
      else if (typeof _sp === 'function') _sp(name, btn);
    } catch (e) { console.warn('showPanel desk', e); }
  };

  function activateWallet() {
    var pw = el('panel-wallet');
    if (pw && !document.querySelector('.panel.active')) pw.classList.add('active');
    var portal = el('portalPage');
    var visible = portal && (portal.style.display !== 'none') && !portal.classList.contains('hidden');
    var hasTok = false;
    try { hasTok = !!(localStorage.getItem('sm_token') || localStorage.getItem('token') || window.token); } catch (_) {}
    if (visible || hasTok) {
      try { window.loadWallet(); } catch (_) {}
    }
  }

  function bootDesk() {
    try { ensureAtelier(); } catch (_) {}
    try {
      var login = el('loginPage');
      var portal = el('portalPage');
      if (portal && login && login.style.display === 'none') activateWallet();
      else if (portal && portal.classList.contains('portal-visible')) activateWallet();
      else {
        var hasTok = false;
        try { hasTok = !!(localStorage.getItem('sm_token') || localStorage.getItem('token')); } catch (_) {}
        if (hasTok) {
          /* spa may still be on the gate; wallet will fill once showPortal runs */
          setTimeout(activateWallet, 600);
        }
      }
    } catch (_) {}
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(bootDesk, 80);
  else document.addEventListener('DOMContentLoaded', function () { setTimeout(bootDesk, 80); });
  window.addEventListener('load', function () { setTimeout(activateWallet, 400); });
})();
