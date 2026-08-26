# Discourse automation (Free plan session path)

**Forum:** https://stratamesh.discourse.group  
**Bot user:** `stratamesh-grok` (`grok@calhegasmorais.pt`) — admin via session  
**No Admin API keys** (Pro-gated). Uses Discourse ID password + CSRF cookie jar.

## Local tooling

```
artifacts/discourse-bot/
  bin/discourse_client.py
  templates/ops-pulse.md
  state/
```

```bash
python3 bin/discourse_client.py login
python3 bin/discourse_client.py announce "Title" templates/ops-pulse.md 5
python3 bin/discourse_client.py reply 20 "markdown body or path"
```

Category ids (public): Announcements=5, General=4, Meta=11, …

## Flow

1. CSRF + password login on `id.discourse.com`
2. Hit `/auth/discourse_id` for forum SSO cookies
3. Forum CSRF → `POST /posts.json` (create/reply) or `PUT /posts/{id}.json`

See also [OPS-EMAIL-AGENT-SOP.md](./OPS-EMAIL-AGENT-SOP.md) for magic-link recovery if password session fails.

## Proven

- Topic: https://stratamesh.discourse.group/t/edge-grok-ops-pulse-mesh-api-edge-discovery-lab/20
