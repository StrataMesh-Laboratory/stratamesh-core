#!/usr/bin/env python3
"""Publish files via GitHub Git Data API + Cloudflare Workers /content.

Secrets stay in /tmp (gh_pat, god_api). Never print tokens. Never workers.dev.
Never Grok GitHub MCP connector. PAT must be ghp_ / github_pat_ (refuse ghu_).
CF: X-Auth-Email first, then Authorization Bearer cfat_ (refuse cfut).
"""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

GH_OWNER = "StrataMesh-Laboratory"
GH_REPO = "stratamesh-core"
GH_BRANCH = "main"
GH_AUTHOR = {
    "name": "André M. Calhegas Morais",
    "email": "121771985+amcmorais@users.noreply.github.com",
}
CF_EMAIL = "amcmorais@icloud.com"
CF_ACCOUNT = "f3645fcb56675cf7250d8ba7358eb252"
CF_SCRIPT = "stratamesh-spa"
MAIN_MODULE = {
    "stratamesh-spa": "index.js",
    "stratamesh-orchestrator": "index.js",
    "stratamesh-status": "worker.js",
    "stratamesh-fund": "stratamesh-fund.js",
    "stratamesh-gossip": "stratamesh-gossip.js",
    "stratamesh-aiops": "stratamesh-aiops.js",
    "stratamesh-deomail": "stratamesh-deomail.js",
    "stratamesh-briefing": "stratamesh-briefing.js",
    "stratamesh-edge-grok": "stratamesh-edge-grok.js",
    "stratamesh-origin-archive": "stratamesh-origin-archive.js",
    "stratamesh-auth": "index.js",
}



def load_pat() -> str:
    for key in ("GITHUB_PAT", "GH_PAT", "GITHUB_TOKEN"):
        v = (os.environ.get(key) or "").strip()
        if v:
            tok = v
            break
    else:
        tok = ""
        for p in ("/tmp/gh_pat", "/tmp/github.token"):
            fp = Path(p)
            if fp.is_file():
                tok = fp.read_text().strip()
                break
    if not tok:
        raise SystemExit("HOLD git: /tmp/gh_pat missing")
    if tok.startswith(("ghu_", "gho_", "ghs_")):
        raise SystemExit("HOLD git: refuse connector token (ghu_/gho_/ghs_)")
    if not tok.startswith(("ghp_", "github_pat_")):
        raise SystemExit("HOLD git: PAT must be ghp_ or github_pat_")
    return tok


def load_cf() -> tuple[str, str]:
    email = (os.environ.get("CLOUDFLARE_EMAIL") or CF_EMAIL).strip()
    tok = (os.environ.get("GOD_API") or os.environ.get("CLOUDFLARE_WRITE_TOKEN") or "").strip()
    if not tok:
        for p in ("/tmp/god_api", "/tmp/write_api"):
            fp = Path(p)
            if fp.is_file():
                tok = fp.read_text().strip()
                break
    if not tok:
        raise SystemExit("HOLD live: /tmp/god_api missing")
    if tok.startswith("cfut"):
        raise SystemExit("HOLD live: refuse cfut read-only token")
    return email, tok


def gh(method: str, path: str, pat: str, body=None, timeout=60):
    url = "https://api.github.com" + path
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Authorization": "Bearer " + pat,
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
            "User-Agent": "stratamesh-api-gitlive",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            return resp.status, json.loads(raw.decode() or "{}")
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            parsed = json.loads(raw.decode() or "{}")
        except json.JSONDecodeError:
            parsed = {"raw": raw[:400].decode("utf-8", "replace")}
        return e.code, parsed


