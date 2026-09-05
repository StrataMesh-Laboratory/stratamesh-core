#!/usr/bin/env python3
"""Per-desk-agent metabol_pace from token meters + renewal clocks.

Writes FOG/data/desk-collegium/state.json members[].pace and lanes{}.
Also appends a short DESK feed line when a lane changes pace.
Never prints secrets.
"""
from __future__ import annotations

import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

FOG = Path(os.environ.get("FOG_HOME") or (Path.home() / "StrataMesh/fog"))
REPO = Path(__file__).resolve().parents[2]
LISBON = ZoneInfo("Europe/Lisbon")

# Meter specs: how each desk lane renews / what burns it
LANE_SPECS = {
    "lane-bot": {
        "meter": "grok-bot-included",
        "renewal": "weekly_unknown",
        "renewal_note": "SuperGrok does not refill bot-included; HOLD if remaining unknown; bot_cap_contingency: non-lead lanes keep working",
        "daily_limit": None,
    },
    "lane-assistant": {
        "meter": "grok-assistant_pool_frac",
        "renewal": "supergrok_weekly",
        "renewal_note": "weekly pool_frac; reset Europe/Lisbon per grok.com Usage",
        "daily_limit": 1.0,
    },
    "lane-hermes": {
        "meter": "ollama_context",
        "renewal": "host_cap",
        "renewal_note": "no CF daily clock; need context≥65536; host RAM/CPU",
        "context_min": 65536,
    },
    "lane-opencode": {
        "meter": "ollama_plus_github",
        "renewal": "github_hour_utc",
        "renewal_note": "GitHub REST 5000/hour rolling; Ollama host_cap",
        "github_hour_cap": 5000,
    },
    "lane-openclaw": {
        "meter": "ollama_session_tokens",
        "renewal": "session_or_model_reload",
        "renewal_note": "session context window (e.g. 33k on llava); reload clears",
    },
    "lane-cf": {
        "meter": "cf_worker_req",
        "renewal": "00:00_UTC",
        "renewal_note": "100k/day Workers decide HOLD/STASIS; KV 1000 writes/day; Pages HTML outside bucket; never workers.dev; auth never 503 on STASIS",
        "daily_limit": 100_000,
    },
    "lane-fog-hop": {
        "meter": "mac_mw_ports",
        "renewal": "host_cap",
        "renewal_note": "local Fog :8787 workerd :8788; MW python:8790 node:8791 deno:8792 mutual fallback; host_cap; skip dead hop 8s",
    },
}


