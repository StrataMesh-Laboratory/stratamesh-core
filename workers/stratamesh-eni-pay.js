/**
 * AMCM ENI — Payment portal (services, assets, node project donations)
 * Banking credentials: env secrets only (never client HTML, never git).
 */
const VERSION = "1.0.0-eni-pay";

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  });
}

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function bankingFromEnv(env) {
  return {
    legal_name: env.ENI_LEGAL_NAME || "André Manuel Calhegas Morais ENI",
    account_number: env.ENI_ACCOUNT_NUMBER || "",
    sort_code: env.ENI_SORT_CODE || "",
    iban: env.ENI_IBAN || "",
    swift: env.ENI_SWIFT || "",
    bank_address: env.ENI_BANK_ADDRESS || "",
    postal_address: env.ENI_POSTAL_ADDRESS || "",
    phone: env.ENI_PHONE || "",
    email: env.ENI_EMAIL || "geral@eni.calhegasmorais.pt",
  };
}

function refCode() {
  const t = Date.now().toString(36).toUpperCase();
  const r = crypto.randomUUID().slice(0, 6).toUpperCase();
  return `AMCM-${t}-${r}`;
}

const PURPOSES = {
  service: { pt: "Pagamento por serviços da ENI", en: "Payment for ENI services" },
  asset: { pt: "Pagamento por activos disponibilizados pela ENI", en: "Payment for assets provided by the ENI" },
  donation: {
    pt: "Donativo para o Projecto do Nó Calhegas Morais (StrataMesh)",
    en: "Donation to the Calhegas Morais Node project (StrataMesh)",
  },
};

