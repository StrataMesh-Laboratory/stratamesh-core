#!/usr/bin/env python3
"""CLI for automation.desk@ — Maildir-first shared desk mail client.

Commands: sync | list | read | search | draft | send | status
Vault paths only (never echo IMAP_PASS/SMTP_PASS/tokens):
  ~/.config/stratagrok/automation.desk.{imap,smtp,token}
See ops/desk-collegium/DESK-MAIL-AUTOMATION.md
"""
from __future__ import annotations

import argparse
import email
import email.policy
import os
import re
import shutil
import smtplib
import subprocess
import sys
import time
from datetime import datetime, timezone
from email.message import EmailMessage
from email.utils import format_datetime, parsedate_to_datetime
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

ADDRESS = "automation.desk@calhegasmorais.pt"
VAULT_ROOT = Path.home() / ".config" / "stratagrok"
IMAP_ENV = VAULT_ROOT / "automation.desk.imap"
SMTP_ENV = VAULT_ROOT / "automation.desk.smtp"
TOKEN_ENV = VAULT_ROOT / "automation.desk.token"
DEFAULT_MAILDIR = Path.home() / "mail" / "automation.desk"
SAFE_NAME = re.compile(r"[^A-Za-z0-9._+-]+")


def die(msg: str, code: int = 1) -> None:
    print(f"desk-mail: {msg}", file=sys.stderr)
    raise SystemExit(code)


def expand(p: str | Path) -> Path:
    return Path(os.path.expanduser(str(p))).resolve()


def load_env_file(path: Path) -> Dict[str, str]:
    """Load KEY=VALUE env file. Never print values."""
    out: Dict[str, str] = {}
    if not path.is_file():
        return out
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        k = k.strip()
        v = v.strip().strip('"').strip("'")
        if k:
            out[k] = v
    return out


def maildir_path(env: Optional[Dict[str, str]] = None) -> Path:
    if os.environ.get("DESK_MAILDIR"):
        return expand(os.environ["DESK_MAILDIR"])
    if env and env.get("MAILDIR"):
        return expand(env["MAILDIR"])
    smtp = load_env_file(SMTP_ENV)
    if smtp.get("MAILDIR"):
        return expand(smtp["MAILDIR"])
    imap = load_env_file(IMAP_ENV)
    if imap.get("MAILDIR"):
        return expand(imap["MAILDIR"])
    return DEFAULT_MAILDIR


def ensure_maildir(md: Path) -> Path:
    for sub in ("cur", "new", "tmp", ".drafts", "sent"):
        (md / sub).mkdir(parents=True, exist_ok=True)
    return md


def vault_present(path: Path) -> bool:
    try:
        return path.is_file() and path.stat().st_size > 0
    except OSError:
        return False


def parse_message(raw: bytes) -> email.message.Message:
    return email.message_from_bytes(raw, policy=email.policy.default)


def msg_body(msg: email.message.Message) -> str:
    if msg.is_multipart():
        parts: List[str] = []
        for part in msg.walk():
            ctype = part.get_content_type()
            if ctype == "text/plain":
                try:
                    parts.append(part.get_content())
                except Exception:
                    payload = part.get_payload(decode=True) or b""
                    parts.append(payload.decode("utf-8", errors="replace"))
        if parts:
            return "\n".join(parts)
        return ""
    try:
        content = msg.get_content()
        return content if isinstance(content, str) else str(content)
    except Exception:
        payload = msg.get_payload(decode=True) or b""
        return payload.decode("utf-8", errors="replace")


def msg_date(msg: email.message.Message) -> str:
    raw = msg.get("Date") or ""
    if not raw:
        return "(no date)"
    try:
        dt = parsedate_to_datetime(raw)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone().strftime("%Y-%m-%d %H:%M")
    except Exception:
        return raw[:32]


def iter_maildir_files(md: Path, folders: Iterable[str] = ("new", "cur")) -> List[Path]:
    files: List[Path] = []
    for folder in folders:
        d = md / folder
        if not d.is_dir():
            continue
        for p in d.iterdir():
            if p.is_file() and not p.name.startswith("."):
                files.append(p)
    files.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    return files


