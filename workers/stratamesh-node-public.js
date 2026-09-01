// stratamesh-node-public.js
// Exact `/` overlay for fog.calhegasmorais.pt and edge.calhegasmorais.pt.
// No subrequests (avoids route loops). JSON lives on tunnel /health /status.
var VERSION = "0.5.1-lab";
var CSS = ":root{--bg:#0a0a0b;--fg:#e8e6e3;--muted:#8a8780;--line:#1c1c1f;--acc:#c4a574}body{margin:0;font:16px/1.45 system-ui,sans-serif;background:var(--bg);color:var(--fg)}main{max-width:40rem;margin:0 auto;padding:2.5rem 1.25rem 4rem}h1{font-size:1.25rem;font-weight:600}p,li{color:var(--muted)}a{color:var(--acc)}code{color:var(--fg)}.badge{display:inline-block;border:1px solid var(--line);padding:.15rem .5rem;font-size:.75rem;letter-spacing:.04em}";

function html(title, body) {
  return new Response(
    `<!DOCTYPE html><html lang="pt-PT"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${title}</title><style>${CSS}</style></head><body>${body}</body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "access-control-allow-origin": "*" } }
  );
}

function fogPage() {
  return html(
    "FOG-NODE-PT-CM-001 · " + VERSION,
    `<main>
<p class="badge">LAB · prerelease · not mainnet</p>
<h1>FOG-NODE-PT-CM-001</h1>
<p>v<code>${VERSION}</code> · origin=<code>macbook</code> · n=2 · mesh_member=true · f_max=0</p>
<p>Continuity=<code>continuous</code>. Mac workerd hop. Peer roster is JSON (<code>/status</code>), not this page. Byzantine f_max stays 0 until n≥3.</p>
<ul>
<li><a href="/health">/health</a> JSON</li>
<li><a href="/status">/status</a> JSON</li>
<li><a href="https://edge.calhegasmorais.pt/health">EDGE /health</a> JSON</li>
<li><a href="https://github.com/StrataMesh-Laboratory/stratamesh-core/releases/tag/v0.5.1-lab">tag v0.5.1-lab</a></li>
</ul>
</main>`
  );
}

function edgePage() {
  return html(
    "EDGE-GROK-CMN-001 · " + VERSION,
    `<main>
<p class="badge">LAB · prerelease · not mainnet</p>
<h1>EDGE-GROK-CMN-001</h1>
<p>v<code>${VERSION}</code> · origin=<code>edge</code> · n=2 · mesh_member=true · f_max=0</p>
<p>Continuity=<code>session</code> (expected). Linked Fog <code>FOG-NODE-PT-CM-001</code>. Distinct host from the Mac. <code>oracle_live=false</code>.</p>
<ul>
<li><a href="/health">/health</a> JSON</li>
<li><a href="https://fog.calhegasmorais.pt/health">Fog /health</a> JSON</li>
<li><a href="https://github.com/StrataMesh-Laboratory/stratamesh-core/releases/tag/v0.5.1-lab">tag v0.5.1-lab</a></li>
</ul>
</main>`
  );
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname !== "/" && url.pathname !== "") {
      return new Response(JSON.stringify({ ok: false, error: "not this overlay", use: "/health" }), {
        status: 404,
        headers: { "content-type": "application/json", "cache-control": "no-store" }
      });
    }
    const accept = request.headers.get("Accept") || "";
    if (accept.includes("text/html")) {
      if (url.hostname.startsWith("edge.")) return edgePage();
      return fogPage();
    }
    return Response.redirect(new URL("/status", url).toString(), 302);
  }
};
