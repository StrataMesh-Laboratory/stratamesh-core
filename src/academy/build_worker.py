#!/usr/bin/env python3
"""Emit workers/stratamesh-academy.js from catalog.py. No secrets."""

from __future__ import annotations

import json
from pathlib import Path

from catalog import COST, HOST, MODELS, NOT_STUDENTS, ROSTER, VERSION, dump

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "workers" / "stratamesh-academy.js"

CSS = (
    ":root{--bg:#0a0a0b;--fg:#e8e6e3;--muted:#8a8780;--line:#1c1c1f;--acc:#c4a574;--ok:#7aa874;--bad:#c45c54}"
    "body{margin:0;font:16px/1.45 system-ui,sans-serif;background:var(--bg);color:var(--fg)}"
    "main{max-width:42rem;margin:0 auto;padding:2.5rem 1.25rem 4rem}h1{font-size:1.25rem;font-weight:600}"
    "p,li{color:var(--muted)}a{color:var(--acc)}code{color:var(--fg)}"
    ".badge{display:inline-block;border:1px solid var(--line);padding:.15rem .5rem;font-size:.75rem;letter-spacing:.04em}"
    "pre{white-space:pre-wrap;word-break:break-word;font-size:13px;line-height:1.4;background:#111;color:var(--fg);"
    "padding:1rem;border:1px solid var(--line)}"
)

CATALOG_JSON = json.dumps(dump(), ensure_ascii=False, separators=(",", ":"))


