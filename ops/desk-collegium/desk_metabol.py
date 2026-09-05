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
        "renewal_note": "100k/day Workers; KV 1000/day; never workers.dev",
        "daily_limit": 100_000,
    },
    "lane-fog-hop": {
        "meter": "mac_mw_ports",
        "renewal": "host_cap",
        "renewal_note": "local :8787–:8792; skip dead hop 8s",
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
    p = _state_path()
    p.parent.mkdir(parents=True, exist_ok=True)
    state["updated"] = _now()
    text = json.dumps(state, indent=2, ensure_ascii=False) + "\n"
    p.write_text(text, encoding="utf-8")
    try:
        (REPO / "ops/desk-collegium/state.json").write_text(text, encoding="utf-8")
    except Exception:
        pass


def feed_append(agent: str, text: str, kind: str = "say") -> None:
    path = FOG / "data/desk-feed.jsonl"
    path.parent.mkdir(parents=True, exist_ok=True)
    rec = {
        "ts": _now(),
        "t": time.strftime("%H:%M:%S"),
        "agent": agent[:32],
        "kind": kind[:16],
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
        "sample_note": "local MW hops; renew=host_cap",
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
    changes = apply_to_members(state, lanes)
    state["lanes"] = lanes
    state["metabol_tick"] = _now()
    mirrored = mirror_open_tasks_to_feed(state)
    save_state(state)
    if changes:
        feed_append("stratagrok", "metabol " + "; ".join(changes), kind="say")
    if mirrored:
        feed_append("stratagrok", f"mirror {mirrored} open tasks → desk-feed", kind="say")
    return {
        "ok": True,
        "lanes": {k: v.get("pace") for k, v in lanes.items()},
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
        print(json.dumps(state.get("lanes") or compute_lanes(state), indent=2))
        return 0
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
