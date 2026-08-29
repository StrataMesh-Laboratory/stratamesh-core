#!/usr/bin/env python3
"""Fog-path tests for optional Tor SOCKS5h helper. Never hits the network."""
from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import tor_socks  # noqa: E402


GOSSIP = "http://10.0.0.2:8787/gossip"
GITHUB = "https://api.github.com/repos/x/y"
CF = "https://api.cloudflare.com/client/v4/graphql"
WORKERS = "https://example.workers.dev/health"
APEX = "https://status.calhegasmorais.pt/"


class UnsetEnv(unittest.TestCase):
    def setUp(self):
        for k in tor_socks.ENV_KEYS:
            os.environ.pop(k, None)

    def test_no_proxy(self):
        self.assertIsNone(tor_socks.socks_url())
        self.assertFalse(tor_socks.should_proxy(GOSSIP))
        self.assertIsNone(tor_socks.proxy_plan(GOSSIP)["proxy"])
        self.assertEqual(tor_socks.proxy_plan(GOSSIP)["dns"], "direct")


class SetEnv(unittest.TestCase):
    def setUp(self):
        os.environ["FOG_TOR_SOCKS"] = "socks5h://127.0.0.1:9050"
        os.environ.pop("TOR_SOCKS", None)

    def tearDown(self):
        os.environ.pop("FOG_TOR_SOCKS", None)

    def test_uses_socks5h(self):
        plan = tor_socks.proxy_plan(GOSSIP)
        self.assertEqual(plan["proxy"], "socks5h://127.0.0.1:9050")
        self.assertEqual(plan["scheme"], "socks5h")
        self.assertEqual(plan["dns"], "remote")
        self.assertEqual(plan["socks_host"], "127.0.0.1")
        self.assertEqual(plan["socks_port"], 9050)

    def test_skip_github_cf_workers_apex(self):
        self.assertFalse(tor_socks.should_proxy(GITHUB))
        self.assertFalse(tor_socks.should_proxy(CF))
        self.assertFalse(tor_socks.should_proxy(WORKERS))
        self.assertFalse(tor_socks.should_proxy(APEX))


if __name__ == "__main__":
    unittest.main(verbosity=2)
