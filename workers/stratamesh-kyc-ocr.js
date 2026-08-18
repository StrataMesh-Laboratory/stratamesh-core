/**
 * Passport / ID OCR → MRZ extraction (Workers AI LLaVA) + ICAO 9303 validation.
 * Open standards: ICAO Doc 9303 check digits (same family as OmniMRZ / mrz-fast).
 * Does not call closed sovereign APIs; structural authenticity only.
 */
const VERSION = '1.0.0-llava-mrz';
const MODEL = '@cf/llava-hf/llava-1.5-7b-hf';

function j(d, s = 200) {
  return new Response(JSON.stringify(d, null, 2), {
    status: s,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' },
  });
}

function icaoCheckDigit(data) {
  const weights = [7, 3, 1];
  const map = {};
  for (let i = 0; i <= 9; i++) map[String(i)] = i;
  for (let i = 0; i < 26; i++) map[String.fromCharCode(65 + i)] = 10 + i;
  map['<'] = 0;
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const v = map[data[i].toUpperCase()];
    if (v === undefined) return null;
    sum += v * weights[i % 3];
  }
  return String(sum % 10);
}

function parseAndValidateMRZ(line1, line2) {
  const L1 = String(line1 || '').toUpperCase().replace(/\s+/g, '');
  const L2 = String(line2 || '').toUpperCase().replace(/\s+/g, '');
  const report = { standard: 'ICAO_9303', format: null, checks: [], ok: false, score: 0 };
  if (L1.length === 44 && L2.length === 44 && (L1.startsWith('P') || L1.startsWith('IP'))) {
    report.format = 'TD3';
    const names = L1.slice(5);
    const docNum = L2.slice(0, 9);
    const docCd = L2[9];
    const nationality = L2.slice(10, 13);
    const birth = L2.slice(13, 19);
    const birthCd = L2[19];
    const sex = L2[20];
    const expiry = L2.slice(21, 27);
    const expiryCd = L2[27];
    const optional = L2.slice(28, 42);
    const optionalCd = L2[42];
    const compositeCd = L2[43];
    const c1 = icaoCheckDigit(docNum) === docCd;
    const c2 = icaoCheckDigit(birth) === birthCd;
    const c3 = icaoCheckDigit(expiry) === expiryCd;
    const c4 = icaoCheckDigit(optional) === optionalCd;
    const composite = docNum + docCd + birth + birthCd + expiry + expiryCd + optional + optionalCd;
    const c5 = icaoCheckDigit(composite) === compositeCd;
    report.checks = [
      { field: 'document_number', ok: c1 },
      { field: 'birth_date', ok: c2 },
      { field: 'expiry', ok: c3 },
      { field: 'optional', ok: c4 },
      { field: 'composite', ok: c5 },
    ];
    report.document_number = docNum.replace(/</g, '');
    report.nationality = nationality.replace(/</g, '');
    report.sex = sex;
    const nameParts = names.split('<<');
    report.surname = (nameParts[0] || '').replace(/</g, ' ').trim();
    report.given_names = (nameParts[1] || '').replace(/</g, ' ').trim();
    report.full_name = (report.surname + ' ' + report.given_names).trim();
    report.ok = c1 && c2 && c3 && c5;
    report.score = [c1, c2, c3, c4, c5].filter(Boolean).length / 5;
    report.mrz_line1 = L1;
    report.mrz_line2 = L2;
    return report;
  }
  report.checks.push({ field: 'mrz', ok: false, detail: 'Need TD3 lines of 44 chars each' });
  return report;
}

function extractMrzFromText(text) {
  const lines = String(text || '')
    .toUpperCase()
    .replace(/[^\nA-Z0-9<]/g, '')
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  // Prefer lines of length 44 starting with P
  const td3 = lines.filter((l) => l.length >= 40 && l.length <= 48);
  let l1 = td3.find((l) => l.startsWith('P') || l.startsWith('IP'));
  let l2 = null;
  if (l1) {
    const i = td3.indexOf(l1);
    l2 = td3[i + 1] || td3.find((l) => l !== l1 && /\d/.test(l));
  }
  // pad/trim to 44
  const norm = (l) => {
    if (!l) return '';
    l = l.replace(/\s/g, '');
    if (l.length > 44) l = l.slice(0, 44);
    while (l.length < 44) l += '<';
    return l;
  };
  return { mrz_line1: norm(l1), mrz_line2: norm(l2), raw_lines: lines.slice(0, 8) };
}