# Platform typology: renewal / quota / burn_rate or host_cap (metabol_pace=true)
# Usage notes drive handlers — HOLD/STASIS = pace (skip/slow), not freeze.
# Auth on CF Workers must never 503 when STASIS (Retry-After / contingency hop).
PLATFORM_SPECS = {
    "cf-workers": {
        "renewal": "00:00_UTC",
        "quota": 100_000,
        "unit": "req/day",
        "burn_rate": "decide_frac + hourly pressure (HOLD≥1.25×, STASIS≥2× unadj hourly)",
        "usage": "Worker invocations; never workers.dev; auth must not 503 when STASIS",
        "lane": "lane-cf",
        "auth_never_503": True,
    },
    "cf-kv": {
        "renewal": "00:00_UTC",
        "quota": 1000,
        "unit": "writes/day",
        "burn_rate": "pace writes; debt stretches interval",
        "usage": "KV writes only (reads 100k/day separate); share day UTC with Workers clock",
        "lane": "lane-cf",
    },
    "cf-pages-html": {
        "renewal": "none",
        "quota": None,
        "unit": None,
        "burn_rate": "outside Worker 100k bucket",
        "usage": "static Pages HTML free; Functions share cf-workers pool — not this rail",
        "pace_default": "ALLOW",
        "outside_worker_bucket": True,
    },
    "local-mw": {
        "renewal": "host_cap",
        "quota": None,
        "unit": "host RAM/CPU",
        "burn_rate": "host_cap only",
        "usage": "python :8790, node :8791, deno :8792; mutual fallback; skip dead hop 8s",
        "ports": {"8790": "python", "8791": "node", "8792": "deno"},
        "mutual_fallback": True,
        "lane": "lane-fog-hop",
    },
    "fog-kernel": {
        "renewal": "host_cap",
        "quota": None,
        "unit": "host RAM/CPU",
        "burn_rate": "host_cap only",
        "usage": "Fog kernel :8787 + workerd :8788; primary continuous Fog",
        "ports": {"8787": "fog", "8788": "workerd"},
        "lane": "lane-fog-hop",
    },
    "desk-agents": {
        "renewal": "per_lane",
        "quota": None,
        "unit": "tokens/renewal clocks",
        "burn_rate": "lane decide via desk_metabol LANE_SPECS",
        "usage": "Hermes/OpenClaw/OpenCode/Fog/EDGE token+renewal lanes; bot_cap_contingency",
        "lanes": [
            "lane-hermes",
            "lane-openclaw",
            "lane-opencode",
            "lane-assistant",
            "lane-bot",
        ],
    },
    "academy-exams": {
        "renewal": "daily_lisbon",
        "quota": 1,
        "unit": "exam_run/day",
        "burn_rate": "once/day when due",
        "usage": "LaunchAgent + academy_teach_tick; bot_required=false; Mac Fog primary",
        "bot_required": False,
        "lane": "lane-hermes",
    },
    "tailscale": {
        "renewal": "trial_or_personal",
        "quota": None,
        "unit": "trial days / seats",
        "burn_rate": "metabol-paced; HOLD paid seats",
        "usage": "trial notes; no default-route/exit-node on box; no MagicDNS steal",
        "no_default_route": True,
        "no_exit_node": True,
        "docs": "docs/ops/TAILSCALE-METABOL.md",
    },
    "deno-deploy-free": {
        "renewal": "vendor_free",
        "quota": None,
        "unit": None,
        "burn_rate": "ALLOW fallback only — never primary burn rail",
        "usage": "ALLOW fallback only when MW/Fog contingency needs Deno Deploy Free",
        "pace_default": "ALLOW",
        "fallback_only": True,
    },
    "fund-origin-put": {
        "renewal": "00:00_UTC",
        "quota": None,
        "unit": "CF Worker PUTs / origin archive",
        "burn_rate": "gated by cf-workers (+ cf-kv if write); Pages HTML outside bucket",
        "usage": "fund worker + origin PUT respect metabol if gated; HTML/Pages always ALLOW",
        "lane": "lane-cf",
        "pages_always_allow": True,
    },
}


def _now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S%z")


def _state_path() -> Path:
    fog_p = FOG / "data/desk-collegium/state.json"
    repo_p = REPO / "ops/desk-collegium/state.json"
    if fog_p.is_file() or os.environ.get("FOG_HOME") or FOG.exists():
        fog_p.parent.mkdir(parents=True, exist_ok=True)
        if not fog_p.is_file() and repo_p.is_file():
            fog_p.write_text(repo_p.read_text(encoding="utf-8"), encoding="utf-8")
        return fog_p if fog_p.is_file() or True else repo_p
    return repo_p


def load_state() -> dict:
    p = _state_path()
    if p.is_file():
        return json.loads(p.read_text(encoding="utf-8"))
    return {"schema": "desk.collegium.state.v1", "members": [], "open_tasks": []}


def save_state(state: dict) -> None:
    """Write FOG_HOME state only — never mirror live dumps into the git tree."""
    fog_p = FOG / "data/desk-collegium/state.json"
    fog_p.parent.mkdir(parents=True, exist_ok=True)
    state["updated"] = _now()
    text = json.dumps(state, indent=2, ensure_ascii=False) + "\n"
    fog_p.write_text(text, encoding="utf-8")
    # Tests set FOG_HOME to a temp dir; also honor _state_path when it differs.
    p = _state_path()
    if p.resolve() != fog_p.resolve():
        try:
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(text, encoding="utf-8")
        except Exception:
            pass


