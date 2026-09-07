#!/usr/bin/env python3
"""Open World language player pools → microhypervisor selection.

Doctrine: docs/OPEN-WORLD-HYPERVISORS.md · docs/UI-LOCALE-CPLP.md

- CPLP countries → pool `cplp`, locale `pt-PT`, micro id `*-cplp-pt-pt`
- non-CPLP → pool `international`, locale `en-GB`, micro id `*-intl-en-gb`
- Same macrohypervisor / same land-bundle
- Geo/country is primary; Accept-Language is not primary
- `explicit_pool` overrides for tests/accounts
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
REALMS_PATH = ROOT / "contracts" / "cmn" / "realms.json"
WORLD_PATH = ROOT / "contracts" / "mud" / "olissippo-world.json"

# Official CPLP member ISO 3166-1 alpha-2 codes (Comunidade dos Países de Língua Portuguesa).
CPLP_COUNTRY_CODES: frozenset[str] = frozenset(
    {
        "AO",  # Angola
        "BR",  # Brazil
        "CV",  # Cabo Verde
        "GQ",  # Equatorial Guinea
        "GW",  # Guinea-Bissau
        "MZ",  # Mozambique
        "PT",  # Portugal
        "ST",  # São Tomé and Príncipe
        "TL",  # Timor-Leste
    }
)

POOL_CPLP = "cplp"
POOL_INTERNATIONAL = "international"
VALID_POOLS = frozenset({POOL_CPLP, POOL_INTERNATIONAL})

LOCALE_BY_POOL: dict[str, str] = {
    POOL_CPLP: "pt-PT",
    POOL_INTERNATIONAL: "en-GB",
}

DEFAULT_REALM_ID = "lore-olissippo-lusitanian"


def _norm_country(country_code: str | None) -> str | None:
    if country_code is None:
        return None
    cc = str(country_code).strip().upper()
    if not cc:
        return None
    # tolerate accidental locale tags like pt-PT / PT-pt
    if "-" in cc:
        cc = cc.split("-", 1)[0]
    if len(cc) != 2 or not cc.isalpha():
        return None
    return cc


def _norm_explicit_pool(explicit_pool: str | None) -> str | None:
    if explicit_pool is None:
        return None
    p = str(explicit_pool).strip().lower()
    aliases = {
        "cplp": POOL_CPLP,
        "intl": POOL_INTERNATIONAL,
        "international": POOL_INTERNATIONAL,
        "en": POOL_INTERNATIONAL,
        "en-gb": POOL_INTERNATIONAL,
        "pt": POOL_CPLP,
        "pt-pt": POOL_CPLP,
    }
    if p in aliases:
        return aliases[p]
    if p in VALID_POOLS:
        return p
    raise ValueError(f"unknown_explicit_pool:{explicit_pool}")


def resolve_player_pool(
    *,
    country_code: str | None = None,
    explicit_pool: str | None = None,
    accept_language: str | None = None,
) -> str:
    """Resolve language player pool.

    Priority:
      1. explicit_pool (tests / account preference)
      2. geo country_code ∈ CPLP_COUNTRY_CODES → cplp, else international
      3. missing country → international (Accept-Language is NOT used as primary)
    """
    # accept_language intentionally unused as primary selector (product rule).
    _ = accept_language

    override = _norm_explicit_pool(explicit_pool)
    if override is not None:
        return override

    cc = _norm_country(country_code)
    if cc is None:
        return POOL_INTERNATIONAL
    if cc in CPLP_COUNTRY_CODES:
        return POOL_CPLP
    return POOL_INTERNATIONAL


def locale_norm_for_pool(pool: str) -> str:
    p = _norm_explicit_pool(pool) or str(pool).strip().lower()
    if p not in LOCALE_BY_POOL:
        raise ValueError(f"unknown_pool:{pool}")
    return LOCALE_BY_POOL[p]


def load_realms(path: Path | None = None) -> dict[str, Any]:
    return json.loads((path or REALMS_PATH).read_text())


def realm_entry(realm_id: str, *, realms: dict[str, Any] | None = None) -> dict[str, Any]:
    data = realms if realms is not None else load_realms()
    for r in data.get("realms") or []:
        if r.get("realm_id") == realm_id:
            return r
    raise KeyError(f"realm_not_found:{realm_id}")


def select_microhypervisor_pool(
    realm_id: str = DEFAULT_REALM_ID,
    *,
    country_code: str | None = None,
    explicit_pool: str | None = None,
    accept_language: str | None = None,
    realms: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Pick mirrored microhypervisor for the resolved language player pool.

    Same macrohypervisor / same land-bundle; only the micro + locale_norm change.
    """
    pool = resolve_player_pool(
        country_code=country_code,
        explicit_pool=explicit_pool,
        accept_language=accept_language,
    )
    locale = locale_norm_for_pool(pool)
    entry = realm_entry(realm_id, realms=realms)
    pools = entry.get("microhypervisor_pools") or []
    match = next((p for p in pools if p.get("player_pool") == pool), None)
    if match is None:
        # Fallback: derive from microhypervisor_ids suffix convention
        ids = entry.get("microhypervisor_ids") or []
        suffix = "cplp-pt-pt" if pool == POOL_CPLP else "intl-en-gb"
        micro_id = next((i for i in ids if str(i).endswith(suffix)), None)
        if micro_id is None:
            raise KeyError(f"no_microhypervisor_for_pool:{realm_id}:{pool}")
        match = {
            "microhypervisor_id": micro_id,
            "player_pool": pool,
            "locale_norm": locale,
        }
    else:
        # Ensure locale stamp matches doctrine even if contract omits it
        match = dict(match)
        match.setdefault("locale_norm", locale)
        if match.get("player_pool") != pool:
            raise ValueError("pool_mismatch")

    out: dict[str, Any] = {
        "realm_id": realm_id,
        "player_pool": pool,
        "locale_norm": match.get("locale_norm") or locale,
        "microhypervisor_id": match["microhypervisor_id"],
        "macrohypervisor_id": entry.get("macrohypervisor_id"),
        "land_bundle_id": entry.get("land_bundle_id"),
        "selection": {
            "geo_primary": True,
            "accept_language_primary": False,
            "explicit_override": _norm_explicit_pool(explicit_pool) is not None,
            "country_code": _norm_country(country_code),
        },
    }
    return out


