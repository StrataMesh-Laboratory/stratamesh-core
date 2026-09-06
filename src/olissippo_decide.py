#!/usr/bin/env python3
"""Olissippo Phase 3 — real decide → validate → execute.

Default: Ollama JSON when :11434 is up; otherwise the real Boutius/role
routine policy (not a test double). Rite effects apply from world.rite_effects.
ACB ≠ NFT throughout.
"""
from __future__ import annotations

import json
import os
import re
import urllib.request
from copy import deepcopy
from typing import Any, Callable

import olissippo_boutius as bb
import olissippo_memory as mem
import olissippo_world as ow

DecideFn = Callable[[dict[str, Any], dict[str, Any]], dict[str, Any]]


def perception(state: dict[str, Any]) -> dict[str, Any]:
    loc = state["location_id"]
    return {
        "location_id": loc,
        "objects_here": [
            {"object_id": o["object_id"], "name": o.get("name"), "qty": o.get("qty"), "template": o.get("template")}
            for o in ow.objects_at(loc)
        ],
        "numina_here": [
            {"numen_id": n["numen_id"], "rites": n.get("rites") or []}
            for n in ow.numen_at(loc)
        ],
        "charcoal_held": state.get("charcoal_held", 0),
        "spear_progress": state.get("spear_progress", 0),
        "status_flags": list(state.get("status_flags") or []),
        "minute": state.get("minute", 0),
        "day": state.get("day", 1),
        "activity_hint": bb.activity_at(int(state.get("minute", 0)))[0],
        "offering_here": any(o.get("template") == "offering" for o in ow.objects_at(loc)),
    }


def build_prompt(persona: dict[str, Any], state: dict[str, Any], perc: dict[str, Any]) -> str:
    world = ow.load_world()
    verbs = list(world.get("actions_mundane", [])) + list(world.get("actions_magic", []))
    return (
        "You are {name}, an ACB Subject (not an NFT, not an Object) in Olissippo lore "
        "(not CMN main sandbox-host). Return ONLY JSON: "
        "{{\"intention\": str, \"action\": {{\"type\": str, ...}}, \"speech\": str|null}}\n"
        "Allowed action types: {verbs}\n"
        "PERSONA: {persona}\n"
        "STATE: subject_id={sid} kind=acb location={loc} charcoal_held={ch} "
        "spear_progress={sp} flags={flags}\n"
        "PERCEPTION: {perc}\n"
        "Do not invent object_id for yourself. Do not claim NFT identity.\n"
    ).format(
        name=persona.get("display_name", "Boutius"),
        verbs=", ".join(verbs),
        persona=json.dumps({k: persona[k] for k in ("display_name", "role", "primary_goal", "beliefs") if k in persona}),
        sid=state["subject_id"],
        loc=state["location_id"],
        ch=state.get("charcoal_held", 0),
        sp=state.get("spear_progress", 0),
        flags=state.get("status_flags") or [],
        perc=json.dumps(perc),
    )


def parse_decision(raw: str | dict[str, Any]) -> dict[str, Any]:
    if isinstance(raw, dict):
        data = raw
    else:
        text = str(raw).strip()
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


def _rite_allowed_here(typ: str, location_id: str) -> dict[str, Any]:
    if typ == "consult_omen":
        return {"ok": True, "numen_id": None}
    for n in ow.numen_at(location_id):
        if typ in (n.get("rites") or []):
            return {"ok": True, "numen_id": n["numen_id"]}
    return {"ok": False, "error": "rite_not_at_location"}


