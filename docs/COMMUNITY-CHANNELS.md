# Community channels — Reddit · Discord · GitHub

**Operator:** AMCM ENI · **Lab:** StrataMesh Laboratory · **Node:** FOG-NODE-PT-CM-001  
**Tone:** open-source protocol lab, not crypto hype.  
**Status:** GitHub live · Reddit/Discord **to create** · API moderation **pending credentials**

---

## Channel map

| Channel | Role | Status |
|---------|------|--------|
| [GitHub Discussions](https://github.com/StrataMesh-Laboratory/stratamesh-core/discussions) | Architecture, protocol critique, contributor Q&A | **Live** ([#4 invite](https://github.com/StrataMesh-Laboratory/stratamesh-core/discussions/4)) |
| **Reddit** `r/StrataMesh_DLT` (preferred) | Public forum, long-form, discoverability | **Create** on official account |
| **Discord** *StrataMesh Laboratory* | Real-time lab, tracks, announcements | **Create** + bot |
| Impact Fund | Grants / challenges | [fund.calhegasmorais.pt](https://fund.calhegasmorais.pt/) |
| DeoMail ENI | Personalised outreach | `geral@` / `noreply@eni.calhegasmorais.pt` |

---

## 1. Reddit — official subreddit

### Naming
| Candidate | Notes |
|-----------|--------|
| **r/StrataMesh_DLT** | Preferred — clear DLT + brand |
| r/stratamesh_dlt | lowercase variant |
| r/StrataMesh | Check if taken; avoid confusion with unrelated projects |

### Create (human, once)
1. Log in with the **official** Reddit account for AMCM ENI / Lab (not a throwaway).  
2. Create community → Public → name above.  
3. Description (short):

```
StrataMesh Laboratory — open-source DLT + Fog/Edge substrate (pre-testnet).
Subjects (humans, SCAs) vs objects (STRATA, NFTs). Not mainnet. Not financial advice.
GitHub: github.com/StrataMesh-Laboratory
```

4. Sidebar / wiki: link WHY-YOUR-EXPERTISE-MATTERS, CONTRIBUTING, Discussion #4, Fund.  
5. First post: **Official sticky** — lab status, how to contribute, rules.

### Rules (suggested)
1. Lab honesty — no mainnet / guaranteed returns claims.  
2. Technical > hype; no “next Ethereum” spam.  
3. No financial advice; STRATA is lab-context.  
4. Be excellent to each other; no doxxing.  
5. Self-promotion only if on-topic contribution.

### Official opening thread (template)

**Title:** `[Official] StrataMesh Laboratory — pre-testnet DLT + Fog/Edge · looking for protocol contributors`

**Body:** reuse Discussion #4 substance + links to tracks and Fund. Mark as pinned + announcement if available.

### API integration (moderation)
Reddit **script** app (https://www.reddit.com/prefs/apps):

| Secret (CF Workers) | Purpose |
|---------------------|---------|
| `REDDIT_CLIENT_ID` | App id |
| `REDDIT_CLIENT_SECRET` | App secret |
| `REDDIT_USERNAME` | Official bot/mod user |
| `REDDIT_PASSWORD` | Or refresh token preferred |
| `REDDIT_USER_AGENT` | `StrataMeshLab/1.0 by <username>` |
| `REDDIT_SUBREDDIT` | `StrataMesh_DLT` |

Worker plan: `stratamesh-community` — post sticky, remove rule-breaking, mirror GitHub announcements.

OAuth scope: `identity`, `read`, `submit`, `modposts`, `modconfig`, `privatemessages` (as needed).

---

## 2. Discord — official server

### Server name
**StrataMesh Laboratory**  
Subtitle/topic: `StrataMesh DLT · pre-testnet lab · FOG-NODE-PT-CM-001`

### Channel layout

```
INFORMATION
  #announcements          (mod-only post)
  #start-here             (links, rules, lab status)
  #lab-status             (pulse / FOG node)

CONTRIBUTE
  #track-network          (libp2p / gossip)
  #track-edge             (KubeEdge / devices)
  #track-economy          (Golem/Akash / PoC)
  #track-agents           (SCA / multi-agent)
  #track-worlds           (Godot/Bevy)
  #track-identity
  #good-first-issue

PROTOCOL
  #architecture
  #adversarial            (break it before testnet)

FUND
  #impact-fund            (challenges, not price talk)

VOICE (optional later)
  #lab-office-hours
```

### Roles
| Role | Who |
|------|-----|
| `@Lab` | AMCM ENI operators |
| `@Moderator` | Trusted mods |
| `@Contributor` | Merged PR or accepted challenge |
| `@Track-Network` … | Optional self-assign |
| `@Everyone` | Default |

### Bot (API moderation)
1. https://discord.com/developers/applications → **StrataMesh Laboratory Bot**  
2. Bot token → CF secret `DISCORD_BOT_TOKEN`  
3. Privileged intents: **Server Members**, **Message Content** (if moderating text)  
4. Invite URL scopes: `bot` `applications.commands` — permissions: Manage Messages, Kick, Ban (optional), Moderate Members, Embed Links, Send Messages, Manage Roles (careful).  
5. After join: copy **Guild ID** → `DISCORD_GUILD_ID`  
6. Webhook for `#announcements` → `DISCORD_ANNOUNCE_WEBHOOK` (simple path even before full bot)

### Worker plan (`stratamesh-community`)
| Route | Action |
|-------|--------|
| `POST /discord/announce` | Post to announcements (auth internal+) |
| `POST /discord/mirror-github` | New Discussion/Release → Discord |
| `POST /reddit/submit` | Official posts |
| `POST /mod/report` | Unified mod queue from both |
| `GET /health` | Both APIs configured? |

---

## 3. What you connect so Grok can admin/mod

Hand these as **Cloudflare Worker secrets** (never commit):

```
# Reddit
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
REDDIT_USERNAME=
REDDIT_PASSWORD=          # prefer refresh token if available
REDDIT_USER_AGENT=StrataMeshLab/1.0 by <reddit_username>
REDDIT_SUBREDDIT=StrataMesh_DLT

# Discord
DISCORD_BOT_TOKEN=
DISCORD_GUILD_ID=
DISCORD_ANNOUNCE_WEBHOOK=
DISCORD_PUBLIC_KEY=       # for interaction verification later
```

Then: “proceed — deploy stratamesh-community” and wire routes under `community.calhegasmorais.pt` or `/api/v1/community/*`.

---

## 4. Outreach email (DeoMail) — send policy

| Step | Action |
|------|--------|
| Templates | [OUTREACH-TEMPLATES.md](./OUTREACH-TEMPLATES.md) |
| From | `geral@eni.calhegasmorais.pt` (reply-to same) |
| Volume | 5–15 personalised / day |
| Blocker | Real `targets` with github + email — **no invented addresses** |
| Log | Private CSV (not public git) |

Activation notice already sent via DeoMail to operator (2026-08-25).

---

## 5. Order of operations (checklist)

- [x] GitHub Discussions + invite thread  
- [x] WHY / playbook / templates on repo  
- [x] DeoMail ops activation email  
- [ ] Create Reddit subreddit + sticky  
- [ ] Create Discord server + channels + roles  
- [ ] Create Discord application + bot invite  
- [ ] Create Reddit script app  
- [ ] Put secrets in CF  
- [ ] Deploy `stratamesh-community` worker  
- [ ] Research first 20 targets with public emails only where appropriate (or GitHub-only CTA)  
- [ ] Start Template A batches  

---

## Message discipline (all channels)

Sober, technical, specific. Pre-testnet. Subjects ≠ objects.  
No revolutionary / next Ethereum / guaranteed yield in official posts.
