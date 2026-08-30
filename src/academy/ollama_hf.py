"""Ollama ← Hugging Face GGUF bridge for Fog residual capacity.

Worker never calls this. HF Inference Providers stay HOLD.
Pull: `ollama pull hf.co/{user}/{repo}:{quant}`
Generate: POST http://127.0.0.1:11434/api/generate
Secrets: none. Optional local OLLAMA_HOST only.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any

from .catalog import MODELS, formation as get_formation

DEFAULT_HOST = os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434").rstrip("/")


class RuntimeUnavailable(RuntimeError):
    pass


class OllamaHf:
    def __init__(self, host: str = DEFAULT_HOST, timeout: int = 60):
        self.host = host.rstrip("/")
        self.timeout = timeout

    def alive(self) -> bool:
        try:
            req = urllib.request.Request(self.host + "/api/tags", method="GET")
            with urllib.request.urlopen(req, timeout=3) as r:
                return r.status == 200
        except (urllib.error.URLError, TimeoutError, OSError):
            return False

    def tags(self) -> list[str]:
        try:
            req = urllib.request.Request(self.host + "/api/tags", method="GET")
            with urllib.request.urlopen(req, timeout=5) as r:
                data = json.loads(r.read().decode() or "{}")
            return [m.get("name") for m in data.get("models") or [] if m.get("name")]
        except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError):
            return []

    def pull_spec(self, mode: str) -> dict:
        m = MODELS["corrective" if mode != "exploratory" else "exploratory"]
        return {
            "command": "ollama pull " + m["hf_gguf"],
            "fallback": "ollama pull " + m["ollama"],
            "hf_gguf": m["hf_gguf"],
            "ollama_lib": m["ollama"],
            "docs": MODELS["policy"]["docs"],
            "worker_does_not_pull": True,
            "hf_inference_providers": MODELS["policy"]["hf_inference_providers"],
        }

    def generate(self, model: str, prompt: str, system: str = "") -> str:
        if not self.alive():
            raise RuntimeUnavailable("ollama not listening on " + self.host)
        body = {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0, "num_predict": 256},
        }
        if system:
            body["system"] = system
        req = urllib.request.Request(
            self.host + "/api/generate",
            data=json.dumps(body).encode(),
            method="POST",
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as r:
                data = json.loads(r.read().decode() or "{}")
        except urllib.error.HTTPError as e:
            raise RuntimeUnavailable("ollama http " + str(e.code)) from e
        return (data.get("response") or "").strip()

    def run_formation(self, formation_id: str, *, model: str | None = None) -> dict[str, Any]:
        f = get_formation(formation_id)
        if not f:
            return {"ok": False, "error": "unknown_formation"}
        spec = self.pull_spec(f["mode"])
        mdl = model or spec["ollama_lib"]
        system = (
            "You are a StrataMesh LAB ACB student. Role="
            + f["role"]
            + ". Fail-closed. Never invent handlers. Never workers.dev. "
            "Never echo secrets. Lab, not mainnet. grok@ is not an SCA."
        )
        answers = []
        if not self.alive():
            return {
                "ok": False,
                "runtime": "ollama",
                "available": False,
                "error": "runtime_unavailable",
                "hint": spec,
                "fallback": "POST /v1/grade with your own answers, or --runtime symbolic",
            }
        for drill in f["drills"]:
            try:
                answers.append(self.generate(mdl, drill["prompt"], system=system))
            except RuntimeUnavailable as e:
                answers.append("")
                return {
                    "ok": False,
                    "runtime": "ollama",
                    "error": str(e),
                    "answers": answers,
                    "hint": spec,
                }
        from .grader import grade

        out = grade(f["id"], answers)
        out["runtime"] = "ollama"
        out["model"] = mdl
        out["hf_gguf"] = spec["hf_gguf"]
        out["answers"] = answers
        return out