def feed_append(agent: str, text: str, kind: str = "act") -> None:
    """Delegate to desk_feed (verbs + dedupe). kind=say coerced to act."""
    try:
        import importlib.util
        fp = Path(__file__).resolve().parent / "desk_feed.py"
        spec = importlib.util.spec_from_file_location("desk_feed", fp)
        mod = importlib.util.module_from_spec(spec)
        assert spec.loader is not None
        spec.loader.exec_module(mod)
        mod.append(agent, text, kind=kind, specialty="lead", fog=FOG)
        return
    except Exception:
        pass
    path = FOG / "data/desk-feed.jsonl"
    path.parent.mkdir(parents=True, exist_ok=True)
    k = "act" if (kind or "") in ("say", "", None) else kind
    rec = {
        "ts": _now(),
        "t": time.strftime("%H:%M:%S"),
        "agent": agent[:32],
        "kind": (k or "act")[:16],
        "specialty": "lead",
        "text": text[:240],
    }
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")


def hours_until_utc_midnight() -> float:
    from datetime import timedelta
    now = datetime.now(timezone.utc)
    tomorrow = now.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
    return max((tomorrow - now).total_seconds() / 3600.0, 1 / 60)


def read_openclaw_sample() -> dict:
    """Optional FOG/data/desk-meters/openclaw.json written by claw or operator."""
    p = FOG / "data/desk-meters/openclaw.json"
    if p.is_file():
        try:
            return json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            pass
    # default from last known UI sample shape
    return {}


def read_hermes_sample() -> dict:
    p = FOG / "data/desk-meters/hermes.json"
    if p.is_file():
        try:
            return json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


def read_bot_sample() -> dict:
    p = FOG / "data/desk-meters/bot.json"
    if p.is_file():
        try:
            return json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {"unknown_remaining": True}


def read_assistant_sample() -> dict:
    p = FOG / "data/desk-meters/assistant.json"
    if p.is_file():
        try:
            return json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


def read_cf_sample() -> dict:
    p = FOG / "data/desk-meters/cf.json"
    if p.is_file():
        try:
            return json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


def decide_frac(used: float, limit: float) -> str:
    if limit <= 0:
        return "ALLOW"
    frac = used / limit
    if frac >= 0.95:
        return "STASIS"
    if frac >= 0.80:
        return "HOLD"
    return "ALLOW"



def read_kv_sample() -> dict:
    p = FOG / "data/desk-meters/cf-kv.json"
    if p.is_file():
        try:
            return json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


def read_tailscale_sample() -> dict:
    for name in ("tailscale.json", "tailscale-taper.json"):
        p = FOG / "data/desk-meters" / name
        if p.is_file():
            try:
                return json.loads(p.read_text(encoding="utf-8"))
            except Exception:
                pass
    return {}


def read_mw_sample() -> dict:
    p = FOG / "data/desk-meters/local-mw.json"
    if p.is_file():
        try:
            return json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


def platform_pace(platforms: dict, name: str) -> str:
    return str(((platforms or {}).get(name) or {}).get("pace") or "ALLOW")


def platform_allows(
    platforms: dict,
    name: str,
    *,
    action: str | None = None,
) -> tuple[bool, str, dict]:
    """HOLD/STASIS skip or slow per typology.

    Special cases:
    - cf-pages-html / action=pages|html → always ALLOW
    - cf-workers action=auth → ALLOW even in STASIS (never 503; contingency hop)
    - deno-deploy-free → ALLOW only as fallback (action must be fallback|contingency)
    - fund-origin-put action=pages|html → ALLOW; worker/fund gated by cf-workers
    """
    spec = (platforms or {}).get(name) or PLATFORM_SPECS.get(name) or {}
    pace = str(spec.get("pace") or spec.get("pace_default") or "ALLOW")
    act = (action or "").lower()

    if name == "cf-pages-html" or act in ("pages", "html", "static"):
        return True, "ALLOW", {**spec, "pace": "ALLOW", "reason": "outside_worker_bucket"}

    if name == "cf-workers" and act == "auth":
        # STASIS paces Worker spend; auth path must not 503
        return True, pace, {**spec, "pace": pace, "reason": "auth_never_503"}

    if name == "deno-deploy-free":
        if act in ("fallback", "contingency", "allow_fallback"):
            return True, "ALLOW", {**spec, "pace": "ALLOW", "reason": "fallback_only"}
        return False, "HOLD", {**spec, "pace": "HOLD", "reason": "deno_deploy_not_primary"}

    if name == "fund-origin-put":
        if act in ("pages", "html", "static"):
            return True, "ALLOW", {**spec, "pace": "ALLOW", "reason": "pages_always_allow"}
        # worker/fund/origin inherit cf-workers pace when present
        cf = (platforms or {}).get("cf-workers") or {}
        pace = str(cf.get("pace") or pace)
        if pace == "STASIS":
            return False, pace, {**spec, "pace": pace, "reason": "cf_workers_stasis"}
        if pace == "HOLD" and act in ("fund", "fund-worker", "worker_put"):
            return False, pace, {**spec, "pace": pace, "reason": "cf_workers_hold_slow"}
        if pace == "HOLD" and act in ("origin", "origin_put", "cf-put-origin"):
            # HOLD = slow: skip auto origin PUT (operator/force can still call)
            return False, pace, {**spec, "pace": pace, "reason": "cf_workers_hold_slow"}
        return True, pace, {**spec, "pace": pace}

    if pace == "STASIS":
        return False, pace, spec
    if pace == "HOLD":
        # HOLD skips non-lead paced surfaces; host_cap platforms stay ALLOW unless meter says HOLD
        if spec.get("renewal") == "host_cap" and not spec.get("meter_forced_hold"):
            return True, "ALLOW", {**spec, "pace": "ALLOW"}
        return False, pace, spec
    return True, pace, spec


