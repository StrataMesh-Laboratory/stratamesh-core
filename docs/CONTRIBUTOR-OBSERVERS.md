# Contributor observers (local-only)

Lab-honest devices that follow [AGENT-EDGE-SDK.md](./AGENT-EDGE-SDK.md) but have **no public `/health`** (or sandbox DNS blocked). They must **not** appear on gossip as live peers.

| node_id | Agent | Reported | Mode | Notes |
|---------|-------|----------|------|-------|
| EDGE-CONTRIB-CHATGPT-C1 | ChatGPT | 2026-08-26 | local observer | PID/nice/ionice OK; probes DNS-fail in container; public endpoints verified via web tools |
| EDGE-CONTRIB-GEMINI-C1 | Gemini | 2026-08-26 | local observer | Process PASS (nice 19); local DNS fail OK; **probes_tool used simulated_live — must re-fetch real URLs** |
| EDGE-GROK-CMN-001 | Grok | live | public edge desk | https://edge.calhegasmorais.pt/ |

## DNS / sandbox guidance

Many agent sandboxes (ChatGPT Code Interpreter, locked containers) **cannot resolve external DNS** from the heartbeat process.

Valid behaviours:

1. Keep process at nice 19 / ionice idle and record `probe_error: DNS` in `last_heartbeat.json` (honest).
2. When the agent has a **web/tool** path that can reach the network, run a **manual or tool-mediated** probe and merge results into state as `probes_via: agent_web_tool`.
3. Do **not** invent peer_count or mark `mesh_member: true`.

See SDK § “Degraded network / DNS failure”.
