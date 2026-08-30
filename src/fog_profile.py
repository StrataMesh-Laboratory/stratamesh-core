"""Local Fog Node profile. No secrets. ~/.config/stratamesh/node.json + node.id."""
from __future__ import annotations

import json
import os
from pathlib import Path

VERSION = "0.3.0"
REGISTRY = "https://calhegasmorais.pt/api/auth"
CORE_REPO = "https://github.com/StrataMesh-Laboratory/stratamesh-core.git"
CMN_ID = "FOG-NODE-PT-CM-001"
MOTTO = "Intelligentia · Vigilantia · Veritas"
BRAND = "STRATAMESH LAB"


def secrets_dir() -> Path:
    return Path.home() / ".config" / "stratamesh"


def _read(name: str) -> str:
    p = secrets_dir() / name
    if p.is_file():
        return p.read_text().strip()
    return ""


def load() -> dict:
    node_id = (
        os.environ.get("FOG_NODE_ID")
        or _read("node.id")
        or ""
    ).strip().upper()
    origin = (os.environ.get("FOG_ORIGIN") or "").strip()
    path = secrets_dir() / "node.json"
    data: dict = {}
    if path.is_file():
        try:
            data = json.loads(path.read_text() or "{}")
        except json.JSONDecodeError:
            data = {}
    if not node_id:
        node_id = str(data.get("node_id") or "").strip().upper()
    cmn = node_id == CMN_ID
    if not origin:
        origin = str(data.get("origin") or ("macbook" if cmn else "local"))
    return {
        "node_id": node_id or "UNREGISTERED",
        "origin": origin,
        "registry": str(data.get("registry") or os.environ.get("FOG_AUTH_BASE") or REGISTRY),
        "core_repo": str(data.get("core_repo") or CORE_REPO),
        "public_fog": str(data.get("public_fog") or (os.environ.get("FOG_PUBLIC_URL") or ("https://fog.calhegasmorais.pt" if cmn else ""))),
        "label": str(data.get("label") or ("Calhegas Morais Fog" if cmn else "Fog Node")),
        "version": VERSION,
        "lab": True,
        "not_mainnet": True,
        "cmn": cmn,
        "agent_label": "pt.calhegasmorais.fog" if cmn else "lab.stratamesh.fog",
        "motto": MOTTO,
        "brand": BRAND,
    }


def save(extra: dict | None = None) -> Path:
    cur = load()
    if extra:
        cur.update(extra)
    out = {
        "node_id": cur["node_id"],
        "origin": cur["origin"],
        "registry": cur["registry"],
        "core_repo": cur["core_repo"],
        "public_fog": cur.get("public_fog") or "",
        "label": cur.get("label") or "Fog Node",
        "version": VERSION,
        "lab": True,
        "not_mainnet": True,
    }
    secrets_dir().mkdir(parents=True, exist_ok=True)
    os.chmod(secrets_dir(), 0o700)
    path = secrets_dir() / "node.json"
    path.write_text(json.dumps(out, indent=2) + "\n")
    os.chmod(path, 0o600)
    return path