def cf_put_content(email: str, token: str, source: Path, script: str = CF_SCRIPT, main_module: str | None = None) -> dict:
    import uuid

    main = main_module or MAIN_MODULE.get(script) or "index.js"
    boundary = "----GitLive" + uuid.uuid4().hex
    meta = json.dumps({"main_module": main}).encode()
    script_bytes = source.read_bytes()

    def part(name: str, filename: str | None, content: bytes, ctype: str) -> bytes:
        disp = f'Content-Disposition: form-data; name="{name}"'
        if filename:
            disp += f'; filename="{filename}"'
        return (
            f"--{boundary}\r\n".encode()
            + (disp + "\r\n").encode()
            + f"Content-Type: {ctype}\r\n\r\n".encode()
            + content
            + b"\r\n"
        )

    body = (
        part("metadata", "metadata.json", meta, "application/json")
        + part(main, main, script_bytes, "application/javascript+module")
        + f"--{boundary}--\r\n".encode()
    )
    url = f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT}/workers/scripts/{script}/content"
    req = urllib.request.Request(
        url,
        data=body,
        method="PUT",
        headers={
            "X-Auth-Email": email,
            "Authorization": "Bearer " + token,
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            raw = resp.read()
            return {"http": resp.status, **json.loads(raw.decode() or "{}")}
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            parsed = json.loads(raw.decode() or "{}")
        except json.JSONDecodeError:
            parsed = {"raw": raw[:400].decode("utf-8", "replace")}
        return {"http": e.code, **parsed}


def commit_files(root: Path, files: list[str], message: str, pat: str) -> str:
    code, ref = gh("GET", f"/repos/{GH_OWNER}/{GH_REPO}/git/ref/heads/{GH_BRANCH}", pat)
    if code != 200:
        raise SystemExit(f"ref: {code} {ref}")
    parent = ref["object"]["sha"]
    code, commit = gh("GET", f"/repos/{GH_OWNER}/{GH_REPO}/git/commits/{parent}", pat)
    if code != 200:
        raise SystemExit(f"commit: {code} {commit}")
    base_tree = commit["tree"]["sha"]
    tree_items = []
    for rel in files:
        p = root / rel
        content = p.read_text(encoding="utf-8")
        code, blob = gh(
            "POST",
            f"/repos/{GH_OWNER}/{GH_REPO}/git/blobs",
            pat,
            {"content": content, "encoding": "utf-8"},
            timeout=120,
        )
        if code not in (200, 201):
            raise SystemExit(f"blob {rel}: {code} {blob}")
        tree_items.append({"path": rel, "mode": "100644", "type": "blob", "sha": blob["sha"]})
        print(f"blob {rel} {blob['sha'][:12]}", flush=True)
    code, tree = gh(
        "POST",
        f"/repos/{GH_OWNER}/{GH_REPO}/git/trees",
        pat,
        {"base_tree": base_tree, "tree": tree_items},
        timeout=120,
    )
    if code not in (200, 201):
        raise SystemExit(f"tree: {code} {tree}")
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    author = dict(GH_AUTHOR)
    author["date"] = now
    code, new_commit = gh(
        "POST",
        f"/repos/{GH_OWNER}/{GH_REPO}/git/commits",
        pat,
        {
            "message": message,
            "tree": tree["sha"],
            "parents": [parent],
            "author": author,
            "committer": author,
        },
    )
    if code not in (200, 201):
        raise SystemExit(f"create commit: {code} {new_commit}")
    sha = new_commit["sha"]
    code, updated = gh(
        "PATCH",
        f"/repos/{GH_OWNER}/{GH_REPO}/git/refs/heads/{GH_BRANCH}",
        pat,
        {"sha": sha, "force": False},
    )
    if code not in (200, 201):
        raise SystemExit(f"update ref: {code} {updated}")
    print(f"commit {sha}", flush=True)
    return sha


def comment_issue(pat: str, number: int, body: str) -> int:
    code, data = gh(
        "POST",
        f"/repos/{GH_OWNER}/{GH_REPO}/issues/{number}/comments",
        pat,
        {"body": body},
    )
    if code not in (200, 201):
        print(f"comment #{number} HOLD {code} {data}", flush=True)
        return code
    print(f"comment #{number} {data.get('html_url')}", flush=True)
    return code


if __name__ == "__main__":
    print("api-gitlive-publish: importable; use as library or --help", file=sys.stderr)
