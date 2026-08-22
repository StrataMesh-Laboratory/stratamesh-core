"""Lockstep helpers — twin source of truth → live HTML + git copy map.

CF writes: X-Auth-Email FIRST, then Authorization Bearer (cfat write token).
Never use a cfut user token for D1 / R2 / Workers writes.
"""

from __future__ import annotations

import html as htmlmod
import os
import re
from pathlib import Path

CF_EMAIL = "amcmorais@icloud.com"
CF_ACCOUNT = "f3645fcb56675cf7250d8ba7358eb252"
CF_D1 = "f78ff995-03d2-4b97-88b6-56e61416fce7"
CF_ZONE = "cdd8ee56bba57bca8623a86b88c7b7b6"
R2_BUCKET = "stratamesh-fog"
GH_USER = "amcmorais"
GH_REPO = "stratamesh-core"
D1_CHUNK = 7000
# Full pages that must stay in lockstep with landing.tsx / diagrams.tsx.
D1_KEYS_PT = ("home-pt", "landing-pt", "home")
D1_KEYS_EN = ("home-en", "landing-en")
D1_KEYS = D1_KEYS_PT + D1_KEYS_EN
PORTAL_KEYS_PT = ("portal-pt", "portal")
PORTAL_KEYS_EN = ("portal-en",)

# Twin paths → GitHub repo paths (stratamesh-core).
GIT_COPY = (
    ("src/lib/holons.ts", "src/lib/holons.ts"),
    ("src/lib/copy/site.ts", "src/lib/copy/site.ts"),
    ("src/lib/symbolic.ts", "src/lib/symbolic.ts"),
    ("src/lib/orchestrator.ts", "src/lib/orchestrator.ts"),
    ("src/lib/roadmap.ts", "src/lib/roadmap.ts"),
    ("src/components/diagrams.tsx", "src/components/diagrams.tsx"),
    ("src/components/landing.tsx", "src/components/landing.tsx"),
    ("src/components/painel.tsx", "src/components/painel.tsx"),
    ("src/components/roadmap.tsx", "src/components/roadmap.tsx"),
    ("src/components/site-chrome.tsx", "src/components/site-chrome.tsx"),
    ("src/lib/os-shims/user.ts", "src/lib/os-shims/user.ts"),
    ("src/lib/os-shims/gates.tsx", "src/lib/os-shims/gates.tsx"),
    ("src/components/holon-strip.tsx", "src/components/holon-strip.tsx"),
    ("src/lib/bancada-store.ts", "src/lib/bancada-store.ts"),
    ("src/lib/bancada-ipfs.ts", "src/lib/bancada-ipfs.ts"),
    ("src/lib/cgu-engine.ts", "src/lib/cgu-engine.ts"),
    ("src/lib/cgu-script.ts", "src/lib/cgu-script.ts"),
    ("src/lib/cgu-carts.ts", "src/lib/cgu-carts.ts"),
    ("src/lib/lab-kernel.ts", "src/lib/lab-kernel.ts"),
    ("src/components/bancada-canvas.tsx", "src/components/bancada-canvas.tsx"),
    ("src/components/nft-turntable.tsx", "src/components/nft-turntable.tsx"),
    ("src/components/roadmap-labs.tsx", "src/components/roadmap-labs.tsx"),
    ("artifacts/stratamesh/frontend/portal-pt.html", "frontend/portal-pt.html"),
    ("artifacts/stratamesh/frontend/portal-en.html", "frontend/portal-en.html"),
    ("src/lib/session-id.ts", "src/lib/session-id.ts"),
    ("src/os-entry.tsx", "src/os-entry.tsx"),
    ("vite.os.config.ts", "vite.os.config.ts"),
    ("os.html", "os.html"),
    ("src/routes/painel.tsx", "src/routes/painel.tsx"),
    ("src/routes/en.painel.tsx", "src/routes/en.painel.tsx"),
    ("scripts/lockstep_lib.py", "scripts/lockstep_lib.py"),
    ("scripts/lockstep-publish.py", "scripts/lockstep-publish.py"),
    ("scripts/lockstep_lib.test.py", "scripts/lockstep_lib.test.py"),
    ("scripts/publish-lockstep.sh", "scripts/publish-lockstep.sh"),
    ("artifacts/stratamesh/shared/holonic-clp.js", "shared/holonic-clp.js"),
    ("artifacts/stratamesh/shared/holonic-contracts.js", "shared/holonic-contracts.js"),
    ("artifacts/stratamesh/docs/HOLONIC-LAYERS.md", "docs/HOLONIC-LAYERS.md"),
    ("artifacts/stratamesh/frontend/landing-pt.html", "frontend/landing-pt.html"),
    ("artifacts/stratamesh/frontend/landing-en.html", "frontend/landing-en.html"),
    ("artifacts/stratamesh/workers/stratamesh-holons.js", "workers/stratamesh-holons.js"),
    ("artifacts/stratamesh/workers/stratamesh-status.js", "workers/stratamesh-status.js"),
    ("artifacts/stratamesh/workers/stratamesh-deomail.js", "workers/stratamesh-deomail.js"),
    ("artifacts/stratamesh/workers/stratamesh-briefing.js", "workers/stratamesh-briefing.js"),
    ("artifacts/stratamesh/workers/stratamesh-auth.js", "workers/stratamesh-auth.js"),
    ("artifacts/stratamesh/workers/_foundation_holonic_clp.js", "workers/_foundation_holonic_clp.js"),
)

