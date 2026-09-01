#!/usr/bin/env python3
"""MinIO probe — no secret printed. Uses AWS S3 signature via raw HTTP list optional."""
import json, os
from pathlib import Path
VAULT = Path.home() / ".config/stratamesh"
print(json.dumps({
  "hop": "minio",
  "has_pass": (VAULT / "minio.pass").is_file(),
  "user": ((VAULT / "minio.user").read_text().strip() if (VAULT / "minio.user").is_file() else "minio"),
  "s3": "http://127.0.0.1:9000",
  "console": "http://127.0.0.1:9001",
}))
