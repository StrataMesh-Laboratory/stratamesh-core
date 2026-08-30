"""
StrataMesh Persistent Fog Node — Phase 2
========================================
HTTP Fog Node: PersistentDAG, gossip, pins, SPA registry, finality, PoC.

Endpoints:
  GET  /status /health /inv /tx /tx/{id} /gossip /resources /spa /finality /contribution
  POST /submit /gossip /spa/register

GET /gossip is a lab_single_host_gossip view (self-peer only, mesh_member false).
GET /tx aliases GET /inv (inventory ids). GET /tx/{id} remains the tx body.
GET /resources is resource_meter.sample() on this process — not a device farm.
"""

from __future__ import annotations
import argparse
import json
import time
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse
from persistent_dag import PersistentDAG
from tip_selection import Transaction, TxType
from gossip import GossipNode
from ipfs_client import IPFSClient
from spa_registry import SPARegistry
from finality import tip_set_report, tip_confidence
from finality_modules import FinalityEngine
from contribution import ContributionLedger
from metrics_bridge import build_status_payload
from subsistence.runtime import SubsistenceRuntime
from spa_pin_policy import enforce_or_warn
from strata_token import StrataTokenLedger
from agora import Agora
from service_credit import ServiceCreditLedger
from nft import NFTRegistry
from governance import Governance
from sandbox import UGCSandbox
from acb import ACBRegistry
from pq_keys import PQKeyRegistry
from resource_meter import sample as resource_sample
from host_fingerprint import fingerprint as host_fingerprint


