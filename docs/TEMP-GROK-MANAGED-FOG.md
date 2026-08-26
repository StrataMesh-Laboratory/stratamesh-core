# Temporary Grok-managed Fog (Oracle pending)

While Oracle Always Free tenancy recovery is blocked (password / iCloud reset email), the **public status pulse** can be refreshed from a lab session:

As of 2026-08-26, `fog.calhegasmorais.pt` has no DNS record; the public pulse is Workers aggregation until tenancy + tunnel.


1. Run Fog on any available host (sandbox, PC, later Oracle VM)
2. `POST` status to `https://stratamesh-status.stratamesh.workers.dev/ingest`
3. Public view: https://stratamesh-status.stratamesh.workers.dev/status and `/live`

**Limits:** A Grok sandbox process is **not** 24/7. When the session ends, only the **last published snapshot** remains in Worker KV until the next ingest.

**Operator:** André Manuel Calhegas Morais  
**Node id:** FOG-NODE-PT-CM-001  
**Marker:** `version: 0.2.1-lab-temp` · `source: Grok managed temporary Fog…`

## Refresh from PC (recommended while waiting)
```bash
cd stratamesh-core/src
python3 node_persistent.py --port 8787 --db ~/stratamesh-fog.db --id FOG-NODE-PT-CM-001 &
# other terminal:
STATUS_TOKEN=… python3 publish_status.py --url http://127.0.0.1:8787/status
# or loop:
./scripts/publish_loop.sh
```

When Oracle access returns, switch to `docs/HYBRID-ORACLE-CF-TUNNEL.md` and clear the `temp` markers on next publish.
