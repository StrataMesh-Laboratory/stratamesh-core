#!/usr/bin/env python3
"""Lockstep publisher: one local deploy writes live (D1+R2+workers) AND git.

Twin (/workspace) is the source of truth. Live and the GitHub repo must never
lag it. `npm run deploy` is the only command that should be needed.

CF auth: X-Auth-Email FIRST, then Bearer cfat write token. Never cfut.
Git: username amcmorais FIRST, then the token as password.
"""

from __future__ import annotations

import argparse
import json
import os
import ssl
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import lockstep_lib as L  # noqa: E402

TWIN = Path("/workspace")
CLONE = Path("/tmp/sm-lock")
REPORT = Path("/tmp/lockstep-report.json")
UA = "Mozilla/5.0 (compatible; StrataMesh-lockstep/1.0)"
CTX = ssl.create_default_context()


def log(msg: str) -> None:
    print(msg, flush=True)


def run(cmd: list[str], cwd: Path | None = None, env: dict[str, str] | None = None, timeout: int = 180) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, cwd=cwd, env=env, timeout=timeout, text=True, capture_output=True)


def http(method: str, url: str, headers: dict[str, str], body: bytes | None = None, timeout: int = 90) -> tuple[int, bytes]:
    req = urllib.request.Request(url, data=body, method=method)
    for k, v in headers.items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=CTX) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def cf_json(email: str, token: str, method: str, url: str, payload: dict | None = None, extra: dict[str, str] | None = None) -> tuple[int, dict]:
    headers = L.cf_headers(email, token, extra)
    body = None
    if payload is not None:
        body = json.dumps(payload).encode()
        headers["Content-Type"] = "application/json"
    code, raw = http(method, url, headers, body)
    try:
        data = json.loads(raw.decode() or "{}")
    except json.JSONDecodeError:
        data = {"raw": raw[:400].decode("utf-8", "replace")}
    return code, data


def d1_query(email: str, token: str, sql: str, params: list | None = None) -> dict:
    url = f"https://api.cloudflare.com/client/v4/accounts/{L.CF_ACCOUNT}/d1/database/{L.CF_D1}/query"
    payload: dict = {"sql": sql}
    if params is not None:
        payload["params"] = params
    code, data = cf_json(email, token, "POST", url, payload)
    if code != 200 or not data.get("success"):
        raise RuntimeError(f"D1 {code}: {data.get('errors') or data}")
    return data


def assemble_html(email: str, token: str, key: str) -> str:
    data = d1_query(
        email, token, "SELECT idx, value FROM site_content_chunks WHERE key = ? ORDER BY idx", [key]
    )
    rows = (data.get("result") or [{}])[0].get("results") or []
    if rows:
        return "".join(r["value"] for r in rows)
    data = d1_query(email, token, "SELECT value FROM site_content WHERE key = ?", [key])
    rows = (data.get("result") or [{}])[0].get("results") or []
    if not rows:
        raise RuntimeError(f"D1 key missing: {key}")
    return rows[0]["value"]


def write_html(email: str, token: str, html: str, keys: tuple[str, ...]) -> list[str]:
    done = []
    for sql, params in L.d1_write_plan(html, keys):
        d1_query(email, token, sql, params)
    done.extend(keys)
    return done


def multipart(fields: list[tuple[str, str, bytes, str]]) -> tuple[bytes, str]:
    boundary = "----Lockstep" + uuid.uuid4().hex
    chunks: list[bytes] = []
    for name, filename, content, ctype in fields:
        chunks.append(f"--{boundary}\r\n".encode())
        disp = f'Content-Disposition: form-data; name="{name}"'
        if filename:
            disp += f'; filename="{filename}"'
        chunks.append((disp + "\r\n").encode())
        chunks.append(f"Content-Type: {ctype}\r\n\r\n".encode())
        chunks.append(content)
        chunks.append(b"\r\n")
    chunks.append(f"--{boundary}--\r\n".encode())
    return b"".join(chunks), boundary