def validate_decision(state: dict[str, Any], decision: dict[str, Any]) -> dict[str, Any]:
    bb.assert_subject_not_nft(state)
    act = decision.get("action") or {}
    typ = str(act.get("type") or "")
    if not ow.action_allowed(typ):
        return {"ok": False, "error": "unknown_action", "action": act}
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

    if typ == "sell":
        item = str(act.get("item") or "")
        qty = int(act.get("quantity") or 1)
        if item != "charcoal":
            return {"ok": False, "error": "unsupported_item", "action": act}
        if int(state.get("charcoal_held") or 0) < qty:
            return {"ok": False, "error": "insufficient_charcoal", "action": act}
        if state["location_id"] not in ("market", "smithy", "charcoal_lean"):
            return {"ok": False, "error": "cannot_sell_here", "action": act}
        return {"ok": True, "action": {"type": "sell", "item": "charcoal", "quantity": qty}}

    if typ == "work":
        if state["location_id"] != "smithy":
            return {"ok": False, "error": "not_at_forge", "action": act}
        if int(state.get("charcoal_held") or 0) <= 0:
            return {"ok": False, "error": "no_charcoal", "action": act}
        return {"ok": True, "action": {"type": "work"}}

    if typ in ("wait", "eat", "sleep", "say", "inspect", "follow"):
        return {"ok": True, "action": {"type": typ, **{k: act[k] for k in act if k != "type"}}}

    if typ in ("rite_offer", "rite_heal", "rite_dream", "oath_bandua", "consult_omen"):
        gate = _rite_allowed_here(typ, state["location_id"])
        if not gate.get("ok"):
            return {"ok": False, "error": gate.get("error", "rite_blocked"), "action": act}
        effects = (ow.load_world().get("rite_effects") or {}).get(typ) or {}
        if effects.get("requires_object_template") == "offering":
            if not any(o.get("template") == "offering" for o in ow.objects_at(state["location_id"])):
                if "offering_held" not in (state.get("status_flags") or []) and not state.get("offering_held"):
                    return {"ok": False, "error": "no_offering_object", "action": act}
        need = effects.get("requires_numen")
        if need and gate.get("numen_id") and gate["numen_id"] != need:
            # also accept if any numen at loc matches need
            if not any(n["numen_id"] == need for n in ow.numen_at(state["location_id"])):
                return {"ok": False, "error": "wrong_numen", "action": act}
        return {"ok": True, "action": {"type": typ}, "numen_id": gate.get("numen_id"), "effects": effects}

    return {"ok": False, "error": "unhandled_action", "action": act}


def _apply_flags(s: dict[str, Any], effects: dict[str, Any]) -> None:
    flags = set(s.get("status_flags") or [])
    for f in effects.get("clears_flags") or []:
        flags.discard(f)
    for f in effects.get("sets_flags") or []:
        flags.add(f)
    s["status_flags"] = sorted(flags)
    if "energy_delta" in effects:
        s["energy"] = max(0.0, min(1.0, float(s.get("energy") or 0) + float(effects["energy_delta"])))
    if "hunger_delta" in effects:
        s["hunger"] = max(0.0, min(1.0, float(s.get("hunger") or 0) + float(effects["hunger_delta"])))


