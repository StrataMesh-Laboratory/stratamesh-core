#!/usr/bin/env python3
"""Fog Node bootstrap wizard (macOS). Terminal prompts (pop-ups optional via FOG_DIALOGS=1)."""
from __future__ import annotations

import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

AUTH = os.environ.get("FOG_AUTH_BASE", "https://calhegasmorais.pt/api/auth").rstrip("/")
HOME = Path.home()
FOG = Path(os.environ.get("STRATAMESH_HOME") or (HOME / "StrataMesh")) / "fog"
SECRETS = HOME / ".config" / "stratamesh"
REPO = FOG / "repo"
REPO_URL = "https://github.com/StrataMesh-Laboratory/stratamesh-core.git"


def as_lit(s: str) -> str:
    parts = []
    for line in s.split("\n"):
        line = line.replace("\\", "\\\\").replace('"', '\\"')
        parts.append('"%s"' % line)
    return " & return & ".join(parts)


def osa(*lines: str) -> tuple[int, str, str]:
    r = subprocess.run(["osascript", *[x for ln in lines for x in ("-e", ln)]], capture_output=True, text=True)
    return r.returncode, (r.stdout or "").strip(), (r.stderr or "").strip()


def use_popups() -> bool:
    return os.environ.get("FOG_DIALOGS", "").strip() == "1"


def dialog(title: str, prompt: str, default: str = "", hidden: bool = False, extra: str = "") -> str:
    if use_popups():
        hid = " with hidden answer" if hidden else ""
        core = (
            "display dialog %s default answer %s buttons {\"Cancelar\",\"Continuar\"} "
            "default button \"Continuar\" with title %s%s"
            % (as_lit(prompt), as_lit(default), as_lit(title), hid)
        )
        for sc in ('tell application "Terminal"\nactivate\n%s\nend tell' % core, core):
            code, out, err = osa(sc)
            if code == 0:
                marker = "text returned:"
                return out.split(marker, 1)[1] if marker in out else out
            if "User canceled" in err or "-128" in err:
                raise SystemExit(1)
    print()
    print("== %s ==" % title)
    print(prompt)
    if hidden:
        import getpass
        return getpass.getpass("-> ").strip() or default
    raw = input("-> [%s] " % default)
    return (raw.strip() or default)


def alert(title: str, prompt: str) -> None:
    print()
    print("== %s ==" % title)
    print(prompt)


def ask_until(title: str, prompt: str, ok, hidden: bool = True) -> str:
    last = ""
    for _ in range(5):
        val = dialog(title, prompt + (("\n" + last) if last else ""), hidden=hidden).strip()
        good, msg = ok(val)
        if good:
            return val
        last = msg
        print(msg)
    raise SystemExit(1)


def http_json(method: str, url: str, body: dict | None = None, token: str | None = None, timeout: float = 20) -> dict:
    data = None if body is None else json.dumps(body).encode()
    headers = {"Accept": "application/json", "User-Agent": "fog-bootstrap/8"}
    if body is not None:
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = "Bearer " + token
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read().decode()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode(errors="replace")
        try:
            j = json.loads(raw)
        except Exception:
            j = {"error": raw[:300], "http": e.code}
        j.setdefault("success", False)
        j["http"] = e.code
        return j
    except Exception as e:
        return {"success": False, "error": str(e)}


def write_secret(name: str, value: str) -> Path:
    SECRETS.mkdir(parents=True, exist_ok=True)
    os.chmod(SECRETS, 0o700)
    p = SECRETS / name
    p.write_text(value.strip() + "\n")
    os.chmod(p, 0o600)
    return p


def ensure_repo() -> None:
    FOG.mkdir(parents=True, exist_ok=True)
    if (REPO / ".git").exists():
        subprocess.call(["git", "-C", str(REPO), "fetch", "origin"])
        return
    rc = subprocess.call(["git", "clone", "--depth", "1", REPO_URL, str(REPO)])
    if rc != 0:
        print("Nao foi possivel clonar o repositorio.")
        raise SystemExit(2)