def short_id(path: Path) -> str:
    """Stable short id: basename without :info suffix."""
    name = path.name.split(":")[0]
    return name


def resolve_message(md: Path, ref: str) -> Path:
    """Resolve ID or path to a Maildir message file."""
    cand = Path(ref)
    if cand.is_file():
        return cand
    expanded = expand(ref)
    if expanded.is_file():
        return expanded
    # match by short id / substring against new+cur (+sent)
    files = iter_maildir_files(md, ("new", "cur", "sent"))
    exact = [p for p in files if short_id(p) == ref or p.name == ref]
    if len(exact) == 1:
        return exact[0]
    if len(exact) > 1:
        die(f"ambiguous id {ref!r}: {len(exact)} matches")
    partial = [p for p in files if ref in p.name or ref in short_id(p)]
    if len(partial) == 1:
        return partial[0]
    if len(partial) > 1:
        die(f"ambiguous id {ref!r}: {len(partial)} matches — use full path")
    die(f"message not found: {ref}")


def repo_sync_script() -> Path:
    fog_src = Path(os.environ.get("FOG_SRC", Path.home() / "StrataMesh" / "fog" / "repo"))
    candidates = [
        fog_src / "deploy" / "mac-fog" / "desk-mail-sync.py",
        Path(__file__).resolve().parent / "desk-mail-sync.py",
        Path.home() / ".local" / "bin" / "desk-mail-sync",
    ]
    for c in candidates:
        if c.is_file():
            return c
    die("desk-mail-sync.py not found (set FOG_SRC)")


def cmd_sync(_args: argparse.Namespace) -> int:
    script = repo_sync_script()
    env = os.environ.copy()
    # Prefer vault token path via env without printing it
    if vault_present(TOKEN_ENV):
        env.setdefault("DESK_MAIL_TOKEN_FILE", str(TOKEN_ENV))
    md = ensure_maildir(maildir_path())
    env.setdefault("DESK_MAILDIR", str(md))
    if script.suffix == ".py" or script.name.endswith(".py"):
        cmd = [sys.executable, str(script)]
    else:
        cmd = [str(script)]
    p = subprocess.run(cmd, env=env)
    return int(p.returncode)


def cmd_list(args: argparse.Namespace) -> int:
    md = ensure_maildir(maildir_path())
    limit = int(args.limit or 50)
    files = iter_maildir_files(md)[:limit]
    if not files:
        print(f"desk-mail list: maildir={md} count=0")
        return 0
    print(f"desk-mail list: maildir={md} showing={len(files)}")
    for p in files:
        try:
            msg = parse_message(p.read_bytes())
        except Exception as e:
            print(f"  {short_id(p)}  (unreadable: {type(e).__name__})")
            continue
        frm = (msg.get("From") or "")[:48]
        subj = (msg.get("Subject") or "(no subject)")[:72]
        folder = p.parent.name
        print(f"  {short_id(p)}  [{folder}]  {msg_date(msg)}  | {frm}  | {subj}")
    return 0


def cmd_read(args: argparse.Namespace) -> int:
    md = ensure_maildir(maildir_path())
    path = resolve_message(md, args.ref)
    msg = parse_message(path.read_bytes())
    print(f"Path: {path}")
    print(f"From: {msg.get('From') or ''}")
    print(f"To: {msg.get('To') or ''}")
    print(f"Subject: {msg.get('Subject') or ''}")
    print(f"Date: {msg.get('Date') or ''}")
    print("---")
    print(msg_body(msg))
    return 0


def cmd_search(args: argparse.Namespace) -> int:
    md = ensure_maildir(maildir_path())
    q = (args.query or "").lower().strip()
    if not q:
        die("search requires QUERY")
    hits = 0
    for p in iter_maildir_files(md):
        try:
            raw = p.read_bytes()
            msg = parse_message(raw)
            blob = " ".join(
                [
                    msg.get("From") or "",
                    msg.get("To") or "",
                    msg.get("Subject") or "",
                    msg_body(msg),
                    short_id(p),
                ]
            ).lower()
        except Exception:
            continue
        if q in blob:
            hits += 1
            frm = (msg.get("From") or "")[:40]
            subj = (msg.get("Subject") or "(no subject)")[:64]
            print(f"  {short_id(p)}  {msg_date(msg)}  | {frm}  | {subj}")
    print(f"desk-mail search: hits={hits} query={q!r}")
    return 0


