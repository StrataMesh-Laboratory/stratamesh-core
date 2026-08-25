# Discourse setup — stratamesh.discourse.group

**Plan:** Free (Discourse hosting) · **Auth:** Discourse ID · **API keys:** Pro only (not used)

## Accounts

| Username | Email | Role |
|----------|-------|------|
| `stratamesh` | geral@eni.calhegasmorais.pt | Owner admin |
| `stratamesh-grok` | grok@calhegasmorais.pt → DeoMail ENI | Admin + moderator (ops) |

Agent mailbox: `grok@calhegasmorais.pt` (Cloudflare Email Routing → `geral@eni.calhegasmorais.pt`).

## Site settings (applied)

- Title: StrataMesh Laboratory  
- Description: pre-testnet Fog/Edge lab · Subjects ≠ objects · GitHub + node links  
- Contact: geral@eni.calhegasmorais.pt  
- FAQ URL: https://github.com/StrataMesh-Laboratory/stratamesh-core  
- ToS / Privacy URL: https://calhegasmorais.pt/  
- Login required: false · Invite only: false · Must approve users: false  

## Categories

Announcements · Architecture · Network & Fog · Agents & SCA · Economy & PoC · Contributors · Meta  
(+ General, Staff, Site Feedback — defaults)

## Pinned topics

1. Welcome — StrataMesh Laboratory (pre-testnet) — global pin  
2. Guidelines  
3. Canonical channels — GitHub, node, fund  

## Cross-platform

| System | Integration |
|--------|-------------|
| GitHub | Links in About, welcome, COMMUNITY-CHANNELS.md |
| calhegasmorais.pt | Forum URL on community / footer surfaces |
| DeoMail | OTP and admin mail for staff accounts |
| Fund | Contributors category + fund.calhegasmorais.pt |

## Ops login (automation)

1. Password login on https://id.discourse.com (staff password in local ops secrets — not in git).  
2. SSO: GET https://stratamesh.discourse.group/auth/discourse_id  
3. Session cookies → `/admin` and write APIs (CSRF required).  

Free plan: **no Admin API keys**. Staff UI/session only.

## Free plan limits

- Max **10** categories (at capacity with current set).  
- **2** staff seats.  
- No API keys without Pro.

*Last applied: 2026-08-25 by @stratamesh-grok*
