/**
 * Bancada CGU — reconstructed handheld lot engine.
 *
 * Lessons (public hardware + homebrew docs, rebuilt from scratch):
 *
 * 1. Display is layered, not a single mesh.
 *    BG0 floor tiles, BG1 overlay (rugs/decals), OBJ/OAM movers, Window = HUD.
 *    Ceiling/walls are a separate pass (priority above OBJ when indoors).
 *
 * 2. Collision is a parallel map, not the art.
 *    Each cell has a nibble: empty / solid / trigger / warp.
 *    Movement tests the four corners of a small AABB (pixel-walk, tile-block).
 *
 * 3. Interact is the FACING cell, one tile ahead along yaw.
 *    Use-key talks to that cell (warp, actor script, empty). Radius-nearest
 *    is only a fallback when the facing cell is empty and something sits
 *    inside a short reach.
 *
 * 4. OAM is a budget, not an infinite list. Metasprites (multi-plane props)
 *    share one occupancy cell. Billboards face the camera yaw (cheap affine).
 *
 * 5. Dual view: Engine A is the inhabited lot (3D). Engine B is the tile
 *    radar (2D map of the same occupancy). Stylus/compose paints overlay.
 *
 * 6. Warp is a cell script, not a mesh click. Door cell → fade → load world.
 *
 * 7. Inventory is a fixed slot table. Digit keys fire the script of that slot.
 *
 * No commercial titles, no ROM/ISO import. Mechanics only.
 */

export const TILE = 0.9;
export const OAM_MAX = 40;
export const INV_SLOTS = 8;
export const REACH = 1.15;
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

/** One tile ahead of heading. yaw=0 faces −Z. */
export function facingTile(x: number, z: number, yaw: number, half: number, tile = TILE) {
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  return worldToTile(x + fx * tile, z + fz * tile, half, tile);
}

export function occupy(grid: Uint8Array, n: number, tx: number, tz: number, v = 1) {
  if (tx < 0 || tz < 0 || tx >= n || tz >= n) return;
  grid[tz * n + tx] = v;
}

/** Four-corner AABB vs collision map (handheld walk). */
export function blockedAabb(
  grid: Uint8Array,
  n: number,
  x: number,
  z: number,
  half: number,
  radius = 0.22,
  tile = TILE,
) {
  const pts: [number, number][] = [
    [x - radius, z - radius],
    [x + radius, z - radius],
    [x - radius, z + radius],
    [x + radius, z + radius],
  ];
  for (const [px, pz] of pts) {
    const c = worldToTile(px, pz, half, tile);
    const v = grid[c.tz * n + c.tx];
    if (v === COLL.SOLID) return true;
  }
  return false;
}

export function cellAt(grid: Uint8Array, n: number, tx: number, tz: number) {
  if (tx < 0 || tz < 0 || tx >= n || tz >= n) return COLL.EMPTY;
  return grid[tz * n + tx];
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

export function actorOnTile(list: { x: number; z: number; id: string }[], tx: number, tz: number, half: number, tile = TILE) {
  for (const a of list) {
    const c = worldToTile(a.x, a.z, half, tile);
    if (c.tx === tx && c.tz === tz) return a;
  }
  return null;
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