class PersistentFogNode:
    def __init__(self, node_id: str = "FOG-NODE-PT-CM-001", db_path: str = "/tmp/stratamesh-fog.db"):
        self.node_id = node_id
        self.dag = PersistentDAG(db_path)
        self.gossip = GossipNode(self.dag)
        self.pinner = IPFSClient()  # mode from IPFS_API_URL / stub
        self.spas = SPARegistry(self.dag)
        self.poc = ContributionLedger()
        self.token = StrataTokenLedger()
        self.svc = ServiceCreditLedger()
        self.svc.credit(node_id, 100.0)  # lab bootstrap SVC
        self.agora = Agora(token_ledger=self.token, service_ledger=self.svc)
        self._agora_anchored = 0
        self.nfts = NFTRegistry()
        self.gov = Governance()
        self.sandbox = UGCSandbox()
        self.subsistence = SubsistenceRuntime()
        self.subsistence.register(node_id, reserve=10.0, tau=0.0)
        self.acbs = ACBRegistry(self.subsistence, self.poc)
        self.pq = PQKeyRegistry()
        self.finality_engine = FinalityEngine()
        self.started_at = time.time()
        self.lock = threading.Lock()
        self.db_path = db_path

    def submit(self, tx_type: str = "standard", cid: str | None = None) -> dict:
        with self.lock:
            parents = self.dag.select_tips(k=2)
            t = TxType.LIGHTWEIGHT if tx_type == "lightweight" else TxType.STANDARD
            tx = Transaction(
                tx_id=Transaction.make_id(str(time.time()), str(len(self.dag.txs))),
                tx_type=t,
                parents=parents,
                weight=1.0,
                cid=cid,
            )
            ok = self.dag.attach(tx)
            pin_status = None
            if ok and cid:
                pin_status = self.pinner.request_pin(cid).status
            if ok:
                self.poc.record(self.node_id, "validation", units=1.0)
                self.subsistence.earn(self.node_id, compute=0.5)
            self.subsistence.consume(self.node_id, compute=0.1)
            return {
                "accepted": ok,
                "tx_id": tx.tx_id,
                "type": t.value,
                "parents": parents,
                "cid": cid,
                "pin_status": pin_status,
                "confidence": tip_confidence(self.dag, tx.tx_id) if ok else 0.0,
            }

    def register_spa(self, roles: list, service_level: dict | None = None, cid: str | None = None) -> dict:
        with self.lock:
            rec = self.spas.register(
                provider_id=self.node_id,
                roles=roles or ["fog"],
                service_level=service_level,
                cid=cid,
            )
            self.poc.record(self.node_id, "spa_uptime", units=5.0, spa_id=rec.spa_id)
            policy = enforce_or_warn(rec.roles, self.pinner.mode, strict=False)
            return {
                "spa_id": rec.spa_id,
                "tx_id": rec.tx_id,
                "roles": rec.roles,
                "active": rec.active,
                "pin_policy": policy,
            }


    def mint_poc(self) -> dict:
        with self.lock:
            credit = self.poc.balance(self.node_id)
            if credit <= 0:
                return {"minted": 0, "reason": "no poc credit"}
            # mint only unminted delta vs token balance (simple: mint full credit once tracked)
            already = self.token.balance(self.node_id)
            delta = max(0.0, credit - already)
            if delta <= 0:
                return {"minted": 0, "balance": already, "reason": "already minted to poc level"}
            ev = self.token.mint_from_poc(self.node_id, delta, rate=1.0)
            parents = self.dag.select_tips(k=2) or ["genesis"]
            tx = Transaction(
                tx_id=Transaction.make_id(ev.mint_id, str(time.time())),
                tx_type=TxType.MINT,
                parents=parents,
                weight=1.0,
                sender=self.node_id,
            )
            self.dag.attach(tx)
            return {
                "minted": ev.amount,
                "mint_id": ev.mint_id,
                "balance": self.token.balance(self.node_id),
                "dag_tx": tx.tx_id,
            }

    def agora_place(self, side: str, amount: float, price: float) -> dict:
        with self.lock:
            o = self.agora.place(self.node_id, side, amount, price)
            trade_txs = []
            while self._agora_anchored < len(self.agora.trades):
                tr = self.agora.trades[self._agora_anchored]
                parents = self.dag.select_tips(k=2) or ["genesis"]
                tx = Transaction(
                    tx_id=Transaction.make_id(tr.trade_id, str(time.time())),
                    tx_type=TxType.TRADE,
                    parents=parents,
                    weight=1.0,
                    sender=self.node_id,
                )
                if self.dag.attach(tx):
                    trade_txs.append({"trade_id": tr.trade_id, "dag_tx": tx.tx_id, "amount": tr.amount, "price": tr.price})
                self._agora_anchored += 1
            return {
                "order_id": o.order_id,
                "side": o.side.value,
                "amount": o.amount,
                "price": o.price,
                "book": self.agora.book(),
                "dag_trades": trade_txs,
            }


    def nft_mint(self, cid: str, title: str = "") -> dict:
        with self.lock:
            a = self.nfts.mint(self.node_id, cid, title=title)
            parents = self.dag.select_tips(k=2) or ["genesis"]
            tx = Transaction(
                tx_id=Transaction.make_id(a.asset_id, str(time.time())),
                tx_type=TxType.STANDARD,
                parents=parents,
                weight=1.0,
                cid=cid,
                sender=self.node_id,
            )
            self.dag.attach(tx)
            a.dag_tx = tx.tx_id
            if cid:
                self.pinner.request_pin(cid)
            return {"asset_id": a.asset_id, "cid": a.cid, "owner": a.owner, "dag_tx": a.dag_tx}

    def nft_transfer(self, asset_id: str, new_owner: str) -> dict:
        with self.lock:
            a = self.nfts.transfer(asset_id, new_owner)
            return {"asset_id": a.asset_id, "owner": a.owner, "cid": a.cid}


    def gov_propose(self, title: str, body: str = "") -> dict:
        with self.lock:
            pr = self.gov.propose(self.node_id, title, body)
            parents = self.dag.select_tips(k=2) or ["genesis"]
            tx = Transaction(
                tx_id=Transaction.make_id(pr.proposal_id, str(time.time())),
                tx_type=TxType.STANDARD,
                parents=parents,
                weight=1.0,
                sender=self.node_id,
            )
            self.dag.attach(tx)
            pr.dag_tx = tx.tx_id
            return {"proposal_id": pr.proposal_id, "title": pr.title, "status": pr.status.value, "dag_tx": pr.dag_tx}

    def gov_vote(self, proposal_id: str, choice: str, weight: float = 1.0) -> dict:
        with self.lock:
            pr = self.gov.vote(proposal_id, self.node_id, choice, weight)
            return {
                "proposal_id": pr.proposal_id,
                "status": pr.status.value,
                "yes": pr.yes,
                "no": pr.no,
            }

    def sandbox_create(self, cid: str, label: str = "") -> dict:
        with self.lock:
            it = self.sandbox.create(self.node_id, cid, label)
            if cid:
                self.pinner.request_pin(cid)
            return {"item_id": it.item_id, "cid": it.cid, "label": it.label}

    def sandbox_publish(self, item_id: str, as_nft: bool = False) -> dict:
        with self.lock:
            nft_id = None
            if as_nft:
                it0 = self.sandbox.items[item_id]
                a = self.nfts.mint(self.node_id, it0.cid, title=it0.label)
                parents = self.dag.select_tips(k=2) or ["genesis"]
                tx = Transaction(
                    tx_id=Transaction.make_id(a.asset_id, str(time.time())),
                    tx_type=TxType.STANDARD,
                    parents=parents,
                    weight=1.0,
                    cid=it0.cid,
                    sender=self.node_id,
                )
                self.dag.attach(tx)
                a.dag_tx = tx.tx_id
                nft_id = a.asset_id
            it = self.sandbox.publish(item_id, nft_asset_id=nft_id)
            return {"item_id": it.item_id, "published": it.published, "nft_asset_id": it.nft_asset_id}


    def acb_register(self, label: str = "", capabilities: list | None = None) -> dict:
        with self.lock:
            a = self.acbs.register(self.node_id, label, capabilities)
            parents = self.dag.select_tips(k=2) or ["genesis"]
            tx = Transaction(
                tx_id=Transaction.make_id(a.acb_id, str(time.time())),
                tx_type=TxType.STANDARD,
                parents=parents,
                weight=1.0,
                sender=self.node_id,
            )
            self.dag.attach(tx)
            a.dag_tx = tx.tx_id
            return {"acb_id": a.acb_id, "label": a.label, "state": a.state.value, "dag_tx": a.dag_tx}

    def acb_heartbeat(self, acb_id: str, consume: float | None = None, earn: float = 0.0, auto_meter: bool = True) -> dict:
        with self.lock:
            return self.acbs.heartbeat(acb_id, consume=consume, earn=earn, auto_meter=auto_meter)


    def pq_generate(self, algorithm: str = "Kyber768-lab", purpose: str = "node-identity") -> dict:
        with self.lock:
            k = self.pq.generate(self.node_id, algorithm, purpose)
            parents = self.dag.select_tips(k=2) or ["genesis"]
            tx = Transaction(
                tx_id=Transaction.make_id(k.key_id, str(time.time())),
                tx_type=TxType.STANDARD,
                parents=parents,
                weight=1.0,
                sender=self.node_id,
            )
            self.dag.attach(tx)
            k.dag_tx = tx.tx_id
            return {"key_id": k.key_id, "algorithm": k.algorithm, "purpose": k.purpose, "dag_tx": k.dag_tx}

    def handle_gossip(self, raw: bytes) -> list:
        with self.lock:
            replies = self.gossip.handle_message(raw)
            if replies:
                self.poc.record(self.node_id, "gossip", units=0.2)
            return replies

    def inventory(self) -> list:
        with self.lock:
            return list(self.dag.txs.keys())[-64:]

    def lab_role(self) -> str:
        """Honest single-host role from node_id. Not a mesh roster."""
        nid = (self.node_id or "").upper()
        if nid.startswith("EDGE"):
            return "edge"
        return "fog"

    def spa_view(self) -> dict:
        """GET /spa: registry counts plus lab honesty. Empty registry is valid at n=1."""
        with self.lock:
            self.spas.apply_opt_out_grace()
            s = self.spas.summary()
        s.update({
            "ok": True,
            "lab": True,
            "n": 1,
            "source": "fog_process",
            "node_id": self.node_id,
            "mesh_member": False,
            "oracle_live": False,
            "consensus": {
                "n": 1,
                "f_max": 0,
                "note": "lab n=1; Byzantine f_max=0 until n>=3",
            },
            "agora": {"settlements": {"unavailable": "n<2"}},
        })
        return s

    def public_html(self) -> str:
        """GET / for browsers. JSON remains default for /status and Accept: json."""
        spa = self.spa_view()
        ver = "0.2.3-lab"
        return f"""<!DOCTYPE html>
<html lang="pt-PT"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Fog · Nó Calhegas Morais</title>
<style>
:root{{--bg:#07111c;--ink:#d7e4ef;--muted:#8aa0b3;--line:#1c3348;--surface:#0c1a28;--teal:#2f9e8a}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--ink);font-family:system-ui,sans-serif;line-height:1.55}}
.wrap{{max-width:42rem;margin:0 auto;padding:2rem 1.2rem 4rem}}
.kicker{{font:600 .68rem/1 ui-monospace,monospace;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}}
h1{{font-size:1.6rem;margin:.4rem 0 .8rem}}p{{color:var(--muted)}}
a{{color:var(--teal)}}.card{{background:var(--surface);border:1px solid var(--line);border-radius:.75rem;padding:1rem 1.1rem;margin:1rem 0}}
.links a{{display:inline-block;margin:.2rem .3rem .2rem 0;padding:.4rem .7rem;border:1px solid var(--line);border-radius:10px;color:var(--ink);text-decoration:none}}
.links a:hover{{border-color:var(--teal);color:var(--teal)}}
.mono{{font-family:ui-monospace,monospace;font-size:.84rem;color:var(--teal)}}
footer{{margin-top:2rem;color:var(--muted);font-size:.78rem}}
</style></head><body><main class="wrap">
<p class="kicker">fog.calhegasmorais.pt</p>
<h1>FOG-NODE-PT-CM-001</h1>
<p>Nó de referência Calhegas Morais · Lisboa. Local-process lab. <span class="mono">mesh_member=false</span> · <span class="mono">oracle_live=false</span> · n=1.</p>
<div class="card">
<p>JSON: <span class="mono">/health</span> · <span class="mono">/status</span> · <span class="mono">/spa</span> · <span class="mono">/gossip</span>. Not the status Worker pulse.</p>
<div class="links">
  <a href="/health">/health</a>
  <a href="/status">/status</a>
  <a href="/spa">/spa</a>
  <a href="/gossip">/gossip</a>
  <a href="https://gossip.calhegasmorais.pt/">Gossip Worker</a>
  <a href="https://origin.calhegasmorais.pt/">Origin</a>
  <a href="https://edge.calhegasmorais.pt/">EDGE</a>
  <a href="https://calhegasmorais.pt/">Apex</a>
  <a href="https://status.calhegasmorais.pt/status">Status pulse</a>
</div>
</div>
<footer>spa.total={spa.get("total")} · source={spa.get("source")} · {ver} · LAB only · no STRATA</footer>
</main></body></html>
"""

    def gossip_view(self) -> dict:
        """GET /gossip: live inventory + self as the only peer. lab_single_host_gossip."""
        nid = self.node_id
        return {
            "protocol": "lab_single_host_gossip",
            "ok": True,
            "node_id": nid,
            "mesh_member": False,
            "peers": [
                {
                    "id": nid,
                    "role": self.lab_role(),
                    "substrate": "local-process",
                }
            ],
            "ids": self.inventory(),
            "accept": ["POST /gossip", "GET /inv", "GET /tx/{id}", "POST /submit"],
        }

    def resources_view(self) -> dict:
        """GET /resources: this process sample + one lab mock device (this host)."""
        s = resource_sample()
        return {
            "ok": True,
            "lab": True,
            "node_id": self.node_id,
            "source": s.source,
            "sample": {
                "cpu_percent": s.cpu_percent,
                "mem_rss_mb": s.mem_rss_mb,
                "mem_percent": s.mem_percent,
                "timestamp": s.timestamp,
                "source": s.source,
            },
            "devices": [
                {
                    "id": self.node_id,
                    "kind": "host-process",
                    "mock": True,
                    "label": "single lab host (this process)",
                    "substrate": "local-process",
                }
            ],
            "note": (
                "single-host process sample via resource_meter.sample(); "
                "one mock device object for this host only — not a device farm, not multi-host"
            ),
        }

    def status(self) -> dict:
        with self.lock:
            self.spas.apply_opt_out_grace()
            stats = self.dag.stats()
            sub = self.subsistence.ledger.report(self.node_id)
            fp = host_fingerprint()
            agora_book = self.agora.book()
            if not isinstance(agora_book, dict):
                agora_book = {}
            agora_out = dict(agora_book)
            # n=1: do not report a seed scalar as live settlements
            agora_out["settlements"] = {"unavailable": "n<2"}
            return build_status_payload(
                node_id=self.node_id,
                dag_stats=stats,
                spa_summary=self.spas.summary(),
                subsistence=sub,
                phase="2",
                phase_name="Nodal Hierarchy & SPAs",
                extra={
                    "version": "0.2.3-lab",
                    "host_id": fp["host_id"],
                    "host_id_source": fp["source"],
                    "mesh_member": False,
                    "oracle_live": False,
                    "oracle_vm": False,
                    "uptime_seconds": int(time.time() - self.started_at),
                    "storage": {"backend": "sqlite", "path": self.db_path},
                    "finality_tips": tip_set_report(self.dag, limit=8),
                    "contribution": self.poc.summary(),
                    "token": self.token.summary(),
                    "service_credit": self.svc.summary(),
                    "agora": agora_out,
                    "consensus": {
                        "n": 1,
                        "f_max": 0,
                        "note": "lab n=1; Byzantine f_max=0 until n>=3",
                    },
                    "nfts": self.nfts.summary(),
                    "governance": self.gov.summary(),
                    "sandbox": self.sandbox.summary(),
                    "acbs": self.acbs.summary(),
                    "pq_keys": self.pq.summary(),
                    "ipfs": {
                        "dnslink_cid": "bafybeigdyrzt5sfp7udm7hu76uh7y26nf4dfuylqabf3oclgtqy55fbzdi",
                        "pins": self.pinner.summary(),
                    },
                },
            )


