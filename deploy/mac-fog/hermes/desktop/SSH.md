# Shared desk machine — Hermes desktop via SSH

**Why:** André’s Fog Mac (`mbpv`) is **Intel** — Grok Bot app is **not** supported there. Desk agents must not depend on Bot Computers registration.

**Shared desk machine** = Hermes desktop workspace on that Mac (FOG-CMN-DESK). STRATAGROK Bot computer stays separate (meters/git/escalation only).

## Identity

| Field | Value |
|-------|-------|
| Host (Tailscale MagicDNS / status name) | `mbpv` |
| Tailscale IPv4 | `100.108.35.26` (confirm with `tailscale ip -4` on Mac) |
| SSH alias | `hermes-desk` |
| User | `andremorais` (Mac login) |
| Workspace root | `/Users/andremorais/StrataMesh/fog/repo/deploy/mac-fog/hermes/desktop` |
| Fog repo | `/Users/andremorais/StrataMesh/fog/repo` |
| Access | Tailscale SSH and/or Remote Login (`sshd`) over Tailscale only |

Lab is Adversarial **P1**. No workers.dev. Never put private keys in git/chat.

## Who SSHs here

| Agent | Role on shared machine |
|-------|-------------------------|
| Hermes | Native desktop host; primary workspace |
| OpenCode | SSH/session into same Mac for code Acts |
| OpenClaw | SSH/session into same Mac for claw probes |
| Fog/EDGE Assistants | Consume reports only — no SSH required |
| STRATAGROK | Escalate/representative; does **not** share Bot desktop |

## Mac one-shot enable (Intel workaround)

```bash
bash /Users/andremorais/StrataMesh/fog/repo/deploy/mac-fog/hermes/desktop/install-desk-ssh.sh
```

Or after `g` pulls this file. Script turns on Tailscale SSH + Remote Login and prints `READY hermes-desk=…`.

## Client SSH config (box / peers — paths only)

Install snippet (no secrets):

```bash
mkdir -p ~/.ssh && chmod 700 ~/.ssh
cat >> ~/.ssh/config <<'CFG'
Host hermes-desk mbpv
  HostName 100.108.35.26
  User andremorais
  IdentityFile ~/.ssh/desk_hermes_ed25519
  IdentitiesOnly yes
  StrictHostKeyChecking accept-new
CFG
chmod 600 ~/.ssh/config
```

Generate a **desk agent** key once on the client (box or agent host), then install the **public** key on the Mac:

```bash
# on client
ssh-keygen -t ed25519 -f ~/.ssh/desk_hermes_ed25519 -N '' -C 'desk-agent-hermes'
# copy ONLY .pub to Mac authorized_keys (Tailscale file / paste once)
```

Mac:

```bash
mkdir -p ~/.ssh && chmod 700 ~/.ssh
# append desk_hermes_ed25519.pub contents:
# cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys
```

## Prove

```bash
# from box / agent host with Tailscale up
tailscale ssh andremorais@mbpv 'hostname; test -d /Users/andremorais/StrataMesh/fog/repo/deploy/mac-fog/hermes/desktop && echo HERMES_DESK_OK'
# or after config:
ssh hermes-desk 'cd /Users/andremorais/StrataMesh/fog/repo && git rev-parse --short HEAD'
```

## Deny

- Grok Bot Computers registration (unsupported on Intel Mac)
- Sharing STRATAGROK Bot desktop with desk agents
- Committing private keys / `authorized_keys` private material
- Opening SSH to the public internet (Tailscale / overlay only)
