# StrataMesh Phase 0 — Deployment Notes

## 1. Local simulation (immediate)

```bash
cd src
python3 local_dag_node.py --port 8787
```

Then:
- `curl http://localhost:8787/status`
- `curl -X POST http://localhost:8787/submit -H 'Content-Type: application/json' -d '{"type":"lightweight"}'`

This gives you a live local Fog Node you can point tools at while the real origin is instrumented.

## 2. Public status page via Cloudflare Worker

File: `cloudflare-worker-status.js`

Options:
- Cloudflare Dashboard → Workers & Pages → Create Worker → paste the script → Deploy
- Or use Wrangler:
  ```bash
  npm create cloudflare@latest
  # replace worker code with cloudflare-worker-status.js
  npx wrangler deploy
  ```

You can then attach a route such as `status.calhegasmorais.pt/*` or `calhegasmorais.pt/status*`.

## 3. Static assets on origin

Upload the contents of `status/` (index.html + status.json) to the origin web root or a `/status/` path.
The existing Cloudflare zone already proxies the domain; once the files are on the origin they will be served (subject to current WAF/403 rules).

## 4. Recommended order
1. Run local simulation and verify tip selection + status API.
2. Deploy the Worker (or static files) so the public has a visible pulse.
3. Open the public repository with the current artefacts.
4. Begin wiring real node metrics into status.json / the Worker.
