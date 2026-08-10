"""Compatibility shim for cid_pin_stub imports."""
from ipfs_client import IPFSClient, PinRecord, PinStub

DEFAULT_PINNER = IPFSClient(mode="stub")