async function runVision(env, imageBytes) {
  if (!env.AI || typeof env.AI.run !== 'function') {
    return { ok: false, error: 'AI_binding_missing' };
  }
  const prompt =
    'This is a passport or national ID photo. Read the Machine Readable Zone (MRZ) at the bottom exactly. ' +
    'Return ONLY the MRZ lines as plain text, one line per row, using letters, digits and < characters. No commentary.';
  try {
    const result = await env.AI.run(MODEL, {
      prompt,
      image: [...imageBytes],
      max_tokens: 256,
    });
    const text = result?.response || result?.description || JSON.stringify(result);
    return { ok: true, text: String(text) };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
          'Access-Control-Allow-Headers': '*',
        },
      });
    }
    try {
      if (path === '/health' || path === '/') {
        return j({
          status: 'ok',
          service: 'stratamesh-kyc-ocr',
          version: VERSION,
          model: MODEL,
          ai: !!(env.AI && env.AI.run),
          standards: ['ICAO_9303_MRZ'],
          endpoints: ['POST /ocr', 'POST /kyc-from-image'],
        });
      }

      if ((path === '/ocr' || path === '/kyc-from-image') && request.method === 'POST') {
        const ct = request.headers.get('Content-Type') || '';
        let bytes = null;
        let lang = 'pt';
        let submitAuth = null;
        let sovereign_hint = '';
        if (ct.includes('multipart/form-data')) {
          const fd = await request.formData();
          const file = fd.get('image') || fd.get('file') || fd.get('document');
          lang = String(fd.get('lang') || 'pt');
          submitAuth = fd.get('authorization') || request.headers.get('Authorization');
          sovereign_hint = String(fd.get('sovereign_id') || '');
          if (file && typeof file.arrayBuffer === 'function') {
            bytes = new Uint8Array(await file.arrayBuffer());
          }
        } else {
          const body = await request.json().catch(() => ({}));
          lang = body.lang || 'pt';
          submitAuth = body.authorization || request.headers.get('Authorization');
          sovereign_hint = body.sovereign_id || '';
          if (body.image_base64) {
            const b64 = String(body.image_base64).replace(/^data:image\/\w+;base64,/, '');
            const bin = atob(b64);
            bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          }
        }
        if (!bytes || bytes.length < 100) {
          return j({ success: false, error: 'image_required' }, 400);
        }
        if (bytes.length > 4_500_000) {
          return j({ success: false, error: 'image_too_large_max_4mb' }, 400);
        }

        const vision = await runVision(env, bytes);
        if (!vision.ok) {
          return j({
            success: false,
            error: vision.error || 'ocr_failed',
            hint: lang === 'en'
              ? 'Vision OCR unavailable. Enter MRZ lines manually via /kyc/submit.'
              : 'OCR visual indisponível. Introduza as linhas MRZ manualmente em /kyc/submit.',
          }, 503);
        }

        const extracted = extractMrzFromText(vision.text);
        const report = parseAndValidateMRZ(extracted.mrz_line1, extracted.mrz_line2);
        const out = {
          success: true,
          version: VERSION,
          ocr: { model: MODEL, raw_excerpt: String(vision.text).slice(0, 500) },
          mrz_line1: extracted.mrz_line1,
          mrz_line2: extracted.mrz_line2,
          validation: report,
          sovereign_id: report.document_number || sovereign_hint || null,
          full_name: report.full_name || null,
        };

        // Optional: forward to auth KYC submit
        if (path === '/kyc-from-image' && submitAuth && report.mrz_line1) {
          try {
            const r = await fetch('https://stratamesh-auth.stratamesh.workers.dev/kyc/submit', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: String(submitAuth).startsWith('Bearer') ? submitAuth : 'Bearer ' + submitAuth,
              },
              body: JSON.stringify({
                lang,
                doc_type: 'passport',
                sovereign_id: out.sovereign_id,
                mrz_line1: out.mrz_line1,
                mrz_line2: out.mrz_line2,
                full_name: out.full_name,
                issuing_country: report.nationality || 'PRT',
              }),
            });
            out.kyc_submit = await r.json().catch(() => ({}));
          } catch (e) {
            out.kyc_submit = { error: String(e.message || e) };
          }
        }
        return j(out);
      }

      return j({ error: 'not_found', version: VERSION }, 404);
    } catch (e) {
      return j({ error: String(e.message || e), version: VERSION }, 500);
    }
  },
};
