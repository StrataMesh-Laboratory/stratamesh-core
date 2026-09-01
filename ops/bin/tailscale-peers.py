#!/usr/bin/env python3
"""List tailnet peers without printing keys."""
import json, subprocess, shutil
def main():
    if not shutil.which("tailscale"):
        print(json.dumps({"ok": False, "error": "tailscale-not-installed"})); return
    raw = subprocess.check_output(["tailscale", "status", "--json"], text=True)
    d = json.loads(raw)
    self = d.get("Self") or {}
    peers = []
    for p in (d.get("Peer") or {}).values():
        peers.append({
            "host": p.get("HostName"),
            "os": p.get("OS"),
            "online": p.get("Online"),
            "ips": p.get("TailscaleIPs"),
        })
    print(json.dumps({
        "ok": True,
        "self": {"host": self.get("HostName"), "ips": self.get("TailscaleIPs")},
        "peers": peers,
        "n": 1 + len(peers),
    }))
if __name__ == "__main__":
    main()