def main() -> int:
    ensure_repo()
    print("Fog Node bootstrap — chaves so em ~/.config/stratamesh")

    node_file = SECRETS / "node.id"
    boot_file = SECRETS / "bootstrap.token"
    resume = node_file.is_file() and boot_file.is_file() and boot_file.stat().st_size > 10
    if resume:
        node_id = node_file.read_text().strip().upper()
        print("2FA ja verificado para", node_id, "— a retomar chaves.")
    else:
        node_id = dialog("No Fog", "Id de no registado:", "FOG-NODE-PT-CM-001", hidden=False).strip().upper()
        if not node_id:
            return 1
        ch = http_json("POST", AUTH + "/fog/bootstrap/challenge", {"node_id": node_id, "lang": "pt"})
        if not ch.get("success"):
            print("Falha 2FA:", ch.get("error") or ch)
            return 1
        masked = ch.get("operator_masked") or "operador@"
        code = dialog("2FA do operador", "Codigo de 6 digitos enviado a %s:" % masked, hidden=False).strip()
        vr = http_json(
            "POST",
            AUTH + "/fog/bootstrap/verify",
            {"node_id": node_id, "challenge": ch.get("challenge"), "code": code, "lang": "pt"},
        )
        if not vr.get("success"):
            print("Codigo recusado:", vr.get("error") or vr)
            return 1
        write_secret("node.id", node_id)
        write_secret("bootstrap.token", vr.get("bootstrap_token") or "")

    def gh_ok(val: str):
        if val.startswith("ghp_") or val.startswith("github_pat_"):
            who = http_json("GET", "https://api.github.com/user", token=val)
            if who.get("login"):
                return True, who["login"]
            return False, "Token recusado pela API GitHub."
        return False, "Tem de comecar por ghp_ (ou github_pat_)."

    gh = ask_until(
        "GitHub",
        "Cole o Personal Access Token (ghp_). Permissoes: repo StrataMesh-Laboratory.",
        gh_ok,
        hidden=True,
    )
    who = http_json("GET", "https://api.github.com/user", token=gh)
    write_secret("github.pat", gh)
    write_secret("gh_pat", gh)

    def cf_ok(val: str):
        if len(val) < 20:
            return False, "Token demasiado curto."
        if val.startswith("cfat_") or val.startswith("v1.0-") or len(val) >= 30:
            return True, "ok"
        return False, "Cole o token Cloudflare (cfat_)."

    cf = ask_until(
        "Cloudflare",
        "Cole o API token Cloudflare (cfat_). Workers + DNS + Account.",
        cf_ok,
        hidden=True,
    )
    write_secret("cloudflare.token", cf)
    write_secret("god_api", cf)

    tun_path = SECRETS / "tunnel.token"
    if not tun_path.is_file() or tun_path.stat().st_size < 20:
        tun = dialog(
            "Tunel Cloudflare",
            "Token do named tunnel macbook-server (vazio = saltar / manter disco).",
            hidden=True,
        ).strip()
        if tun:
            write_secret("tunnel.token", tun)

    write_secret("cf_account", "f3645fcb56675cf7250d8ba7358eb252")
    print("Identidade ok:", node_id, "GitHub @" + str(who.get("login")), "— a instalar.")

    env = os.environ.copy()
    env["FOG_NODE_ID"] = node_id
    inst = REPO / "deploy/mac-fog/FogNodeInstaller.command"
    rc = subprocess.call(["bash", str(inst)], env=env)
    if rc != 0:
        print("Instalador codigo", rc)
        return rc
    subprocess.call(["bash", str(REPO / "deploy/mac-fog/FogStayAwake.command"), "--no-tui"], env=env)
    subprocess.call(["bash", str(REPO / "deploy/mac-fog/build-apps.sh")], env=env)

    tui = FOG / "bin" / "fog-tui.py"
    if not tui.is_file():
        tui = REPO / "deploy/mac-fog/fog-tui.py"
    os.environ["FOG_HOME"] = str(FOG)
    os.environ["FOG_NODE_ID"] = node_id
    os.execvp("python3", ["python3", str(tui)])
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except SystemExit:
        raise
    except Exception as e:
        print("ERR", e, file=sys.stderr)
        raise SystemExit(1)
