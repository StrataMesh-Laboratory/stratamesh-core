#!/usr/bin/env python3
"""Olissippo Phase 3 — LLM-advisory decide → server validate → execute.

ACB ≠ NFT: Boutius remains Subject.kind=acb. The model may only propose
finite JSON actions; the world engine accepts or rejects them.
Ollama is optional — CI uses a mock decider; Mac may call localhost:11434.
"""
from __future__ import annotations

import json
import re
import urllib.error
import urllib.request
from copy import deepcopy
from typing import Any, Callable

import olissippo_boutius as bb
import olissippo_world as ow

DecideFn = Callable[[dict[str, Any], dict[str, Any]], dict[str, Any]]


def perception(state: dict[str, Any]) -> dict[str, Any]:
    loc = state["location_id"]
    return {
        "location_id": loc,
        "objects_here": [
            {"object_id": o["object_id"], "name": o.get("name"), "qty": o.get("qty")}
            for o in ow.objects_at(loc)
        ],
        "numina_here": [n["numen_id"] for n in ow.numen_at(loc)],
        "charcoal_held": state.get("charcoal_held", 0),
        "spear_progress": state.get("spear_progress", 0),
        "minute": state.get("minute", 0),
        "day": state.get("day", 1),
        "activity_hint": bb.activity_at(int(state.get("minute", 0)))[0],
    }


def build_prompt(persona: dict[str, Any], state: dict[str, Any], perc: dict[str, Any]) -> str:
    world = ow.load_world()
    verbs = list(world.get("actions_mundane", [])) + list(world.get("actions_magic", []))
    return (
        "You are {name}, an ACB Subject (not an NFT, not an Object) in Olissippo.\n"
        "Return ONLY JSON: {{\"intention\": str, \"action\": {{\"type\": str, ...}}, \"speech\": str|null}}\n"
        "Allowed action types: {verbs}\n"
        "PERSONA: {persona}\n"
        "STATE: subject_id={sid} kind=acb location={loc} charcoal_held={ch} spear_progress={sp}\n"
        "PERCEPTION: {perc}\n"
        "Do not invent object_id for yourself. Do not claim actions the server did not allow.\n"
    ).format(
        name=persona.get("display_name", "Boutius"),
        verbs=", ".join(verbs),
        persona=json.dumps({k: persona[k] for k in ("display_name", "role", "primary_goal", "beliefs") if k in persona}),
        sid=state["subject_id"],
        loc=state["location_id"],
        ch=state.get("charcoal_held", 0),
        sp=state.get("spear_progress", 0),
        perc=json.dumps(perc),
    )


def parse_decision(raw: str | dict[str, Any]) -> dict[str, Any]:
    if isinstance(raw, dict):
        data = raw
    else:
        text = str(raw).strip()
        # strip markdown fences if present
        m = re.search(r"\{[\s\S]*\}", text)
        if not m:
            raise ValueError("no_json_object")
        data = json.loads(m.group(0))
    if "action" not in data or not isinstance(data["action"], dict):
        raise ValueError("missing_action")
    if "type" not in data["action"]:
        raise ValueError("missing_action_type")
    return {
        "intention": data.get("intention"),
        "action": data["action"],
        "speech": data.get("speech"),
        "memory": data.get("memory"),
    }


