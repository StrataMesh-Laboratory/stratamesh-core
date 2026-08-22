/** Project a portrait onto a head sphere: polar UVs, atlas, no billboard plane. */

type Geo = {
  attributes: {
    position: {
      count: number;
      getX?: (i: number) => number;
      getY?: (i: number) => number;
      getZ?: (i: number) => number;
      array: ArrayLike<number>;
    };
    uv: {
      setXY?: (i: number, u: number, v: number) => void;
      needsUpdate: boolean;
      array: Float32Array | number[];
    };
  };
};

export function remapSphereFaceUVs(geo: Geo) {
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const n = pos.count;
  for (let i = 0; i < n; i++) {
    const x = pos.getX ? pos.getX(i) : pos.array[i * 3];
    const y = pos.getY ? pos.getY(i) : pos.array[i * 3 + 1];
    const z = pos.getZ ? pos.getZ(i) : pos.array[i * 3 + 2];
    const l = Math.hypot(x, y, z) || 1;
    const nx = x / l;
    const ny = y / l;
    const nz = z / l;
    const u = (Math.atan2(nx, nz) / Math.PI) * 0.5 + 0.5;
    const v = ny * 0.5 + 0.48;
    if (uv.setXY) uv.setXY(i, u, v);
    else {
      uv.array[i * 2] = u;
      uv.array[i * 2 + 1] = v;
    }
  }
  uv.needsUpdate = true;
}

export function paintFaceAtlas(image: CanvasImageSource, size = 1024): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  ctx.fillStyle = "#c4a07a";
  ctx.fillRect(0, 0, size, size);
  try {
    const tmp = document.createElement("canvas");
    tmp.width = tmp.height = 4;
    const tctx = tmp.getContext("2d");
    if (tctx) {
      tctx.drawImage(image, 0, 0, 4, 4);
      const d = tctx.getImageData(2, 0, 1, 1).data;
      ctx.fillStyle = `rgb(${d[0]},${d[1]},${d[2]})`;
      ctx.fillRect(0, 0, size, size);
    }
  } catch {
    /* CORS or empty */
  }
  const cx = size * 0.5;
  const cy = size * 0.46;
  const rx = size * 0.3;
  const ry = size * 0.38;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(image, cx - rx, cy - ry, rx * 2, ry * 2);
  ctx.restore();
  return c;
}