def compute_platforms(lanes: dict) -> dict:
    """Derive platform metabol_pace entries from meters + lane paces."""
    platforms: dict = {}
    cf_lane = (lanes or {}).get("lane-cf") or {}
    cf_pace = str(cf_lane.get("pace") or "ALLOW")
    hrs = hours_until_utc_midnight()

    # 1) CF Workers
    platforms["cf-workers"] = {
        **PLATFORM_SPECS["cf-workers"],
        "pace": cf_pace,
        "hours_until_renewal": hrs,
        "sample_note": cf_lane.get("sample_note")
        or f"renew=00:00_UTC h_left={hrs:.1f}; never workers.dev; auth never 503",
        "computed_at": _now(),
    }

    # 2) CF KV writes
    kv = read_kv_sample()
    kv_lim = float(kv.get("daily_limit") or PLATFORM_SPECS["cf-kv"]["quota"] or 1000)
    if kv.get("writes_used") is not None or kv.get("used") is not None:
        used = float(kv.get("writes_used") if kv.get("writes_used") is not None else kv.get("used") or 0)
        kv_pace = decide_frac(used, kv_lim)
        kv_note = f"writes={int(used)}/{int(kv_lim)} renew=00:00_UTC"
    elif kv.get("remaining") is not None:
        rem = float(kv["remaining"])
        used = kv_lim - rem
        kv_pace = decide_frac(used, kv_lim)
        kv_note = f"remaining={int(rem)}/{int(kv_lim)} renew=00:00_UTC"
    else:
        # inherit Worker day clock conservatively only when CF STASIS; else ALLOW until sampled
        kv_pace = "HOLD" if cf_pace == "STASIS" else "ALLOW"
        kv_note = "no cf-kv sample — write FOG/data/desk-meters/cf-kv.json; quota=1000 writes/day"
    platforms["cf-kv"] = {
        **PLATFORM_SPECS["cf-kv"],
        "pace": kv_pace,
        "hours_until_renewal": hrs,
        "sample_note": kv_note,
        "computed_at": _now(),
    }

    # 3) CF Pages HTML — outside Worker bucket
    platforms["cf-pages-html"] = {
        **PLATFORM_SPECS["cf-pages-html"],
        "pace": "ALLOW",
        "sample_note": "static Pages outside Worker 100k; Functions share cf-workers",
        "computed_at": _now(),
    }

    # 4) Local MW host_cap + mutual fallback
    mw = read_mw_sample()
    hop = (lanes or {}).get("lane-fog-hop") or {}
    mw_pace = str(hop.get("pace") or "ALLOW")
    if mw.get("dead_all"):
        mw_pace = "STASIS"
        mw_note = "all MW ports dead — host_cap exhausted / process down"
    elif mw.get("ports"):
        alive = [p for p, ok in (mw.get("ports") or {}).items() if ok]
        mw_note = f"alive={alive or list((mw.get('ports') or {}).keys())} mutual_fallback renew=host_cap"
    else:
        mw_note = "python:8790 node:8791 deno:8792 mutual fallback; renew=host_cap"
    platforms["local-mw"] = {
        **PLATFORM_SPECS["local-mw"],
        "pace": mw_pace,
        "sample_note": mw_note,
        "computed_at": _now(),
    }

    # 5) Fog kernel / workerd
    platforms["fog-kernel"] = {
        **PLATFORM_SPECS["fog-kernel"],
        "pace": mw_pace if not mw.get("fog_down") else "STASIS",
        "sample_note": "Fog :8787 + workerd :8788 renew=host_cap",
        "computed_at": _now(),
    }

    # 6) Desk agents — summarize lane paces
    agent_paces = {
        k: str(((lanes or {}).get(k) or {}).get("pace") or "ALLOW")
        for k in PLATFORM_SPECS["desk-agents"]["lanes"]
    }
    # worst non-bot pace for summary; bot HOLD must not freeze others
    non_bot = [p for k, p in agent_paces.items() if k != "lane-bot"]
    if "STASIS" in non_bot:
        desk_pace = "STASIS"
    elif "HOLD" in non_bot:
        desk_pace = "HOLD"
    else:
        desk_pace = "ALLOW"
    platforms["desk-agents"] = {
        **PLATFORM_SPECS["desk-agents"],
        "pace": desk_pace,
        "lane_paces": agent_paces,
        "sample_note": "bot_cap_contingency: lane-bot HOLD/STASIS never freezes Hermes/OpenCode/OpenClaw",
        "computed_at": _now(),
    }

    # 7) Academy exams
    platforms["academy-exams"] = {
        **PLATFORM_SPECS["academy-exams"],
        "pace": str(((lanes or {}).get("lane-hermes") or {}).get("pace") or "ALLOW"),
        "bot_required": False,
        "sample_note": "LaunchAgent pt.calhegasmorais.academy-daily-exams + academy_teach_tick; bot_required=false",
        "computed_at": _now(),
    }

    # 8) Tailscale
    ts = read_tailscale_sample()
    if ts.get("pace") in ("ALLOW", "HOLD", "STASIS"):
        ts_pace = str(ts["pace"])
        ts_note = str(ts.get("summary") or ts.get("sample_note") or "meter pace")
    elif ts.get("trial_ended") or ts.get("buy_seats"):
        ts_pace = "STASIS" if ts.get("buy_seats") else "HOLD"
        ts_note = "trial/billing gate — no paid seats; see TAILSCALE-METABOL"
    else:
        ts_pace = "ALLOW"
        ts_note = "metabol-paced trial; no default-route/exit-node on box; docs/ops/TAILSCALE-METABOL.md"
    platforms["tailscale"] = {
        **PLATFORM_SPECS["tailscale"],
        "pace": ts_pace,
        "sample_note": ts_note,
        "computed_at": _now(),
    }

    # 9) Deno Deploy Free — ALLOW fallback only
    platforms["deno-deploy-free"] = {
        **PLATFORM_SPECS["deno-deploy-free"],
        "pace": "ALLOW",
        "sample_note": "ALLOW fallback only — not a primary burn rail",
        "computed_at": _now(),
    }

    # 10) Fund worker / origin PUT
    fund_pace = cf_pace
    if kv_pace == "STASIS" and cf_pace == "ALLOW":
        fund_pace = "HOLD"  # slow KV-touching publishes
    platforms["fund-origin-put"] = {
        **PLATFORM_SPECS["fund-origin-put"],
        "pace": fund_pace,
        "sample_note": f"gated by cf-workers={cf_pace} cf-kv={kv_pace}; Pages HTML always ALLOW",
        "computed_at": _now(),
    }
    return platforms

