import { paceFailed, admit, decide, ALLOW, HOLD, STASIS, P0_BORROW } from "./_metabolism.js";
import { isP0Path, AUTH_CONTINGENCY, preambleAdmit } from "./metabol-admit.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(isP0Path("/health") && isP0Path("/login") && isP0Path("/verify"), "p0 paths");
assert(!isP0Path("/me"), "non-p0");

assert(!paceFailed({ prevCircuit: ALLOW, circuit: STASIS, hourSpent: 9000, hourlyCap: 4000 }), "first STASIS is pace");
assert(paceFailed({ prevCircuit: STASIS, circuit: STASIS, hourSpent: 9000, hourlyCap: 4000 }), "second STASIS freeze-eligible");
assert(paceFailed({ prevCircuit: HOLD, circuit: STASIS, hourSpent: 9000, hourlyCap: 4000 }), "HOLD then STASIS");

const allow = { decision: ALLOW, circuit: "", deflator: 1, remaining: 100000, hourly_cap: 4000 };
const a0 = admit(allow, { rand: 0.9 });
assert(a0.admit && !a0.freeze, "ALLOW never freeze");

const first = { decision: STASIS, circuit: STASIS, deflator: 1, remaining: 50000, hourly_cap: 4000, hour_spent: 9000 };
const a1 = admit(first, { rand: 0.99, prevCircuit: ALLOW, hourSpent: 9000 });
assert(!a1.freeze, "first STASIS freeze false");

const second = { ...first };
const a2 = admit(second, { rand: 0, prevCircuit: STASIS, hourSpent: 9000, isP0: false });
assert(!a2.admit && a2.freeze, "second STASIS freezes non-P0");

const p0 = admit(second, { rand: 0, prevCircuit: STASIS, hourSpent: 9000, isP0: true });
assert(p0.admit && !p0.freeze && p0.reason === P0_BORROW, "P0 admits on freeze");

const hold = { decision: HOLD, circuit: HOLD, deflator: 0.5, remaining: 50000, hourly_cap: 4000 };
assert(!admit(hold, { rand: 0.9 }).freeze && admit(hold, { rand: 0.9 }).admit === false, "HOLD never freeze");
assert(admit(hold, { rand: 0.1 }).admit === true, "HOLD paces");

const hop = { ...second, contingency_url: AUTH_CONTINGENCY.url, contingency_ok: true };
const a3 = admit(hop, { rand: 0.99, prevCircuit: STASIS, hourSpent: 9000 });
assert(a3.admit && !a3.freeze && a3.via === "contingency", "paceFailed + contingency fail-open");

const nohop = { ...second, contingency_url: "", contingency_ok: false };
const a4 = admit(nohop, { rand: 0, prevCircuit: STASIS, hourSpent: 9000 });
assert(!a4.admit && a4.freeze, "paceFailed + no contingency freeze");

const cfg = { rails: { "cf-worker-req": { daily_limit: 100000, kind: "rate" } }, density: {} };
const pack = decide("cf-worker-req", { cfg, remaining: 100000, now: new Date("2026-09-02T01:00:00Z") });
assert(pack.freeze === false, "decide ALLOW freeze false");

const pre = preambleAdmit("/login", hop, { admit, rand: 0, isP0: true });
assert(pre.admit, "login is P0");

console.log("ok metabol-admit");
