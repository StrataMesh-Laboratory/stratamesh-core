/**
 * Bancada CGU runtime — tile BG, occupancy, actors, dual-view radar.
 * Mechanics only (MIT/GPL handheld engines + CC0 packs). No commercial titles.
 */

export const TILE = 0.9;
export const OAM_MAX = 40;
export const INV_SLOTS = 8;
export const PALETTE = [0x1a1008, 0x4a2410, 0x8a4a24, 0xc48a3a, 0xf3e2c4, 0xfff6e4, 0x8a2a1a, 0xd4a017];
export const COLL = { EMPTY: 0, SOLID: 1, TRIGGER: 2, DOOR: 3 } as const;

export function gridCount(half: number, tile = TILE) {
  return Math.max(8, Math.round((half * 2) / tile));
}

export function worldToTile(x: number, z: number, half: number, tile = TILE) {
  const n = gridCount(half, tile);
  const tx = Math.floor((x + half) / tile);
  const tz = Math.floor((z + half) / tile);
  return { tx: Math.max(0, Math.min(n - 1, tx)), tz: Math.max(0, Math.min(n - 1, tz)), n };
}

export function tileCenter(tx: number, tz: number, half: number, tile = TILE) {
  return { x: -half + tile * (tx + 0.5), z: -half + tile * (tz + 0.5) };
}

export function snapTile(v: number, tile = TILE) {
  return Math.round(v / tile) * tile;
}

export type ActorKind = "avatar" | "prop" | "trigger";

export type Actor = {
  id: string;
  kind: ActorKind;
  x: number;
  z: number;
  r: number;
  solid: boolean;
  script?: "use" | "door" | "pad";
};

export type Trigger = {
  id: string;
  kind: "door" | "use" | "pad";
  x: number;
  z: number;
  r: number;
};

export function occupy(grid: Uint8Array, n: number, tx: number, tz: number, v = 1) {
  if (tx < 0 || tz < 0 || tx >= n || tz >= n) return;
  grid[tz * n + tx] = v;
}

export function blockedGrid(grid: Uint8Array, n: number, x: number, z: number, half: number, tile = TILE) {
  const { tx, tz } = worldToTile(x, z, half, tile);
  const v = grid[tz * n + tx];
  return v === COLL.SOLID;
}

export function nearestActor(list: Actor[], x: number, z: number): Actor | null {
  let best: Actor | null = null;
  let d = 99;
  for (const a of list) {
    const n = Math.hypot(a.x - x, a.z - z);
    if (n < a.r && n < d) {
      d = n;
      best = a;
    }
  }
  return best;
}

export function toonRamp(steps = 8) {
  const data = new Uint8Array(steps * 4);
  const stops = [
    [48, 28, 16],
    [90, 52, 24],
    [140, 88, 40],
    [196, 140, 72],
    [232, 196, 140],
    [248, 228, 188],
    [255, 246, 228],
    [255, 252, 240],
  ];
  for (let i = 0; i < steps; i++) {
    const s = stops[Math.min(stops.length - 1, i)];
    data[i * 4] = s[0];
    data[i * 4 + 1] = s[1];
    data[i * 4 + 2] = s[2];
    data[i * 4 + 3] = 255;
  }
  return data;
}