def compute_lanes(state: dict) -> dict:
    lanes = {}
    # openclaw — session tokens (UI showed 2.1k/33k)
    oc = read_openclaw_sample()
    oc_used = float(oc.get("tokens_used") or oc.get("used") or 0)
    oc_lim = float(oc.get("tokens_limit") or oc.get("limit") or 33000)
    # if no sample, leave ALLOW but annotate
    oc_pace = decide_frac(oc_used, oc_lim) if oc else "ALLOW"
    if not oc:
        oc_pace = "ALLOW"
        oc_note = "no meter sample yet — write FOG/data/desk-meters/openclaw.json"
    else:
        oc_note = f"session {int(oc_used)}/{int(oc_lim)} renew=session_reload"
    lanes["lane-openclaw"] = {
        **LANE_SPECS["lane-openclaw"],
        "pace": oc_pace,
        "tokens_used": oc_used,
        "tokens_limit": oc_lim,
        "remaining_frac": (1 - oc_used / oc_lim) if oc_lim else 1.0,
        "sample_note": oc_note,
        "computed_at": _now(),
    }

    # hermes — context window
    hm = read_hermes_sample()
    ctx = int(hm.get("context_length") or hm.get("context") or 0)
    ctx_min = 65536
    if hm and ctx and ctx < ctx_min:
        hm_pace = "STASIS"
        hm_note = f"context {ctx}<{ctx_min} — agent init blocked (use qwen2.5:7b+)"
    elif hm and ctx:
        used = float(hm.get("tokens_used") or 0)
        hm_pace = decide_frac(used, ctx)
        hm_note = f"context {ctx} used={int(used)} renew=host_cap"
    else:
        hm_pace = "ALLOW"
        hm_note = "no hermes meter — prefer ≥64k model; renew=host_cap"
    lanes["lane-hermes"] = {
        **LANE_SPECS["lane-hermes"],
        "pace": hm_pace,
        "context_length": ctx or None,
        "sample_note": hm_note,
        "computed_at": _now(),
    }

    # opencode — github hour + ollama host
    lanes["lane-opencode"] = {
        **LANE_SPECS["lane-opencode"],
        "pace": "ALLOW",
        "hours_until_github_hour_roll": 1.0,
        "sample_note": "github 5000/hour rolling UTC; Ollama host_cap; renew=github_hour+host",
        "computed_at": _now(),
    }

    # bot
    bot = read_bot_sample()
    if bot.get("unknown_remaining") or bot.get("remaining") is None:
        bot_pace = "HOLD"
        bot_note = "bot-included remaining unknown — HOLD (bot_cap_contingency: Hermes/OpenCode/OpenClaw continue)"
    else:
        rem = float(bot.get("remaining_frac") if bot.get("remaining_frac") is not None else bot.get("remaining") or 0)
        bot_pace = "STASIS" if rem <= 0 else ("HOLD" if rem < 0.15 else "ALLOW")
        bot_note = f"remaining_frac={rem} renew=weekly_unknown"
    lanes["lane-bot"] = {
        **LANE_SPECS["lane-bot"],
        "pace": bot_pace,
        "sample_note": bot_note,
        "computed_at": _now(),
    }

    # assistant
    asst = read_assistant_sample()
    if not asst:
        asst_pace = "ALLOW"
        asst_note = "no assistant sample — gate on pool_frac when known; renew=supergrok_weekly Lisbon"
    else:
        rem = float(asst.get("remaining_frac") if asst.get("remaining_frac") is not None else 1.0)
        asst_pace = "STASIS" if rem <= 0 else ("HOLD" if rem < 0.15 else "ALLOW")
        reset = str(asst.get("reset_iso") or asst.get("renewal") or "supergrok_weekly")
        asst_note = f"remaining_frac={rem} renew={reset}"
    lanes["lane-assistant"] = {
        **LANE_SPECS["lane-assistant"],
        "pace": asst_pace,
        "sample_note": asst_note,
        "hours_until_renewal": asst.get("hours_until_renewal"),
        "computed_at": _now(),
    }

    # cf
    cf = read_cf_sample()
    hrs = hours_until_utc_midnight()
    if cf.get("remaining") is not None:
        rem = float(cf["remaining"])
        lim = float(cf.get("daily_limit") or 100_000)
        used = lim - rem
        cf_pace = decide_frac(used, lim)
        # also hourly pressure
        hourly_cap = rem / hrs
        hour_spent = float(cf.get("hour_spent") or 0)
        if hour_spent >= 2 * hourly_cap:
            cf_pace = "STASIS"
        elif hour_spent >= 1.25 * hourly_cap:
            cf_pace = "HOLD" if cf_pace == "ALLOW" else cf_pace
        cf_note = f"remaining={int(rem)}/{int(lim)} renew=00:00_UTC h_left={hrs:.1f}"
    else:
        cf_pace = "ALLOW"
        cf_note = f"no cf sample — renew=00:00_UTC h_left={hrs:.1f}; never workers.dev"
    lanes["lane-cf"] = {
        **LANE_SPECS["lane-cf"],
        "pace": cf_pace,
        "hours_until_renewal": hrs,
        "sample_note": cf_note,
        "computed_at": _now(),
    }

    lanes["lane-fog-hop"] = {
        **LANE_SPECS["lane-fog-hop"],
        "pace": "ALLOW",
        "sample_note": "Fog:8787 workerd:8788; MW 8790/8791/8792 mutual fallback; renew=host_cap",
        "computed_at": _now(),
    }
    return lanes


