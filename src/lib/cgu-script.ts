/**
 * Lot script VM — reconstructed from zlib Butano `sprite_actions` /
 * `value_template_actions` (Gustavo Valiente): a queue of timed actions
 * committed onto an actor, not a ROM interpreter.
 *
 * PDRoms.de is the legal homebrew catalog (author-permission builds).
 * MAMEDEV free sets stay on mamedev.org — their terms forbid bundling here.
 */

export type LotAction =
  | { op: "say"; text: string; dur?: number }
  | { op: "give"; id: string }
  | { op: "wait"; dur?: number }
  | { op: "warp" };

export class ScriptQ {
  q: LotAction[] = [];
  current: LotAction | null = null;
  t = 0;

  push(a: LotAction | LotAction[]) {
    this.q.push(...(Array.isArray(a) ? a : [a]));
  }

  get saying(): string | null {
    return this.current?.op === "say" ? this.current.text : null;
  }

  step(dt: number): LotAction | null {
    if (!this.current) {
      this.current = this.q.shift() ?? null;
      this.t = 0;
    }
    const cur = this.current;
    if (!cur) return null;
    if (cur.op === "give" || cur.op === "warp") {
      this.current = null;
      return cur;
    }
    this.t += dt;
    if (this.t >= (cur.dur ?? 1.8)) {
      this.current = null;
      this.t = 0;
    }
    return cur;
  }
}
