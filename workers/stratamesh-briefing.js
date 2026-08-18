/**
 * AMCM ENI — Daily executive briefing + voice (TTV/VTT)
 * Channels: DeoMail → amcmorais@icloud.com · WhatsApp → +351 967 240 130
 * Schedule: 11:00 Europe/Lisbon (cron)
 * On-demand: WhatsApp keywords resumo|briefing|voz|voice → text + optional TTS audio
 *
 * Open stack:
 *  - LLM: Orchestrator (existing)
 *  - STT: Workers AI @cf/openai/whisper (if AI binding)
 *  - TTS: Workers AI @cf/deepgram/aura-1-en or edge free path
 *  - Email: stratamesh-deomail
 *  - WhatsApp: stratamesh-whatsapp
 *
 * True PSTN phone calls are NOT available without Twilio/Vonage — voice arrives as WhatsApp voice note.
 */
const VERSION = "1.0.0-briefing-voice";
const OWNER_EMAIL = "amcmorais@icloud.com";
const OWNER_WA = "447404796458"; // +44 AMCM ENI Business (temp until +351 allowlisted)
const LISBON_TZ = "Europe/Lisbon";

function j(d, s = 200) {
  return new Response(JSON.stringify(d, null, 2), {
    status: s,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  });
}

function nowLisbonParts(d = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: LISBON_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: parseInt(parts.hour, 10),
    minute: parseInt(parts.minute, 10),
  };
}

async function orchBrief(env, mode = "daily") {
  const prompt =
    mode === "daily"
      ? `Gera um RESUMO EXECUTIVO DIÁRIO global (PT-PT) para André Manuel Calhegas Morais (AMCM ENI / Nó Calhegas Morais). Inclui: (1) 5 pontos de contexto mundial relevantes a negócio/tech/energia/regulação, (2) implicações para ENI e StrataMesh lab, (3) 3 acções prioritárias para hoje, (4) riscos. Máximo 400 palavras. Tom institucional, directo. Sem markdown excessivo.`
      : `Resumo executivo curto (PT-PT) sob pedido do operador — contexto global + Nó CMN/StrataMesh. Máximo 250 palavras.`;

  const payload = {
    message: prompt,
    channel: "briefing",
    lang: "pt",
    clearance: "confidential",
  };
  try {
    if (env.ORCH && typeof env.ORCH.fetch === "function") {
      const r = await env.ORCH.fetch(
        new Request("https://orch.internal/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      );
      if (r.ok) {
        const data = await r.json();
        return data.reply || data.message || data.text || JSON.stringify(data).slice(0, 1500);
      }
    }
  } catch (_) {}
  try {
    const r = await fetch("https://stratamesh-orchestrator.stratamesh.workers.dev/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (r.ok) {
      const data = await r.json();
      return data.reply || data.message || data.text || "Resumo indisponível.";
    }
  } catch (_) {}
  return (
    "Resumo executivo (fallback lab): monitorizar verificação Meta WhatsApp (+44), DeoMail operacional (geral@eni.calhegasmorais.pt), número de teste WA activo. Prioridade: concluir Business Verification e registar +44 na Cloud API."
  );
}

async function sendEmail(env, subject, text) {
  try {
    if (env.DEOMAIL && typeof env.DEOMAIL.fetch === "function") {
      const r = await env.DEOMAIL.fetch(
        new Request("https://deomail.internal/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: OWNER_EMAIL,
            subject,
            text,
            html: `<pre style="font-family:system-ui,sans-serif;white-space:pre-wrap">${text
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")}</pre>`,
          }),
        })
      );
      return { ok: r.ok, via: "binding", body: await r.json().catch(() => ({})) };
    }
  } catch (_) {}
  try {
    const r = await fetch("https://stratamesh-deomail.stratamesh.workers.dev/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: OWNER_EMAIL, subject, text }),
    });
    return { ok: r.ok, via: "http", body: await r.json().catch(() => ({})) };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

async function sendWhatsAppText(env, text) {
  try {
    if (env.WHATSAPP && typeof env.WHATSAPP.fetch === "function") {
      const r = await env.WHATSAPP.fetch(
        new Request("https://wa.internal/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: OWNER_WA, text: text.slice(0, 4000) }),
        })
      );
      return { ok: r.ok, via: "binding", body: await r.json().catch(() => ({})) };
    }
  } catch (_) {}
  try {
    const r = await fetch("https://stratamesh-whatsapp.stratamesh.workers.dev/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: OWNER_WA, text: text.slice(0, 4000) }),
    });
    return { ok: r.ok, via: "http", body: await r.json().catch(() => ({})) };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

/** TTS via Workers AI Deepgram Aura if AI binding present */
async function tts(env, text) {
  if (!env.AI) return { ok: false, error: "no_ai_binding" };
  try {
    const clipped = String(text || "").slice(0, 2000);
    const result = await env.AI.run("@cf/deepgram/aura-1-en", {
      text: clipped,
      speaker: "luna",
      encoding: "mp3",
    });
    // Workers AI TTS may return binary or {audio: base64}
    if (result instanceof ArrayBuffer || result instanceof Uint8Array) {
      return { ok: true, mime: "audio/mpeg", bytes: result };
    }
    if (result && result.audio) {
      const bin = Uint8Array.from(atob(result.audio), (c) => c.charCodeAt(0));
      return { ok: true, mime: "audio/mpeg", bytes: bin };
    }
    return { ok: false, error: "tts_unexpected_shape", sample: JSON.stringify(result).slice(0, 200) };
  } catch (e) {
    // try alternate model id
    try {
      const result = await env.AI.run("@cf/deepgram/aura-2-en", {
        text: String(text || "").slice(0, 1500),
      });
      if (result && result.audio) {
        const bin = Uint8Array.from(atob(result.audio), (c) => c.charCodeAt(0));
        return { ok: true, mime: "audio/mpeg", bytes: bin };
      }
    } catch (e2) {
      return { ok: false, error: String(e.message || e) + " / " + String(e2.message || e2) };
    }
    return { ok: false, error: String(e.message || e) };
  }
}