def put_worker(email: str, token: str, name: str, source: Path) -> str:
    """Upload script content only — bindings/secrets stay on the existing Worker."""
    body, boundary = multipart(
        [
            ("metadata", "metadata.json", json.dumps({"main_module": "index.js"}).encode(), "application/json"),
            ("index.js", "index.js", source.read_bytes(), "application/javascript+module"),
        ]
    )
    url = f"https://api.cloudflare.com/client/v4/accounts/{L.CF_ACCOUNT}/workers/scripts/{name}/content"
    headers = L.cf_headers(
        email, token, {"Content-Type": f"multipart/form-data; boundary={boundary}"}
    )
    code, raw = http("PUT", url, headers, body, timeout=120)
    try:
        parsed = json.loads(raw.decode() or "{}")
    except json.JSONDecodeError:
        parsed = {"raw": raw[:300].decode("utf-8", "replace")}
    if code == 200 and parsed.get("success"):
        return f"PUT {name}/content 200"
    raise RuntimeError(f"worker content {name}: {code} {parsed.get('errors') or parsed}")


def put_r2(email: str, token: str, key: str, data: bytes, ctype: str) -> int:
    quoted = urllib.parse.quote(key, safe="/")
    url = f"https://api.cloudflare.com/client/v4/accounts/{L.CF_ACCOUNT}/r2/buckets/{L.R2_BUCKET}/objects/{quoted}"
    headers = L.cf_headers(email, token, {"Content-Type": ctype})
    code, raw = http("PUT", url, headers, data, timeout=120)
    if code not in (200, 201):
        raise RuntimeError(f"R2 PUT {key}: {code} {raw[:240]!r}")
    return code


def purge(email: str, token: str) -> int:
    url = f"https://api.cloudflare.com/client/v4/zones/{L.CF_ZONE}/purge_cache"
    code, data = cf_json(email, token, "POST", url, {"purge_everything": True})
    if code != 200 or not data.get("success"):
        raise RuntimeError(f"purge {code} {data.get('errors') or data}")
    return code


def build_os() -> Path:
    out = TWIN / "dist/os-spa"
    log("os:build vite.os.config.ts → dist/os-spa")
    proc = run(
        ["npx", "vite", "build", "--config", "vite.os.config.ts"],
        cwd=TWIN,
        timeout=180,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"os:build failed:\n{proc.stdout}\n{proc.stderr}")
    html = out / "os.html"
    if not html.is_file():
        raise RuntimeError("os:build produced no dist/os-spa/os.html")
    return out


