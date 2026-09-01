#!/usr/bin/env python3
"""Mirror of artifacts/discourse-bot/bin/discourse_client.py
Session path for Free plan (no Admin API key).
Reads DISCOURSE_PASSWORD or ~/.config/stratamesh/secrets.env
  DISCOURSE_USER=stratamesh-grok
  DISCOURSE_EMAIL=grok@calhegasmorais.pt
  DISCOURSE_PASSWORD=...
Never prints the password.
"""
from __future__ import annotations
import http.cookiejar, json, os, re, sys, urllib.parse, urllib.request
from pathlib import Path

FORUM = "https://stratamesh.discourse.group"
IDP = "https://id.discourse.com"
USER = os.environ.get("DISCOURSE_USER", "stratamesh-grok")
EMAIL = os.environ.get("DISCOURSE_EMAIL", "grok@calhegasmorais.pt")

def load_password():
    if os.environ.get("DISCOURSE_PASSWORD"):
        return os.environ["DISCOURSE_PASSWORD"]
    for p in (
        Path.home() / ".config/stratamesh/secrets.env",
        Path.home() / ".config/stratagrok/secrets.env",
        Path("/home/box/.config/stratagrok/secrets.env"),
    ):
        if not p.is_file():
            continue
        for line in p.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            if k.strip() in ("DISCOURSE_PASSWORD", "DISCOURSE_ID_PASSWORD", "GROK_DISCOURSE_PASSWORD"):
                return v.strip().strip('"').strip("'")
    return None

def op():
    jar = http.cookiejar.CookieJar()
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar)), jar

def get(o, url):
    req = urllib.request.Request(url, headers={"User-Agent": "cmn-discourse"})
    with o.open(req, timeout=30) as r:
        return r.read().decode("utf-8", "replace"), r.headers

def csrf_from(html, headers):
    m = re.search(r'name="csrf-token" content="([^"]+)"', html)
    if m:
        return m.group(1)
    m = re.search(r'"csrf":"([^"]+)"', html)
    if m:
        return m.group(1)
    return headers.get("X-CSRF-Token") or ""

def login(o):
    pw = load_password()
    if not pw:
        sys.stderr.write("no DISCOURSE_PASSWORD in env or ~/.config/stratamesh/secrets.env\n")
        sys.exit(2)
    html, hdr = get(o, IDP + "/session/email")
    token = csrf_from(html, hdr)
    data = urllib.parse.urlencode({"login": EMAIL, "password": pw, "authenticity_token": token}).encode()
    req = urllib.request.Request(
        IDP + "/session",
        data=data,
        headers={"User-Agent": "cmn-discourse", "Content-Type": "application/x-www-form-urlencoded"},
    )
    try:
        o.open(req, timeout=30)
    except Exception as e:
        sys.stderr.write("idp session " + str(e) + "\n")
    get(o, FORUM + "/auth/discourse_id")
    html, hdr = get(o, FORUM + "/session/csrf")
    try:
        return json.loads(html).get("csrf") or csrf_from(html, hdr)
    except Exception:
        return csrf_from(html, hdr)

def announce(title, body, cat=5):
    o, _ = op()
    csrf = login(o)
    payload = json.dumps({"title": title, "raw": body, "category": int(cat)}).encode()
    req = urllib.request.Request(
        FORUM + "/posts.json",
        data=payload,
        headers={
            "User-Agent": "cmn-discourse",
            "Content-Type": "application/json",
            "X-CSRF-Token": csrf or "",
            "X-Requested-With": "XMLHttpRequest",
        },
    )
    with o.open(req, timeout=30) as r:
        d = json.loads(r.read().decode())
    tid = d.get("topic_id") or (d.get("post") or {}).get("topic_id")
    print(FORUM + "/t/" + str(tid))

def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "help"
    if cmd == "login":
        o, _ = op()
        login(o)
        print("session ok as", USER, EMAIL)
        return
    if cmd == "announce":
        title = sys.argv[2]
        src = sys.argv[3]
        cat = int(sys.argv[4]) if len(sys.argv) > 4 else 5
        if os.path.isfile(src):
            body = open(src, encoding="utf-8").read()
        else:
            url = "https://raw.githubusercontent.com/StrataMesh-Laboratory/stratamesh-core/main/" + src
            body = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "cmn"})).read().decode()
        announce(title, body, cat)
        return
    print("usage: discourse_client.py login | announce TITLE PATH [category]")

if __name__ == "__main__":
    main()