def drafts_dir(md: Path) -> Path:
    d = md / ".drafts"
    d.mkdir(parents=True, exist_ok=True)
    return d


def draft_filename(to: str, subject: str) -> str:
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    safe_to = SAFE_NAME.sub("_", to)[:40] or "to"
    safe_subj = SAFE_NAME.sub("_", subject)[:40] or "draft"
    return f"{ts}.{safe_to}.{safe_subj}.eml"


def build_draft(to: str, subject: str, body: str, frm: str = ADDRESS) -> EmailMessage:
    msg = EmailMessage()
    msg["From"] = frm
    msg["To"] = to
    msg["Subject"] = subject
    msg["Date"] = format_datetime(datetime.now(timezone.utc))
    msg["X-Desk-Draft"] = "1"
    msg.set_content(body or "", subtype="plain", charset="utf-8")
    return msg


def cmd_draft_compose(args: argparse.Namespace) -> int:
    md = ensure_maildir(maildir_path())
    to = args.to or ADDRESS
    subject = args.subject or "(no subject)"
    if args.body_file:
        body = Path(args.body_file).read_text(encoding="utf-8")
    else:
        body = args.body or ""
    smtp = load_env_file(SMTP_ENV)
    frm = smtp.get("SMTP_FROM") or ADDRESS
    msg = build_draft(to, subject, body, frm=frm)
    dest = drafts_dir(md) / draft_filename(to, subject)
    dest.write_bytes(msg.as_bytes())
    os.chmod(dest, 0o600)
    print(f"desk-mail draft compose: wrote {dest}")
    return 0


def cmd_draft_edit(args: argparse.Namespace) -> int:
    md = ensure_maildir(maildir_path())
    path = Path(args.path)
    if not path.is_file():
        # try under drafts
        alt = drafts_dir(md) / args.path
        if alt.is_file():
            path = alt
        else:
            die(f"draft not found: {args.path}")
    msg = parse_message(path.read_bytes())
    if args.body_file:
        new_body = Path(args.body_file).read_text(encoding="utf-8")
    elif args.body is not None:
        new_body = args.body
    else:
        # open $EDITOR if interactive; else replace with stdin marker note
        editor = os.environ.get("EDITOR") or os.environ.get("VISUAL")
        if editor and sys.stdin.isatty():
            subprocess.run([editor, str(path)], check=False)
            print(f"desk-mail draft edit: opened {path}")
            return 0
        die("draft edit requires --body or --body-file (non-interactive)")
    # rebuild preserving headers
    to = msg.get("To") or ADDRESS
    subject = msg.get("Subject") or "(no subject)"
    frm = msg.get("From") or ADDRESS
    new_msg = build_draft(to, subject, new_body, frm=frm)
    # preserve Message-ID / Date if present
    if msg.get("Message-ID"):
        new_msg["Message-ID"] = msg.get("Message-ID")
    path.write_bytes(new_msg.as_bytes())
    os.chmod(path, 0o600)
    print(f"desk-mail draft edit: updated {path}")
    return 0


def cmd_draft_list(_args: argparse.Namespace) -> int:
    md = ensure_maildir(maildir_path())
    d = drafts_dir(md)
    files = sorted(d.glob("*.eml"), key=lambda p: p.stat().st_mtime, reverse=True)
    print(f"desk-mail draft list: dir={d} count={len(files)}")
    for p in files:
        try:
            msg = parse_message(p.read_bytes())
            print(
                f"  {p.name}  | To={msg.get('To') or ''}  | Subject={msg.get('Subject') or ''}"
            )
        except Exception:
            print(f"  {p.name}  (unreadable)")
    return 0


def cmd_draft(args: argparse.Namespace) -> int:
    if args.draft_cmd == "compose":
        return cmd_draft_compose(args)
    if args.draft_cmd == "edit":
        return cmd_draft_edit(args)
    if args.draft_cmd == "list":
        return cmd_draft_list(args)
    die(f"unknown draft subcommand: {args.draft_cmd}")


