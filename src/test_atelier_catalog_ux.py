#!/usr/bin/env python3
"""Atelier catalog bridge + non-technical tokenize wizard."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_atelier_catalog_module():
    js = (ROOT / "frontend/atelier-catalog.js").read_text(errors="replace")
    assert "AtelierCatalog" in js
    assert "mergeDeployed" in js
    assert "aspectsOf" in js
    assert "toAtelierNft" in js
    assert "kind === \"lot\"" in js or "kind === 'lot'" in js
    assert "P_market" not in js  # UI bridge must not lecture market jargon in module surface


def test_gnu_atelier_wires_catalog():
    html = (ROOT / "frontend/gnu-atelier.html").read_text(errors="replace")
    assert "atelier-catalog.js" in html
    assert "AtelierCatalog.mergeDeployed" in html
    assert "resolveAspectNfts" in html
    assert "publishFocusNft" in html
    assert "cmn-catalog-changed" in html


def test_tokenize_wizard_nontechnical():
    html = (ROOT / "frontend/tokenize.html").read_text(errors="replace")
    assert "wizShow" in html
    assert 'data-tpl="furniture"' in html
    assert "1 · Categoria" in html or "Categoria" in html
    assert "object_id ·" not in html
    assert "<code>object_id</code>" not in html
    assert "btnWizNext2" in html
    assert 'data-tpl="exec_contract"' in html
    assert 'data-tpl="deed_physical"' in html
    assert 'data-tpl="other"' in html
    assert "var wizTpl" in html
    assert "function wizShow" in html
    assert "international_legal_custodianship" in html
    assert (ROOT / "docs/NFT-MACRO-CATEGORIES.md").is_file()
    assert "Macro-categories (not a closed set)" in (ROOT / "docs/STRATA_NFT_ONTOLOGY.md").read_text()
    assert "Mais pormenores (opcional)" in html
    # list rows should not dump raw id divs as primary
    assert '<div class="id">" + it.id + "</div>' not in html


def test_sandbox_focus_optional():
    html = (ROOT / "frontend/sandbox.html").read_text(errors="replace")
    assert "cmn-atelier-focus" in html
    assert "20260906n" in html


if __name__ == "__main__":
    failed = 0
    for name, fn in list(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn()
                print("ok", name)
            except Exception as e:
                failed += 1
                print("FAIL", name, type(e).__name__, e)
    if failed:
        sys.exit(1)
    print("atelier-catalog-ux ok")
