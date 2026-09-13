"""Compatibility shim for cid_pin_stub imports.

DEFAULT_PINNER is stub/HOLD — does not invent pinned (NO-FAKE-DONE).
"""
from ipfs_client import IPFSClient, PinRecord, PinStub

DEFAULT_PINNER = IPFSClient(mode="stub")