WORKERS = (
    ("stratamesh-holons", "artifacts/stratamesh/workers/stratamesh-holons.js"),
    ("stratamesh-status", "artifacts/stratamesh/workers/stratamesh-status.js"),
    ("stratamesh-deomail", "artifacts/stratamesh/workers/stratamesh-deomail.js"),
    ("stratamesh-briefing", "artifacts/stratamesh/workers/stratamesh-briefing.js"),
    ("stratamesh-auth", "artifacts/stratamesh/workers/stratamesh-auth.js"),
)

# artifacts/ is a FUSE project mount that can be unreadable; git clone is the fallback.
FALLBACK_ROOTS = (
    Path("/tmp/sm-lock"),
    Path("/tmp/stratamesh-core"),
    Path("/tmp/sm-push"),
)

OS_SPA_CANDIDATES = (
    Path("dist/os-spa"),
    Path("artifacts/os-spa"),
    Path("/tmp/os-spa"),
)


def is_write_token(token: str) -> bool:
    t = (token or "").strip()
    if not t:
        return False
    if t.startswith("cfut"):
        return False
    return t.startswith("cfat") or bool(re.fullmatch(r"[a-f0-9]{32,40}", t))


def load_cf_write(env: dict[str, str] | None = None, files: dict[str, str] | None = None) -> tuple[str, str]:
    """Return (email, write_token). Email is always first in the pair — CF auth order."""
    env = env if env is not None else os.environ
    email = (env.get("CLOUDFLARE_EMAIL") or CF_EMAIL).strip()
    candidates: list[str] = []
    for key in ("CLOUDFLARE_WRITE_TOKEN", "GOD_API"):
        if env.get(key):
            candidates.append(env[key].strip())
    default_paths = ["/tmp/god_api", "/tmp/write_api"]
    if files is None:
        for p in default_paths:
            fp = Path(p)
            if fp.is_file():
                candidates.append(fp.read_text().strip())
    else:
        for p in default_paths:
            if p in files:
                candidates.append(files[p].strip())
    for tok in candidates:
        if is_write_token(tok):
            return email, tok
    raise RuntimeError(
        "No Cloudflare WRITE token. Use X-Auth-Email first + cfat write token "
        "(/tmp/god_api). cfut user tokens are read-only."
    )


