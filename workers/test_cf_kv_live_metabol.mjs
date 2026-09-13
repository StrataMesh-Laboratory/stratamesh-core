import assert from "node:assert/strict";
import {
  metabolFromLiveSample,
  parseKvOperationsGroups,
  hoursLeftUtcMidnight,
  KV_WRITE_DAILY,
} from "./cf_kv_live_metabol.js";

assert.equal(parseKvOperationsGroups([
  { dimensions: { actionType: "write" }, sum: { requests: 159 } },
  { dimensions: { actionType: "read" }, sum: { requests: 400 } },
  { dimensions: { actionType: "list" }, sum: { requests: 17 } },
]).writes_used, 159);

const unk = metabolFromLiveSample("macbook", null);
assert.equal(unk.decision, "HOLD");
assert.equal(unk.remaining, 0);
assert.equal(unk.sample_unknown, true);
assert.match(unk.reason, /do not invent/);

const unk2 = metabolFromLiveSample("macbook", { ok: false, error: "x" });
assert.equal(unk2.decision, "HOLD");
assert.equal(unk2.remaining, 0);

const live = metabolFromLiveSample("macbook", {
  ok: true,
  writes_used: 159,
  writes_hour: 0,
  sampled_at: "2026-09-13T12:00:00Z",
});
assert.equal(live.remaining, KV_WRITE_DAILY - 159);
assert.equal(live.day_spent, 159);
assert.equal(live.sample_unknown, false);
assert.equal(live.decision, "ALLOW");
assert.ok(live.remaining !== 1000);

const empty = metabolFromLiveSample("macbook", {
  ok: true,
  writes_used: 0,
  sampled_at: "2026-09-13T12:00:00Z",
});
assert.equal(empty.remaining, 1000);
assert.equal(empty.day_spent, 0);
assert.equal(empty.sample_unknown, false);
assert.match(empty.reason, /live CF KV/);

const standby = metabolFromLiveSample("cf-standby", {
  ok: true,
  writes_used: 100,
  sampled_at: "2026-09-13T12:00:00Z",
});
assert.ok(standby.pace <= 0.5);

assert.ok(hoursLeftUtcMidnight() > 0);
console.log("ok cf_kv_live_metabol tests");
