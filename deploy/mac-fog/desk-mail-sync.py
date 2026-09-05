#!/usr/bin/env python3
"""Fetch automation.desk@ Worker inbox into shared Maildir. Prints counts/subjects only."""
from __future__ import annotations

import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from email.message import EmailMessage
from email.policy import SMTP
from email.utils import format_datetime, parsedate_to_datetime
from pathlib import Path

# Prefer desk-inbox when Worker split is live; fallback path filters by To.
INBOX_URL = os.environ.get(
    "DESK_MAIL_INBOX_URL",
    "https://stratamesh-auth-recovery.stratamesh.workers.dev/desk-inbox",
)
FALLBACK_GROK_INBOX_URL = os.environ.get(
    "DESK_MAIL_FALLBACK_INBOX_URL",
    "https://stratamesh-auth-recovery.stratamesh.workers.dev/grok-inbox",
)
TOKEN_CANDIDATES = [
    Path.home() / ".config/stratagrok/automation.desk.token",
    Path.home() / ".config/stratamesh/automation.desk.token",
    Path.home() / ".config/stratagrok/auth-recovery.token",
    Path.home() / ".config/stratamesh/auth-recovery.token",
]
MAILDIR_CANDIDATES = [
    Path(os.environ["DESK_MAILDIR"]) if os.environ.get("DESK_MAILDIR") else None,
    Path("/home/box/mail/automation.desk"),
    Path.home() / "mail/automation.desk",
]
ADDRESS = "automation.desk@calhegasmorais.pt"
USER_AGENT = "STRATAGROK-desk-mail/1.0"
SAFE_ID = re.compile(r"[^A-Za-z0-9._-]+")


def die(msg: str, code: int = 1) -> None:
    print(f"desk-mail-sync: {msg}", file=sys.stderr)
    raise SystemExit(code)


def load_token() -> str:
    for p in TOKEN_CANDIDATES:
        if p is None or not p.is_file():
            continue
        raw = p.read_text(encoding="utf-8").strip()
        if raw:
            return raw
    die("no vault token (automation.desk.token or auth-recovery.token)")


def maildir() -> Path:
    for p in MAILDIR_CANDIDATES:
        if p is None:
            continue
        if p.is_dir() or not p.exists():
            for sub in ("cur", "new", "tmp"):
                (p / sub).mkdir(parents=True, exist_ok=True)
            return p
    die("cannot resolve Maildir")


def load_seen(md: Path) -> set[str]:
    seen: set[str] = set()
    sp = md / ".seen-ids"
    if sp.is_file():
        for line in sp.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#"):
                seen.add(line)
    for sub in (md / "cur", md / "new"):
        if not sub.is_dir():
            continue
        for p in sub.iterdir():
            name = p.name
            if ".desk" in name:
                core = name.split(":")[0].split(",")[0]
                parts = core.rsplit(".", 2)
                if len(parts) >= 2 and parts[-1] == "desk":
                    seen.add(parts[-2])
    return seen


def save_seen(md: Path, seen: set[str]) -> None:
    sp = md / ".seen-ids"
    tmp = sp.with_suffix(".ids.tmp")
    body = "# desk-mail worker ids already in Maildir\n" + "\n".join(sorted(seen)) + "\n"
    tmp.write_text(body, encoding="utf-8")
    os.chmod(tmp, 0o600)
    tmp.replace(sp)


def safe_id(item_id: str) -> str:
    s = SAFE_ID.sub("_", item_id).strip("._-") or "noid"
    return s[:96]


def parse_date(value: object) -> datetime:
    if not value:
        return datetime.now(timezone.utc)
    text = str(value).strip()
    try:
        dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except ValueError:
        pass
    try:
        dt = parsedate_to_datetime(text)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except (TypeError, ValueError, IndexError):
        return datetime.now(timezone.utc)


def is_desk_item(item: dict) -> bool:
    to = str(item.get("to") or "").lower()
    return "automation.desk@" in to or to.strip() == ADDRESS.lower()


def build_eml(item: dict) -> bytes:
    msg = EmailMessage(policy=SMTP)
    frm = str(item.get("from") or "unknown@invalid")
    to = str(item.get("to") or ADDRESS)
    subj = str(item.get("subject") or "(no subject)")
    body = str(item.get("text") or "")
    item_id = str(item.get("id") or "")
    dt = parse_date(item.get("receivedAt"))
    msg["From"] = frm
    msg["To"] = to
    msg["Subject"] = subj
    msg["Date"] = format_datetime(dt)
    msg["Message-ID"] = f"<{safe_id(item_id)}@automation.desk.local>"
    msg["X-Desk-Inbox-Id"] = item_id
    msg["MIME-Version"] = "1.0"
    msg.set_content(body, subtype="plain", charset="utf-8")
    return msg.as_bytes()


def fetch_json(url: str, token: str) -> dict:
    req = urllib.request.Request(
        url,
        method="GET",
        headers={"Authorization": f"Bearer {token}", "User-Agent": USER_AGENT},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


def fetch_items(token: str) -> list[dict]:
    try:
        data = fetch_json(INBOX_URL, token)
        items = list(data.get("items") or [])
        if items or data.get("success"):
            return [i for i in items if isinstance(i, dict)]
    except urllib.error.HTTPError as e:
        if e.code not in (404, 401):
            print(f"desk-mail-sync: desk-inbox HTTP {e.code}, trying fallback filter", file=sys.stderr)
    except Exception as e:
        print(f"desk-mail-sync: desk-inbox err {type(e).__name__}, fallback", file=sys.stderr)
    # Fallback: grok-inbox mixed store — filter by To
    data = fetch_json(FALLBACK_GROK_INBOX_URL, token)
    items = [i for i in (data.get("items") or []) if isinstance(i, dict) and is_desk_item(i)]
    return items


def main() -> int:
    token = load_token()
    md = maildir()
    seen = load_seen(md)
    try:
        items = fetch_items(token)
    except Exception as e:
        die(f"fetch failed: {type(e).__name__}")
    written = 0
    subjects: list[str] = []
    for item in items:
        iid = str(item.get("id") or "")
        if not iid or iid in seen:
            continue
        if not is_desk_item(item) and "desk-inbox" not in INBOX_URL:
            # when using dedicated desk-inbox, trust Worker; still ok if to missing
            pass
        eml = build_eml(item)
        ts = int(time.time())
        fname = f"{ts}.M{ts % 1000000}P{os.getpid()}Q{written}.{safe_id(iid)}.desk"
        dest = md / "new" / fname
        tmp = md / "tmp" / fname
        tmp.write_bytes(eml)
        os.chmod(tmp, 0o600)
        tmp.replace(dest)
        seen.add(iid)
        written += 1
        subjects.append(str(item.get("subject") or "(no subject)")[:80])
    save_seen(md, seen)
    print(f"desk-mail-sync: maildir={md} new={written} total_seen={len(seen)}")
    for s in subjects[:10]:
        print(f"  · {s}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