def send_maildir_drop(msg: EmailMessage, md: Path) -> Path:
    """SMTP_MODE=maildir_drop: write into sent/ (+new as local drop copy)."""
    ensure_maildir(md)
    ts = int(time.time())
    fname = f"{ts}.M{ts % 1000000}P{os.getpid()}.sent.desk"
    raw = msg.as_bytes()
    for folder in ("sent", "new"):
        dest_dir = md / folder
        dest_dir.mkdir(parents=True, exist_ok=True)
        tmp = md / "tmp" / f"{fname}.{folder}"
        tmp.write_bytes(raw)
        os.chmod(tmp, 0o600)
        final = dest_dir / fname
        tmp.replace(final)
    print(f"desk-mail send: mode=maildir_drop wrote sent/+new/ {fname}")
    return md / "sent" / fname


def send_smtp_real(msg: EmailMessage, smtp_env: Dict[str, str]) -> None:
    host = smtp_env.get("SMTP_HOST") or ""
    port = int(smtp_env.get("SMTP_PORT") or "587")
    user = smtp_env.get("SMTP_USER") or ""
    password = smtp_env.get("SMTP_PASS") or ""
    if not host or not user:
        die("SMTP vault missing SMTP_HOST/SMTP_USER")
    # Never log password
    use_ssl = str(smtp_env.get("SMTP_SSL") or "").lower() in ("1", "true", "yes")
    use_starttls = str(smtp_env.get("SMTP_STARTTLS") or "true").lower() in (
        "1",
        "true",
        "yes",
    )
    recipients = [a.strip() for a in (msg.get("To") or "").split(",") if a.strip()]
    if not recipients:
        die("send: no To recipients")
    if use_ssl:
        with smtplib.SMTP_SSL(host, port, timeout=60) as s:
            if user and password:
                s.login(user, password)
            s.send_message(msg)
    else:
        with smtplib.SMTP(host, port, timeout=60) as s:
            s.ehlo()
            if use_starttls:
                s.starttls()
                s.ehlo()
            if user and password:
                s.login(user, password)
            s.send_message(msg)
    print(f"desk-mail send: mode=smtp host={host} to={','.join(recipients)}")


def cmd_send(args: argparse.Namespace) -> int:
    md = ensure_maildir(maildir_path())
    ref = args.path
    path: Optional[Path] = None
    if ref in ("draft", "last-draft"):
        drafts = sorted(drafts_dir(md).glob("*.eml"), key=lambda p: p.stat().st_mtime)
        if not drafts:
            die("no drafts to send")
        path = drafts[-1]
    else:
        cand = Path(ref)
        if cand.is_file():
            path = cand
        else:
            alt = drafts_dir(md) / ref
            if alt.is_file():
                path = alt
            else:
                # allow sending an existing maildir message by id
                path = resolve_message(md, ref)
    assert path is not None
    msg = parse_message(path.read_bytes())
    # rebuild as EmailMessage for send_message
    out = EmailMessage()
    for h in ("From", "To", "Cc", "Bcc", "Subject", "Date", "Message-ID"):
        if msg.get(h):
            out[h] = msg.get(h)
    if not out.get("From"):
        out["From"] = ADDRESS
    if not out.get("Date"):
        out["Date"] = format_datetime(datetime.now(timezone.utc))
    out.set_content(msg_body(msg), subtype="plain", charset="utf-8")

    smtp_env = load_env_file(SMTP_ENV)
    mode = (smtp_env.get("SMTP_MODE") or "").strip().lower()
    # Safe default: maildir_drop when unset, vault missing, or port 0 placeholder
    if not mode:
        try:
            port = int(smtp_env.get("SMTP_PORT") or "0")
        except ValueError:
            port = 0
        if not smtp_env or port == 0:
            mode = "maildir_drop"
        else:
            mode = "smtp"
    to_addrs = (out.get("To") or "").lower()

    if mode == "maildir_drop":
        send_maildir_drop(out, md)
        return 0

    # Real SMTP: only allow loopback to automation.desk@ unless --force-external
    if ADDRESS.lower() not in to_addrs and not getattr(args, "force_external", False):
        die(
            f"SMTP_MODE={mode}: refusing external send to {out.get('To')!r} "
            f"(use To={ADDRESS} for loopback prove, or --force-external)"
        )
    send_smtp_real(out, smtp_env)
    # also archive to sent/
    send_maildir_drop(out, md)
    return 0