def attach_session_pool(
    session: dict[str, Any] | None = None,
    *,
    realm_id: str = DEFAULT_REALM_ID,
    country_code: str | None = None,
    explicit_pool: str | None = None,
    accept_language: str | None = None,
    realms: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Stamp a session/account dict with resolved player-pool + microhypervisor."""
    sess = dict(session or {})
    sel = select_microhypervisor_pool(
        realm_id,
        country_code=country_code if country_code is not None else sess.get("country_code"),
        explicit_pool=explicit_pool if explicit_pool is not None else sess.get("explicit_pool"),
        accept_language=accept_language if accept_language is not None else sess.get("accept_language"),
        realms=realms,
    )
    sess["player_pool"] = sel["player_pool"]
    sess["locale_norm"] = sel["locale_norm"]
    sess["microhypervisor_id"] = sel["microhypervisor_id"]
    sess["macrohypervisor_id"] = sel["macrohypervisor_id"]
    if sel.get("land_bundle_id") is not None:
        sess["land_bundle_id"] = sel["land_bundle_id"]
    sess["realm_id"] = sel["realm_id"]
    sess["pool_selection"] = sel["selection"]
    return sess


__all__ = [
    "CPLP_COUNTRY_CODES",
    "POOL_CPLP",
    "POOL_INTERNATIONAL",
    "LOCALE_BY_POOL",
    "resolve_player_pool",
    "locale_norm_for_pool",
    "select_microhypervisor_pool",
    "attach_session_pool",
    "load_realms",
    "realm_entry",
]