def render() -> str:
    return f"""/**
 * academy.calhegasmorais.pt — ACB Academy (always-on)
 * Orchestrator + AIOps formations. Ollama←HF GGUF on Fog. No secrets. No workers.dev.
 * Catalog GET is free. HF Inference Providers HOLD. STRATA cost lab-waived.
 */
const VERSION = {json.dumps(VERSION)};
const PRIMARY = {json.dumps(HOST)};
const CATALOG = {CATALOG_JSON};

const CORS = {{
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS,HEAD",
  "Access-Control-Allow-Headers": "*",
}};
const CSS = {json.dumps(CSS)};

function headers(type, cache) {{
  return {{
    ...CORS,
    "Content-Type": type,
    "Cache-Control": cache || "public, max-age=60",
    "X-Robots-Tag": "all, index, follow",
    "X-StrataMesh-Lab": "true",
    "X-StrataMesh-API": VERSION,
    "X-StrataMesh-Academy": "always-on",
  }};
}}
function json(data, status, cache) {{
  return new Response(JSON.stringify(data, null, 2), {{
    status: status || 200,
    headers: headers("application/json; charset=utf-8", cache || "public, max-age=60"),
  }});
}}
function text(body, status) {{
  return new Response(body, {{ status: status || 200, headers: headers("text/plain; charset=utf-8", "public, max-age=60") }});
}}
function html(body) {{
  return new Response(body, {{ status: 200, headers: headers("text/html; charset=utf-8", "public, max-age=60") }});
}}
function wantsHtml(request) {{
  const a = (request.headers.get("Accept") || "").toLowerCase();
  return a.includes("text/html") && !a.includes("application/json");
}}
function meta() {{
  return {{
    status: "ok",
    service: "stratamesh-academy",
    version: VERSION,
    lab: true,
    not_mainnet: true,
    always_on: true,
    n: 2,
    mesh_member: true,
    f_max: 0,
    oracle_live: false,
    hf_inference: "HOLD",
    worker_hf_token: false,
    workers_dev: false,
    ollama: "Fog residual C_mesh :11434 — Worker does not infer",
    flux: "dual-lobe QIGA tap — unready does not breed",
    gene_slots: (CATALOG.flux && CATALOG.flux.gene_slots) || [],
    students: CATALOG.counts.students,
    formations: CATALOG.counts.formations,
    cost: CATALOG.cost,
    host: PRIMARY,
  }};
}}
function findFormation(id) {{
  const u = String(id || "").toUpperCase();
  return (CATALOG.formations || []).find((f) => f.id === u) || null;
}}
function syllabus(role, mode) {{
  return (CATALOG.formations || []).filter((f) => (!role || f.role === role) && (!mode || f.mode === mode));
}}
function norm(s) {{
  return String(s || "").toLowerCase().replace(/[—–]/g, " ").replace(/\\s+/g, " ").trim();
}}
function hasToken(hay, needle) {{
  const n = norm(needle);
  if (!n) return false;
  const esc = n.replace(/[.*+?^${{}}()|[\\]\\\\]/g, "\\\\$&");
  return new RegExp("(?:^|[^a-z0-9])" + esc + "(?:$|[^a-z0-9])").test(hay);
}}
function gradeDrill(drill, answer) {{
  const text = norm(answer);
  if (!text) return {{ pass: false, unready: true, reason: "empty answer — fail-closed", missing: drill.must_contain || [], violations: [] }};
  const missing = (drill.must_contain || []).filter((t) => !hasToken(text, t));
  const violations = (drill.must_not_contain || []).filter((t) => t && hasToken(text, t));
  const ok = missing.length === 0 && violations.length === 0;
  return {{ pass: ok, unready: !ok && drill.fail_closed !== false, missing, violations, reason: ok ? "pass" : "fail-closed" }};
}}
function gradeFormation(f, answers) {{
  const results = (f.drills || []).map((d, i) => ({{ i, prompt: d.prompt, ...gradeDrill(d, (answers || [])[i] || "") }}));
  const passed = results.filter((r) => r.pass).length;
  const unready = results.some((r) => r.unready);
  const complete = passed === results.length && !unready;
  return {{
    ok: true,
    formation_id: f.id,
    role: f.role,
    mode: f.mode,
    title: f.title,
    passed,
    total: results.length,
    complete,
    unready: unready && !complete,
    results,
    cost: {{ lab_waived: true, strata: 0, rail: CATALOG.cost.rail, billed_when: CATALOG.cost.billed_when }},
  }};
}}
function studentIds() {{ return (CATALOG.roster || []).map((s) => s.acb_id); }}
function fitnessFromGrade(g) {{
  if (!g || g.unready || !g.ok) return 0;
  const total = Math.max(1, g.total || 0);
  const base = (g.passed || 0) / total;
  return g.mode === "exploratory" ? Math.min(1, 0.4 + 0.6 * base) : Math.min(1, 0.5 + 0.5 * base);
}}
function fluxTick(acbId, grade, prev) {{
  const students = studentIds();
  const isStudent = students.indexOf(acbId) >= 0;
  const violations = [];
  (grade.results || []).forEach((r) => (r.violations || []).forEach((v) => violations.push(v)));
  const workersDev = violations.some((v) => String(v).indexOf("workers.dev") >= 0);
  const unready = !!(grade.unready || !grade.complete);
  const fit = fitnessFromGrade(grade);
  const reasons = [];
  if (!isStudent) reasons.push("academy_student: grok@ / unknown id is not a student");
  if (unready) reasons.push("academy_unready: unready grade is fail-closed — do not evolve");
  if (workersDev) reasons.push("academy_workers_dev: workers.dev is not admissible");
  const committed = isStudent && !unready && !workersDev && !!grade.complete;
  const geneSlots = (CATALOG.flux && CATALOG.flux.gene_slots) || [];
  const slots = ((CATALOG.flux && CATALOG.flux.formation_genes) || {{}})[grade.formation_id] || [1];
  let st = prev || {{ acb_id: acbId, generation: 0, fitness_ema: 0.5, genes: geneSlots.map(() => 0.5) }};
  let evolved = false;
  if (committed) {{
    const genes = (st.genes || geneSlots.map(() => 0.5)).slice();
    slots.forEach((i) => {{ if (i >= 0 && i < genes.length) genes[i] = Math.max(0, Math.min(1, 0.7 * genes[i] + 0.3 * fit)); }});
    st = {{
      acb_id: acbId,
      generation: (st.generation || 0) + 1,
      fitness_ema: 0.85 * (st.fitness_ema || 0.5) + 0.15 * fit,
      genes,
      last_formation: grade.formation_id,
    }};
    evolved = true;
  }}
  const summary = evolved
    ? {{
        acb_id: acbId,
        fitness: +fit.toFixed(4),
        fitness_ema: +Number(st.fitness_ema).toFixed(4),
        generation: st.generation,
        genes: (st.genes || []).map((g) => +Number(g).toFixed(4)),
        slots: slots.map((i) => geneSlots[i]).filter(Boolean),
        federate: true,
        answers: null,
      }}
    : null;
  return {{
    ok: true,
    schema: "stratamesh.academy.flux.v1",
    acb_id: acbId || null,
    student: isStudent,
    fitness: fit,
    committed,
    evolved,
    unready,
    verdict: committed ? "pass" : "fail",
    reasons,
    bus: "propose → constrain → commit | escalate",
    lobes: {{ probabilistic: "fitness packet", symbolic: "fail-closed certificate" }},
    qiga: isStudent
      ? {{
          generation: st.generation || 0,
          fitness_ema: +Number(st.fitness_ema || 0.5).toFixed(4),
          genes: (st.genes || []).map((g) => +Number(g).toFixed(4)),
          slots: geneSlots,
        }}
      : null,
    federated_summary: summary,
    state: st,
    note: "Worker tap: fail-closed + allele drift. Fog python3 -m academy --flux runs the full QIGA population. Summaries omit answers.",
  }};
}}
async function pushAcbQiga(env, acbId, fitness) {{
  if (!env || !env.ACB || typeof env.ACB.fetch !== "function") return {{ pushed: false, reason: "no env.ACB binding" }};
  try {{
    const r = await env.ACB.fetch(
      new Request("https://acb/acb/qiga", {{
        method: "POST",
        headers: {{ "Content-Type": "application/json" }},
        body: JSON.stringify({{ sca_id: acbId, fitness, federate: true, source: "academy" }}),
      }})
    );
    return {{ pushed: r.ok, status: r.status }};
  }} catch (e) {{
    return {{ pushed: false, error: String(e.message || e).slice(0, 80) }};
  }}
}}
function pageIndex() {{
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>StrataMesh LAB · ACB Academy</title><style>${{CSS}}</style></head><body><main>
<p class="badge">STRATAMESH LAB · v${{VERSION}}</p>
<h1>ACB Academy</h1>
<p>Always-on training for the Orchestrator and the AIOps team. Corrective drills lock failure modes. Exploratory drills widen competence. Fail-closed: empty answers do not pass.</p>
<p>Ollama pulls GGUF from Hugging Face on the Fog (<code>:11434</code>, residual C_mesh). Grades are dual-lobe QIGA packets: probabilistic fitness + symbolic fail-closed certificate. Unready does not breed. Federated summaries never include answers. No HF Inference, no Worker <code>HF_TOKEN</code>, no workers.dev. STRATA cost is <strong>lab-waived</strong>.</p>
<p>Students: Vespera (orchestrator), Kael, Nyx, Solace, Reed, Mira. <code>grok@</code> is not a student.</p>
<ul>
<li><a href="/health">/health</a></li>
<li><a href="/v1/catalog">/v1/catalog</a></li>
<li><a href="/v1/formations">/v1/formations</a></li>
<li><a href="/v1/syllabus">/v1/syllabus</a></li>
<li><a href="/v1/models">/v1/models</a></li>
<li><a href="/v1/flux">/v1/flux</a> dual-lobe QIGA</li>
<li><a href="/SPEC.txt">/SPEC.txt</a></li>
<li><a href="/openapi.json">/openapi.json</a></li>
</ul>
<p><a href="https://huggingface.co/docs/hub/en/ollama">Ollama ← HF GGUF</a> · <a href="https://github.com/StrataMesh-Laboratory/stratamesh-core">git</a></p>
</main></body></html>`;
}}
function specText() {{
  return `STRATAMESH ACB Academy
================================================================================
Version: ${{VERSION}}  Host: ${{PRIMARY}}
Always-on catalog + fail-closed grader. Lab / not mainnet / n=2 / f_max=0.
HF Inference Providers: HOLD (canPay=false until 2026-09-01). Worker HF_TOKEN: none.
Ollama on Fog: ollama pull hf.co/{{user}}/{{repo}}:{{quant}} then POST /api/generate :11434
STRATA: catalog GET = 0. Formation compute lab_waived; later subsistence debit, never mint.
Students: Orchestrator ACB-ORCH-CMN-001 + AIOps devops/security/analysis/mesh/economy.
Not a student: grok@calhegasmorais.pt
================================================================================
GET  /health /v1/catalog /v1/formations /v1/formations/:id /v1/syllabus?role=&mode=
GET  /v1/roster /v1/models /v1/cost /v1/progress?acb_id=
POST /v1/enroll {{acb_id}}
POST /v1/grade  {{formation_id, answers:[], acb_id?}}  — grader + QIGA flux tick
POST /v1/flux   same payload; returns dual-lobe packet
GET  /v1/flux?acb_id=   GET /v1/flux/federated
Fail-closed: empty answers, missing must_contain, or forbidden tokens (workers.dev, secret prefixes).
Unready packets are not admissible — QIGA does not evolve. Federated summaries omit answers.
`;
}}
function openapi() {{
  return {{
    openapi: "3.1.0",
    info: {{
      title: "StrataMesh ACB Academy",
      version: VERSION,
      description: "Always-on formations for Orchestrator and AIOps. Ollama←HF on Fog. No secrets.",
    }},
    servers: [{{ url: PRIMARY }}],
    paths: {{
      "/health": {{ get: {{ summary: "Liveness + counts" }} }},
      "/v1/catalog": {{ get: {{ summary: "Full catalog" }} }},
      "/v1/formations": {{ get: {{ summary: "List formations" }} }},
      "/v1/grade": {{ post: {{ summary: "Fail-closed grader" }} }},
      "/v1/run": {{ post: {{ summary: "symbolic (Worker) or ollama (Fog)" }} }},
    }},
    "x-not-present": ["OAuth", "workers.dev", "HF inference", "mint"],
  }};
}}
async function persist(env, key, value) {{
  if (env && env.ACADEMY_KV && typeof env.ACADEMY_KV.put === "function") {{
    await env.ACADEMY_KV.put(key, JSON.stringify(value));
    return true;
  }}
  return false;
}}
async function readKv(env, key) {{
  if (env && env.ACADEMY_KV && typeof env.ACADEMY_KV.get === "function") {{
    const raw = await env.ACADEMY_KV.get(key);
    if (raw) try {{ return JSON.parse(raw); }} catch (_) {{}}
  }}
  return null;
}}

export default {{
  async fetch(request, env) {{
    if (request.method === "OPTIONS") return new Response(null, {{ headers: CORS }});
    const url = new URL(request.url);
    const path = url.pathname.replace(/\\/+$/, "") || "/";

    if (path === "/" && wantsHtml(request)) return html(pageIndex());
    if (path === "/" || path === "/health" || path === "/v1/meta") return json(meta(), 200, "no-store");
    if (path === "/v1/catalog") return json(CATALOG);
    if (path === "/v1/roster") return json({{ students: CATALOG.roster, not_students: CATALOG.not_students }});
    if (path === "/v1/models") return json(CATALOG.models);
    if (path === "/v1/cost") return json(CATALOG.cost);
    if (path === "/v1/syllabus") {{
      const role = url.searchParams.get("role") || "";
      const mode = url.searchParams.get("mode") || "";
      return json({{ role: role || null, mode: mode || null, formations: syllabus(role, mode) }});
    }}
    if (path === "/v1/formations") {{
      const role = url.searchParams.get("role") || "";
      const mode = url.searchParams.get("mode") || "";
      const list = syllabus(role, mode).map((f) => ({{
        id: f.id, role: f.role, mode: f.mode, title: f.title, intent: f.intent, drills: (f.drills || []).length,
      }}));
      return json({{ count: list.length, formations: list }});
    }}
    if (path.startsWith("/v1/formations/")) {{
      const f = findFormation(path.slice("/v1/formations/".length));
      if (!f) return json({{ ok: false, error: "unknown_formation" }}, 404);
      return json(f);
    }}
    if (path === "/SPEC.txt") return text(specText());
    if (path === "/llms.txt") {{
      return text(`# ACB Academy\\n\\n> Always-on training for Orchestrator + AIOps. Fail-closed. Lab.\\n\\n- ${{PRIMARY}}/SPEC.txt\\n- ${{PRIMARY}}/v1/catalog\\n- POST ${{PRIMARY}}/v1/grade\\n\\nOllama on Fog: ${{CATALOG.models.corrective.hf_gguf}}\\nHF inference: HOLD. grok@ is not a student.\\n`);
    }}
    if (path === "/openapi.json") return json(openapi());
    if (path === "/robots.txt") return text("User-agent: *\\nAllow: /\\n");

    if (path === "/v1/enroll" && request.method === "POST") {{
      const body = await request.json().catch(() => ({{}}));
      const acb_id = String(body.acb_id || "").toUpperCase();
      const student = (CATALOG.roster || []).find((s) => s.acb_id === acb_id);
      if (!student) return json({{ ok: false, error: "not_a_student", hint: "Orchestrator or AIOps ACB ids only. grok@ is not a student." }}, 403);
      const rec = {{ acb_id, enrolled_at: new Date().toISOString(), formations_due: syllabus(student.role).map((f) => f.id) }};
      await persist(env, "enroll:" + acb_id, rec);
      return json({{ ok: true, ...rec, cost: 0 }}, 200, "no-store");
    }}
    if (path === "/v1/progress") {{
      const acb_id = String(url.searchParams.get("acb_id") || "").toUpperCase();
      const rec = acb_id ? await readKv(env, "enroll:" + acb_id) : null;
      const grades = acb_id ? await readKv(env, "grades:" + acb_id) : null;
      const st = acb_id ? await readKv(env, "flux:" + acb_id) : null;
      return json({{ acb_id: acb_id || null, enroll: rec, grades: grades || [], flux: st }}, 200, "no-store");
    }}
    if (path === "/v1/flux/federated") {{
      const fed = (await readKv(env, "flux:federated")) || {{}};
      const clients = Object.keys(fed).map((k) => fed[k]);
      const mean = clients.length ? clients.reduce((s, c) => s + Number(c.fitness_ema || 0), 0) / clients.length : null;
      return json({{ ok: true, n: clients.length, mean_fitness: mean, clients, raw_answers: false }}, 200, "no-store");
    }}
    if (path === "/v1/flux" && request.method === "GET") {{
      const acb_id = String(url.searchParams.get("acb_id") || "").toUpperCase();
      const st = acb_id ? await readKv(env, "flux:" + acb_id) : null;
      return json({{
        ok: true,
        schema: "stratamesh.academy.flux.v1",
        acb_id: acb_id || null,
        state: st,
        slots: (CATALOG.flux && CATALOG.flux.gene_slots) || [],
        bus: "propose → constrain → commit | escalate",
      }}, 200, "no-store");
    }}
    async function runFlux(env, acbId, grade) {{
      const prev = acbId ? await readKv(env, "flux:" + acbId) : null;
      const flux = fluxTick(acbId, grade, prev);
      if (flux.evolved && acbId) {{
        await persist(env, "flux:" + acbId, flux.state);
        const fed = (await readKv(env, "flux:federated")) || {{}};
        if (flux.federated_summary) {{
          fed[acbId] = flux.federated_summary;
          await persist(env, "flux:federated", fed);
        }}
        flux.acb_tap = await pushAcbQiga(env, acbId, flux.fitness);
      }}
      return flux;
    }}
    if ((path === "/v1/grade" || path === "/v1/flux") && request.method === "POST") {{
      const body = await request.json().catch(() => ({{}}));
      const f = findFormation(body.formation_id);
      if (!f) return json({{ ok: false, error: "unknown_formation" }}, 404);
      const out = gradeFormation(f, body.answers || []);
      const acb_id = String(body.acb_id || "").toUpperCase();
      if (acb_id) {{
        const prev = (await readKv(env, "grades:" + acb_id)) || [];
        prev.push({{ at: new Date().toISOString(), formation_id: f.id, complete: out.complete }});
        await persist(env, "grades:" + acb_id, prev.slice(-50));
      }}
      out.flux = await runFlux(env, acb_id, out);
      if (path === "/v1/flux") return json({{ grade: out, flux: out.flux }}, 200, "no-store");
      return json(out, 200, "no-store");
    }}
    if (path === "/v1/run" && request.method === "POST") {{
      const body = await request.json().catch(() => ({{}}));
      const f = findFormation(body.formation_id);
      if (!f) return json({{ ok: false, error: "unknown_formation" }}, 404);
      const runtime = String(body.runtime || "symbolic");
      if (runtime === "ollama") {{
        const ollamaUrl = (env && env.OLLAMA_URL) || "";
        if (!ollamaUrl) {{
          const m = CATALOG.models[f.mode] || CATALOG.models.corrective;
          return json({{
            ok: false,
            runtime: "ollama",
            available: false,
            error: "runtime_unavailable",
            hint: {{
              command: "ollama pull " + m.hf_gguf,
              fallback: "ollama pull " + m.ollama,
              fog: "cd src && python3 -m academy --run " + f.id + " --runtime ollama",
              worker: "this Worker does not infer; Fog residual C_mesh only",
            }},
            fallback: "POST /v1/grade",
          }}, 503, "no-store");
        }}
      }}
      return json({{
        ok: true,
        runtime: "symbolic",
        formation: f,
        hint: "Submit answers via POST /v1/grade. Silence is unready.",
      }}, 200, "no-store");
    }}
    return json({{ ok: false, error: "not_found", spec: PRIMARY + "/SPEC.txt" }}, 404);
  }},
}};
"""


def main() -> None:
    OUT.write_text(render(), encoding="utf-8")
    print("wrote", OUT, "bytes", OUT.stat().st_size)


if __name__ == "__main__":
    main()