def cmd_status(_args: argparse.Namespace) -> int:
    imap = load_env_file(IMAP_ENV)
    smtp = load_env_file(SMTP_ENV)
    md = ensure_maildir(maildir_path({**imap, **smtp}))
    n_new = len(list((md / "new").glob("*"))) if (md / "new").is_dir() else 0
    n_cur = len(list((md / "cur").glob("*"))) if (md / "cur").is_dir() else 0
    n_drafts = len(list((md / ".drafts").glob("*.eml"))) if (md / ".drafts").is_dir() else 0
    n_sent = len(list((md / "sent").glob("*"))) if (md / "sent").is_dir() else 0
    # keys only — never values
    imap_keys = ",".join(sorted(imap.keys())) if imap else "(none)"
    smtp_keys = ",".join(sorted(smtp.keys())) if smtp else "(none)"
    mail_mode = imap.get("MAIL_MODE") or "(unset)"
    smtp_mode = smtp.get("SMTP_MODE") or "(unset)"
    print("desk-mail status")
    print(f"  address: {ADDRESS}")
    print(f"  maildir: {md}")
    print(f"  counts: new={n_new} cur={n_cur} drafts={n_drafts} sent={n_sent}")
    print(f"  vault.imap: {'yes' if vault_present(IMAP_ENV) else 'no'} path={IMAP_ENV}")
    print(f"  vault.smtp: {'yes' if vault_present(SMTP_ENV) else 'no'} path={SMTP_ENV}")
    print(f"  vault.token: {'yes' if vault_present(TOKEN_ENV) else 'no'} path={TOKEN_ENV}")
    print(f"  MAIL_MODE: {mail_mode}")
    print(f"  SMTP_MODE: {smtp_mode}")
    print(f"  imap_keys: {imap_keys}")
    print(f"  smtp_keys: {smtp_keys}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="desk-mail",
        description="automation.desk@ Maildir-first CLI (Hermes/OpenCode/OpenClaw)",
    )
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("sync", help="Worker→Maildir sync via desk-mail-sync.py")
    lp = sub.add_parser("list", help="List Maildir new+cur")
    lp.add_argument("--limit", "-n", type=int, default=50)
    rp = sub.add_parser("read", help="Read full message by ID or path")
    rp.add_argument("ref", help="Message ID or path")
    sp = sub.add_parser("search", help="Search Maildir")
    sp.add_argument("query", help="Case-insensitive query")

    dp = sub.add_parser("draft", help="Draft compose/edit/list")
    dsub = dp.add_subparsers(dest="draft_cmd", required=True)
    dc = dsub.add_parser("compose", help="Write a new draft")
    dc.add_argument("--to", default=ADDRESS)
    dc.add_argument("--subject", required=True)
    dc.add_argument("--body", default="")
    dc.add_argument("--body-file")
    de = dsub.add_parser("edit", help="Replace draft body")
    de.add_argument("path", help="Draft path or basename under .drafts")
    de.add_argument("--body")
    de.add_argument("--body-file")
    dsub.add_parser("list", help="List drafts")

    snd = sub.add_parser("send", help="Send draft/path (maildir_drop or SMTP)")
    snd.add_argument("path", help="Draft path, basename, 'draft', or message id")
    snd.add_argument(
        "--force-external",
        action="store_true",
        help="Allow real SMTP to non-automation.desk recipients",
    )

    sub.add_parser("status", help="Address, maildir counts, vault present yes/no")
    return p


def main(argv: Optional[List[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    handlers = {
        "sync": cmd_sync,
        "list": cmd_list,
        "read": cmd_read,
        "search": cmd_search,
        "draft": cmd_draft,
        "send": cmd_send,
        "status": cmd_status,
    }
    return handlers[args.cmd](args)


if __name__ == "__main__":
    raise SystemExit(main())
