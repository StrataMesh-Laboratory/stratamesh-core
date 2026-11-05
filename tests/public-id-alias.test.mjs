// PT-SM-001 public alias: node_id must stay FOG-NODE-PT-CM-001 for protocol continuity.
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const files = ["shared/holonic-clp.js","workers/_foundation_holonic_clp.js","workers/stratamesh-acb.js","workers/stratamesh-aiops.js","workers/stratamesh-dag.js","workers/stratamesh-holons.js","workers/stratamesh-orchestrator.js","workers/stratamesh-status.js"];
for (const f of files) {
  const s = readFileSync(f, "utf8");
  const i = s.indexOf('node_id: "FOG-NODE-PT-CM-001"');
  assert.ok(i >= 0, f + ": internal node_id kept");
  const blk = s.slice(i, i + 400);
  assert.match(blk, /public_id: "PT-SM-001"/, f);
  assert.match(blk, /public_name: "Spencer-Morais Node"/, f);
}
const g = readFileSync("workers/stratamesh-gossip.js", "utf8");
assert.match(g, /const NODE_ID = 'FOG-NODE-PT-CM-001'/);
console.log("public-id-alias: ok", files.length, "files");