/** STT Whisper */
async function stt(env, audioBase64) {
  if (!env.AI) return { ok: false, error: "no_ai_binding" };
  try {
    const res = await env.AI.run("@cf/openai/whisper", { audio: audioBase64 });
    return { ok: true, text: res.text || res.transcription || "", raw: res };
  } catch (e) {
    try {
      const res = await env.AI.run("@cf/openai/whisper-large-v3-turbo", {
        audio: audioBase64,
        language: "pt",
      });
      return { ok: true, text: res.text || "", raw: res };
    } catch (e2) {
      return { ok: false, error: String(e.message || e) };
    }
  }
}

async function runBriefing(env, { voice = false, mode = "daily" } = {}) {
  const lisbon = nowLisbonParts();
  const summary = await orchBrief(env, mode);
  const subject = `AMCM ENI · Resumo executivo ${lisbon.date} · 11h Lisboa`;
  const header = `StrataMesh / AMCM ENI — briefing ${lisbon.date} (${LISBON_TZ})\n\n`;
  const body = header + summary;

  const email = await sendEmail(env, subject, body);
  const waText =
    `📋 *Briefing AMCM ENI* (${lisbon.date})\n\n` +
    summary.slice(0, 3500) +
    `\n\n_Responda «voz» para versão áudio · «resumo» para repetir_`;
  const wa = await sendWhatsAppText(env, waText);

  let ttsResult = null;
  if (voice) {
    ttsResult = await tts(env, summary.slice(0, 1200));
  }

  return {
    ok: true,
    date: lisbon.date,
    email,
    whatsapp: wa,
    voice_requested: voice,
    tts: ttsResult
      ? { ok: ttsResult.ok, error: ttsResult.error || null, bytes: ttsResult.ok ? ttsResult.bytes?.byteLength || ttsResult.bytes?.length : 0 }
      : null,
    summary_preview: summary.slice(0, 280),
    version: VERSION,
    note:
      "Chamada PSTN real requer Twilio. Voz = nota de voz WhatsApp / TTS quando AI binding activo.",
  };
}

function wantsBriefing(text) {
  const t = String(text || "").toLowerCase();
  return /\b(resumo|briefing|brief|sum[aá]rio|executivo|voz|voice|audio|ligar|chamada)\b/i.test(t);
}

function wantsVoice(text) {
  const t = String(text || "").toLowerCase();
  return /\b(voz|voice|audio|ouvir|chamada|ligar|speak)\b/i.test(t);
}

export default {
  async scheduled(controller, env, ctx) {
    // Cron: daily ~11:00 Lisbon — configure trigger "0 10 * * *" UTC (≈11h WEST) or dual
    ctx.waitUntil(
      runBriefing(env, { voice: false, mode: "daily" }).then((r) =>
        console.log("briefing_cron", JSON.stringify({ ok: r.ok, date: r.date, email: r.email?.ok, wa: r.whatsapp?.ok }))
      )
    );
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
          "Access-Control-Allow-Headers": "*",
        },
      });
    }

    try {
      if (path === "/health" || path === "/") {
        return j({
          status: "ok",
          service: "stratamesh-briefing",
          owner_email: OWNER_EMAIL,
          owner_wa: "+" + OWNER_WA,
          schedule: "11:00 Europe/Lisbon (cron UTC 10:00)",
          channels: ["deomail", "whatsapp", "tts_workers_ai", "stt_whisper"],
          pstn_calls: false,
          version: VERSION,
        });
      }

      if (path === "/run" && (request.method === "POST" || request.method === "GET")) {
        const voice = url.searchParams.get("voice") === "1" || url.searchParams.get("voz") === "1";
        const result = await runBriefing(env, { voice, mode: "daily" });
        return j(result);
      }

      if (path === "/tts" && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const text = body.text || body.message || "";
        const result = await tts(env, text);
        if (result.ok && result.bytes) {
          return new Response(result.bytes, {
            headers: {
              "Content-Type": result.mime || "audio/mpeg",
              "Access-Control-Allow-Origin": "*",
            },
          });
        }
        return j({ ok: false, error: result.error || "tts_failed" }, 502);
      }

      if (path === "/stt" && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const audio = body.audio || body.base64;
        if (!audio) return j({ error: "audio_base64_required" }, 400);
        const result = await stt(env, audio);
        return j(result, result.ok ? 200 : 502);
      }

      // Inbound from WhatsApp worker / Fire
      if (path === "/wa-hook" && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const text = body.text || body.message || body.body || "";
        if (!wantsBriefing(text)) {
          return j({ ok: true, handled: false, reason: "no_keyword" });
        }
        const voice = wantsVoice(text);
        const result = await runBriefing(env, { voice, mode: "on_demand" });
        return j({ ok: true, handled: true, voice, result });
      }

      return j({ error: "not_found", version: VERSION }, 404);
    } catch (e) {
      return j({ error: String(e.message || e), version: VERSION }, 500);
    }
  },
};
