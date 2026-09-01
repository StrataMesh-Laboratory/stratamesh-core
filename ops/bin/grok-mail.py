#!/usr/bin/env python3
"""Local grok@ desk client — IMAP/SMTP to the hosting box. Not CF. Not Gmail connectors.
Vault ~/.config/stratamesh/:
  mail.user   default grok@calhegasmorais.pt
  mail.pass
  mail.host   default 94.126.169.39
Never prints the password.
"""
from __future__ import annotations
import imaplib, smtplib, ssl, sys
from email.message import EmailMessage
from pathlib import Path

VAULT = Path.home() / ".config" / "stratamesh"
USER_DEFAULT = "grok@calhegasmorais.pt"
HOST_DEFAULT = "94.126.169.39"

def read(name, default=""):
    p = VAULT / name
    if p.is_file():
        return p.read_text().strip()
    return default

def creds():
    return {
        "user": read("mail.user", USER_DEFAULT),
        "pw": read("mail.pass"),
        "host": read("mail.host", HOST_DEFAULT),
    }

def send(to, subject, body):
    c = creds()
    if not c["pw"]:
        print("no mail.pass in vault"); return 2
    msg = EmailMessage()
    msg["From"] = c["user"]
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)
    ctx = ssl.create_default_context()
    last = None
    for port, factory in ((587, "starttls"), (465, "ssl")):
        try:
            if factory == "ssl":
                with smtplib.SMTP_SSL(c["host"], port, context=ctx, timeout=20) as s:
                    s.login(c["user"], c["pw"]); s.send_message(msg)
            else:
                with smtplib.SMTP(c["host"], port, timeout=20) as s:
                    s.ehlo(); s.starttls(context=ctx); s.login(c["user"], c["pw"]); s.send_message(msg)
            print("sent", to, "via", c["host"], port)
            return 0
        except Exception as e:
            last = e
    print("send-fail", last)
    return 1

def ping():
    c = creds()
    print("user", c["user"])
    print("host", c["host"])
    print("has_pass", bool(c["pw"]))
    if not c["pw"]:
        return 2
    ctx = ssl.create_default_context()
    try:
        imap = imaplib.IMAP4_SSL(c["host"], 993, ssl_context=ctx)
        imap.login(c["user"], c["pw"])
        typ, data = imap.status("INBOX", "(MESSAGES UNSEEN)")
        print("imap", typ, data)
        imap.logout()
        return 0
    except Exception as e:
        print("imap-fail", e)
        return 1

def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "ping"
    if cmd == "ping":
        sys.exit(ping())
    if cmd == "send":
        to = sys.argv[2] if len(sys.argv) > 2 else creds()["user"]
        subject = sys.argv[3] if len(sys.argv) > 3 else "desk"
        body = sys.argv[4] if len(sys.argv) > 4 else ""
        if not body and not sys.stdin.isatty():
            body = sys.stdin.read()
        sys.exit(send(to, subject, body))
    print("usage: grok-mail.py ping | send [to] [subject] [body]")

if __name__ == "__main__":
    main()
