# Deploy Status Worker — Commands

## Option A — Cloudflare Dashboard (fastest)
1. Go to https://dash.cloudflare.com → Workers & Pages → Create application → Create Worker
2. Name it `stratamesh-status`
3. Paste the contents of `cloudflare-worker-status.js`
4. Deploy
5. (Optional) Add a custom domain / route: status.calhegasmorais.pt

## Option B — Wrangler CLI
```bash
npm install -g wrangler
# Authenticate (one-time)
wrangler login
# From the deploy/ directory
wrangler deploy
```

## Option C — Static files on origin
Upload `../status/index.html` and `../status/status.json` to the web root or `/status/` path on the origin (94.126.169.39).

## After deploy
curl https://<worker-subdomain>.workers.dev/status
# or
curl https://status.calhegasmorais.pt/status