def apply_to_members(state: dict, lanes: dict) -> list[str]:
    """Update members[].pace from their lane; return change notes."""
    notes = []
    for m in state.get("members") or []:
        lane = m.get("lane") or ""
        spec = lanes.get(lane) or {}
        new_pace = spec.get("pace") or m.get("pace") or "ALLOW"
        old = m.get("pace")
        m["pace"] = new_pace
        m["meter"] = spec.get("meter")
        m["renewal"] = spec.get("renewal")
        m["lane_note"] = spec.get("sample_note")
        if old and old != new_pace:
            notes.append(f"{lane} {old}→{new_pace}")
    return notes


def mirror_open_tasks_to_feed(state: dict) -> int:
    """Ensure each open task has a recent feed line (DESK chat)."""
    path = FOG / "data/desk-feed.jsonl"
    path.parent.mkdir(parents=True, exist_ok=True)
    existing = ""
    if path.is_file():
        existing = path.read_text(encoding="utf-8", errors="replace")[-120_000:]
    n = 0
    for t in state.get("open_tasks") or []:
        tid = str(t.get("id") or "")
        if not tid:
            continue
        needle = tid
        if needle in existing:
            continue
        owner = str(t.get("owner") or "desk")
        agent = "hermes"
        if "opencode" in owner:
            agent = "opencode"
        elif "openclaw" in owner:
            agent = "openclaw"
        elif "grok" in owner:
            agent = "stratagrok"
        text = f"{t.get('status')} {tid}: {t.get('intent')}"
        feed_append(agent, text, kind=str(t.get("status") or "propose"))
        n += 1
        existing += tid
    return n