NODE: PersistentFogNode | None = None


class Handler(BaseHTTPRequestHandler):
    def _json(self, code: int, obj):
        if isinstance(obj, (bytes, bytearray)):
            body, ctype = obj, "application/octet-stream"
        else:
            body = json.dumps(obj, indent=2).encode()
            ctype = "application/json"
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _html(self, code: int, body: str):
        raw = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(raw)

    def do_HEAD(self):
        path = urlparse(self.path).path
        if path in (
            "/", "/status", "/v1/status", "/health", "/api/v1/health",
            "/spa", "/gossip", "/inv", "/resources", "/tx",
        ):
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
        else:
            self.send_response(404)
            self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path
        accept = (self.headers.get("Accept") or "")
        if path in ("/", "/status", "/v1/status"):
            if path == "/" and "text/html" in accept:
                self._html(200, NODE.public_html())
            else:
                self._json(200, NODE.status())
        elif path in ("/health", "/api/v1/health"):
            self._json(200, {
                "ok": True,
                "version": "0.2.3-lab",
                "node_id": NODE.node_id,
                "lab": True,
                "n": 1,
                "mesh_member": False,
                "oracle_live": False,
                "substrate": "local-process",
            })
        elif path == "/inv":
            self._json(200, {"ids": NODE.inventory()})
        elif path == "/tx":
            self._json(200, {"ids": NODE.inventory()})
        elif path == "/gossip":
            self._json(200, NODE.gossip_view())
        elif path == "/resources":
            self._json(200, NODE.resources_view())
        elif path.startswith("/tx/"):
            tid = path[len("/tx/"):]
            with NODE.lock:
                tx = NODE.dag.txs.get(tid)
                if not tx:
                    self._json(404, {"error": "not found"})
                else:
                    self._json(200, {
                        "tx_id": tx.tx_id,
                        "tx_type": tx.tx_type.value,
                        "parents": tx.parents,
                        "weight": tx.weight,
                        "cid": tx.cid,
                        "sender": getattr(tx, "sender", None),
                        "timestamp": getattr(tx, "timestamp", None),
                    })
        elif path == "/spa":
            self._json(200, NODE.spa_view())
        elif path == "/spa/export":
            self._json(200, {"spas": NODE.spas.export_records()})
        elif path == "/finality":
            with NODE.lock:
                tips = tip_set_report(NODE.dag)
                self._json(200, {
                    "tips": tips,
                    "modules": NODE.finality_engine.run(NODE.dag, tips),
                })
        elif path == "/finality/modules":
            with NODE.lock:
                tips = tip_set_report(NODE.dag, limit=16)
                self._json(200, NODE.finality_engine.run(NODE.dag, tips))
        elif path == "/contribution":
            self._json(200, NODE.poc.summary())
        elif path == "/token":
            self._json(200, NODE.token.summary())
        elif path == "/svc":
            self._json(200, NODE.svc.summary())
        elif path == "/agora":
            self._json(200, NODE.agora.book())
        elif path == "/nft":
            self._json(200, NODE.nfts.summary())
        elif path == "/gov":
            self._json(200, NODE.gov.summary())
        elif path == "/sandbox":
            self._json(200, NODE.sandbox.summary())
        elif path == "/acb":
            self._json(200, NODE.acbs.summary())
        elif path == "/pq":
            self._json(200, NODE.pq.summary())
        else:
            self._json(404, {"error": "not found"})

    def do_POST(self):
        path = urlparse(self.path).path
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length) if length else b"{}"

        if path == "/submit":
            try:
                data = json.loads(raw.decode() or "{}")
            except Exception:
                data = {}
            self._json(200, NODE.submit(data.get("type", "standard"), data.get("cid")))

        elif path == "/spa/import":
            try:
                data = json.loads(raw.decode() or "{}")
            except Exception:
                data = {}
            items = data.get("spas") or ([data] if data.get("spa_id") else [])
            n = 0
            for it in items:
                if NODE.spas.import_record(it):
                    n += 1
            self._json(200, {"imported": n})

        elif path == "/spa/opt-out":
            try:
                data = json.loads(raw.decode() or "{}")
            except Exception:
                data = {}
            try:
                self._json(200, NODE.spas.request_opt_out(str(data.get("spa_id", "")), str(data.get("reason", "")), bool(data.get("immediate", False))))
            except Exception as e:
                self._json(400, {"error": str(e)})

        elif path == "/spa/register":
            try:
                data = json.loads(raw.decode() or "{}")
            except Exception:
                data = {}
            try:
                result = NODE.register_spa(
                    roles=data.get("roles") or ["fog"],
                    service_level=data.get("service_level"),
                    cid=data.get("cid"),
                )
                self._json(200, result)
            except Exception as e:
                self._json(400, {"error": str(e)})

        elif path == "/pq/sign":
            try:
                data = json.loads(raw.decode() or "{}")
            except Exception:
                data = {}
            try:
                self._json(200, NODE.pq.lab_sign(str(data.get("key_id", "")), str(data.get("message", ""))))
            except Exception as e:
                self._json(400, {"error": str(e)})

        elif path == "/pq/verify":
            try:
                data = json.loads(raw.decode() or "{}")
            except Exception:
                data = {}
            ok = NODE.pq.lab_verify(str(data.get("key_id", "")), str(data.get("message", "")), str(data.get("lab_sig", "")))
            self._json(200, {"valid": ok})

        elif path == "/pq/generate":
            try:
                data = json.loads(raw.decode() or "{}")
            except Exception:
                data = {}
            try:
                self._json(200, NODE.pq_generate(str(data.get("algorithm", "Kyber768-lab")), str(data.get("purpose", "node-identity"))))
            except Exception as e:
                self._json(400, {"error": str(e)})

        elif path == "/acb/register":
            try:
                data = json.loads(raw.decode() or "{}")
            except Exception:
                data = {}
            try:
                self._json(200, NODE.acb_register(str(data.get("label", "ACB")), data.get("capabilities")))
            except Exception as e:
                self._json(400, {"error": str(e)})

        elif path == "/acb/heartbeat":
            try:
                data = json.loads(raw.decode() or "{}")
            except Exception:
                data = {}
            try:
                consume = data.get("consume", None)
                consume_f = float(consume) if consume is not None else None
                auto = bool(data.get("auto_meter", True))
                self._json(200, NODE.acb_heartbeat(
                    str(data.get("acb_id", "")),
                    consume_f,
                    float(data.get("earn", 0.0)),
                    auto_meter=auto,
                ))
            except Exception as e:
                self._json(400, {"error": str(e)})

        elif path == "/gov/propose":
            try:
                data = json.loads(raw.decode() or "{}")
            except Exception:
                data = {}
            try:
                self._json(200, NODE.gov_propose(str(data.get("title", "untitled")), str(data.get("body", ""))))
            except Exception as e:
                self._json(400, {"error": str(e)})

        elif path == "/gov/vote":
            try:
                data = json.loads(raw.decode() or "{}")
            except Exception:
                data = {}
            try:
                self._json(200, NODE.gov_vote(str(data.get("proposal_id", "")), str(data.get("choice", "yes")), float(data.get("weight", 1))))
            except Exception as e:
                self._json(400, {"error": str(e)})

        elif path == "/sandbox/create":
            try:
                data = json.loads(raw.decode() or "{}")
            except Exception:
                data = {}
            try:
                self._json(200, NODE.sandbox_create(str(data.get("cid", "")), str(data.get("label", ""))))
            except Exception as e:
                self._json(400, {"error": str(e)})

        elif path == "/sandbox/publish":
            try:
                data = json.loads(raw.decode() or "{}")
            except Exception:
                data = {}
            try:
                self._json(200, NODE.sandbox_publish(str(data.get("item_id", "")), bool(data.get("as_nft", False))))
            except Exception as e:
                self._json(400, {"error": str(e)})

        elif path == "/nft/mint":
            try:
                data = json.loads(raw.decode() or "{}")
            except Exception:
                data = {}
            try:
                self._json(200, NODE.nft_mint(str(data.get("cid", "")), str(data.get("title", ""))))
            except Exception as e:
                self._json(400, {"error": str(e)})

        elif path == "/nft/transfer":
            try:
                data = json.loads(raw.decode() or "{}")
            except Exception:
                data = {}
            try:
                self._json(200, NODE.nft_transfer(str(data.get("asset_id", "")), str(data.get("to", ""))))
            except Exception as e:
                self._json(400, {"error": str(e)})

        elif path == "/svc/credit":
            try:
                data = json.loads(raw.decode() or "{}")
            except Exception:
                data = {}
            agent = str(data.get("agent_id") or NODE.node_id)
            amt = float(data.get("amount", 0))
            try:
                bal = NODE.svc.credit(agent, amt)
                self._json(200, {"agent_id": agent, "balance": bal, "symbol": "SVC"})
            except Exception as e:
                self._json(400, {"error": str(e)})

        elif path == "/token/mint":
            self._json(200, NODE.mint_poc())

        elif path == "/agora/order":
            try:
                data = json.loads(raw.decode() or "{}")
            except Exception:
                data = {}
            try:
                self._json(200, NODE.agora_place(
                    str(data.get("side", "sell")),
                    float(data.get("amount", 0)),
                    float(data.get("price", 0)),
                ))
            except Exception as e:
                self._json(400, {"error": str(e)})

        elif path == "/tx/ingest":
            from p0_ingest_guard import guard_ingest
            from tip_selection import Transaction, TxType
            with NODE.lock:
                decision = guard_ingest(
                    raw,
                    known_ids=NODE.dag.txs.keys(),
                    genesis_id=NODE.dag.genesis_id,
                )
                if decision.http_status != 200 or not decision.accepted:
                    self._json(decision.http_status, decision.body)
                else:
                    tx = Transaction(
                        tx_id=decision.tx_id,
                        tx_type=TxType(decision.tx_type),
                        parents=list(decision.parents),
                        weight=float(decision.weight),
                        cid=decision.cid,
                        sender=decision.sender,
                    )
                    ok = NODE.dag.attach(tx)
                    self._json(200, {"accepted": bool(ok), "tx_id": tx.tx_id})

        elif path == "/gossip":
            import base64
            replies = NODE.handle_gossip(raw)
            out = [base64.b64encode(r).decode() for r in replies]
            self._json(200, {"replies": out, "count": len(out)})

        else:
            self._json(404, {"error": "not found"})

    def log_message(self, fmt, *args):
        print(f"[node] {fmt % args}")


def main():
    global NODE
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8787)
    parser.add_argument("--db", default="/tmp/stratamesh-fog.db")
    parser.add_argument("--id", default="FOG-NODE-PT-CM-001")
    args = parser.parse_args()

    NODE = PersistentFogNode(node_id=args.id, db_path=args.db)
    server = HTTPServer(("0.0.0.0", args.port), Handler)
    print(f"Persistent Fog Node {args.id} on :{args.port}  db={args.db}")
    print("  GET /status /health /inv /tx /tx/{id} /gossip /resources /spa /finality /contribution")
    print("  POST /submit /spa/register /token/mint /agora/order /nft/mint /nft/transfer /gossip")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        NODE.dag.close()


if __name__ == "__main__":
    main()
