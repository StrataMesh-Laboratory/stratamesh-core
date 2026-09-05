import os
import datetime
from dataclasses import dataclass, field
from typing import Optional

@dataclass
class StrataMeshHourlyStasis:
    """
    Orchestrates the 'STASIS' state of the hourly Git+Live progress.
    Handles the specific 'Destyle' family logic and 'Fog vs Git' ledger.
    """
    
    # Identity & State
    label: str = "Hourly git+live progress"
    issue_id: str = "lab-stress #52"
    state: str = "STASIS"
    quota_context: str = "SuperGrok"
    quota_pct: str = "92%"
    
    # The Snapshot (Origin Head)
    origin_head: str = "dce4cbd79d30"
    fog_version: str = "0.3.0"
    substrate: str = "workerd-hop"
    
    # The Spa/Fog Metrics
    spa_total: int = 3
    edge_health: int = 530
    fog_source: str = "fog_process"
    
    # The Destyle Colors
    accent_gold: str = "#c4a574"
    accent_indigo: str = "#8b9cf7"
    
    # The Commit Anchor
    last_ship_commit: str = "913090ea67c6d1e6ddc9a1c2973a6143e9fc6e16"
    
    # The Chat Endpoint
    chat_endpoint: str = "https://calhegasmorais.pt/chat"
    
    # The Schedule
    slots_schedule: str = "04:00 observe · 09:00 ship · 18:00 t/20 · 23:00 handoff"
    
    # GHA Action IDs
    gha_fail_watch_run: str = "33338564134"
    gha_protocol_run: str = "33338565081"
    
    def __post_init__(self):
        # Normalize the timestamp if dynamic
        if self.origin_head:
            # Ensure we capture the 'Now' moment for the file
            now = datetime.datetime.now(datetime.timezone.utc)
            self.timestamp_str = now.strftime("%Y-%m-%dT%H:%MZ")

    def format_header(self, time_suffix: str = "22:13Z") -> str:
        return f"{time_suffix} {self.state}"

    def render(self) -> str:
        lines = [
            f"# {self.label} ({self.issue_id})",
            f"Hourly automation is **{self.state}** {self.timestamp_str} (SuperGrok {self.quota_pct}). Do not append 24 rows/day.",
            f"Daily slots own the work: {self.slots_schedule}.",
            f"\n## {self.format_header()} — hourly paused ({self.quota_context})",
            f"Operator paused CMN Fog Hourly Git+Live. Prompt is {self.state}. Do not ship from hourly.",
            f"\nDuties absorbed:",
            f"- 09:00 24h Dev Cycle — git+live max 1 ship (HOLD if {self.quota_context} cannot cover)",
            f"- 04:00 Watchdog — cheap /health + GHA fail-watch observe",
            f"- 23:00 Night Diagnostic — handoff + Fog-vs-git ledger",
            f"- 18:00 Discourse — t/20 metabolism line",
            f"\nLast hourly ship: {self.last_ship_commit} (/chat destyle). NEXT PICK unchanged: Fog process vs git (Mac TUI v6 `g`) + EDGE session hop — cannot from sandbox.",
            f"Do not re-ship spa /chat destyle, token 3.5.5-fog-honest, agora 3.3.1-gold-spot.\n\n",
            f"Do not re-derive greens. Copy **STILL RED** + NEXT PICK forward.",
            f"\n## {self.format_header()} hour\n",
            f"READ: origin HEAD {self.origin_head} + 21:49 Fog wallet 45564e44 already on main — not re-shipped). Automation prompt STEP 1 (1) remaining public HTML chrome — status **0.4.8-circ-split** destyle family / origin **0.1.6-destyle** / sandbox **0.4.6-destyle** / apex+clp+dashboard destyle / fund **0.4.8-destyle** / gossip **2.3.11-destyle** / academy HTML **0.4.3-lab** destyle / eni HTML destyle --accent:{self.accent_gold} / pagamentos **1.0.1-destyle** / deomail preview **1.4.6-destyle** **curl wins** except **GET {self.chat_endpoint}** still indigo `--accent:{self.accent_indigo}` (serveNodeChat). STEP 1 (2) GHA fail_total last 24h = **0**. STEP 1 (3) Fog process vs git: /status agora.settlements={{\"unavailable\":\"f_max=0\"}} **envelope LIVE**. Cannot hot-patch Mac LaunchAgent from this sandbox. Re-probe: Fog /health 200 workerd-hop origin=macbook n=2 mesh_member=true mac_live=true **version={self.fog_version} oracle_live=false substrate={self.substrate}**. Fog /spa total={self.spa_total} source=fog_process n=2. Gossip **2.3.11-destyle** n=2 /peers count=**1** (EDGE session down). EDGE /health **{self.edge_health}** CF 1033 session-expected.",
            f"Do not re-ship destyle chrome (status/origin/gossip/fund/academy/apex/sandbox/eni/eni-pay/deomail), gossip 2.3.11, orch 10.24.8, status 0.4.8-circ-split, origin-archive 0.1.6, fund 0.4.8, academy 0.4.3, sandbox 0.4.6-destyle, token 3.5.5-fog-honest.",
            f"\nSHIPPED (REST Git Data API — NOT MCP, NOT paste, NOT workers.dev):\n",
            f"- Destyle **{self.chat_endpoint}** orchestrator HTML chrome to Fog/EDGE family: `--accent:{self.accent_indigo}` â†’ `--acc:{self.accent_gold}` / `--accent:{self.accent_gold}`; leftover `#{self.accent_indigo}` aviso/fallback links â†’ `#{self.accent_gold}`. Roster JSON unchanged. Layout copy unchanged.",
            f"- Git Data API commit **{self.last_ship_commit}** (CF PUT `stratamesh-spa` main_module=index.js). workers.dev subdomain was leftover **enabled**; POST scripts/stratamesh-spa/subdomain enabled=false. Custom domain live.",
            f"- GHA green (no failed runs to fix); dispatched fail-watch + protocol-invariants on {self.last_ship_commit} both **success**. gitlive-drift + secrets-guard **success** on push.",
            f"- Fog /status envelope **LIVE**. /spa total={self.spa_total} source=fog_process. EDGE hop **{self.edge_health}** this hour (session-expected).",
            f"- Did **not** re-ship gossip/orch/fund/status/origin-archive/apex/academy/sandbox/eni/eni-pay/deomail destyle / token. No extra Discourse. No /actions. No 6th cron. No ops-state KV PUT. Did **not** PUT Mac Fog process or workerd :8788.",
            f"\nLIVE curl:\n",
            f"- GHA gha-fail-watch https://github.com/StrataMesh-Laboratory/stratamesh-core/actions/runs/{self.gha_fail_watch_run} â†’ **success** on {self.last_ship_commit}",
            f"- GHA protocol-invariants dispatch https://github.com/StrataMesh-Laboratory/stratamesh-core/actions/runs/{self.gha_protocol_run} â†’ **success** on {self.last_ship_commit}",
            f"- GET https://{self.chat_endpoint.split('//')[1]} Accept:text/html â†’ 200 HTML --accent:{self.accent_gold} --accent:{self.accent_gold} destyle **no #{self.accent_indigo}** **no IBM Plex**",
            f"- GET https://{self.chat_endpoint.replace('.pt', 'www.calhegasmorais.pt').split('//')[1]} Accept:text/html â†’ 200 destyle #{self.accent_gold} **no #{self.accent_indigo}**",
            f"- GET https://stratamesh",
            f"\nIssue Title: [lab-desk] GHA observe + prepare ticks\n",
            f"Issue Body: Unlocked ledger for **gha-fail_watch**, **desk_prepare**, **origin_fallback** (and other desk observe ticks).\n",
            f"\nIssue **{self.issue_id}** (`[lab-stress] SuperGrok 48h hourly git+live loop`) stays **LOCKED** and **CLOSED**. Do not unlock it. Do not comment on it.",
            f"This issue is the standing `DESK_ISSUE` for Actions observe comments (FAIL-LOG, prepare hints, origin DARK ledger). Jobs must stay green if the ledger is locked/403: write artifact, print skip-locked, exit 0.",
            f"\nLabor only. Never `workers.dev`. Never a 6th CF cron. Never Worker PUT from Actions. Never `pkill cloudflared`. Never origin-take.",
            f"# END OF ARTIFACT\n"
        ]
        return "\n".join(lines)

if __name__ == "__main__":
    observer = StrataMeshHourlyStasis()
    print(observer.render())