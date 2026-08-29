#!/usr/bin/env python3
"""Unit tests for optional Tor SOCKS5h helper. Never hits the network."""
from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
import socks as tor_socks  # noqa: E402


GOSSIP = "http://10.0.0.2:8787/gossip"
GITHUB = "https://api.github.com/repos/StrataMesh-Laboratory/stratamesh-core"
CF_GQL = "https://api.cloudflare.com/client/v4/graphql"
WRANGLER = "https://api.cloudflare.com/client/v4/accounts/x/workers/scripts"
APEX = "https://calhegasmorais.pt/api/v1/gossip/peers"
ONION = "http://exampleonionexampleonionexampleonionexampleonionexamp.onion/health"


class UnsetEnv(unittest.TestCase):
    def setUp(self):
        self._old = {k: os.environ.get(k) for k in tor_socks.ENV_KEYS}
        for k in tor_socks.ENV_KEYS:
            os.environ.pop(k, None)

    def tearDown(self):
        for k, v in self._old.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v

    def test_socks_url_none(self):
        self.assertIsNone(tor_socks.socks_url())

    def test_should_proxy_false(self):
        self.assertFalse(tor_socks.should_proxy(GOSSIP))

    def test_plan_is_direct(self):
        plan = tor_socks.proxy_plan(GOSSIP)
        self.assertIsNone(plan["proxy"])
        self.assertEqual(plan["dns"], "direct")

    def test_urlopen_uses_direct(self):
        sentinel = object()

        def fake_open(url, timeout=5, **kwargs):
            return sentinel

        with patch.object(tor_socks, "direct_urlopen", fake_open):
            self.assertIs(tor_socks.urlopen(GOSSIP, timeout=1), sentinel)


class SetEnv(unittest.TestCase):
    def setUp(self):
        self._old = {k: os.environ.get(k) for k in tor_socks.ENV_KEYS}
        os.environ["FOG_TOR_SOCKS"] = "socks5h://127.0.0.1:9050"
        os.environ.pop("TOR_SOCKS", None)

    def tearDown(self):
        for k, v in self._old.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v

    def test_socks_url(self):
        self.assertEqual(tor_socks.socks_url(), "socks5h://127.0.0.1:9050")

    def test_plan_gossip_uses_socks5h(self):
        plan = tor_socks.proxy_plan(GOSSIP)
        self.assertEqual(plan["proxy"], "socks5h://127.0.0.1:9050")
        self.assertEqual(plan["scheme"], "socks5h")
        self.assertEqual(plan["dns"], "remote")
        self.assertEqual(plan["socks_host"], "127.0.0.1")
        self.assertEqual(plan["socks_port"], 9050)

    def test_onion_uses_socks5h(self):
        plan = tor_socks.proxy_plan(ONION)
        self.assertEqual(plan["scheme"], "socks5h")

    def test_skip_github(self):
        self.assertFalse(tor_socks.should_proxy(GITHUB))
        self.assertIsNone(tor_socks.proxy_plan(GITHUB)["proxy"])

    def test_skip_cloudflare_graphql(self):
        self.assertFalse(tor_socks.should_proxy(CF_GQL))
        self.assertFalse(tor_socks.should_proxy(WRANGLER))

    def test_skip_lab_apex(self):
        self.assertFalse(tor_socks.should_proxy(APEX))

    def test_urlopen_does_not_call_direct_for_gossip(self):
        called = {"direct": False}

        def fake_direct(url, timeout=5, **kwargs):
            called["direct"] = True
            raise AssertionError("direct urlopen must not run when SOCKS is set")

        def fake_dial(*args, **kwargs):
            raise OSError("dial skipped in unit test")

        with patch.object(tor_socks, "direct_urlopen", fake_direct):
            with patch.object(tor_socks, "_dial", fake_dial):
                with self.assertRaises(OSError):
                    tor_socks.urlopen(GOSSIP, timeout=1)
        self.assertFalse(called["direct"])

    def test_fallback_env_name(self):
        os.environ.pop("FOG_TOR_SOCKS", None)
        os.environ["TOR_SOCKS"] = "socks5h://127.0.0.1:9050"
        self.assertEqual(tor_socks.socks_url(), "socks5h://127.0.0.1:9050")


if __name__ == "__main__":
    unittest.main(verbosity=2)
