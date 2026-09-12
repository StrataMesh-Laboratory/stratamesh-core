"""Live-token shaped scan for secrets-guard (GHA + local tests).

Token prefixes must start at a boundary so identifiers like desk-mail-* do not
match mid-word (de**sk-**mail… false positive, 2026-09-12 / PR #184).
"""
from __future__ import annotations

import re

# Boundary: not preceded by alnum/underscore (paths, identifiers).
LIVE = re.compile(
    r"(?<![A-Za-z0-9_])"
    r"(?:ghp_|ghu_|gho_|ghs_|ghr_|github_pat_|cfat_|cfut_|hf_|sk-|smva_|deo_live_)"
    r"(?=[A-Za-z0-9_\-]*\d)[A-Za-z0-9_\-]{16,}"
)
WORKERS_DEV = re.compile(r"https?://[^\s]+workers\.dev", re.I)


def find_live_hits(text: str) -> list[str]:
    return sorted({m.group(0) for m in LIVE.finditer(text or "")})


def hit_summaries(text: str) -> list[str]:
    return sorted(
        {
            m.group(0)[:8] + "… len=" + str(len(m.group(0)))
            for m in LIVE.finditer(text or "")
        }
    )
