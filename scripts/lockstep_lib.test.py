#!/usr/bin/env python3
"""Unit tests for lockstep helpers — no network."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import lockstep_lib as L  # noqa: E402


LANDING = """
          {pt
            ? "Holons aninhados e distintos: TRD → Nó → SO → Domínio Virtual (VM hipervisor). O Painel abre-se na Bancada."
            : "Nested distinct holons: DLT → Node → OS → Virtual Realm (VM hypervisor). The Panel opens in the sandbox."}
"""

DIAGRAMS = r'''
  const rows = pt
    ? [
        "TRD StrataMesh · kernel CLP/PPC",
        "Nó Calhegas Morais · Fog · instancia SO nativos e importados",
        "SO Metaverso Web3 · nativo StrataMesh · nos Fog",
        "Domínio Virtual · VM hipervisor · servidores dos mundos",
        "Mundo Aberto · objectos NFT STRATA",
        "Bancada CGU · Painel e sandbox privados de cada conta",
        "Utilizador  |  SCA · contas que o Nó fornece",
      ]
    : [
        "StrataMesh DLT · CLP/PPC kernel",
        "Calhegas Morais Node · Fog · instantiates native and imported OS",
        "Web3 Metaverse OS · StrataMesh native · on Fogs",
        "Virtual Realm · VM hypervisor · servers of the worlds",
        "Open World · STRATA NFT objects",
        "UGC sandbox · private Panel and sandbox of each account",
        "User  |  SCA · accounts the Node provides",
      ];
'''

HTML_PT = (
    "<p>Holons aninhados e distintos: OLD Anfitrião (SO e VM do equipamento) END.</p>"
    '<svg class="diagram" viewBox="0 0 640 430" role="img" aria-label="Pilha holónica — Nó Calhegas Morais">'
    "<rect/><text>old</text></svg>"
)

HTML_PT_OLD_LABEL = (
    "<p>Holons aninhados e distintos: OLD.</p>"
    '<svg class="diagram" viewBox="0 0 640 420" role="img" aria-label="Pilha holónica do Nó Calhegas Morais">'
    "<rect/><text>old</text></svg>"
)


class Creds(unittest.TestCase):
    def test_reject_cfut(self):
        self.assertFalse(L.is_write_token("cfut" + "x" * 49))

    def test_accept_cfat(self):
        self.assertTrue(L.is_write_token("cfat" + "x" * 49))

    def test_load_prefers_god_rejects_cfut_file(self):
        email, tok = L.load_cf_write(
            env={"CLOUDFLARE_EMAIL": "amcmorais@icloud.com"},
            files={"/tmp/god_api": "cfatWRITESECRET", "/tmp/write_api": "cfutREADONLY"},
        )
        self.assertEqual(email, "amcmorais@icloud.com")
        self.assertEqual(tok, "cfatWRITESECRET")

    def test_headers_email_first(self):
        h = L.cf_headers("amcmorais@icloud.com", "cfatABC")
        keys = list(h.keys())
        self.assertEqual(keys[0], "X-Auth-Email")
        self.assertEqual(h["X-Auth-Email"], "amcmorais@icloud.com")
        self.assertTrue(h["Authorization"].startswith("Bearer "))

    def test_missing_write_token(self):
        with self.assertRaises(RuntimeError):
            L.load_cf_write(env={}, files={"/tmp/god_api": "cfutNOPE"})


class Parse(unittest.TestCase):
    def test_arch(self):
        a = L.extract_arch(LANDING)
        self.assertIn("VM hipervisor", a["pt"])
        self.assertIn("VM hypervisor", a["en"])
        self.assertNotIn("Não existe camada", a["pt"])
        self.assertNotIn("not a layer", a["en"])

    def test_rows(self):
        r = L.extract_holon_rows(DIAGRAMS)
        self.assertEqual(len(r["pt"]), 7)
        self.assertEqual(r["pt"][1], "Nó Calhegas Morais · Fog · instancia SO nativos e importados")
        self.assertEqual(r["pt"][2], "SO Metaverso Web3 · nativo StrataMesh · nos Fog")
        self.assertEqual(r["pt"][3], "Domínio Virtual · VM hipervisor · servidores dos mundos")
        self.assertEqual(r["en"][3], "Virtual Realm · VM hypervisor · servers of the worlds")
        joined = " ".join(r["pt"] + r["en"])
        self.assertNotIn("VM · isolate", joined)
        self.assertNotIn("Anfitrião", joined)
        self.assertNotIn("Host · OS", joined)

    def test_git_copy_includes_publisher(self):
        dests = {d for _, d in L.GIT_COPY}
        self.assertIn("scripts/lockstep-publish.py", dests)
        self.assertIn("scripts/lockstep_lib.py", dests)
        self.assertIn("src/lib/bancada-store.ts", dests)
        self.assertIn("src/components/bancada-canvas.tsx", dests)
        self.assertIn("frontend/portal-pt.html", dests)
        self.assertIn("frontend/portal-en.html", dests)
        self.assertIn("workers/stratamesh-deomail.js", dests)
        self.assertIn("workers/stratamesh-auth.js", dests)


class Patch(unittest.TestCase):
    def test_patch_pt(self):
        rows = L.extract_holon_rows(DIAGRAMS)["pt"]
        svg = L.holon_svg("pt", rows, "Pilha holónica — Nó Calhegas Morais")
        out = L.patch_landing_html(HTML_PT, "pt", "Holons aninhados e distintos: VM = DV.", svg)
        self.assertIn("VM = DV", out)
        self.assertNotIn("Anfitrião", out)
        self.assertIn('viewBox="0 0 640 430"', out)
        self.assertIn("VM hipervisor", out)
        self.assertNotIn("VM · isolate", out)
        self.assertEqual(out.count("<svg"), 1)

    def test_patch_old_aria_label(self):
        rows = L.extract_holon_rows(DIAGRAMS)["pt"]
        svg = L.holon_svg("pt", rows, "Pilha holónica — Nó Calhegas Morais")
        out = L.patch_landing_html(HTML_PT_OLD_LABEL, "pt", "Holons aninhados e distintos: novo.", svg)
        self.assertIn("novo", out)
        self.assertIn("VM hipervisor", out)
        self.assertNotIn("VM · isolate", out)

    def test_chunk(self):
        parts = L.chunk_html("abcdefghij", 3)
        self.assertEqual(parts, ["abc", "def", "ghi", "j"])

    def test_d1_plan_uses_idx(self):
        plan = L.d1_write_plan("abcdef", ["home-pt"])
        sqls = [s for s, _ in plan]
        self.assertTrue(any("site_content " in s or "site_content(" in s for s in sqls))
        self.assertTrue(any("idx" in s for s in sqls))
        self.assertFalse(any(" seq" in s for s in sqls))

    def test_slim_secret_refuses(self):
        with self.assertRaises(RuntimeError):
            L.slim_bindings([{"type": "secret_text", "name": "GENESIS_PRIVATE_KEY_V2"}])


if __name__ == "__main__":
    unittest.main()
