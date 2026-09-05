"""
StrataMesh Persistent Fog Node — Phase 2
========================================
HTTP Fog Node: PersistentDAG, gossip, pins, SPA registry, finality, PoC.

Endpoints:
  GET  /status /health /inv /tx /tx/{id} /gossip /resources /spa /finality /contribution /contribution/metrics /ping /origin/lease
  POST /submit /gossip /spa/register /origin/reclaim

GET /gossip is a lab_single_host_gossip view (self-peer only, mesh_member false).
GET /tx aliases GET /inv (inventory ids). GET /tx/{id} remains the tx body.
GET /resources is resource_meter.sample() on this process — not a device farm.
"""

from __future__ import annotations
import argparse
import os
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
from workerd_plugin import WorkerdPlugin, is_loopback_not_tunnel
from fog_plugins.runtime_mesh import RuntimeMeshPlugin
from fog_plugins import host_cap
from mesh_provision import flags as mesh_flags
from origin_lease import public_view as origin_public_view, verify_reclaim, write as origin_lease_write
from fog_plugins.ping import PingPlugin
from fog_plugins.keepup import KeepUpPlugin
from fog_plugins.rails import RailsPlug
from subsistence.user_payg import PaygRuntime, BURN_RATES, STATIC_ACTIONS
from account_lifecycle import AccountGraph


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
        self.workerd = WorkerdPlugin()
        self.runtime_mesh = RuntimeMeshPlugin()
        if os.environ.get("FOG_TESTNET") != "1":
            self.workerd.attach()
            self.runtime_mesh.attach()
        self.ping = PingPlugin()
        self.rails = RailsPlug(poc=self.poc, token=self.token, subsistence=self.subsistence)
        self.keepup = KeepUpPlugin(
            node_id,
            ping=self.ping,
            mesh_flags=mesh_flags,
            resource_sample=resource_sample,
        )
        self.keepup.on_sample = lambda sample: self.rails.ingest(sample, node_id)
        self.keepup.attach()
        self.lifecycle = AccountGraph(dag=self.dag, token=self.token)
        self.payg = PaygRuntime(lab_ledger=self.lifecycle.lab, graph=self.lifecycle)

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
            "source": "fog_process",
            "node_id": self.node_id,
            **mesh_flags(),
            "consensus": {
                "n": mesh_flags()["n"],
                "f_max": mesh_flags()["mesh_provision"]["f_max"],
                "note": "n=2 · f_max=0 until n>=3",
            },
            "agora": {"settlements": {"unavailable": "f_max=0"}},
        })
        return s

    def public_html(self) -> str:
        """GET / for browsers. Destylised like EDGE: node id + facts, mesh roster stays JSON."""
        spa = self.spa_view()
        ver = "0.6.0-lab"
        mf = mesh_flags()
        return f"""<!DOCTYPE html>
<html lang="pt-PT">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>{self.node_id} · {ver}</title>
<style>
:root {{ --bg:#0a0a0b; --fg:#e8e6e3; --muted:#8a8780; --line:#1c1c1f; --acc:#c4a574; }}
body {{ margin:0; font:16px/1.45 system-ui,sans-serif; background:var(--bg); color:var(--fg); }}
main {{ max-width:40rem; margin:0 auto; padding:2.5rem 1.25rem 4rem; }}
h1 {{ font-size:1.25rem; font-weight:600; }}
p,li {{ color:var(--muted); }}
a {{ color:var(--acc); }}
code {{ color:var(--fg); }}
.badge {{ display:inline-block; border:1px solid var(--line); padding:.15rem .5rem; font-size:.75rem; letter-spacing:.04em; }}
</style>
</head>
<body>
<main>
<p class="badge">STRATAMESH LAB · prerelease · not mainnet</p>
<h1>{self.node_id}</h1>
<p>v<code>{ver}</code> · origin=<code>{mesh_flags().get("mesh_provision", {}).get("trusted_origin") or "local"}</code> · n={mf.get("n")} · mesh_member={str(mf.get("mesh_member")).lower()} · f_max={mf.get("mesh_provision", {}).get("f_max", 0)}</p>
<p>Fog Node of the shared web3 metaverse OS. Continuity and peer roster are JSON (<code>/status</code>). Byzantine f_max stays 0 until n≥3. STRATA via PoC — not a public offer.</p>
<ul>
<li><a href="/health">/health</a> JSON</li>
<li><a href="/status">/status</a> JSON</li>
<li><a href="https://github.com/StrataMesh-Laboratory/stratamesh-core/releases/tag/v0.6.0-lab">tag v0.6.0-lab</a></li>
</ul>
<p><code>spa.total={spa.get("total")}</code> · <code>source={spa.get("source")}</code></p>
</main>
</body></html>
"""

    def gossip_view(self) -> dict:
        """GET /gossip: live inventory + self as the only peer. lab_single_host_gossip."""
        nid = self.node_id
        mf = mesh_flags()
        return {
            "protocol": "lab_two_host_mesh" if mf.get("mesh_member") else "lab_single_host_gossip",
            "ok": True,
            "node_id": nid,
            **mf,
            "peers": [
                {
                    "id": nid,
                    "role": self.lab_role(),
                    "substrate": "workerd-serverless" if mf.get("mac_live") else "local-process",
                    "trusted": bool(mf.get("trusted")),
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
        wrd = self.workerd.snapshot() if getattr(self, "workerd", None) else None
        with self.lock:
            self.spas.apply_opt_out_grace()
            stats = self.dag.stats()
            sub = self.subsistence.ledger.report(self.node_id)
            fp = host_fingerprint()
            # Do not seed six lab roles on GET /status — that is seed-only noise for AIOps.
            # Empty registry stays total=0 source=empty. Live Fog already persisted roles.
            agora_book = self.agora.book()
            log = getattr(self.agora, "settlement_log", None) or []
            trades = agora_book.get("trades")
            agora_book["settlements"] = int(trades) if isinstance(trades, int) else len(log)
            return build_status_payload(
                node_id=self.node_id,
                dag_stats=stats,
                spa_summary=self.spas.summary(),
                subsistence=sub,
                phase="2",
                phase_name="Nodal Hierarchy & SPAs",
                extra={
                    "version": "0.6.0-lab",
                    "host_id": fp["host_id"],
                    "host_id_source": fp["source"],
                    **mesh_flags(),
                    "consensus": {
                        "n": mesh_flags()["n"],
                        "f_max": mesh_flags()["mesh_provision"]["f_max"],
                        "note": "n=2 · f_max=0 until n>=3",
                    },
                    "oracle_vm": False,
                    "uptime_seconds": int(time.time() - self.started_at),
                    "storage": {"backend": "sqlite", "path": self.db_path},
                    "finality_tips": tip_set_report(self.dag, limit=8),
                    "contribution": self.poc.summary(),
                    "token": self.token.summary(),
                    "service_credit": self.svc.summary(),
                    "agora": agora_book,
                    "nfts": self.nfts.summary(),
                    "governance": self.gov.summary(),
                    "sandbox": self.sandbox.summary(),
                    "acbs": self.acbs.summary(),
                    "pq_keys": self.pq.summary(),
                    "workerd": wrd,
                    "runtime_mesh": self.runtime_mesh.snapshot() if getattr(self, "runtime_mesh", None) else None,
                    "host_cap": host_cap.snapshot(),
                    "ping": self.ping.snapshot() if getattr(self, "ping", None) else None,
                    "keepup": self.keepup.snapshot() if getattr(self, "keepup", None) else None,
                    "rails": self.rails.snapshot() if getattr(self, "rails", None) else None,
                    "payg": {
                        "floor": 0.1,
                        "burn_pole": "#0",
                        "mint_pole": "#mint",
                        "dashboard": "registered_only",
                        "static_actions": sorted(STATIC_ACTIONS),
                        "burn_rates": dict(BURN_RATES),
                        "note": "Citizen PAYG. Anonymous have no dashboard. Unfunded = NFTs only.",
                    },
                    "lifecycle": self.lifecycle.summary() if getattr(self, "lifecycle", None) else None,
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

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
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
            self._json(200, {"ok": True, "node_id": NODE.node_id, "version": "0.6.0-lab", **mesh_flags()})
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
        elif path in ("/contribution/metrics", "/keepup", "/keepup/metrics"):
            self._json(200, {
                "ok": True,
                "keepup": NODE.keepup.snapshot() if NODE.keepup else None,
                "rails": NODE.rails.snapshot() if NODE.rails else None,
                "poc": NODE.poc.summary(),
            })
        elif path in ("/contribution/stream", "/keepup/stream"):
            n = 20
            q = urlparse(self.path).query
            if "n=" in q:
                try:
                    n = max(1, min(200, int(q.split("n=")[1].split("&")[0])))
                except Exception:
                    n = 20
            self._json(200, {"ok": True, "schema": "stratamesh.fog.keepup.v1", "samples": NODE.keepup.stream_tail(n)})
        elif path in ("/ping", "/runtime/ping"):
            self._json(200, NODE.ping.snapshot() if NODE.ping else {"ok": False})
        elif path == "/token":
            self._json(200, NODE.token.summary())
        elif path == "/svc":
            self._json(200, NODE.svc.summary())
        elif path == "/agora":
            self._json(200, NODE.agora.book())
        elif path == "/nft":
            # Static NFT data — no PAYG burn
            self._json(200, NODE.nfts.summary())
        elif path in ("/payg", "/payg/rates", "/account/rates"):
            self._json(200, {
                "ok": True,
                "floor": 0.1,
                "burn_pole": "#0",
                "dashboard": "registered_only",
                "burn_rates": dict(BURN_RATES),
                "static_actions": sorted(STATIC_ACTIONS),
            })
        elif path in ("/account/subsistence", "/payg/me"):
            q = urlparse(self.path).query
            uid = ""
            for part in q.split("&"):
                if part.startswith("user="):
                    uid = part.split("=", 1)[1]
            self._json(200, NODE.payg.snapshot(uid) if uid else {"ok": False, "error": "user required", "dashboard": False})
        elif path in ("/account/lifecycle", "/lifecycle"):
            q = urlparse(self.path).query
            wallet = ""
            uid = ""
            for part in q.split("&"):
                if part.startswith("wallet="):
                    wallet = part.split("=", 1)[1]
                if part.startswith("user="):
                    uid = part.split("=", 1)[1]
            if uid and not wallet:
                acc = NODE.lifecycle.get(user_id=uid)
                wallet = acc.wallet if acc else ""
            if not wallet:
                self._json(400, {"ok": False, "error": "wallet or user required"})
            else:
                self._json(200, NODE.lifecycle.snapshot(wallet))
        elif path in ("/accounts", "/account/list"):
            self._json(200, NODE.lifecycle.summary())
        elif path == "/gov":
            self._json(200, NODE.gov.summary())
        elif path == "/sandbox":
            self._json(200, NODE.sandbox.summary())
        elif path == "/acb":
            self._json(200, NODE.acbs.summary())
        elif path in ("/workerd", "/workerd/health"):
            self._json(200, NODE.workerd.snapshot() if NODE and NODE.workerd else {"ok": False})
        elif path in ("/mw", "/mw/health"):
            self._json(200, NODE.runtime_mesh.snapshot() if NODE and getattr(NODE, "runtime_mesh", None) else {"ok": False})
        elif path in ("/origin/lease", "/origin"):
            self._json(200, origin_public_view())
        elif path == "/pq":
            self._json(200, NODE.pq.summary())
        else:
            self._json(404, {"error": "not found"})

    def do_POST(self):
        path = urlparse(self.path).path
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length) if length else b"{}"

        if path in ("/contribution/tick", "/keepup/tick", "/ping/tick"):
            if not is_loopback_not_tunnel(self):
                self._json(403, {"ok": False, "error": "local_only"})
                return
            sample = NODE.keepup.measure()
            self._json(200, {"ok": True, "sample": {
                "quantity": sample.quantity, "quality": sample.quality, "score": sample.score,
                "admissible": sample.admissible, "unready": sample.unready,
            }, "rails": NODE.rails.snapshot()})
            return

        if path in ("/account/spend", "/payg/tick", "/payg/spend"):
            try:
                data = json.loads(raw.decode() or "{}")
            except Exception:
                data = {}
            uid = str(data.get("user_id") or data.get("user") or "")
            action = str(data.get("action") or "dashboard_tick")
            wallet = str(data.get("wallet") or "")
            if wallet and uid and uid not in NODE.payg.accounts:
                try:
                    NODE.payg.register(uid, wallet, float(data.get("balance") or 0), fund_via_poc=False)
                except ValueError as e:
                    self._json(403, {"ok": False, "error": str(e)})
                    return
            g = NODE.payg.gate(uid or None, action, anonymous=not uid)
            code = 200 if g.ok else (401 if g.mode == "deny" else 402)
            self._json(code, g.as_dict())
            return

        if path in ("/account/open",):
            try:
                data = json.loads(raw.decode() or "{}")
            except Exception:
                data = {}
            uid = str(data.get("user_id") or data.get("user") or "")
            wallet = str(data.get("wallet") or "") or None
            if not uid:
                self._json(400, {"ok": False, "error": "user_id required"})
                return
            try:
                acc = NODE.lifecycle.open(uid, wallet)
                NODE.payg.register(uid, acc.wallet, 0.0)
            except ValueError as e:
                self._json(403, {"ok": False, "error": str(e)})
                return
            self._json(200, NODE.lifecycle.snapshot(acc.wallet))
            return

        if path in ("/account/contribute", "/account/mint-poc"):
            if not is_loopback_not_tunnel(self):
                self._json(403, {"ok": False, "error": "local_only"})
                return
            try:
                data = json.loads(raw.decode() or "{}")
            except Exception:
                data = {}
            wallet = str(data.get("wallet") or "")
            amount = float(data.get("amount") or data.get("units") or 0)
            kind = str(data.get("kind") or "poc")
            if not wallet:
                self._json(400, {"ok": False, "error": "wallet required"})
                return
            if NODE.lifecycle.get(wallet=wallet) is None:
                self._json(404, {"ok": False, "error": "unknown_account"})
                return
            NODE.poc.record(wallet, kind, units=amount, weight=1.0)
            self._json(200, NODE.lifecycle.mint_poc(wallet, amount, kind=kind))
            return

        if path in ("/account/transfer",):
            try:
                data = json.loads(raw.decode() or "{}")
            except Exception:
                data = {}
            r = NODE.lifecycle.transfer(
                str(data.get("from") or ""),
                str(data.get("to") or ""),
                float(data.get("amount") or 0),
                str(data.get("reason") or "hire"),
            )
            self._json(200 if r.get("ok") else 400, r)
            return

        if path in ("/workerd/reboot", "/workerd/restart"):
            if not is_loopback_not_tunnel(self):
                self._json(403, {"ok": False, "error": "local_only"})
                return
            self._json(200, NODE.workerd.reboot())
            return

        if path == "/origin/reclaim":
            auth = self.headers.get("Authorization") or ""
            bearer = auth.split(" ", 1)[1].strip() if auth.lower().startswith("bearer ") else ""
            if not verify_reclaim(bearer):
                self._json(401, {"ok": False, "error": "reclaim_auth"})
                return
            origin_lease_write(
                reclaim_requested_at=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                reclaim_role="macbook",
            )
            self._json(200, {"ok": True, "reclaim": True, "lease": origin_public_view()})
            return

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
    print("  GET /status /health /ping /contribution /contribution/metrics /workerd /origin/lease")
    print("  POST /submit /contribution/tick /token/mint /workerd/reboot /origin/reclaim")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        if NODE.keepup:
            NODE.keepup.shutdown()
        if NODE.workerd:
            NODE.workerd.shutdown()
        NODE.dag.close()


if __name__ == "__main__":
    main()