def execute_decision(state: dict[str, Any], validated: dict[str, Any], speech: Any = None) -> dict[str, Any]:
    s = deepcopy(state)
    bb.assert_subject_not_nft(s)
    if "status_flags" not in s:
        s["status_flags"] = []
    act = validated["action"]
    typ = act["type"]
    source = "policy"

    if typ == "move":
        s["location_id"] = act["destination"]
        s["last_action"] = {"type": "move", "destination": act["destination"], "ok": True, "source": source}
    elif typ == "buy" and act.get("item") == "charcoal":
        q = int(act["quantity"])
        s["charcoal_held"] = min(10, int(s.get("charcoal_held") or 0) + q)
        s["last_action"] = {"type": "buy", "item": "charcoal", "quantity": q, "ok": True, "source": source}
    elif typ == "sell" and act.get("item") == "charcoal":
        q = int(act["quantity"])
        s["charcoal_held"] = max(0, int(s.get("charcoal_held") or 0) - q)
        s["last_action"] = {"type": "sell", "item": "charcoal", "quantity": q, "ok": True, "source": source}
    elif typ == "work":
        s["charcoal_held"] = int(s.get("charcoal_held") or 0) - 1
        s["spear_progress"] = min(12, int(s.get("spear_progress") or 0) + 1)
        s["last_action"] = {"type": "work", "ok": True, "spear_progress": s["spear_progress"], "source": source}
    elif typ == "eat":
        s["hunger"] = max(0.0, float(s.get("hunger") or 0) - 0.3)
        s["last_action"] = {"type": "eat", "ok": True, "source": source}
    elif typ == "sleep":
        s["energy"] = min(1.0, float(s.get("energy") or 0) + 0.2)
        s["last_action"] = {"type": "sleep", "ok": True, "source": source}
    elif typ in ("rite_offer", "rite_heal", "rite_dream", "oath_bandua", "consult_omen"):
        effects = validated.get("effects") or (ow.load_world().get("rite_effects") or {}).get(typ) or {}
        _apply_flags(s, effects)
        s["last_action"] = {
            "type": typ,
            "ok": True,
            "source": source,
            "numen_id": validated.get("numen_id"),
            "flags": list(s["status_flags"]),
            "energy": s.get("energy"),
        }
    else:
        s["last_action"] = {"type": typ, "ok": True, "source": source}

    if speech:
        s["last_speech"] = str(speech)[:240]
    s["log"] = list(s.get("log") or [])
    s["log"].append({"day": s.get("day"), "minute": s.get("minute"), "action": s["last_action"], "speech": s.get("last_speech")})
    s["log"] = s["log"][-200:]
    s["kind"] = "acb"
    s["is_subject"] = True
    s["is_object"] = False
    s["is_nft"] = False
    s.pop("object_id", None)
    return s


def routine_decide(state: dict[str, Any], perc: dict[str, Any]) -> dict[str, Any]:
    """Real deterministic Boutius/role policy expressed as JSON decisions (production fallback)."""
    hint = perc.get("activity_hint") or "wait"
    loc = state["location_id"]
    flags = set(state.get("status_flags") or [])

    # Real rite when at grove with offering and wounded/taboo
    if loc in ("sacred_grove", "shrine_niche") and perc.get("offering_here"):
        if "taboo_breach" in flags or "wounded" in flags:
            return {"intention": "Seek Endovelicus.", "action": {"type": "rite_heal" if "wounded" in flags else "rite_offer"}, "speech": None}
        if "endovelicus_favour" not in flags and hint in ("sleep", "close_shop"):
            return {"intention": "Leave an offering.", "action": {"type": "rite_offer"}, "speech": None}
    if loc in ("wall_watch", "hill_enclosure") and "bandua_oath" not in flags and hint in ("socialize", "close_shop"):
        if any(n.get("numen_id") == "bandua" for n in perc.get("numina_here") or []):
            return {"intention": "Swear the watch oath.", "action": {"type": "oath_bandua"}, "speech": None}

    if hint == "fetch_charcoal" or (hint == "work" and int(state.get("charcoal_held") or 0) <= 0):
        if loc != "charcoal_lean":
            path = bb._path(loc, "charcoal_lean") or []
            if path:
                return {"intention": "Obtain charcoal before the forge runs out.", "action": {"type": "move", "destination": path[0]}, "speech": None}
        return {"intention": "Gather charcoal.", "action": {"type": "buy", "item": "charcoal", "quantity": 2}, "speech": None}
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


# Back-compat name used only in older tests — same real policy
mock_decide = routine_decide