def upload_os_spa(email: str, token: str, spa: Path) -> list[str]:
    uploaded = []
    for path in sorted(spa.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(spa).as_posix()
        if rel.startswith("__grok/") or rel in {"clp.html", "favicon.svg", "og.jpg", "robots.txt", "sitemap.xml"}:
            continue
        key = L.r2_key_for_os(path, spa)
        put_r2(email, token, key, path.read_bytes(), L.content_type(path))
        uploaded.append(key)
        log(f"  R2 {key}")
    return uploaded


def load_gh_token() -> str | None:
    env = os.environ
    for key in ("GITHUB_TOKEN", "GH_TOKEN", "GITHUB_PAT"):
        if env.get(key):
            return env[key].strip()
    for p in (
        Path("/tmp/grok/connectors/github.token"),
        Path("/tmp/github.token"),
        Path("/root/.config/github.token"),
    ):
        if p.is_file():
            t = p.read_text().strip()
            if t:
                return t
    return None


def ensure_clone() -> Path:
    if (CLONE / ".git").is_dir():
        run(["git", "-C", str(CLONE), "remote", "set-url", "origin", f"https://github.com/{L.GH_USER}/{L.GH_REPO}.git"])
        return CLONE
    CLONE.parent.mkdir(parents=True, exist_ok=True)
    proc = run(
        ["git", "clone", "--depth", "80", f"https://github.com/{L.GH_USER}/{L.GH_REPO}.git", str(CLONE)],
        timeout=120,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"git clone failed: {proc.stderr}")
    return CLONE


def copy_to_clone(clone: Path) -> list[str]:
    copied = []
    for src_rel, dest_rel in L.GIT_COPY:
        src = L.resolve_src(src_rel, TWIN)
        if src is None:
            continue
        dest = clone / dest_rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        data = src.read_bytes()
        if dest.is_file() and dest.read_bytes() == data:
            continue
        dest.write_bytes(data)
        copied.append(dest_rel)
    return copied


def git_commit_push(clone: Path, copied: list[str], token: str | None) -> dict:
    run(["git", "-C", str(clone), "config", "user.email", L.CF_EMAIL])
    run(["git", "-C", str(clone), "config", "user.name", "AMCM ENI"])
    if copied:
        run(["git", "-C", str(clone), "add", "--"] + copied)
    # also add anything already staged / modified from previous copy
    run(["git", "-C", str(clone), "add", "-u"])
    st = run(["git", "-C", str(clone), "status", "--porcelain"])
    if not (st.stdout or "").strip():
        return {"commit": None, "push": "clean", "copied": copied}
    msg = "Lockstep: twin → live + repo. Holons described by what they are."
    c = run(["git", "-C", str(clone), "commit", "-m", msg])
    if c.returncode != 0:
        return {"commit": None, "push": f"commit-failed: {c.stderr.strip()}", "copied": copied}
    sha = run(["git", "-C", str(clone), "rev-parse", "--short", "HEAD"]).stdout.strip()
    if not token:
        return {"commit": sha, "push": "NO_TOKEN", "copied": copied}
    ask = Path("/tmp/git-askpass-lockstep.sh")
    ask.write_text(
        "#!/bin/sh\n"
        'case "$1" in\n'
        f"  *[Uu]sername*) echo {L.GH_USER} ;;\n"
        '  *) echo "$LOCKSTEP_GH_TOKEN" ;;\n'
        "esac\n"
    )
    ask.chmod(0o700)
    env = {
        **os.environ,
        "GIT_ASKPASS": str(ask),
        "SSH_ASKPASS": str(ask),
        "GIT_TERMINAL_PROMPT": "0",
        "LOCKSTEP_GH_TOKEN": token,
        "GIT_USER": L.GH_USER,
    }
    # Username first, then the token — never token-as-username.
    remote = f"https://{L.GH_USER}@github.com/{L.GH_USER}/{L.GH_REPO}.git"
    p = run(
        ["git", "-C", str(clone), "push", remote, "HEAD:main"],
        env=env,
        timeout=120,
    )
    if p.returncode == 0:
        return {"commit": sha, "push": "ok", "copied": copied}
    err = (p.stderr or p.stdout or "").strip()
    # redacted
    err = err.replace(token, "***")
    return {"commit": sha, "push": f"denied: {err[:400]}", "copied": copied}


def verify_live() -> dict:
    out = {}
    for path, lang in (("/", "pt"), ("/en", "en")):
        url = "https://calhegasmorais.pt" + path
        code, raw = http("GET", url, {"User-Agent": UA}, timeout=30)
        text = raw.decode("utf-8", "replace")
        out[path] = {
            "http": code,
            "len": len(text),
            "vm_isolate": "VM · isolate" in text,
            "anfitriao": "Anfitrião" in text or "Host · OS and VM" in text,
            "dv_vm": ("VM hipervisor" in text) or ("VM hypervisor" in text),
            "instantiate": ("instancia SO nativos e importados" in text) or ("instantiates native and imported OS" in text),
            "viewBox430": 'viewBox="0 0 640 430"' in text,
            "arch": ("Holons aninhados e distintos" in text) or ("Nested distinct holons" in text),
        }
    return out


def publish_live(email: str, token: str, spa: Path | None) -> dict:
    report: dict = {"d1": [], "r2": [], "workers": [], "purge": None}
    landing = (TWIN / "src/components/landing.tsx").read_text()
    diagrams = (TWIN / "src/components/diagrams.tsx").read_text()
    arch = L.extract_arch(landing)
    rows = L.extract_holon_rows(diagrams)
    titles = {
        "pt": "Pilha holónica — Nó Calhegas Morais",
        "en": "Holonic stack — Calhegas Morais Node",
    }
    for lang, keys in (("pt", L.D1_KEYS_PT), ("en", L.D1_KEYS_EN)):
        src_key = keys[0]
        html = assemble_html(email, token, src_key)
        svg = L.holon_svg(lang, rows[lang], titles[lang])
        patched = L.patch_landing_html(html, lang, arch[lang], svg)
        if "Anfitrião" in patched or "Host · OS and VM" in patched:
            raise RuntimeError(f"{lang}: forbidden Anfitrião/Host grouping still present")
        if "VM · isolate" in patched:
            raise RuntimeError(f"{lang}: forbidden VM isolate layer above the OS")
        if lang == "pt" and "VM hipervisor" not in patched:
            raise RuntimeError(f"{lang}: Domínio Virtual must be the VM hypervisor")
        if lang == "en" and "VM hypervisor" not in patched:
            raise RuntimeError(f"{lang}: Virtual Realm must be the VM hypervisor")
        written = write_html(email, token, patched, keys)
        report["d1"].extend(written)
        log(f"  D1 {lang}: {', '.join(written)} ({len(patched)} bytes)")
        # keep git frontend copies in the clone in sync too (resolved later)
        frontend = TWIN / f"dist/landing-{lang}.html"
        frontend.parent.mkdir(parents=True, exist_ok=True)
        frontend.write_text(patched)

    portal_src = {
        "pt": Path("/tmp/portal-pt.html"),
        "en": Path("/tmp/portal-en.html"),
    }
    portal_fallback = {
        "pt": [TWIN / "dist/portal-pt.html", TWIN / "artifacts/stratamesh/frontend/portal-pt.html"],
        "en": [TWIN / "dist/portal-en.html", TWIN / "artifacts/stratamesh/frontend/portal-en.html"],
    }
    for lang, keys in (("pt", L.PORTAL_KEYS_PT), ("en", L.PORTAL_KEYS_EN)):
        src = portal_src[lang]
        readable = False
        try:
            readable = src.is_file()
        except OSError:
            readable = False
        if not readable:
            for alt in portal_fallback[lang]:
                try:
                    if alt.is_file():
                        src = alt
                        readable = True
                        break
                except OSError:
                    continue
        if not readable:
            report.setdefault("portal", []).append(f"SKIP {lang}: missing {src}")
            continue
        html = src.read_text(encoding="utf-8")
        if "GTA" in html or "Garry" in html or "The Sims" in html:
            raise RuntimeError(f"portal {lang}: forbidden franchise name in live HTML")
        written = write_html(email, token, html, keys)
        report["d1"].extend(written)
        report.setdefault("portal", []).extend(written)
        log(f"  D1 portal {lang}: {', '.join(written)} ({len(html)} bytes)")

    if spa is not None:
        report["r2"] = upload_os_spa(email, token, spa)
        face = TWIN / "attachments/IMG_0697.jpg"
        if face.is_file():
            blob = face.read_bytes()
            for key in (
                "os/account/usr-admin-root/files/avatar-face.jpg",
                "os/account/usr-admin-root/avatar-face.jpg",
            ):
                put_r2(email, token, key, blob, "image/jpeg")
                report["r2"].append(key)
                log(f"  R2 {key}")
        texdir = TWIN / "tex" / "512"
        if texdir.is_dir():
            for p in sorted(texdir.glob("*.jpg")):
                key = f"os/tex/{p.name}"
                put_r2(email, token, key, p.read_bytes(), "image/jpeg")
                report["r2"].append(key)
                log(f"  R2 {key}")

    for name, rel in L.WORKERS:
        src = L.resolve_src(rel, TWIN)
        if src is None:
            report["workers"].append(f"SKIP {name}: source missing")
            log(f"  worker {name}: source missing")
            continue
        try:
            msg = put_worker(email, token, name, src)
            report["workers"].append(msg)
            log(f"  worker {msg}")
        except Exception as e:
            report["workers"].append(f"FAIL {name}: {e}")
            log(f"  worker FAIL {name}: {e}")

    report["purge"] = purge(email, token)
    log(f"  purge {report['purge']}")
    time.sleep(2)
    report["verify"] = verify_live()
    return report


def main() -> int:
    ap = argparse.ArgumentParser(description="Publish twin → live + git together")
    ap.add_argument("--skip-os", action="store_true", help="do not rebuild the Painel SPA")
    ap.add_argument("--skip-live", action="store_true")
    ap.add_argument("--skip-git", action="store_true")
    args = ap.parse_args()

    report: dict = {
        "ok": False,
        "live": None,
        "git": None,
        "os": None,
        "errors": [],
    }
    spa: Path | None = None
    rc = 0

    try:
        if args.skip_os:
            for c in L.OS_SPA_CANDIDATES:
                p = c if c.is_absolute() else TWIN / c
                try:
                    if (p / "os.html").is_file():
                        spa = p
                        break
                except OSError:
                    continue
            report["os"] = f"reuse {spa}" if spa else "missing"
        else:
            spa = build_os()
            report["os"] = str(spa)
    except Exception as e:
        report["errors"].append(f"os:build {e}")
        report["os"] = f"FAIL {e}"
        log(f"os:build FAIL {e}")
        rc = 1

    if not args.skip_live:
        try:
            email, token = L.load_cf_write()
            log(f"CF auth: X-Auth-Email={email} token={token[:4]}…")
            report["live"] = publish_live(email, token, spa)
        except Exception as e:
            report["errors"].append(f"live {e}")
            report["live"] = {"error": str(e)}
            log(f"LIVE FAIL {e}")
            rc = 1
    else:
        report["live"] = "skipped"

    if not args.skip_git:
        try:
            clone = ensure_clone()
            copied = copy_to_clone(clone)
            # patched landings if we wrote them
            for lang in ("pt", "en"):
                local = TWIN / f"dist/landing-{lang}.html"
                dest = clone / f"frontend/landing-{lang}.html"
                if local.is_file():
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    dest.write_bytes(local.read_bytes())
                    if f"frontend/landing-{lang}.html" not in copied:
                        copied.append(f"frontend/landing-{lang}.html")
            gh = load_gh_token()
            report["git"] = git_commit_push(clone, copied, gh)
            push = (report["git"] or {}).get("push")
            log(f"git commit={(report['git'] or {}).get('commit')} push={push}")
            if push and str(push).startswith("denied"):
                rc = rc or 2
            if push == "NO_TOKEN":
                rc = rc or 2
        except Exception as e:
            report["errors"].append(f"git {e}")
            report["git"] = {"error": str(e)}
            log(f"GIT FAIL {e}")
            rc = rc or 2
    else:
        report["git"] = "skipped"

    live_ok = isinstance(report.get("live"), dict) and "error" not in report["live"]
    git_info = report.get("git") if isinstance(report.get("git"), dict) else {}
    git_ok = git_info.get("push") in ("ok", "clean")
    report["ok"] = live_ok and git_ok and not report["errors"]
    REPORT.write_text(json.dumps(report, indent=2, ensure_ascii=False))
    log(json.dumps({k: report[k] for k in ("ok", "os", "errors")}, ensure_ascii=False))
    if live_ok:
        log("LIVE published (D1 + R2 + workers + purge)")
    if git_ok:
        log("GIT updated")
    elif git_info:
        log(f"GIT not updated: {git_info.get('push') or git_info.get('error')}")
    return rc


if __name__ == "__main__":
    sys.exit(main())
