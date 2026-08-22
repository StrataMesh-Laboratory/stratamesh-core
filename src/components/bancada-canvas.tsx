import { useEffect, useRef, useState } from "react";
import type { Object3D } from "three";
import type { Nft } from "@/lib/lab-kernel";
import { DEFAULT_WORLD } from "@/lib/bancada-store";
import { cidGatewayUrl, nftMediaRef, parseCid } from "@/lib/bancada-ipfs";
import { COLL, INV_SLOTS, OAM_MAX, REACH, TILE, actorOnTile, blockedAabb, cellAt, facingTile, gridCount, occupy, snapTile, toonRamp, worldToTile } from "@/lib/cgu-engine";
import { HOMEBREW_CARTS } from "@/lib/cgu-carts";
import { paintFaceAtlas, remapSphereFaceUVs } from "@/lib/cgu-face";
import { ScriptQ } from "@/lib/cgu-script";

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      setKeys?: (codes: string[]) => void;
    };
  }
}

type Presence = "inhabit" | "orbit" | "compose";

export function BancadaCanvas({
  nfts,
  avatar,
  worldId = DEFAULT_WORLD,
  lang = "pt",
  transforms = {},
  onPick,
  onEnterWorld,
  onPlace,
}: {
  nfts: Nft[];
  avatar?: Nft | null;
  worldId?: string;
  lang?: "pt" | "en";
  transforms?: Record<string, { x: number; z: number }>;
  onPick: (id: string) => void;
  onEnterWorld?: (worldId: string) => void;
  onPlace?: (id: string, x: number, z: number) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const radarRef = useRef<HTMLCanvasElement>(null);
  const [presence, setPresence] = useState<Presence>("inhabit");
  const [prompt, setPrompt] = useState("");
  const [locked, setLocked] = useState(false);
  const [loadingWorld, setLoadingWorld] = useState(false);
  const [placing, setPlacing] = useState(false);
  const presenceRef = useRef<Presence>("inhabit");
  const onPickRef = useRef(onPick);
  const onEnterRef = useRef(onEnterWorld);
  const onPlaceRef = useRef(onPlace);
  const transformsRef = useRef(transforms);
  const avatarRef = useRef(avatar);
  onPickRef.current = onPick;
  onEnterRef.current = onEnterWorld;
  onPlaceRef.current = onPlace;
  transformsRef.current = transforms;
  avatarRef.current = avatar;
  presenceRef.current = presence;
  const pt = lang === "pt";

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let dead = false;
    let dispose = () => {};

    void import("three").then((THREE) => {
      if (dead || !host.current) return;
      const stage = host.current;
      const HALF = 7.2;
      const HEIGHT = 3.4;
      const EYE = 1.4;
      const DOOR_Z = HALF - 0.12;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x2a1810);
      scene.fog = new THREE.Fog(0xc9a06a, 16, 32);

      const camera = new THREE.PerspectiveCamera(72, 1, 0.08, 80);
      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
      } catch {
        renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
      }
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      if ("outputColorSpace" in renderer && THREE.SRGBColorSpace) {
        (renderer as { outputColorSpace: string }).outputColorSpace = THREE.SRGBColorSpace;
      }
      renderer.toneMapping = THREE.NoToneMapping;
      renderer.setClearColor(0xf4e4c1, 1);
      renderer.domElement.style.display = "block";
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.style.cursor = "crosshair";
      renderer.domElement.style.touchAction = "none";
      renderer.domElement.tabIndex = 0;
      stage.style.touchAction = "none";
      stage.style.overflow = "hidden";
      const scan = document.createElement("div");
      scan.setAttribute("aria-hidden", "true");
      scan.style.cssText = "position:absolute;inset:0;pointer-events:none;z-index:5;background:repeating-linear-gradient(180deg,rgba(26,16,8,.08) 0 1px,transparent 1px 3px);mix-blend-mode:multiply";
      stage.appendChild(scan);
      const fade = document.createElement("div");
      fade.style.cssText = "position:absolute;inset:0;z-index:9;background:#1a1008;opacity:0;pointer-events:none;transition:opacity .28s linear";
      stage.appendChild(fade);
      function warpFade(go: () => void) {
        fade.style.opacity = "1";
        window.setTimeout(() => {
          go();
          fade.style.opacity = "0";
        }, 280);
      }
      renderer.domElement.addEventListener("webglcontextlost", (ev) => ev.preventDefault());
      stage.appendChild(renderer.domElement);

      const yaw = { v: 0 };
      const pitch = { v: 0 };
      const pos = { x: 0, y: EYE, z: HALF - 1.8 };
      const keys = new Set<string>();
      const clock = { last: performance.now() };
      const queue: { x: number; z: number; then?: "use" | "door"; id?: string }[] = [];
      const carry = { id: "" };
      const gait = { t: 0 };
      const undo: { id: string; x: number; z: number }[] = [];
      const stick = { x: 0, y: 0 };
      const look = { x: 0, y: 0 };
      const dragLook = { on: false, lx: 0, ly: 0, moved: 0 };
      let lastHud = "";
      function hud(text: string) {
        if (text === lastHud) return;
        lastHud = text;
        setPrompt(text);
      }

      function size() {
        const w = Math.max(stage.clientWidth, 320);
        const h = Math.max(stage.clientHeight, 280);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      }
      size();

      scene.add(new THREE.HemisphereLight(0xffe6b8, 0x5a3a22, 1.05));
      const sun = new THREE.DirectionalLight(0xfff4dc, 1.05);
      sun.position.set(3, 7, 4);
      scene.add(sun);
      const fill = new THREE.PointLight(0xffcc88, 0.55, 18, 2);
      fill.position.set(0, HEIGHT - 0.7, 0);
      scene.add(fill);

      const gradData = toonRamp(8);
      const grad = new THREE.DataTexture(gradData, 8, 1);
      grad.magFilter = THREE.NearestFilter;
      grad.minFilter = THREE.NearestFilter;
      grad.needsUpdate = true;

      function lantern(x: number, z: number) {
        const g = new THREE.Group();
        const bulb = new THREE.Mesh(
          new THREE.SphereGeometry(0.16, 12, 12),
          new THREE.MeshToonMaterial({ color: 0xffd27a, emissive: 0xff9a2e, emissiveIntensity: 1.1, gradientMap: grad }),
        );
        bulb.position.y = HEIGHT - 0.55;
        g.add(bulb);
        const cord = new THREE.Mesh(
          new THREE.CylinderGeometry(0.012, 0.012, 0.45, 6),
          new THREE.MeshToonMaterial({ color: 0x3a2418, gradientMap: grad }),
        );
        cord.position.y = HEIGHT - 0.28;
        g.add(cord);
        g.position.set(x, 0, z);
        scene.add(g);
      }
      lantern(-4.2, -4.2);
      lantern(4.2, -4.2);
      lantern(-4.2, 4.2);
      lantern(4.2, 4.2);

      const wallMat = new THREE.MeshToonMaterial({ color: 0xe8d4b8, gradientMap: grad });
      const trimMat = new THREE.MeshToonMaterial({ color: 0x6b3a1c, gradientMap: grad });
      const floorMat = new THREE.MeshToonMaterial({ color: 0x8a5a28, gradientMap: grad });
      const ceilMat = new THREE.MeshToonMaterial({ color: 0xf4ead8, gradientMap: grad });
      function dress(mat: InstanceType<typeof THREE.MeshToonMaterial>, file: string, rx: number, ry: number) {
        new THREE.TextureLoader().load("/os/tex/" + file, (tex) => {
          if (dead) return;
          tex.wrapS = THREE.RepeatWrapping;
          tex.wrapT = THREE.RepeatWrapping;
          tex.repeat.set(rx, ry);
          tex.anisotropy = 8;
          if ("colorSpace" in tex && THREE.SRGBColorSpace) (tex as { colorSpace: string }).colorSpace = THREE.SRGBColorSpace;
          mat.map = tex;
          mat.needsUpdate = true;
        });
      }
      dress(floorMat, "wood-floor.jpg", 6, 6);
      dress(wallMat, "plaster.jpg", 3, 2);
      dress(ceilMat, "ceiling.jpg", 2, 2);
      dress(trimMat, "wood-dark.jpg", 4, 1);

      const floor = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2, 0.12, HALF * 2), floorMat);
      floor.position.y = -0.06;
      scene.add(floor);
      const tilesN = gridCount(HALF, TILE);
      const tileGeo = new THREE.PlaneGeometry(TILE * 0.98, TILE * 0.98);
      tileGeo.rotateX(-Math.PI / 2);
      const tileMat = floorMat.clone();
      tileMat.vertexColors = true;
      const tileMesh = new THREE.InstancedMesh(tileGeo, tileMat, tilesN * tilesN);
      const dummy = new THREE.Object3D();
      const tint = new THREE.Color();
      let ti = 0;
      for (let tz = 0; tz < tilesN; tz++) {
        for (let tx = 0; tx < tilesN; tx++) {
          dummy.position.set(-HALF + TILE * (tx + 0.5), 0.02, -HALF + TILE * (tz + 0.5));
          dummy.updateMatrix();
          tileMesh.setMatrixAt(ti, dummy.matrix);
          tint.setHSL(0.08, 0.42, 0.38 + ((tx + tz) % 3) * 0.07);
          if (tileMesh.setColorAt) tileMesh.setColorAt(ti, tint);
          ti++;
        }
      }
      tileMesh.instanceMatrix.needsUpdate = true;
      if (tileMesh.instanceColor) tileMesh.instanceColor.needsUpdate = true;
      scene.add(tileMesh);
      const occ = new Uint8Array(tilesN * tilesN);
      occupy(occ, tilesN, Math.floor(tilesN / 2), tilesN - 1, COLL.DOOR);
      const doorCell = worldToTile(0, HALF - 0.35, HALF, TILE);
      occupy(occ, tilesN, doorCell.tx, doorCell.tz, COLL.DOOR);
      const ceil = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2, 0.1, HALF * 2), ceilMat);
      ceil.position.y = HEIGHT;
      scene.add(ceil);

      function wall(w: number, h: number, d: number, x: number, y: number, z: number) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
        m.position.set(x, y, z);
        scene.add(m);
      }
      const t = 0.18;
      const hy = HEIGHT / 2;
      wall(HALF * 2, HEIGHT, t, 0, hy, -HALF);
      wall(t, HEIGHT, HALF * 2, -HALF, hy, 0);
      wall(t, HEIGHT, HALF * 2, HALF, hy, 0);
      const doorW = 1.6;
      const side = (HALF * 2 - doorW) / 2;
      wall(side, HEIGHT, t, -(HALF - side / 2), hy, HALF);
      wall(side, HEIGHT, t, HALF - side / 2, hy, HALF);
      wall(doorW, HEIGHT - 2.2, t, 0, 2.2 + (HEIGHT - 2.2) / 2, HALF);

      const door = new THREE.Mesh(
        new THREE.BoxGeometry(doorW - 0.08, 2.15, 0.08),
        new THREE.MeshToonMaterial({ color: 0x8a3a28, emissive: 0x7a2018, emissiveIntensity: 0.2, gradientMap: grad }),
      );
      door.position.set(0, 1.08, DOOR_Z);
      door.userData.door = true;
      scene.add(door);
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(doorW + 0.14, 2.32, 0.06),
        new THREE.MeshToonMaterial({ color: 0xd4a017, emissive: 0x8a6a10, emissiveIntensity: 0.25, gradientMap: grad }),
      );
      frame.position.set(0, 1.16, DOOR_Z + 0.04);
      scene.add(frame);
      const skirting = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2 - 0.2, 0.16, HALF * 2 - 0.2), trimMat);
      skirting.position.y = 0.08;
      dress((door.material as InstanceType<typeof THREE.MeshToonMaterial>), "wood-dark.jpg", 1, 2);
      dress((frame.material as InstanceType<typeof THREE.MeshToonMaterial>), "wood-table.jpg", 1, 1);

      const objects = new THREE.Group();
      scene.add(objects);

      function toon(color: number, emissive = 0x000000, em = 0) {
        return new THREE.MeshToonMaterial({ color, emissive, emissiveIntensity: em, gradientMap: grad });
      }
      function outline(mesh: Object3D) {
        mesh.traverse((ch) => {
          const m = ch as Object3D & { geometry?: unknown; isMesh?: boolean };
          if (!m.isMesh || !m.geometry) return;
          const line = new THREE.LineSegments(
            new THREE.EdgesGeometry(m.geometry as ConstructorParameters<typeof THREE.EdgesGeometry>[0]),
            new THREE.LineBasicMaterial({ color: 0x1a1008 }),
          );
          ch.add(line);
        });
      }

      function rebuild(list: Nft[]) {
        while (objects.children.length) objects.remove(objects.children[0]);
        occ.fill(0);
        list
          .filter((n) => n.kind !== "avatar")
          .forEach((n, i) => {
            const saved = transformsRef.current[n.id];
            const ang = i * 2.39996;
            const r = 1.8 + Math.sqrt(i + 1) * 1.15;
            const x = saved ? saved.x : Math.max(-HALF + 1.2, Math.min(HALF - 1.2, Math.cos(ang) * r));
            const z = saved ? saved.z : Math.max(-HALF + 1.2, Math.min(HALF - 1.6, Math.sin(ang) * r));
            const g = new THREE.Group();
            g.position.set(snap(x), 0, snap(z));
            const cell = worldToTile(g.position.x, g.position.z, HALF, TILE);
            occupy(occ, tilesN, cell.tx, cell.tz, 1);
            g.userData.nftId = n.id;
            g.userData.mode = n.mode;
            g.userData.title = n.title;
            const col = n.mode === "dynamic" ? 0x3d9a6a : n.mode === "suspended_static" ? 0xc45c4a : 0xd4a017;
            const table = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.7), toon(0x8a5a28));
            table.position.y = 0.52;
            dress(table.material as InstanceType<typeof THREE.MeshToonMaterial>, "wood-table.jpg", 1, 1);
            const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.08), toon(0x6b3a1c));
            dress(leg.material as InstanceType<typeof THREE.MeshToonMaterial>, "wood-dark.jpg", 1, 2);
            leg.position.y = 0.25;
            const core = new THREE.Mesh(
              new THREE.OctahedronGeometry(0.22 + Math.min(0.35, n.collateral), 0),
              toon(col, col, n.mode === "dynamic" ? 0.55 : 0.12),
            );
            core.position.y = 0.82;
            g.add(table);
            g.add(leg);
            g.add(core);
            const media = nftMediaRef(n as Nft & { cid?: string; image?: string });
            if (media) {
              const cid = parseCid(media);
              const url = cid ? cidGatewayUrl(cid) : media;
              new THREE.TextureLoader().load(url, (tex) => {
                if (dead) return;
                if ("colorSpace" in tex && THREE.SRGBColorSpace) (tex as { colorSpace: string }).colorSpace = THREE.SRGBColorSpace;
                const mat = core.material as { map: unknown; needsUpdate: boolean };
                mat.map = tex;
                mat.needsUpdate = true;
              });
            }
            outline(g);
            objects.add(g);
          });
      }
      rebuild(nfts);

      function ink(mesh: InstanceType<typeof THREE.Mesh>, s = 1.07) {
        const ol = new THREE.Mesh(
          mesh.geometry,
          new THREE.MeshBasicMaterial({ color: 0x140804, side: THREE.BackSide }),
        );
        ol.scale.setScalar(s);
        mesh.add(ol);
      }
      function cap(r: number, len: number, color: number) {
        const mesh = new THREE.Mesh(
          THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(r, len, 4, 10) : new THREE.CylinderGeometry(r, r, len + r * 2, 10),
          toon(color),
        );
        ink(mesh);
        return mesh;
      }
      function cloth(mesh: InstanceType<typeof THREE.Mesh>, file: string, rx = 2, ry = 2) {
        dress(mesh.material as InstanceType<typeof THREE.MeshToonMaterial>, file, rx, ry);
      }
      const avatarRoot = new THREE.Group();
      const hips = new THREE.Group();
      hips.position.y = 0.74;
      const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), toon(0x3a2418));
      pelvis.scale.set(1.18, 0.68, 0.95);
      ink(pelvis, 1.05);
      cloth(pelvis, "pants.jpg", 2, 2);
      const torso = cap(0.17, 0.26, 0xf2ebe3);
      torso.position.y = 0.28;
      cloth(torso, "shirt.jpg", 3, 3);
      const collar = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), toon(0xf2ebe3));
      collar.position.y = 0.46;
      collar.scale.set(1.05, 0.32, 0.9);
      ink(collar, 1.04);
      cloth(collar, "shirt.jpg", 2, 2);
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.07, 8), toon(0xc9a07e));
      neck.position.y = 0.5;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.185, 32, 24), toon(0xc9a07e));
      head.position.y = 0.62;
      ink(head, 1.05);
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.195, 12, 10), toon(0x1a120c));
      hair.position.set(0, 0.72, -0.07);
      hair.scale.set(1.08, 0.66, 1.12);
      ink(hair, 1.04);
      cloth(hair, "wood-dark.jpg", 1, 1);
      hips.add(pelvis);
      hips.add(torso);
      hips.add(collar);
      hips.add(neck);
      hips.add(head);
      hips.add(hair);
      function arm(side: number) {
        const rootA = new THREE.Group();
        rootA.position.set(0.24 * side, 0.38, 0);
        const up = cap(0.05, 0.16, 0xf2ebe3);
        up.position.y = -0.1;
        cloth(up, "shirt.jpg", 2, 2);
        const lo = cap(0.042, 0.14, 0xc9a07e);
        lo.position.y = -0.3;
        rootA.add(up);
        rootA.add(lo);
        hips.add(rootA);
        return rootA;
      }
      function leg(side: number) {
        const rootL = new THREE.Group();
        rootL.position.set(0.11 * side, 0.02, 0);
        const up = cap(0.062, 0.18, 0x3a2418);
        up.position.y = -0.14;
        cloth(up, "pants.jpg", 2, 2);
        const lo = cap(0.05, 0.16, 0x3a2418);
        lo.position.y = -0.38;
        cloth(lo, "pants.jpg", 2, 2);
        const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.058, 8, 6), toon(0x1a120c));
        shoe.scale.set(1, 0.5, 1.4);
        shoe.position.set(0, -0.52, 0.03);
        ink(shoe, 1.04);
        rootL.add(up);
        rootL.add(lo);
        rootL.add(shoe);
        hips.add(rootL);
        return rootL;
      }
      const armL = arm(-1);
      const armR = arm(1);
      const legL = leg(-1);
      const legR = leg(1);
      avatarRoot.add(hips);
      scene.add(avatarRoot);
      let faceOnce = false;
      function applyFace(url: string | null) {
        if (!url) return;
        new THREE.TextureLoader().load(url, (tex) => {
          if (dead) return;
          const img = tex.image as CanvasImageSource | undefined;
          if (!img) return;
          const atlas = new THREE.CanvasTexture(paintFaceAtlas(img));
          if ("colorSpace" in atlas && THREE.SRGBColorSpace) (atlas as { colorSpace: string }).colorSpace = THREE.SRGBColorSpace;
          atlas.needsUpdate = true;
          if (!faceOnce) {
            head.geometry = head.geometry.clone();
            remapSphereFaceUVs(head.geometry as unknown as Parameters<typeof remapSphereFaceUVs>[0]);
            faceOnce = true;
          }
          const mat = head.material as InstanceType<typeof THREE.MeshToonMaterial>;
          mat.map = atlas;
          mat.needsUpdate = true;
          head.visible = true;
          if (!hips.getObjectByName("chain")) {
            const chain = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.008, 8, 20), toon(0xc9cdd1));
            chain.name = "chain";
            chain.rotation.x = 1.25;
            chain.position.y = 0.49;
            hips.add(chain);
          }
        });
      }
      (stage as HTMLDivElement & { __setFace?: (u: string | null) => void }).__setFace = applyFace;
      const av = avatarRef.current;
      const seed = av ? nftMediaRef(av as Nft & { cid?: string; image?: string }) : null;
      if (seed) applyFace(parseCid(seed) ? cidGatewayUrl(parseCid(seed) as string) : seed);

      const hands = new THREE.Group();
      const palm = (sx: number) => {
        const h = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 6), toon(0xc9a07e));
        h.scale.set(0.9, 0.7, 1.3);
        h.position.set(sx, -0.18, -0.34);
        ink(h, 1.08);
        return h;
      };
      hands.add(palm(-0.16));
      hands.add(palm(0.16));
      camera.add(hands);
      scene.add(camera);

      const carts = new THREE.Group();
      scene.add(carts);
      HOMEBREW_CARTS.forEach((c, i) => {
        const g = new THREE.Group();
        g.position.set(-4.5 + i * 1.28, 0, -5.5);
        g.userData.nftId = c.id;
        g.userData.title = `${c.title} · ${c.lesson}`;
        g.userData.cart = c.file;
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.7, 0.1), toon(0x8a2a1a, 0xd4a017, 0.18));
        body.position.y = 0.48;
        ink(body, 1.04);
        g.add(body);
        carts.add(g);
        const cell = worldToTile(g.position.x, g.position.z, HALF, TILE);
        occupy(occ, tilesN, cell.tx, cell.tz, COLL.SOLID);
      });
      const keyPad = worldToTile(0, -2.7, HALF, TILE);
      occupy(occ, tilesN, keyPad.tx, keyPad.tz, COLL.TRIGGER);
      const sprites = new THREE.Group();
      scene.add(sprites);
      function placeAtlas(
        url: string,
        cols: number,
        rows: number,
        cells: { c: number; r: number; x: number; z: number; w: number; h: number }[],
      ) {
        new THREE.TextureLoader().load(url, (base) => {
          if (dead) return;
          base.magFilter = THREE.NearestFilter;
          base.minFilter = THREE.NearestFilter;
          cells.slice(0, Math.max(0, OAM_MAX - sprites.children.length)).forEach((cell) => {
            const tex = base.clone();
            tex.repeat.set(1 / cols, 1 / rows);
            tex.offset.set(cell.c / cols, 1 - (cell.r + 1) / rows);
            tex.needsUpdate = true;
            const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.18, side: THREE.DoubleSide });
            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(cell.w, cell.h), mat);
            mesh.position.set(cell.x, cell.h * 0.5, cell.z);
            mesh.userData.billboard = true;
            mesh.userData.baseY = cell.h * 0.5;
            sprites.add(mesh);
            const tcell = worldToTile(cell.x, cell.z, HALF, TILE);
            occupy(occ, tilesN, tcell.tx, tcell.tz, COLL.SOLID);
          });
        });
      }
      placeAtlas("/os/tex/tiles-dungeon.png", 12, 11, [
        { c: 3, r: 6, x: -4.5, z: -3.6, w: 0.85, h: 0.9 },
        { c: 4, r: 6, x: 4.2, z: -3.6, w: 1.05, h: 0.7 },
        { c: 8, r: 6, x: -4.5, z: 3.15, w: 0.8, h: 0.9 },
        { c: 6, r: 7, x: 4.05, z: 3.0, w: 0.7, h: 1.0 },
        { c: 9, r: 8, x: 2.25, z: 5.2, w: 0.7, h: 0.7 },
        { c: 2, r: 7, x: -2.7, z: -4.5, w: 0.9, h: 0.55 },
      ]);
      placeAtlas("/os/tex/sprites-1bit.png", 49, 22, [
        { c: 41, r: 14, x: -5.4, z: 0, w: 0.7, h: 0.85 },
        { c: 22, r: 10, x: 5.4, z: 0, w: 0.7, h: 0.85 },
        { c: 34, r: 8, x: 0, z: -5.4, w: 0.65, h: 0.8 },
      ]);

      const inv: string[] = [];
      const invBar = document.createElement("div");
      invBar.style.cssText =
        "position:absolute;left:50%;bottom:8px;transform:translateX(-50%);z-index:6;display:flex;gap:4px;pointer-events:none";
      function paintInv() {
        invBar.innerHTML = "";
        for (let i = 0; i < INV_SLOTS; i++) {
          const slot = document.createElement("div");
          slot.style.cssText =
            "width:28px;height:28px;border:1px solid #6b2e1c;background:#fff6e4;font:600 9px/28px IBM Plex Mono,monospace;text-align:center;color:#8a2a1a";
          slot.textContent = inv[i] ? String(i + 1) : "";
          invBar.appendChild(slot);
        }
      }
      paintInv();
      stage.appendChild(invBar);

      const scripts = new ScriptQ();
      const balloon = document.createElement("div");
      balloon.style.cssText =
        "position:absolute;left:50%;bottom:44px;transform:translateX(-50%);z-index:8;max-width:min(92%,420px);padding:.45rem .7rem;background:#fff6e4;border:1px solid #6b2e1c;color:#1a1008;font:500 13px/1.35 IBM Plex Sans,sans-serif;display:none;pointer-events:none";
      stage.appendChild(balloon);
      const pause = document.createElement("div");
      pause.style.cssText =
        "position:absolute;inset:0;z-index:10;display:none;align-items:center;justify-content:center;background:rgba(26,16,8,.55)";
      pause.innerHTML = `<div style="background:#fff6e4;border:1px solid #6b2e1c;padding:1rem 1.2rem;min-width:220px;color:#1a1008"><div style="font:600 11px/1 IBM Plex Mono,monospace;letter-spacing:.12em;text-transform:uppercase;color:#8a2a1a;margin-bottom:.5rem">${pt ? "Pausa · lote" : "Pause · lot"}</div><div id="pauseInv" style="font:13px/1.5 IBM Plex Sans,sans-serif"></div><p style="margin:.6rem 0 0;font-size:.75rem;color:#6b2e1c">Enter</p></div>`;
      stage.appendChild(pause);
      let paused = false;

      const padHeld = { v: 0 };
      function makePad(side: "left" | "right", label: string, color: string, target: { x: number; y: number }) {
        const wrap = document.createElement("div");
        wrap.style.cssText = `position:absolute;${side}:8px;bottom:12px;z-index:7;width:116px;pointer-events:none;touch-action:none`;
        const capEl = document.createElement("div");
        capEl.textContent = label;
        capEl.style.cssText = "text-align:center;font:600 10px/1 IBM Plex Mono,monospace;letter-spacing:.1em;text-transform:uppercase;color:#8a2a1a;margin-bottom:4px";
        const base = document.createElement("div");
        base.style.cssText = `position:relative;width:116px;height:116px;border-radius:50%;border:2px solid ${color};background:rgba(255,246,228,.55);pointer-events:auto;touch-action:none`;
        const knob = document.createElement("div");
        knob.style.cssText = `position:absolute;left:50%;top:50%;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:${color};box-shadow:0 2px 0 #1a1008;pointer-events:none`;
        base.appendChild(knob);
        wrap.appendChild(capEl);
        wrap.appendChild(base);
        let pid: number | null = null;
        function reset() {
          pid = null;
          target.x = 0;
          target.y = 0;
          knob.style.transform = "translate(0,0)";
          padHeld.v = Math.max(0, padHeld.v - 1);
        }
        function aim(e: PointerEvent) {
          const r = base.getBoundingClientRect();
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          const max = r.width * 0.36;
          let dx = e.clientX - cx;
          let dy = e.clientY - cy;
          const len = Math.hypot(dx, dy) || 1;
          const k = Math.min(1, max / len);
          dx *= k;
          dy *= k;
          target.x = dx / max;
          target.y = -dy / max;
          knob.style.transform = `translate(${dx}px,${dy}px)`;
        }
        base.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          e.stopPropagation();
          pid = e.pointerId;
          padHeld.v += 1;
          try {
            base.setPointerCapture(e.pointerId);
          } catch {
            /* */
          }
          aim(e);
        });
        base.addEventListener("pointermove", (e) => {
          if (pid !== e.pointerId) return;
          e.preventDefault();
          e.stopPropagation();
          aim(e);
        });
        base.addEventListener("pointerup", (e) => {
          if (pid === e.pointerId) reset();
        });
        base.addEventListener("pointercancel", reset);
        return { wrap, destroy: reset };
      }
      const pads: Array<{ destroy: () => void; wrap: HTMLDivElement }> = [];
      const wantPads = window.matchMedia("(pointer: coarse)").matches || window.matchMedia("(max-width: 1024px)").matches || "ontouchstart" in window;
      if (wantPads) {
        const walkPad = makePad("left", pt ? "Andar" : "Walk", "#8a2a1a", stick);
        const lookPad = makePad("right", pt ? "Olhar" : "Look", "#d4a017", look);
        stage.appendChild(walkPad.wrap);
        stage.appendChild(lookPad.wrap);
        pads.push(walkPad, lookPad);
      }
      const blockTouch = (e: TouchEvent) => {
        if (e.target === renderer.domElement || (e.target as HTMLElement).closest?.("[data-pad]") || pads.length) {
          if (stage.contains(e.target as Node)) e.preventDefault();
        }
      };
      stage.addEventListener("touchmove", blockTouch, { passive: false });

      void import("cannon-es")
        .then((CANNON) => {
          if (dead) return;
          const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -14, 0) });
          world.broadphase = new CANNON.SAPBroadphase(world);
          const ground = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
          ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
          world.addBody(ground);
          (stage as HTMLDivElement & { __world?: typeof world }).__world = world;
        })
        .catch(() => {});

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();

      function clampPos() {
        const m = HALF - 0.45;
        pos.x = Math.max(-m, Math.min(m, pos.x));
        pos.z = Math.max(-m, Math.min(m, pos.z));
        pos.y = EYE;
      }
      function blocked(nx: number, nz: number) {
        if (blockedAabb(occ, tilesN, nx, nz, HALF, 0.22, TILE)) return true;
        for (const g of objects.children) {
          if (g.userData.nftId === carry.id) continue;
          if (Math.hypot(g.position.x - nx, g.position.z - nz) < 0.55) return true;
        }
        return false;
      }
      function allActors() {
        return [...objects.children, ...carts.children];
      }
      function facingActor() {
        const face = facingTile(pos.x, pos.z, yaw.v, HALF, TILE);
        const list = allActors().map((g) => ({ id: String(g.userData.nftId || ""), x: g.position.x, z: g.position.z }));
        const hit = actorOnTile(list, face.tx, face.tz, HALF, TILE);
        if (hit) return allActors().find((g) => String(g.userData.nftId) === hit.id) || null;
        return null;
      }
      function tryMove(dx: number, dz: number) {
        const nx = pos.x + dx;
        const nz = pos.z + dz;
        if (!blocked(nx, nz)) {
          pos.x = nx;
          pos.z = nz;
        } else if (!blocked(nx, pos.z)) pos.x = nx;
        else if (!blocked(pos.x, nz)) pos.z = nz;
      }
      function clampInterior(x: number, y: number, z: number) {
        const m = HALF - 0.55;
        return {
          x: Math.max(-m, Math.min(m, x)),
          y: Math.max(0.48, Math.min(HEIGHT - 0.38, y)),
          z: Math.max(-m, Math.min(m, z)),
        };
      }
      function nearDoor() {
        return Math.abs(pos.x) < 0.95 && pos.z > HALF - 1.35;
      }
      function nearestNft() {
        let best: Object3D | null = null;
        let bd = 1.35;
        allActors().forEach((g) => {
          const d = Math.hypot(g.position.x - pos.x, g.position.z - pos.z);
          if (d < bd) {
            bd = d;
            best = g;
          }
        });
        return best;
      }
      function snap(v: number) {
        return snapTile(v, TILE);
      }
      function commitPlace(g: Object3D) {
        g.position.x = snap(g.position.x);
        g.position.z = snap(g.position.z);
        g.position.y = 0;
        onPlaceRef.current?.(String(g.userData.nftId), g.position.x, g.position.z);
      }

      function applyCam() {
        avatarRoot.position.set(pos.x, 0, pos.z);
        avatarRoot.rotation.y = yaw.v + Math.PI;
        const p = presenceRef.current;
        const fx = -Math.sin(yaw.v);
        const fz = -Math.cos(yaw.v);
        hands.visible = p === "inhabit";
        camera.up.set(0, 1, 0);
        if (p === "inhabit") {
          camera.position.set(pos.x, pos.y, pos.z);
          camera.rotation.set(pitch.v, yaw.v, 0, "YXZ");
          hips.visible = false;
        } else {
          hips.visible = true;
          const dist = p === "compose" ? 2.45 : 2.1;
          const back = dist * Math.max(0.4, Math.cos(pitch.v));
          const lift = 1.52 - Math.sin(pitch.v) * 1.25;
          const c = clampInterior(pos.x - fx * back, lift, pos.z - fz * back);
          camera.position.set(c.x, c.y, c.z);
          camera.rotation.set(pitch.v, yaw.v, 0, "YXZ");
        }
      }

      function drawRadar() {
        const cv = radarRef.current;
        if (!cv) return;
        const ctx = cv.getContext("2d");
        if (!ctx) return;
        const s = cv.width;
        ctx.fillStyle = "#fff6e4";
        ctx.fillRect(0, 0, s, s);
        const cell = s / tilesN;
        for (let tz = 0; tz < tilesN; tz++) {
          for (let tx = 0; tx < tilesN; tx++) {
            ctx.fillStyle = occ[tz * tilesN + tx] ? "#c48a3a" : ((tx + tz) % 2 ? "#f3e2c4" : "#e8d0a8");
            ctx.fillRect(tx * cell, tz * cell, cell - 0.4, cell - 0.4);
          }
        }
        const face = facingTile(pos.x, pos.z, yaw.v, HALF, TILE);
        ctx.fillStyle = "#8a2a1a";
        ctx.fillRect(face.tx * cell, face.tz * cell, cell, cell);
        const map = (x: number, z: number) => [((x + HALF) / (HALF * 2)) * s, ((z + HALF) / (HALF * 2)) * s] as const;
        ctx.fillStyle = "#c45c4a";
        const [dx, dz] = map(0, HALF - 0.2);
        ctx.fillRect(dx - 4, dz - 3, 8, 6);
        objects.children.forEach((g) => {
          const [ox, oz] = map(g.position.x, g.position.z);
          ctx.fillStyle = g.userData.mode === "dynamic" ? "#3d9a6a" : "#d4a017";
          ctx.beginPath();
          ctx.arc(ox, oz, 3, 0, Math.PI * 2);
          ctx.fill();
        });
        const [ax, az] = map(pos.x, pos.z);
        ctx.fillStyle = "#1a1008";
        ctx.beginPath();
        ctx.moveTo(ax - Math.sin(yaw.v) * 7, az - Math.cos(yaw.v) * 7);
        ctx.lineTo(ax + Math.cos(yaw.v) * 4, az - Math.sin(yaw.v) * 4);
        ctx.lineTo(ax - Math.cos(yaw.v) * 4, az + Math.sin(yaw.v) * 4);
        ctx.closePath();
        ctx.fill();
      }

      function tick() {
        if (dead) return;
        requestAnimationFrame(tick);
        const now = performance.now();
        const dt = Math.min(0.1, (now - clock.last) / 1000);
        clock.last = now;
        const fired = scripts.step(dt);
        if (fired?.op === "give" && fired.id && inv.length < INV_SLOTS && !inv.includes(fired.id)) {
          inv.push(fired.id);
          paintInv();
        }
        if (fired?.op === "warp") {
          warpFade(() => {
            setLoadingWorld(true);
            onEnterRef.current?.(worldId);
          });
        }
        balloon.style.display = scripts.saying ? "block" : "none";
        if (scripts.saying) balloon.textContent = scripts.saying;
        if (paused) {
          applyCam();
          try { renderer.render(scene, camera); } catch { /* */ }
          return;
        }
        const sprint = keys.has("ShiftLeft") || keys.has("ShiftRight");
        const speed = (sprint ? 4.4 : 2.35) * dt;
        if (look.x || look.y) {
          const flip = presenceRef.current === "inhabit" ? -1 : 1;
          yaw.v -= look.x * 2.55 * dt * flip;
          pitch.v -= look.y * 2.05 * dt * flip;
          pitch.v = Math.max(-1.15, Math.min(1.15, pitch.v));
        }
        const fx = -Math.sin(yaw.v);
        const fz = -Math.cos(yaw.v);
        const rx = Math.cos(yaw.v);
        const rz = -Math.sin(yaw.v);
        let moving = 0;
        const steer =
          keys.has("KeyW") || keys.has("ArrowUp") || keys.has("KeyS") || keys.has("ArrowDown") || keys.has("KeyA") || keys.has("ArrowLeft") || keys.has("KeyD") || keys.has("ArrowRight");
        if (steer) queue.length = 0;
        if (keys.has("KeyW") || keys.has("ArrowUp")) {
          tryMove(fx * speed, fz * speed);
          moving = 1;
        }
        if (keys.has("KeyS") || keys.has("ArrowDown")) {
          tryMove(-fx * speed, -fz * speed);
          moving = 1;
        }
        if (keys.has("KeyA") || keys.has("ArrowLeft")) {
          tryMove(-rx * speed, -rz * speed);
          moving = 1;
        }
        if (keys.has("KeyD") || keys.has("ArrowRight")) {
          tryMove(rx * speed, rz * speed);
          moving = 1;
        }
        if (stick.x || stick.y) {
          tryMove(fx * speed * stick.y + rx * speed * stick.x, fz * speed * stick.y + rz * speed * stick.x);
          moving = 1;
          queue.length = 0;
        }
        if (queue[0]) {
          const q = queue[0];
          const dx = q.x - pos.x;
          const dz = q.z - pos.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 0.55) {
            queue.shift();
            if (q.then === "use" && q.id) onPickRef.current(q.id);
            if (q.then === "door") {
              setLoadingWorld(true);
              onEnterRef.current?.(worldId);
            }
          } else {
            yaw.v = Math.atan2(-dx, -dz);
            tryMove((dx / dist) * speed, (dz / dist) * speed);
            moving = 1;
          }
        }
        clampPos();
        const phys = (stage as HTMLDivElement & { __world?: { step: (n: number) => void } }).__world;
        if (phys) phys.step(Math.min(dt, 1 / 30));
        gait.t += dt * (moving ? 9 : 0);
        const sw = moving ? Math.sin(gait.t) * 0.55 : 0;
        legL.rotation.x = sw;
        legR.rotation.x = -sw;
        armL.rotation.x = -sw * 0.8;
        armR.rotation.x = sw * 0.8;
        hips.position.y = 0.74 + (moving ? Math.abs(Math.sin(gait.t)) * 0.03 : 0);

        if (carry.id) {
          const held = objects.children.find((g) => g.userData.nftId === carry.id);
          if (held) {
            held.position.x = pos.x + fx * 0.7;
            held.position.z = pos.z + fz * 0.7;
            held.position.y = 0.15;
          }
        }
        objects.children.forEach((g) => {
          const core = g.children[2];
          if (core && g.userData.mode === "dynamic") core.rotation.y += dt * 0.9;
        });
        sprites.children.forEach((m, i) => {
          m.rotation.y = yaw.v;
          const base = Number(m.userData.baseY || 0.4);
          m.position.y = base + Math.sin(gait.t * 0.7 + i) * 0.03;
        });

        const near = nearestNft();
        const nid = near ? String((near as Object3D).userData.nftId || "") : "";
        if (nearDoor()) hud(pt ? `E · porta · ${worldId}` : `E · door · ${worldId}`);
        else if (carry.id) hud(pt ? "F · pousar na grelha · Z desfazer" : "F · set down on grid · Z undo");
        else if (presenceRef.current === "compose") hud(pt ? "Compor · F pegar · clique no chão para pousar · Z desfazer" : "Compose · F pick up · click floor to set down · Z undo");
        else if (nid) hud(pt ? "E · célula da frente · F pegar · 1–8 inventário" : "E · facing cell · F pick up · 1–8 inventory");
        else hud(pt ? "Habitar · WASD · Shift correr · clique para ir" : "Inhabit · WASD · Shift sprint · click to walk");

        applyCam();
        drawRadar();
        try {
          renderer.render(scene, camera);
        } catch {
          /* context lost — wait restore */
        }
        window.__controlsTest = {
          getYaw: () => yaw.v,
          getSpeed: () => moving,
          setKeys: (codes: string[]) => {
            keys.clear();
            codes.forEach((c) => keys.add(c));
          },
        };
      }
      tick();

      function onKey(e: KeyboardEvent) {
        if (e.repeat) return;
        keys.add(e.code);
        if (e.code === "KeyE") {
          const face = facingTile(pos.x, pos.z, yaw.v, HALF, TILE);
          const kind = cellAt(occ, tilesN, face.tx, face.tz);
          if (kind === COLL.DOOR || nearDoor()) {
            queue.length = 0;
            warpFade(() => {
              setLoadingWorld(true);
              onEnterRef.current?.(worldId);
            });
          } else if (kind === COLL.TRIGGER) {
            if (inv.includes("cart-castle")) {
              pos.x = -pos.x;
              pos.z = Math.max(-HALF + 1.4, Math.min(HALF - 1.8, -pos.z * 0.4));
              scripts.push({ op: "say", text: pt ? "Sala 2 · chave aceite" : "Room 2 · key accepted", dur: 1.4 });
            } else {
              scripts.push({ op: "say", text: pt ? "Porta interior · falta a chave (Castle Escape)" : "Inner door · need Castle Escape cart", dur: 1.6 });
            }
          } else {
            const faced = facingActor();
            const n = faced || nearestNft();
            if (n) {
              const id = String((n as Object3D).userData.nftId);
              const d = Math.hypot((n as Object3D).position.x - pos.x, (n as Object3D).position.z - pos.z);
              if (faced || d < REACH) {
                queue.length = 0;
                queue.push({ x: (n as Object3D).position.x, z: (n as Object3D).position.z, then: "use", id });
                const title = String((n as Object3D).userData.title || id);
                scripts.push({ op: "say", text: title, dur: 1.6 });
                scripts.push({ op: "give", id });
              }
            } else {
              scripts.push({ op: "say", text: pt ? "Lote · célula livre" : "Lot · empty cell", dur: 1.1 });
            }
          }
        }
        if (e.code.startsWith("Digit")) {
          const i = Number(e.code.replace("Digit", "")) - 1;
          if (i >= 0 && i < INV_SLOTS && inv[i]) onPickRef.current(inv[i]);
        }
        if (e.code === "KeyF") {
          if (carry.id) {
            const held = objects.children.find((g) => g.userData.nftId === carry.id);
            if (held) {
              undo.push({ id: carry.id, x: held.userData.prevX ?? held.position.x, z: held.userData.prevZ ?? held.position.z });
              commitPlace(held);
            }
            carry.id = "";
            setPlacing(false);
          } else {
            const n = nearestNft();
            if (n) {
              carry.id = String((n as Object3D).userData.nftId);
              (n as Object3D).userData.prevX = (n as Object3D).position.x;
              (n as Object3D).userData.prevZ = (n as Object3D).position.z;
              if (inv.length < INV_SLOTS && !inv.includes(carry.id)) {
                inv.push(carry.id);
                paintInv();
              }
              setPlacing(true);
            }
          }
        }
        if (e.code === "KeyZ") {
          const u = undo.pop();
          if (u) {
            const g = objects.children.find((o) => o.userData.nftId === u.id);
            if (g) {
              g.position.set(u.x, 0, u.z);
              onPlaceRef.current?.(u.id, u.x, u.z);
            }
          }
        }
        if (e.code === "KeyC") {
          setPresence("compose");
          presenceRef.current = "compose";
          document.exitPointerLock?.();
        }
        if (e.code === "KeyV") {
          setPresence("inhabit");
          presenceRef.current = "inhabit";
        }
        if (e.code === "Enter" || e.code === "NumpadEnter") {
          paused = !paused;
          pause.style.display = paused ? "flex" : "none";
          const box = pause.querySelector("#pauseInv");
          if (box) box.textContent = inv.length ? inv.join(" · ") : pt ? "Inventário vazio" : "Inventory empty";
        }
      }
      function onUp(e: KeyboardEvent) {
        keys.delete(e.code);
      }
      function onMove(e: MouseEvent) {
        if (document.pointerLockElement === renderer.domElement) {
          yaw.v -= e.movementX * 0.0022;
          pitch.v -= e.movementY * 0.0022;
          pitch.v = Math.max(-1.15, Math.min(1.15, pitch.v));
          return;
        }
        if (!dragLook.on) return;
        const dx = e.clientX - dragLook.lx;
        const dy = e.clientY - dragLook.ly;
        dragLook.lx = e.clientX;
        dragLook.ly = e.clientY;
        dragLook.moved += Math.abs(dx) + Math.abs(dy);
        yaw.v -= dx * 0.005;
        pitch.v -= dy * 0.004;
        pitch.v = Math.max(-1.15, Math.min(1.15, pitch.v));
      }
      function onPointerDown(e: PointerEvent) {
        if (padHeld.v > 0) return;
        if (e.target !== renderer.domElement) return;
        dragLook.on = true;
        dragLook.lx = e.clientX;
        dragLook.ly = e.clientY;
        dragLook.moved = 0;
      }
      function onPointerUp() {
        dragLook.on = false;
      }
      function onClick(e: MouseEvent) {
        if (dragLook.moved > 12) {
          dragLook.moved = 0;
          return;
        }
        renderer.domElement.focus();
        const isTouch = "pointerType" in e && (e as PointerEvent).pointerType === "touch";
        if (presenceRef.current === "inhabit" && !isTouch) renderer.domElement.requestPointerLock?.();
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        if (presenceRef.current === "compose") {
          const fl = raycaster.intersectObject(floor);
          if (fl[0]) {
            const p = fl[0].point;
            const sx = snap(p.x);
            const sz = snap(p.z);
            const overlay = new THREE.Mesh(new THREE.PlaneGeometry(TILE * 0.92, TILE * 0.92), toon(0xc48a3a, 0x8a2a1a, 0.15));
            overlay.rotation.x = -Math.PI / 2;
            overlay.position.set(sx, 0.04, sz);
            scene.add(overlay);
            const c = worldToTile(sx, sz, HALF, TILE);
            occupy(occ, tilesN, c.tx, c.tz, COLL.TRIGGER);
            return;
          }
        }
        const hits = raycaster.intersectObjects(objects.children, true);
        const hit = hits.find((h: { object: Object3D }) => {
          let o: Object3D | null = h.object;
          while (o) {
            if (o.userData?.nftId) return true;
            o = o.parent;
          }
          return false;
        });
        if (hit) {
          let o: Object3D | null = hit.object;
          while (o) {
            if (o.userData?.nftId) {
              const id = o.userData.nftId as string;
              onPickRef.current(id);
              queue.length = 0;
              queue.push({ x: o.position.x, z: o.position.z, then: "use", id });
              break;
            }
            o = o.parent;
          }
        } else if (carry.id) {
          const floorHits = raycaster.intersectObject(floor);
          if (floorHits[0]) {
            const held = objects.children.find((g) => g.userData.nftId === carry.id);
            if (held) {
              undo.push({ id: carry.id, x: held.userData.prevX ?? held.position.x, z: held.userData.prevZ ?? held.position.z });
              held.position.x = snap(floorHits[0].point.x);
              held.position.z = snap(floorHits[0].point.z);
              commitPlace(held);
            }
            carry.id = "";
            setPlacing(false);
          }
        }
      }
      function onLock() {
        setLocked(document.pointerLockElement === renderer.domElement);
      }

      window.addEventListener("keydown", onKey);
      window.addEventListener("keyup", onUp);
      window.addEventListener("blur", () => keys.clear());
      document.addEventListener("mousemove", onMove);
      document.addEventListener("pointerlockchange", onLock);
      renderer.domElement.addEventListener("pointerdown", onPointerDown);
      window.addEventListener("pointerup", onPointerUp);
      renderer.domElement.addEventListener("click", onClick);
      window.addEventListener("resize", size);

      (stage as HTMLDivElement & { __rebuild?: (n: Nft[]) => void }).__rebuild = rebuild;

      dispose = () => {
        dead = true;
        window.removeEventListener("keydown", onKey);
        window.removeEventListener("keyup", onUp);
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("pointerlockchange", onLock);
        renderer.domElement.removeEventListener("click", onClick);
        renderer.domElement.removeEventListener("pointerdown", onPointerDown);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("resize", size);
        try { pads.forEach((p) => { p.destroy(); p.wrap.remove(); }); } catch { /* */ }
        stage.removeEventListener("touchmove", blockTouch);
        scene.traverse((ch) => {
          const m = ch as { geometry?: { dispose?: () => void }; material?: { dispose?: () => void } | Array<{ dispose?: () => void }> };
          m.geometry?.dispose?.();
          if (Array.isArray(m.material)) m.material.forEach((x) => x.dispose?.());
          else m.material?.dispose?.();
        });
        renderer.dispose();
        renderer.domElement.remove();
      };
    }).catch(() => {});

    return () => {
      dead = true;
      dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const stage = host.current as (HTMLDivElement & { __rebuild?: (n: Nft[]) => void; __setFace?: (u: string | null) => void }) | null;
    stage?.__rebuild?.(nfts);
    const media = avatar ? nftMediaRef(avatar as Nft & { cid?: string; image?: string }) : null;
    const url = media ? (parseCid(media) ? cidGatewayUrl(parseCid(media) as string) : media) : null;
    stage?.__setFace?.(url);
  }, [nfts, avatar]);

  return (
    <div className="relative mt-3 overflow-hidden border border-line" style={{ height: "min(72vh, 640px)", background: "#f4e4c1" }}>
      <div ref={host} className="h-full w-full" />
      <div className="pointer-events-none absolute left-3 top-3 max-w-[22rem] border border-[#6b2e1c] bg-[#fff6e4]/95 p-3 text-[0.8rem] text-[#1a1008] shadow-md">
        <p className="mono text-[0.62rem] uppercase tracking-[0.12em] text-[#8a2a1a]">{pt ? "Bancada · lote privado" : "Sandbox · private lot"}</p>
        <p className="mt-1 font-medium">{avatar ? avatar.title : pt ? "NFT Avatar" : "Avatar NFT"}</p>
        <p className="mt-1 text-[#4a3018]">{prompt || (locked ? (pt ? "A habitar" : "Inhabiting") : pt ? "Clique para habitar" : "Click to inhabit")}</p>
        <p className="mono mt-1 text-[0.68rem] text-[#6b2e1c]">
          {pt ? "Porta" : "Door"} · {worldId}
        </p>
      </div>
      <div className="absolute right-3 top-3 flex flex-col gap-2">
        <button
          type="button"
          className={presence === "inhabit" ? "btn" : "btn ghost"}
          onClick={() => {
            setPresence("inhabit");
            presenceRef.current = "inhabit";
          }}
        >
          {pt ? "Habitar" : "Inhabit"}
        </button>
        <button
          type="button"
          className={presence === "orbit" ? "btn" : "btn ghost"}
          onClick={() => {
            setPresence("orbit");
            presenceRef.current = "orbit";
            document.exitPointerLock?.();
          }}
        >
          {pt ? "Órbita interior" : "Interior orbit"}
        </button>
        <button
          type="button"
          className={presence === "compose" ? "btn" : "btn ghost"}
          onClick={() => {
            setPresence("compose");
            presenceRef.current = "compose";
            document.exitPointerLock?.();
          }}
        >
          {pt ? "Compor" : "Compose"}
        </button>
      </div>
      <canvas ref={radarRef} width={112} height={112} className="pointer-events-none absolute right-3 top-36 border border-[#6b2e1c] bg-[#fff6e4] max-md:top-auto max-md:bottom-[148px]" aria-hidden />
      <div className="pointer-events-none absolute bottom-[148px] left-1/2 z-[2] max-w-[90%] -translate-x-1/2 border border-[#d4a017] bg-[#1a1008] px-4 py-2 text-center text-[0.78rem] text-[#ffe6b8] md:bottom-3">
        {prompt}
        {placing ? (pt ? " · a colocar" : " · placing") : ""}
      </div>
      {loadingWorld ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#fff6e4]/95 text-center">
          <p className="mono text-[0.7rem] uppercase tracking-[0.14em] text-[#8a2a1a]">{pt ? "Porta do mundo aberto" : "Open-world door"}</p>
          <p className="serif mt-3 text-2xl text-[#1a1008]">{worldId}</p>
          <p className="mt-2 max-w-sm text-[#4a3018]">
            {pt
              ? "A bancada está endereçada a este mundo. O NFT Avatar equipado segue pela porta."
              : "The sandbox is addressed to this world. The equipped Avatar NFT continues through the door."}
          </p>
          <button type="button" className="btn mt-5" onClick={() => setLoadingWorld(false)}>
            {pt ? "Voltar à bancada" : "Back to sandbox"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