def validate_decision(state: dict[str, Any], decision: dict[str, Any]) -> dict[str, Any]:
    """Server-authoritative gate. Rejects unknown verbs, bad moves, NFT self-claims."""
    bb.assert_subject_not_nft(state)
    act = decision.get("action") or {}
    typ = str(act.get("type") or "")
    if not ow.action_allowed(typ):
        return {"ok": False, "error": "unknown_action", "action": act}
    # forbid model promoting Subject to object/NFT
    for bad in ("object_id", "mint_nft", "become_nft"):
        if bad in act:
            return {"ok": False, "error": "acb_is_not_nft", "action": act}
    if typ == "move":
        dest = act.get("destination") or act.get("to")
        if not dest:
            return {"ok": False, "error": "missing_destination", "action": act}
        check = ow.validate_move(state["location_id"], str(dest))
        if not check.get("ok"):
            return {"ok": False, "error": check.get("error", "bad_move"), "action": act, "check": check}
        return {"ok": True, "action": {"type": "move", "destination": str(dest)}}
    if typ == "buy":
        item = str(act.get("item") or "")
        qty = int(act.get("quantity") or 1)
        if item != "charcoal":
            return {"ok": False, "error": "unsupported_item", "action": act}
        if state["location_id"] != "charcoal_lean":
            return {"ok": False, "error": "not_at_merchant", "action": act}
        if qty < 1 or qty > 10:
            return {"ok": False, "error": "bad_quantity", "action": act}
        return {"ok": True, "action": {"type": "buy", "item": "charcoal", "quantity": qty}}
    if typ == "work":
        if state["location_id"] != "smithy":
            return {"ok": False, "error": "not_at_forge", "action": act}
        if int(state.get("charcoal_held") or 0) <= 0:
            return {"ok": False, "error": "no_charcoal", "action": act}
        return {"ok": True, "action": {"type": "work"}}
    if typ in ("wait", "eat", "sleep", "say", "inspect", "follow", "sell"):
        return {"ok": True, "action": {"type": typ, **{k: act[k] for k in act if k != "type"}}}
    if typ in ("rite_offer", "rite_heal", "rite_dream", "oath_bandua", "consult_omen"):
        # Phase 3: accept verb only at cult locations; effects stubbed
        if not ow.numen_at(state["location_id"]) and typ != "consult_omen":
            return {"ok": False, "error": "no_numen_here", "action": act}
        return {"ok": True, "action": {"type": typ}}
    return {"ok": False, "error": "unhandled_action", "action": act}


def execute_decision(state: dict[str, Any], validated: dict[str, Any], speech: Any = None) -> dict[str, Any]:
    """Apply a validated action to Subject runtime. Never mints NFT / object_id for ACB."""
    s = deepcopy(state)
    bb.assert_subject_not_nft(s)
    act = validated["action"]
    typ = act["type"]
    if typ == "move":
        s["location_id"] = act["destination"]
        s["last_action"] = {"type": "move", "destination": act["destination"], "ok": True, "source": "llm"}
    elif typ == "buy" and act.get("item") == "charcoal":
        q = int(act["quantity"])
        s["charcoal_held"] = min(10, int(s.get("charcoal_held") or 0) + q)
        s["last_action"] = {"type": "buy", "item": "charcoal", "quantity": q, "ok": True, "source": "llm"}
    elif typ == "work":
        s["charcoal_held"] = int(s.get("charcoal_held") or 0) - 1
        s["spear_progress"] = min(12, int(s.get("spear_progress") or 0) + 1)
        s["last_action"] = {"type": "work", "ok": True, "spear_progress": s["spear_progress"], "source": "llm"}
    elif typ == "eat":
        s["hunger"] = max(0.0, float(s.get("hunger") or 0) - 0.3)
        s["last_action"] = {"type": "eat", "ok": True, "source": "llm"}
    elif typ == "sleep":
        s["energy"] = min(1.0, float(s.get("energy") or 0) + 0.2)
        s["last_action"] = {"type": "sleep", "ok": True, "source": "llm"}
    else:
        s["last_action"] = {"type": typ, "ok": True, "source": "llm"}
    if speech:
        s["last_speech"] = str(speech)[:240]
    s["log"] = list(s.get("log") or [])
    s["log"].append({"day": s.get("day"), "minute": s.get("minute"), "action": s["last_action"], "speech": s.get("last_speech")})
    s["log"] = s["log"][-200:]
    # seals
    s["kind"] = "acb"
    s["is_subject"] = True
    s["is_object"] = False
    s["is_nft"] = False
    s.pop("object_id", None)
    return s


def mock_decide(state: dict[str, Any], perc: dict[str, Any]) -> dict[str, Any]:
    """Deterministic stand-in for Ollama — used in CI."""
    hint = perc.get("activity_hint") or "wait"
    loc = state["location_id"]
    if hint == "fetch_charcoal" or (hint == "work" and int(state.get("charcoal_held") or 0) <= 0):
        if loc != "charcoal_lean":
            # one hop toward lean
            path = bb._path(loc, "charcoal_lean") or []
            if path:
                return {
                    "intention": "Obtain charcoal before the forge runs out.",
                    "action": {"type": "move", "destination": path[0]},
                    "speech": None,
                }
        return {
            "intention": "Gather charcoal.",
            "action": {"type": "buy", "item": "charcoal", "quantity": 2},
            "speech": None,
        }
    if hint == "work" and loc == "smithy" and int(state.get("charcoal_held") or 0) > 0:
        return {"intention": "Advance spear order.", "action": {"type": "work"}, "speech": None}
    if hint == "eat":
        if loc != "guest_house":
            path = bb._path(loc, "guest_house") or []
            if path:
                return {"intention": "Eat.", "action": {"type": "move", "destination": path[0]}, "speech": None}
        return {"intention": "Eat.", "action": {"type": "eat"}, "speech": None}
    if hint == "sleep":
        return {"intention": "Rest.", "action": {"type": "sleep"}, "speech": None}
    return {"intention": "Wait.", "action": {"type": "wait"}, "speech": None}