def cf_headers(email: str, token: str, extra: dict[str, str] | None = None) -> dict[str, str]:
    """User first, then the key — never Bearer-only without email."""
    h = {"X-Auth-Email": email, "Authorization": "Bearer " + token}
    if extra:
        h.update(extra)
    return h


def extract_arch(landing_tsx: str) -> dict[str, str]:
    m_pt = re.search(r'\? "(Holons aninhados e distintos:.*?)"', landing_tsx, re.S)
    m_en = re.search(r': "(Nested distinct holons:.*?)"', landing_tsx, re.S)
    if not m_pt or not m_en:
        raise RuntimeError("Could not extract architecture paragraphs from landing.tsx")
    return {"pt": m_pt.group(1), "en": m_en.group(1)}


def extract_holon_rows(diagrams_tsx: str) -> dict[str, list[str]]:
    block = re.search(
        r"const rows = pt\s*\?\s*\[(.*?)]\s*:\s*\[(.*?)]",
        diagrams_tsx,
        re.S,
    )
    if not block:
        raise RuntimeError("Could not extract HolonSvg rows from diagrams.tsx")

    def rows(blob: str) -> list[str]:
        return [s.replace('\\"', '"') for s in re.findall(r'"([^"]+)"', blob)]

    pt, en = rows(block.group(1)), rows(block.group(2))
    if len(pt) < 7 or len(en) < 7:
        raise RuntimeError(f"Holon rows too short: pt={len(pt)} en={len(en)}")
    return {"pt": pt, "en": en}


def holon_svg(lang: str, rows: list[str], title: str) -> str:
    # diagrams.tsx: viewBox height = 16 + n*58 + 8 (8 rows → 488).
    height = 16 + len(rows) * 58 + 8
    out = [
        f'<svg class="diagram" viewBox="0 0 640 {height}" role="img" aria-label="{htmlmod.escape(title, quote=True)}">'
    ]
    for i, label in enumerate(rows):
        w = 560 - i * 32
        x = 40 + i * 16
        y = 16 + i * 58
        fill, stroke = ("#161618", "#c4b5a0") if i == 1 else ("#111113", "#2a2a2e")
        out.append(
            f'<rect x="{x}" y="{y}" width="{w}" height="48" rx="2" fill="{fill}" stroke="{stroke}"/>'
        )
        tx = x + w / 2
        out.append(
            f'<text x="{tx:g}" y="{y + 30}" text-anchor="middle" fill="#e8e6e3" '
            f'font-family="IBM Plex Mono,monospace" font-size="12">{htmlmod.escape(label)}</text>'
        )
    out.append("</svg>")
    return "".join(out)


def patch_landing_html(html: str, lang: str, arch: str, svg: str) -> str:
    if lang == "pt":
        html2, n = re.subn(r"Holons aninhados e distintos:.*?(?=<)", arch, html, count=1, flags=re.S)
        lead = "Holons aninhados"
    else:
        html2, n = re.subn(r"Nested distinct holons:.*?(?=<)", arch, html, count=1, flags=re.S)
        lead = "Nested distinct"
    if n != 1:
        raise RuntimeError(f"{lang}: architecture paragraph not found ({lead})")
    pat = (
        r'<svg class="diagram" viewBox="0 0 640 \d+" role="img" '
        r'aria-label="[^"]*(?:Pilha holónica|Holonic stack)[^"]*">[\s\S]*?</svg>'
    )
    html3, n2 = re.subn(pat, svg, html2, count=1)
    if n2 != 1:
        raise RuntimeError(f"{lang}: holon SVG not found")
    # Painel is INTERNAL. Public CTAs send visitors to sign-in (PUBLIC clearance).
    if lang == "pt":
        html3 = html3.replace('href="/painel">Abrir painel', 'href="/dashboard">Entrar')
        html3 = html3.replace('href="/painel">Painel', 'href="/dashboard">Entrar')
        html3 = html3.replace(
            "Painel no piso público; sessão autenticada abre o piso interno.",
            "Sessão autenticada: clearance interna. O Painel é a Bancada desta conta.",
        )
    else:
        html3 = html3.replace('href="/en/painel">Open panel', 'href="/dashboard">Sign in')
        html3 = html3.replace('href="/en/painel">Panel', 'href="/dashboard">Sign in')
        html3 = html3.replace(
            "Panel on the public floor; an authenticated session opens the internal floor.",
            "Authenticated session: internal clearance. The Panel is this account’s sandbox.",
        )
    return html3