def ollama_decide(
    state: dict[str, Any],
    perc: dict[str, Any],
    *,
    model: str | None = None,
    host: str = "http://127.0.0.1:11434",
    timeout: float = 45.0,
) -> dict[str, Any]:
    persona = bb.load_persona()
    prompt = build_prompt(persona, state, perc)
    model = model or os.environ.get("OLISSIPPO_OLLAMA_MODEL", "llama3.2:1b")
    schema = {
        "type": "object",
        "properties": {
            "intention": {"type": "string"},
            "action": {"type": "object"},
            "speech": {},
        },
        "required": ["action"],
    }
    body = json.dumps({
        "model": model,
        "prompt": prompt + "\nJSON only. Example: {\"intention\":\"work\",\"action\":{\"type\":\"work\"},\"speech\":null}\n",
        "stream": False,
        "format": "json",
        "options": {"temperature": 0.1, "num_predict": 120},
    }).encode()
    req = urllib.request.Request(
        host.rstrip("/") + "/api/generate",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        payload = json.loads(resp.read().decode())
    raw = payload.get("response") or payload.get("thinking") or ""
    try:
        return parse_decision(raw)
    except Exception:
        # second chance: if model returned a bare action type string
        text = str(raw).strip().lower()
        for verb in ("work", "wait", "eat", "sleep", "buy", "move"):
            if verb in text:
                act: dict[str, Any] = {"type": verb}
                if verb == "buy":
                    act.update({"item": "charcoal", "quantity": 2})
                return {"intention": "recovered", "action": act, "speech": None}
        raise ValueError(f"ollama_bad_json:{raw[:200]!r}")


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
    prefer_ollama: bool = True,
    memory_store: dict[str, Any] | None = None,
    ollama_host: str | None = None,
) -> dict[str, Any]:
    """Advance time; Ollama (real) or routine policy; validate; execute; record memory."""
    if ollama_host is None:
        ollama_host = os.environ.get("OLISSIPPO_OLLAMA_HOST", "http://127.0.0.1:11434")
    s = deepcopy(state)
    bb.assert_subject_not_nft(s)
    if "status_flags" not in s:
        s["status_flags"] = []
    s["minute"] = (int(s["minute"]) + int(minutes)) % 1440
    if int(state["minute"]) + int(minutes) >= 1440:
        s["day"] = int(s["day"]) + 1

    perc = perception(s)
    decider = decide
    used = "inject"
    if decider is None and prefer_ollama and ollama_available(ollama_host):
        decider = lambda st, pe: ollama_decide(st, pe, host=ollama_host)
        used = "ollama"
    if decider is None:
        decider = routine_decide
        used = "routine"

    try:
        raw = decider(s, perc)
        decision = parse_decision(raw)
        gate = validate_decision(s, decision)
        if gate.get("ok"):
            out = execute_decision(s, gate, speech=decision.get("speech"))
            out["last_action"]["source"] = used
            return out
        # rejected — one real routine step without double clock
        s["last_action"] = {"type": "wait", "reason": "llm_rejected", "error": gate.get("error"), "source": "server"}
        want_act, want_loc = bb.activity_at(int(s["minute"]))
        if int(s.get("charcoal_held") or 0) <= 0 and want_act == "work":
            want_act, want_loc = "fetch_charcoal", "charcoal_lean"
        if s["location_id"] != want_loc:
            path = bb._path(s["location_id"], want_loc) or []
            if path:
                check = ow.validate_move(s["location_id"], path[0])
                if check.get("ok"):
                    s["location_id"] = path[0]
                    s["last_action"] = {"type": "move", "destination": path[0], "ok": True, "source": "routine"}
                    if path[0] == want_loc:
                        s = bb._apply_activity(s, want_act)
                        if isinstance(s.get("last_action"), dict):
                            s["last_action"]["source"] = "routine"
        else:
            s = bb._apply_activity(s, want_act)
            if isinstance(s.get("last_action"), dict):
                s["last_action"]["source"] = "routine"
        s["log"] = list(s.get("log") or [])
        s["log"].append({"day": s.get("day"), "minute": s.get("minute"), "action": s["last_action"]})
        s["log"] = s["log"][-200:]
        return s
    except Exception as e:
        out = bb.tick(state, minutes)
        la = out.get("last_action") or {}
        if isinstance(la, dict):
            la = {**la, "source": "routine_exception", "error": type(e).__name__}
            out["last_action"] = la
        return out


def cognitive_tick_with_memory(
    state: dict[str, Any],
    store: dict[str, Any],
    minutes: int = 10,
    **kwargs: Any,
) -> tuple[dict[str, Any], dict[str, Any]]:
    out = cognitive_tick(state, minutes, **kwargs)
    store2 = mem.record_from_action(store, out)
    return out, store2
