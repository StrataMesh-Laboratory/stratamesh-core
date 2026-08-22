import { useEffect, useRef, useState } from "react";
import type { Object3D } from "three";
import type { Nft } from "@/lib/lab-kernel";
import { DEFAULT_WORLD } from "@/lib/bancada-store";
import { cidGatewayUrl, nftMediaRef, parseCid } from "@/lib/bancada-ipfs";

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
      const EYE = 1.62;
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

      const gradData = new Uint8Array([70, 50, 32, 255, 190, 150, 90, 255, 255, 240, 210, 255]);
      const grad = new THREE.DataTexture(gradData, 3, 1);
      grad.magFilter = THREE.NearestFilter;
      grad.minFilter = THREE.NearestFilter;
      grad.needsUpdate = true;

      function paintTex(size: number, repeatX: number, repeatY: number, draw: (ctx: CanvasRenderingContext2D, n: number) => void) {
        const c = document.createElement("canvas");
        c.width = c.height = size;
        const ctx = c.getContext("2d");
        if (!ctx) return null;
        draw(ctx, size);
        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(repeatX, repeatY);
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        tex.generateMipmaps = false;
        tex.needsUpdate = true;
        if ("colorSpace" in tex && THREE.SRGBColorSpace) (tex as { colorSpace: string }).colorSpace = THREE.SRGBColorSpace;
        return tex;
      }
      function noiseFill(ctx: CanvasRenderingContext2D, n: number, r: number, g: number, b: number, jitter: number) {
        const img = ctx.getImageData(0, 0, n, n);
        const d = img.data;
        for (let i = 0; i < d.length; i += 4) {
          const j = (Math.random() * jitter) | 0;
          d[i] = Math.max(0, Math.min(255, r + j));
          d[i + 1] = Math.max(0, Math.min(255, g + j - 4));
          d[i + 2] = Math.max(0, Math.min(255, b + j - 8));
          d[i + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);
      }
      const texWood = paintTex(128, 8, 8, (ctx, n) => {
        noiseFill(ctx, n, 122, 62, 28, 28);
        ctx.globalAlpha = 0.55;
        for (let y = 0; y < n; y += 16) {
          ctx.fillStyle = y % 32 ? "#c48a3a" : "#4a2410";
          ctx.fillRect(0, y, n, 2);
          ctx.fillStyle = "#2a1408";
          ctx.fillRect(0, y + 14, n, 1);
        }
        ctx.globalAlpha = 0.2;
        ctx.strokeStyle = "#1a0c04";
        for (let i = 0; i < 18; i++) {
          ctx.beginPath();
          ctx.moveTo(Math.random() * n, 0);
          ctx.quadraticCurveTo(n * 0.5, Math.random() * n, n, n);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      });
      const texPlaster = paintTex(128, 3, 2, (ctx, n) => {
        noiseFill(ctx, n, 238, 214, 176, 22);
        ctx.strokeStyle = "rgba(90,40,20,0.12)";
        for (let i = 0; i < n; i += 8) {
          ctx.beginPath();
          ctx.moveTo(0, i);
          ctx.lineTo(n, i + 3);
          ctx.stroke();
        }
      });
      const texCeil = paintTex(64, 2, 2, (ctx, n) => noiseFill(ctx, n, 255, 244, 220, 10));
      const texShirt = paintTex(64, 4, 4, (ctx, n) => {
        noiseFill(ctx, n, 242, 235, 220, 14);
        ctx.strokeStyle = "rgba(180,160,130,0.35)";
        for (let i = 0; i < n; i += 3) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i, n);
          ctx.stroke();
        }
      });
      const texPants = paintTex(64, 3, 3, (ctx, n) => {
        noiseFill(ctx, n, 58, 36, 28, 16);
        ctx.strokeStyle = "rgba(20,10,6,0.35)";
        for (let i = 0; i < n; i += 4) {
          ctx.beginPath();
          ctx.moveTo(0, i);
          ctx.lineTo(n, i);
          ctx.stroke();
        }
      });
      const texSkin = paintTex(64, 1, 1, (ctx, n) => noiseFill(ctx, n, 201, 160, 126, 18));
      const texHair = paintTex(64, 1, 1, (ctx, n) => {
        noiseFill(ctx, n, 22, 16, 12, 10);
        ctx.strokeStyle = "rgba(0,0,0,0.5)";
        for (let i = 0; i < 30; i++) {
          ctx.beginPath();
          ctx.moveTo(Math.random() * n, 0);
          ctx.quadraticCurveTo(Math.random() * n, n * 0.5, Math.random() * n, n);
          ctx.stroke();
        }
      });
      const texDoor = paintTex(64, 1, 2, (ctx, n) => {
        noiseFill(ctx, n, 180, 70, 55, 20);
        ctx.strokeStyle = "#4a1810";
        ctx.strokeRect(6, 6, n - 12, n - 12);
        ctx.strokeRect(14, 14, n - 28, n / 2 - 20);
      });
      const texTrim = paintTex(32, 6, 1, (ctx, n) => noiseFill(ctx, n, 90, 40, 22, 12));

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

      const wallMat = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: grad, map: texPlaster || undefined });
      const trimMat = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: grad, map: texTrim || undefined });
      const floorMat = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: grad, map: texWood || undefined });
      const ceilMat = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: grad, map: texCeil || undefined });

      const floor = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2, 0.12, HALF * 2), floorMat);
      floor.position.y = -0.06;
      scene.add(floor);
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
        new THREE.MeshToonMaterial({ color: 0xffffff, emissive: 0x7a2018, emissiveIntensity: 0.2, gradientMap: grad, map: texDoor || undefined }),
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
      scene.add(skirting);

      const objects = new THREE.Group();
      scene.add(objects);

      function toon(color: number, emissive = 0x000000, em = 0, map: InstanceType<typeof THREE.CanvasTexture> | null = null) {
        return new THREE.MeshToonMaterial({ color, emissive, emissiveIntensity: em, gradientMap: grad, map: map || undefined });
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
        list
          .filter((n) => n.kind !== "avatar")
          .forEach((n, i) => {
            const saved = transformsRef.current[n.id];
            const ang = i * 2.39996;
            const r = 1.8 + Math.sqrt(i + 1) * 1.15;
            const x = saved ? saved.x : Math.max(-HALF + 1.2, Math.min(HALF - 1.2, Math.cos(ang) * r));
            const z = saved ? saved.z : Math.max(-HALF + 1.2, Math.min(HALF - 1.6, Math.sin(ang) * r));
            const g = new THREE.Group();
            g.position.set(x, 0, z);
            g.userData.nftId = n.id;
            g.userData.mode = n.mode;
            const col = n.mode === "dynamic" ? 0x3d9a6a : n.mode === "suspended_static" ? 0xc45c4a : 0xd4a017;
            const table = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.7), toon(0xffffff, 0, 0, texWood));
            table.position.y = 0.52;
            const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.08), toon(0xffffff, 0, 0, texTrim));
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
      function cap(r: number, len: number, color: number, map: InstanceType<typeof THREE.CanvasTexture> | null = null) {
        const mesh = new THREE.Mesh(
          THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(r, len, 4, 10) : new THREE.CylinderGeometry(r, r, len + r * 2, 10),
          toon(color, 0, 0, map),
        );
        ink(mesh);
        return mesh;
      }
      const avatarRoot = new THREE.Group();
      const hips = new THREE.Group();
      hips.position.y = 0.9;
      const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), toon(0xffffff, 0, 0, texPants));
      pelvis.scale.set(1, 0.75, 0.85);
      ink(pelvis, 1.06);
      const torso = cap(0.145, 0.3, 0xffffff, texShirt);
      torso.position.y = 0.32;
      const collar = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), toon(0xffffff, 0, 0, texShirt));
      collar.position.y = 0.5;
      collar.scale.set(1, 0.35, 0.9);
      ink(collar, 1.05);
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.08, 8), toon(0xffffff, 0, 0, texSkin));
      neck.position.y = 0.56;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.145, 14, 12), toon(0xffffff, 0, 0, texSkin));
      head.position.y = 0.68;
      ink(head, 1.06);
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.152, 12, 10), toon(0xffffff, 0, 0, texHair));
      hair.position.set(0, 0.73, -0.015);
      hair.scale.set(1.05, 0.72, 1.08);
      ink(hair, 1.04);
      const bang = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), toon(0xffffff, 0, 0, texHair));
      bang.position.set(0, 0.76, 0.1);
      bang.scale.set(1.4, 0.45, 0.5);
      const eyeM = toon(0x1a1008);
      const eL = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 6), eyeM);
      eL.position.set(-0.048, 0.02, 0.125);
      const eR = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 6), eyeM);
      eR.position.set(0.048, 0.02, 0.125);
      const sclera = toon(0xfff6e4);
      const sL = new THREE.Mesh(new THREE.SphereGeometry(0.032, 6, 6), sclera);
      sL.position.set(-0.048, 0.02, 0.118);
      const sR = new THREE.Mesh(new THREE.SphereGeometry(0.032, 6, 6), sclera);
      sR.position.set(0.048, 0.02, 0.118);
      head.add(sL);
      head.add(sR);
      head.add(eL);
      head.add(eR);
      hips.add(pelvis);
      hips.add(torso);
      hips.add(collar);
      hips.add(neck);
      hips.add(head);
      hips.add(hair);
      hips.add(bang);
      function arm(side: number) {
        const rootA = new THREE.Group();
        rootA.position.set(0.2 * side, 0.42, 0);
        const up = cap(0.042, 0.2, 0xffffff, texShirt);
        up.position.y = -0.12;
        const lo = cap(0.036, 0.18, 0xffffff, texSkin);
        lo.position.y = -0.36;
        rootA.add(up);
        rootA.add(lo);
        hips.add(rootA);
        return rootA;
      }
      function leg(side: number) {
        const rootL = new THREE.Group();
        rootL.position.set(0.09 * side, 0.02, 0);
        const up = cap(0.055, 0.26, 0xffffff, texPants);
        up.position.y = -0.2;
        const lo = cap(0.045, 0.24, 0xffffff, texPants);
        lo.position.y = -0.52;
        const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), toon(0xffffff, 0, 0, texHair));
        shoe.scale.set(1, 0.55, 1.45);
        shoe.position.set(0, -0.7, 0.03);
        ink(shoe, 1.05);
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
      let facePlate: InstanceType<typeof THREE.Mesh> | null = null;
      function applyFace(url: string | null) {
        if (!url) return;
        new THREE.TextureLoader().load(url, (tex) => {
          if (dead) return;
          if ("colorSpace" in tex && THREE.SRGBColorSpace) (tex as { colorSpace: string }).colorSpace = THREE.SRGBColorSpace;
          tex.wrapS = THREE.ClampToEdgeWrapping;
          tex.wrapT = THREE.ClampToEdgeWrapping;
          const geo = new THREE.SphereGeometry(0.152, 28, 20, Math.PI / 2 - 0.95, 1.9, 0.38, 1.95);
          const mat = toon(0xc9a07e);
          (mat as { map: unknown; needsUpdate: boolean }).map = tex;
          mat.needsUpdate = true;
          if (facePlate) hips.remove(facePlate);
          facePlate = new THREE.Mesh(geo, mat);
          facePlate.position.copy(head.position);
          hips.add(facePlate);
          head.visible = false;
          eL.visible = false;
          eR.visible = false;
          sL.visible = false;
          sR.visible = false;
          const shirt = torso.material as { color?: { setHex?: (n: number) => void } };
          shirt.color?.setHex?.(0xf2ebe3);
          if (!hips.getObjectByName("chain")) {
            const chain = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.008, 8, 20), toon(0xc9cdd1));
            chain.name = "chain";
            chain.rotation.x = 1.25;
            chain.position.y = 0.53;
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
        const h = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), toon(0xffffff, 0, 0, texSkin));
        h.scale.set(0.9, 0.7, 1.3);
        h.position.set(sx, -0.18, -0.34);
        ink(h, 1.08);
        return h;
      };
      hands.add(palm(-0.16));
      hands.add(palm(0.16));
      camera.add(hands);
      scene.add(camera);

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
        for (const g of objects.children) {
          if (g.userData.nftId === carry.id) continue;
          if (Math.hypot(g.position.x - nx, g.position.z - nz) < 0.55) return true;
        }
        return false;
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
        objects.children.forEach((g) => {
          const d = Math.hypot(g.position.x - pos.x, g.position.z - pos.z);
          if (d < bd) {
            bd = d;
            best = g;
          }
        });
        return best;
      }
      function snap(v: number) {
        return Math.round(v * 2) / 2;
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
        ctx.strokeStyle = "#d4a017";
        ctx.strokeRect(1, 1, s - 2, s - 2);
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
        hips.position.y = 0.92 + (moving ? Math.abs(Math.sin(gait.t)) * 0.03 : 0);

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
        door.rotation.y = nearDoor() ? -0.4 : 0;

        const near = nearestNft();
        const nid = near ? String((near as Object3D).userData.nftId || "") : "";
        if (nearDoor()) hud(pt ? `E · porta · ${worldId}` : `E · door · ${worldId}`);
        else if (carry.id) hud(pt ? "F · pousar na grelha · Z desfazer" : "F · set down on grid · Z undo");
        else if (presenceRef.current === "compose") hud(pt ? "Compor · F pegar · clique no chão para pousar · Z desfazer" : "Compose · F pick up · click floor to set down · Z undo");
        else if (nid) hud(pt ? "E · usar · F · pegar · clique para ir até ao objecto" : "E · use · F · pick up · click to walk to object");
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
          if (nearDoor()) {
            queue.length = 0;
            queue.push({ x: 0, z: HALF - 1.1, then: "door" });
          } else {
            const n = nearestNft();
            if (n) {
              const id = String((n as Object3D).userData.nftId);
              queue.length = 0;
              queue.push({ x: (n as Object3D).position.x, z: (n as Object3D).position.z, then: "use", id });
            }
          }
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
        if (e.code === "Escape") document.exitPointerLock?.();
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
