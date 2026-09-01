#!/usr/bin/env node
/* Fog Node middleware — loopback only. Not public origin. */
const http = require("http");
const PORT = parseInt(process.env.FOG_MW_NODE_PORT || "8791", 10);
const server = http.createServer((req, res) => {
  const url = (req.url || "/").split("?")[0];
  if (req.method === "GET" && (url === "/" || url === "/health" || url === "/mw/health")) {
    const body = JSON.stringify({
      ok: true,
      runtime: "node",
      port: PORT,
      role: "middleware",
    });
    res.writeHead(200, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) });
    res.end(body);
    return;
  }
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: false }));
});
server.listen(PORT, "127.0.0.1");
