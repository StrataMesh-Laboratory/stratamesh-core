const ENV_KEYS = ["FOG_TOR_SOCKS", "TOR_SOCKS"];
function socksUrl(env) { env = env || process.env; for (const k of ENV_KEYS) { const v = (env[k] || "").trim(); if (v) return v; } return null; }
const SKIP = ["cloudflare.com","workers.dev","github.com","githubusercontent.com","calhegasmorais.pt","grok.me"];
function hostOf(url) { try { return new URL(url).hostname.toLowerCase(); } catch (e) { return ""; } }
function shouldProxy(url, env) { if (!socksUrl(env)) return false; const h = hostOf(url); if (!h) return false; if (h.endsWith(".onion")) return true; for (const s of SKIP) { if (h === s || h.endsWith("." + s)) return false; } return true; }
function proxyPlan(url, env) { const p = socksUrl(env); if (!p || !shouldProxy(url, env)) return { proxy: null, dns: "direct", scheme: null }; const u = new URL(p); const scheme = u.protocol.replace(":",""); return { proxy: p, scheme: scheme, dns: scheme === "socks5h" ? "remote" : "local", socksHost: u.hostname, socksPort: Number(u.port || 9050) }; }
module.exports = { ENV_KEYS, socksUrl, shouldProxy, proxyPlan };