def chunk_html(html: str, size: int = D1_CHUNK) -> list[str]:
    return [html[i : i + size] for i in range(0, len(html), size)] or [""]


def d1_write_plan(html: str, keys: tuple[str, ...] | list[str]) -> list[tuple[str, list]]:
    """SQL+params to write a full HTML page into site_content + chunks (idx, value)."""
    parts = chunk_html(html)
    stmts: list[tuple[str, list]] = []
    for key in keys:
        stmts.append(("INSERT OR REPLACE INTO site_content (key, value) VALUES (?, ?)", [key, html]))
        stmts.append(("DELETE FROM site_content_chunks WHERE key = ?", [key]))
        for i, part in enumerate(parts):
            stmts.append(
                ("INSERT INTO site_content_chunks (key, idx, value) VALUES (?, ?, ?)", [key, i, part])
            )
    return stmts


def slim_bindings(binds: list[dict]) -> list[dict]:
    out = []
    for b in binds:
        t = b.get("type")
        item = {"type": t, "name": b.get("name")}
        if t == "service":
            item["service"] = b.get("service")
        elif t == "d1":
            item["id"] = b.get("id") or b.get("database_id")
        elif t == "r2_bucket":
            item["bucket_name"] = b.get("bucket_name")
        elif t == "kv_namespace":
            item["namespace_id"] = b.get("namespace_id")
        elif t in ("secret_text", "secret"):
            # PUT would wipe the secret if we omit the value. Skip the worker instead.
            raise RuntimeError(f"secret binding {b.get('name')} — refusing PUT without value")
        elif t == "plain_text":
            item["text"] = b.get("text")
        else:
            for k, v in b.items():
                if k not in ("environment",) and k not in item:
                    item[k] = v
        out.append(item)
    return out


def resolve_src(rel: str, twin_root: Path) -> Path | None:
    """Find a twin file, falling back to the git clone if artifacts/ is unreadable."""
    cand = [twin_root / rel]
    mapped = dict(GIT_COPY).get(rel)
    for root in FALLBACK_ROOTS:
        cand.append(root / rel)
        if mapped:
            cand.append(root / mapped)
        if rel.startswith("artifacts/stratamesh/"):
            cand.append(root / rel[len("artifacts/stratamesh/") :])
    seen: set[str] = set()
    for p in cand:
        key = str(p)
        if key in seen:
            continue
        seen.add(key)
        try:
            if p.is_file():
                return p
        except OSError:
            continue
    return None


def content_type(path: Path) -> str:
    ext = path.suffix.lower()
    return {
        ".html": "text/html; charset=utf-8",
        ".js": "application/javascript; charset=utf-8",
        ".mjs": "application/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".svg": "image/svg+xml",
        ".json": "application/json",
        ".map": "application/json",
        ".woff2": "font/woff2",
        ".png": "image/png",
        ".ico": "image/x-icon",
        ".txt": "text/plain; charset=utf-8",
    }.get(ext, "application/octet-stream")


def r2_key_for_os(path: Path, spa_root: Path) -> str:
    rel = path.relative_to(spa_root).as_posix()
    if rel == "os.html" or rel.endswith("/os.html"):
        return "os/os.html"
    if rel.startswith("assets/"):
        return "os/" + rel
    return "os/" + rel