def ollama_decide(
    state: dict[str, Any],
    perc: dict[str, Any],
    *,
    model: str = "llama3.2:1b",
    host: str = "http://127.0.0.1:11434",
    timeout: float = 8.0,
) -> dict[str, Any]:
    persona = bb.load_persona()
    prompt = build_prompt(persona, state, perc)
    body = json.dumps({
        "model": model,
        "prompt": prompt,
        "stream": False,
        "format": "json",
        "options": {"temperature": 0.2, "num_predict": 180},
    }).encode()
    req = urllib.request.Request(
        host.rstrip("/") + "/api/generate",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        payload = json.loads(resp.read().decode())
    return parse_decision(payload.get("response") or "")


def ollama_available(host: str = "http://127.0.0.1:11434", timeout: float = 1.5) -> bool:
    try:
        with urllib.request.urlopen(host.rstrip("/") + "/api/tags", timeout=timeout) as resp:
            return resp.status == 200
    except Exception:
        return False


def cognitive_tick(
    state: dict[str, Any],
    minutes: int = 10,
    *,
    decide: DecideFn | None = None,
    prefer_ollama: bool = False,
) -> dict[str, Any]:
    """Advance time, ask decider, validate, execute — or fall back to Phase 2 routine."""
    s = deepcopy(state)
    bb.assert_subject_not_nft(s)
    # clock
    s["minute"] = (int(s["minute"]) + int(minutes)) % 1440
    if int(state["minute"]) + int(minutes) >= 1440:
        s["day"] = int(s["day"]) + 1

    perc = perception(s)
    decider = decide
    if decider is None and prefer_ollama and ollama_available():
        decider = ollama_decide
    if decider is None:
        decider = mock_decide

    try:
        raw = decider(s, perc)
        decision = parse_decision(raw)
        gate = validate_decision(s, decision)
        if gate.get("ok"):
            return execute_decision(s, gate, speech=decision.get("speech"))
        # rejected — fall back to deterministic Phase 2 tick on a copy of pre-clock state... 
        # Better: apply Phase 2 activity from current s without double-advancing clock.
        s["last_action"] = {"type": "wait", "reason": "llm_rejected", "error": gate.get("error"), "source": "server"}
        s["log"] = list(s.get("log") or [])
        s["log"].append({"day": s.get("day"), "minute": s.get("minute"), "action": s["last_action"]})
        # one deterministic step without another clock bump: reuse boutius helpers
        want_act, want_loc = bb.activity_at(int(s["minute"]))
        if int(s.get("charcoal_held") or 0) <= 0 and want_act == "work":
            want_act, want_loc = "fetch_charcoal", "charcoal_lean"
        if s["location_id"] != want_loc:
            path = bb._path(s["location_id"], want_loc) or []
            if path:
                check = ow.validate_move(s["location_id"], path[0])
                if check.get("ok"):
                    s["location_id"] = path[0]
                    s["last_action"] = {"type": "move", "destination": path[0], "ok": True, "source": "fallback"}
                    if path[0] == want_loc:
                        s = bb._apply_activity(s, want_act)
                        s["last_action"]["source"] = "fallback"
        else:
            s = bb._apply_activity(s, want_act)
            if isinstance(s.get("last_action"), dict):
                s["last_action"]["source"] = "fallback"
        s["log"].append({"day": s.get("day"), "minute": s.get("minute"), "action": s["last_action"]})
        s["log"] = s["log"][-200:]
        return s
    except Exception as e:
        # hard fail → Phase 2 full tick (re-clock carefully: bb.tick also advances clock)
        # Undo our clock bump by calling tick on original state
        out = bb.tick(state, minutes)
        out["last_action"] = {
            **(out.get("last_action") or {}),
            "source": "fallback_exception",
            "error": type(e).__name__,
        }
        return out
