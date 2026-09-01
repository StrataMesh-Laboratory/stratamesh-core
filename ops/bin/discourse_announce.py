#!/usr/bin/env python3
"""Announce markdown on stratamesh.discourse.group.
Uses DISCOURSE_API_KEY + DISCOURSE_API_USER if set.
Else prints the post to stdout (no session in this kit).
"""
import json, os, sys, urllib.request

FORUM = "https://stratamesh.discourse.group"
TITLE = sys.argv[1] if len(sys.argv) > 1 else "v0.5.1-lab · Kit Fog Node (macOS) e Kit Edge Node (iOS)"
BODY_PATH = sys.argv[2] if len(sys.argv) > 2 else "docs/DISCOURSE-v0.5.1-lab-kits.md"
CAT = int(sys.argv[3]) if len(sys.argv) > 3 else 5

def read_body():
    if os.path.isfile(BODY_PATH):
        return open(BODY_PATH, encoding="utf-8").read()
    url = "https://raw.githubusercontent.com/StrataMesh-Laboratory/stratamesh-core/main/docs/DISCOURSE-v0.5.1-lab-kits.md"
    return urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "cmn"})).read().decode()

body = read_body()
key = os.environ.get("DISCOURSE_API_KEY") or os.environ.get("DISCOURSE_KEY")
user = os.environ.get("DISCOURSE_API_USER") or "stratamesh-grok"
if not key:
    print("NO_API_KEY — copy below into https://stratamesh.discourse.group/new-topic?category=announcements")
    print("TITLE:", TITLE)
    print("---")
    print(body)
    sys.exit(0)

req = urllib.request.Request(
    FORUM + "/posts.json",
    data=json.dumps({"title": TITLE, "raw": body, "category": CAT}).encode(),
    method="POST",
    headers={
        "Api-Key": key,
        "Api-Username": user,
        "Content-Type": "application/json",
        "User-Agent": "cmn-discourse",
    },
)
try:
    d = json.loads(urllib.request.urlopen(req, timeout=30).read())
    tid = (d.get("topic_id") or (d.get("post") or {}).get("topic_id"))
    print("posted", FORUM + "/t/" + str(tid))
except Exception as e:
    print("post failed", e)
    if hasattr(e, "read"):
        print(e.read()[:400].decode("utf-8", "replace"))
    sys.exit(1)
