#!/usr/bin/env node
import http from "node:http";
const PORT = parseInt(process.env.FOG_MW_NODE_PORT || "8791", 10);
const server = http.createServer((req, res) => {
  const url = String(req.url || "/").split("?")[0];
  if (req.method === "GET" && (url === "/" || url === "/health" || url === "/mw/health")) {
    const body = JSON.stringify({ ok: true, runtime: "node", port: PORT, role: "middleware", listening: true });
    res.writeHead(200, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) });
    res.end(body);
    return;
  }
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: false }));
});
server.on("error", (err) => {
  process.stderr.write(String(err && err.stack || err) + "\n");
  process.exit(1);
});
server.listen(PORT, "127.0.0.1", () => {
  process.stderr.write("fog-mw node listening 127.0.0.1:" + PORT + "\n");
});