async function ensureSchema(db) {
  if (!db) return;
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS eni_payments (
        id TEXT PRIMARY KEY,
        reference TEXT UNIQUE,
        purpose TEXT,
        amount REAL,
        currency TEXT,
        payer_name TEXT,
        payer_email TEXT,
        note TEXT,
        status TEXT,
        created_at TEXT,
        meta_json TEXT
      )`
    )
    .run();
}

function portalPage() {
  return `<!DOCTYPE html>
<html lang="pt-PT">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pagamentos · AMCM ENI</title>
<meta name="robots" content="noindex,nofollow">
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=IBM+Plex+Sans:wght@300;400;500&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
:root{--bg:#0a0a0b;--fg:#e8e6e3;--muted:#8a8780;--line:#1c1c1f;--line2:#2a2a2e;--accent:#c4b5a0;--card:#111113;--ok:#6b8f71}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--fg);font-family:'IBM Plex Sans',system-ui,sans-serif;font-weight:300;line-height:1.7;min-height:100vh}
a{color:var(--accent);text-decoration:none}
.wrap{max-width:28rem;margin:0 auto;padding:2rem 1.25rem 4rem}
.kicker{font-family:'IBM Plex Mono',monospace;font-size:.62rem;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);margin-bottom:.85rem}
h1{font-family:'Instrument Serif',Georgia,serif;font-weight:400;font-size:1.85rem;letter-spacing:-.02em;margin-bottom:.5rem}
.lead{color:var(--muted);font-size:.95rem;margin-bottom:1.5rem}
label{display:block;font-family:'IBM Plex Mono',monospace;font-size:.62rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin:1rem 0 .4rem}
input,select,textarea{width:100%;padding:.75rem .85rem;background:var(--card);border:1px solid var(--line2);border-radius:4px;color:var(--fg);font:inherit}
textarea{min-height:4.5rem;resize:vertical}
.row{display:grid;grid-template-columns:1fr 7rem;gap:.65rem}
button{margin-top:1.25rem;width:100%;padding:.9rem;background:transparent;border:1px solid var(--accent);color:var(--accent);font-family:'IBM Plex Mono',monospace;font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;border-radius:3px}
button:hover{background:var(--accent);color:#111}
button:disabled{opacity:.45;cursor:not-allowed}
.note{font-size:.82rem;color:var(--muted);margin-top:1rem;border-left:2px solid var(--line2);padding-left:.75rem}
.err{color:#c47b7b;font-size:.88rem;margin-top:.75rem;display:none}
.card{display:none;margin-top:1.5rem;padding:1.15rem;background:var(--card);border:1px solid var(--line);border-radius:4px}
.card.on{display:block}
.card h2{font-family:'Instrument Serif',Georgia,serif;font-weight:400;font-size:1.25rem;margin-bottom:.75rem}
.card .ref{font-family:'IBM Plex Mono',monospace;font-size:1rem;color:var(--accent);letter-spacing:.06em;margin:.5rem 0}
.card dl{font-size:.88rem}
.card dt{font-family:'IBM Plex Mono',monospace;font-size:.6rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-top:.65rem}
.card dd{margin:0;color:var(--fg);word-break:break-all}
.top{font-size:.8rem;color:var(--muted);margin-bottom:1.5rem}
.top a{margin-right:.75rem}
.copy{margin-top:.5rem;font-size:.65rem;font-family:'IBM Plex Mono',monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);cursor:pointer;border:none;background:none;padding:0;width:auto}
</style>
</head>
<body>
<main class="wrap">
  <p class="top"><a href="https://eni.calhegasmorais.pt/">AMCM ENI</a><a href="https://calhegasmorais.pt/">Nó CMN</a></p>
  <p class="kicker">Portal de pagamentos · laboratório</p>
  <h1>Pagamentos AMCM ENI</h1>
  <p class="lead">Serviços e activos da ENI, ou donativos ao projecto do Nó Calhegas Morais na StrataMesh. Os dados bancários não são publicados nesta página — são aplicados automaticamente na instrução de pagamento após o pedido.</p>

  <form id="payForm">
    <label for="purpose">Finalidade</label>
    <select id="purpose" name="purpose" required>
      <option value="service">Pagamento por serviços da ENI</option>
      <option value="asset">Pagamento por activos da ENI</option>
      <option value="donation">Donativo — Projecto Nó Calhegas Morais (StrataMesh)</option>
    </select>

    <div class="row">
      <div>
        <label for="amount">Montante</label>
        <input id="amount" name="amount" type="number" min="1" step="0.01" required placeholder="0.00">
      </div>
      <div>
        <label for="currency">Moeda</label>
        <select id="currency" name="currency">
          <option value="EUR">EUR</option>
          <option value="GBP">GBP</option>
          <option value="USD">USD</option>
        </select>
      </div>
    </div>

    <label for="payer_name">Nome do ordenante</label>
    <input id="payer_name" name="payer_name" required autocomplete="name">

    <label for="payer_email">Email</label>
    <input id="payer_email" name="payer_email" type="email" required autocomplete="email">

    <label for="note">Nota (opcional)</label>
    <textarea id="note" name="note" placeholder="Referência de factura, descrição do serviço…"></textarea>

    <button type="submit" id="submitBtn">Gerar instrução de pagamento</button>
    <p class="err" id="err"></p>
    <p class="note">Ao submeter, é criada uma referência única. A instrução de transferência internacional (beneficiário, IBAN, SWIFT, etc.) é emitida só nesse momento, pelo servidor — não fica indexável na página pública.</p>
  </form>

  <div class="card" id="result">
    <h2>Instrução pronta</h2>
    <p>Use exactamente esta <strong>referência</strong> na transferência:</p>
    <p class="ref" id="outRef">—</p>
    <dl id="outDl"></dl>
    <p class="note" style="margin-top:1rem">Após a transferência, a ENI reconcilia pelo montante e pela referência. Contacto: <a href="mailto:geral@eni.calhegasmorais.pt">geral@eni.calhegasmorais.pt</a></p>
  </div>
</main>
<script>
document.getElementById('payForm').addEventListener('submit', async function(ev){
  ev.preventDefault();
  var btn=document.getElementById('submitBtn');
  var err=document.getElementById('err');
  err.style.display='none';
  btn.disabled=true; btn.textContent='A processar…';
  try{
    var body={
      purpose: document.getElementById('purpose').value,
      amount: parseFloat(document.getElementById('amount').value,10),
      currency: document.getElementById('currency').value,
      payer_name: document.getElementById('payer_name').value.trim(),
      payer_email: document.getElementById('payer_email').value.trim(),
      note: document.getElementById('note').value.trim()
    };
    var r=await fetch('/api/payment-intent',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(body)});
    var j=await r.json().catch(function(){return {};});
    if(!r.ok||!j.success) throw new Error(j.error||('HTTP '+r.status));
    document.getElementById('outRef').textContent=j.reference;
    var ins=j.instruction||{};
    var rows=[
      ['Beneficiário', ins.beneficiary],
      ['IBAN', ins.iban],
      ['SWIFT / BIC', ins.swift],
      ['Sort code (UK)', ins.sort_code],
      ['Nº de conta', ins.account_number],
      ['Montante', j.amount+' '+j.currency],
      ['Finalidade', j.purpose_label],
      ['Referência obrigatória', j.reference],
      ['Banco', ins.bank_address],
      ['Morada postal do titular', ins.postal_address]
    ];
    document.getElementById('outDl').innerHTML=rows.filter(function(x){return x[1];}).map(function(x){
      return '<dt>'+x[0]+'</dt><dd>'+String(x[1]).replace(/</g,'&lt;')+'</dd>';
    }).join('');
    document.getElementById('result').classList.add('on');
    document.getElementById('result').scrollIntoView({behavior:'smooth',block:'start'});
  }catch(e){
    err.textContent=e.message||String(e);
    err.style.display='block';
  }finally{
    btn.disabled=false; btn.textContent='Gerar instrução de pagamento';
  }
});
</script>
</body>
</html>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type,Authorization",
        },
      });
    }

    const path = url.pathname.replace(/\/+$/, "") || "/";
    const db = env.LEDGER || env.DB;

    if (path === "/health") {
      const b = bankingFromEnv(env);
      return json({
        status: "ok",
        service: "stratamesh-eni-pay",
        version: VERSION,
        banking_configured: !!(b.iban && b.swift),
        purposes: Object.keys(PURPOSES),
        contact: b.email,
      });
    }

    if (path === "/" || path === "/pay" || path === "/pagamentos") {
      return html(portalPage());
    }

    if (path === "/api/payment-intent" && request.method === "POST") {
      try {
        const body = await request.json().catch(() => ({}));
        const purpose = String(body.purpose || "");
        if (!PURPOSES[purpose]) return json({ error: "finalidade_invalida", allowed: Object.keys(PURPOSES) }, 400);
        const amount = Number(body.amount);
        if (!(amount > 0) || amount > 1e7) return json({ error: "montante_invalido" }, 400);
        const currency = String(body.currency || "EUR").toUpperCase().slice(0, 3);
        const payer_name = String(body.payer_name || "").trim().slice(0, 200);
        const payer_email = String(body.payer_email || "").trim().slice(0, 200);
        if (!payer_name || !payer_email || !payer_email.includes("@")) {
          return json({ error: "identificacao_ordenante_obrigatoria" }, 400);
        }
        const note = String(body.note || "").trim().slice(0, 1000);
        const reference = refCode();
        const id = crypto.randomUUID();
        const created_at = new Date().toISOString();
        const bank = bankingFromEnv(env);
        if (!bank.iban || !bank.swift) {
          return json({ error: "portal_nao_configurado", message: "Banking secrets missing on worker" }, 503);
        }

        await ensureSchema(db);
        if (db) {
          await db
            .prepare(
              `INSERT INTO eni_payments (id, reference, purpose, amount, currency, payer_name, payer_email, note, status, created_at, meta_json)
               VALUES (?,?,?,?,?,?,?,?,?,?,?)`
            )
            .bind(
              id,
              reference,
              purpose,
              amount,
              currency,
              payer_name,
              payer_email,
              note,
              "awaiting_transfer",
              created_at,
              JSON.stringify({ regions: ["UK", "PT"], channel: "international_bank_transfer" })
            )
            .run();
        }

        const purpose_label = PURPOSES[purpose].pt + " / " + PURPOSES[purpose].en;

        // Instruction issued only in this API response (not in static HTML)
        return json({
          success: true,
          id,
          reference,
          amount,
          currency,
          purpose,
          purpose_label,
          status: "awaiting_transfer",
          created_at,
          instruction: {
            beneficiary: bank.legal_name,
            iban: bank.iban,
            swift: bank.swift,
            sort_code: bank.sort_code,
            account_number: bank.account_number,
            bank_address: bank.bank_address,
            postal_address: bank.postal_address,
            payment_reference: reference,
            contact_email: bank.email,
            contact_phone: bank.phone,
          },
          reconciliation: {
            pt: "A ENI reconcilia transferências pelo montante e pela referência AMCM-… indicada.",
            en: "The ENI reconciles transfers by amount and the stated AMCM-… reference.",
          },
        });
      } catch (e) {
        return json({ error: String(e.message || e) }, 500);
      }
    }

    // Staff-only list: requires shared secret header, never public
    if (path === "/api/payments" && request.method === "GET") {
      const key = request.headers.get("X-ENI-Staff-Key") || "";
      if (!env.ENI_STAFF_KEY || key !== env.ENI_STAFF_KEY) return json({ error: "unauthorized" }, 401);
      await ensureSchema(db);
      const { results } = await db.prepare("SELECT id, reference, purpose, amount, currency, payer_name, payer_email, status, created_at FROM eni_payments ORDER BY created_at DESC LIMIT 100").all();
      return json({ payments: results || [] });
    }

    return json({ error: "not_found", path }, 404);
  },
};
