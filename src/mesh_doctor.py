#!/usr/bin/env python3
"""
StrataMesh Doctor — full-stack lab exercise
===========================================
Runs a temporary PersistentFogNode path without binding a port.
"""

from __future__ import annotations
import json
import tempfile
import os


def run() -> dict:
    from node_persistent import PersistentFogNode

    db = tempfile.mktemp(suffix=".db")
    n = PersistentFogNode(node_id="FOG-NODE-PT-CM-001", db_path=db)
    report = {"steps": []}

    def step(name, result):
        report["steps"].append({"name": name, "result": result})
        print(f"✓ {name}: {result if not isinstance(result, dict) else list(result.keys())}")

    step("submit", n.submit("lightweight", "bafy-doctor-1"))
    step("spa", n.register_spa(["fog", "pinner"]))
    step("mint_poc", n.mint_poc())
    step("agora_sell", n.agora_place("sell", 0.05, 1.0))
    step("nft", n.nft_mint("bafy-doctor-nft", "Doctor NFT"))
    step("gov", n.gov_propose("Doctor proposal", "mesh doctor run"))
    pid = list(n.gov.proposals.keys())[0]
    n.gov.vote(pid, "EDGE-WITNESS", "yes", 1.0)
    step("gov_vote", n.gov_vote(pid, "yes", 1.0))
    step("sandbox", n.sandbox_create("bafy-doctor-ugc", "tile"))
    iid = list(n.sandbox.items.keys())[0]
    step("sandbox_pub", n.sandbox_publish(iid, as_nft=False))
    step("acb", n.acb_register("Doctor-ACB", ["compute"]))
    aid = list(n.acbs.acbs.keys())[0]
    step("acb_hb", n.acb_heartbeat(aid, earn=0.5))  # auto_meter

    # B1 dual agora needs SVC + STRATA
    step("svc_credit", {"buyer_svc": n.svc.credit("BUYER", 20.0)})
    if n.token.balance(n.node_id) >= 0.05:
        step("agora_sell", n.agora_place("sell", 0.05, 1.5))
        try:
            # external buyer places buy → dual settlement
            n.agora.place("BUYER", "buy", 0.05, 1.5)
            step("agora_buy_match", {"settlements": len(n.agora.settlement_log), "book": n.agora.book()})
        except Exception as e:
            step("agora_buy_match", {"error": str(e)})

    # B2 finality modules
    from finality import tip_set_report
    tips = tip_set_report(n.dag, limit=8)
    step("finality_modules", n.finality_engine.run(n.dag, tips))

    # PQ
    k = n.pq.generate(n.node_id, "Kyber768-lab")
    sig = n.pq.lab_sign(k.key_id, "mesh-doctor")
    step("pq_key", {"key_id": k.key_id, "alg": k.algorithm, "lab_sig_ok": n.pq.lab_verify(k.key_id, "mesh-doctor", sig["lab_sig"])})

    st = n.status()
    report["status_summary"] = {
        "phase": st.get("phase"),
        "dag": st.get("dag"),
        "spa": st.get("spa"),
        "token": st.get("token"),
        "nfts": st.get("nfts", {}).get("total"),
        "governance": st.get("governance", {}).get("total"),
        "sandbox": st.get("sandbox", {}).get("total"),
        "acbs": st.get("acbs", {}).get("total"),
        "contribution": st.get("contribution", {}).get("total_minted"),
        "service_credit": st.get("service_credit"),
        "pq_keys": (st.get("pq_keys") or {}).get("total"),
        "release": "v0.2.1-lab",
    }
    n.dag.close()
    try:
        os.remove(db)
    except OSError:
        pass
    print(json.dumps(report["status_summary"], indent=2))
    print("mesh_doctor OK")
    return report


if __name__ == "__main__":
    run()