def tick() -> dict:
    state = load_state()
    lanes = compute_lanes(state)
    platforms = compute_platforms(lanes)
    changes = apply_to_members(state, lanes)
    state["lanes"] = lanes
    state["platforms"] = platforms
    state["metabol_pace"] = True
    state["metabol_tick"] = _now()
    mirrored = mirror_open_tasks_to_feed(state)
    save_state(state)
    if changes:
        feed_append("stratagrok", "metabol " + "; ".join(changes), kind="revise")
    if mirrored:
        feed_append("stratagrok", f"mirror {mirrored} open tasks → desk-feed", kind="act")
    return {
        "ok": True,
        "lanes": {k: v.get("pace") for k, v in lanes.items()},
        "platforms": {k: v.get("pace") for k, v in platforms.items()},
        "changes": changes,
        "mirrored": mirrored,
    }


def main() -> int:
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("cmd", choices=["tick", "show", "mirror"])
    args = p.parse_args()
    if args.cmd == "tick":
        print(json.dumps(tick(), indent=2))
        return 0
    if args.cmd == "mirror":
        state = load_state()
        n = mirror_open_tasks_to_feed(state)
        print(json.dumps({"mirrored": n}))
        return 0
    if args.cmd == "show":
        state = load_state()
        lanes = state.get("lanes") or compute_lanes(state)
        platforms = state.get("platforms") or compute_platforms(lanes)
        print(json.dumps({"lanes": lanes, "platforms": platforms, "metabol_pace": True}, indent=2))
        return 0
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
