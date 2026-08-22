import { useEffect, useRef } from "react";
import type { Nft } from "@/lib/lab-kernel";
import { cidGatewayUrl, nftMediaRef, parseCid } from "@/lib/bancada-ipfs";
import { paintFaceAtlas, remapSphereFaceUVs } from "@/lib/cgu-face";

const TEX = "/os/tex/";

function mediaUrl(n: Nft | null | undefined): string | null {
  if (!n) return null;
  const raw = nftMediaRef(n as Nft & { cid?: string; image?: string });
  if (!raw) return (n as Nft & { image?: string }).image || null;
  const cid = parseCid(raw);
  return cid ? cidGatewayUrl(cid) : raw;
}

/** Front-facing inspect of an NFT (figure or object). Drag to yaw. */
export function NftTurntable({ nft, lang = "pt" }: { nft: Nft | null; lang?: "pt" | "en" }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = host.current;
    if (!el || !nft) return;
    let dead = false;
    let dispose = () => {};
    void import("three").then((THREE) => {
      if (dead || !host.current) return;
      const stage = host.current;
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xb08958);
      const camera = new THREE.PerspectiveCamera(42, 1, 0.08, 20);
      camera.position.set(1.2, 1.15, 2.05);
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      if ("outputColorSpace" in renderer && THREE.SRGBColorSpace) {
        (renderer as { outputColorSpace: string }).outputColorSpace = THREE.SRGBColorSpace;
      }
      renderer.setClearColor(0xb08958, 1);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.style.touchAction = "none";
      renderer.domElement.style.cursor = "grab";
      stage.appendChild(renderer.domElement);
      scene.add(new THREE.HemisphereLight(0xffe6b8, 0x4a3018, 1.1));
      const sun = new THREE.DirectionalLight(0xfff4dc, 0.9);
      sun.position.set(2, 4, 3);
      scene.add(sun);
      const root = new THREE.Group();
      scene.add(root);
      const isAv = nft.kind === "avatar";
      const loader = new THREE.TextureLoader();
      function map(url: string, rx = 1, ry = 1) {
        const t = loader.load(url);
        t.wrapS = THREE.RepeatWrapping;
        t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(rx, ry);
        if ("colorSpace" in t && THREE.SRGBColorSpace) (t as { colorSpace: string }).colorSpace = THREE.SRGBColorSpace;
        return t;
      }
      function toon(color: number, tex?: InstanceType<typeof THREE.Texture>) {
        return new THREE.MeshToonMaterial({ color, map: tex });
      }
      if (isAv) {
        const hips = new THREE.Group();
        hips.position.y = 0.74;
        const shirt = map(TEX + "shirt.jpg", 3, 3);
        const pants = map(TEX + "pants.jpg", 2, 2);
        const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.26, 4, 10), toon(0xf2ebe3, shirt));
        torso.position.y = 0.28;
        const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), toon(0xffffff, pants));
        pelvis.scale.set(1.15, 0.7, 0.95);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.185, 32, 24), toon(0xc9a07e));
        head.position.y = 0.62;
        const hair = new THREE.Mesh(
          new THREE.SphereGeometry(0.205, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.56),
          toon(0x1a1008),
        );
        hair.rotation.x = 0.48;
        hair.position.set(0, 0.695, -0.035);
        hips.add(pelvis, torso, head, hair);
        function limb(x: number, y: number, r: number, len: number, tex: InstanceType<typeof THREE.Texture>) {
          const g = new THREE.Group();
          g.position.set(x, y, 0);
          const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 3, 8), toon(0xffffff, tex));
          m.position.y = -len / 2;
          g.add(m);
          hips.add(g);
        }
        limb(-0.24, 0.38, 0.05, 0.3, shirt);
        limb(0.24, 0.38, 0.05, 0.3, shirt);
        limb(-0.11, 0.02, 0.06, 0.38, pants);
        limb(0.11, 0.02, 0.06, 0.38, pants);
        const faceUrl = mediaUrl(nft);
        if (faceUrl) {
          loader.load(faceUrl, (tex) => {
            if (dead) return;
            const img = tex.image as CanvasImageSource | undefined;
            if (!img) return;
            const atlas = new THREE.CanvasTexture(paintFaceAtlas(img));
            if ("colorSpace" in atlas && THREE.SRGBColorSpace) (atlas as { colorSpace: string }).colorSpace = THREE.SRGBColorSpace;
            atlas.needsUpdate = true;
            head.geometry = head.geometry.clone();
            remapSphereFaceUVs(head.geometry as unknown as Parameters<typeof remapSphereFaceUVs>[0]);
            const mat = head.material as { map: unknown; needsUpdate: boolean };
            mat.map = atlas;
            mat.needsUpdate = true;
          });
        }
        const floor = new THREE.Mesh(new THREE.CircleGeometry(1.6, 24), toon(0x8a5a28));
        floor.rotation.x = -Math.PI / 2;
        root.add(floor);
        root.add(hips);
        camera.position.set(1.15, 1.2, 1.95);
        camera.lookAt(0, 0.82, 0);
      } else {
        const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), toon(nft.mode === "dynamic" ? 0x3d9a6a : 0xd4a017));
        root.add(core);
        const mu = mediaUrl(nft);
        if (mu) loader.load(mu, (tex) => { (core.material as { map: unknown; needsUpdate: boolean }).map = tex; (core.material as { needsUpdate: boolean }).needsUpdate = true; });
        camera.position.set(0, 0.4, 2.1);
        camera.lookAt(0, 0.2, 0);
      }
      let yaw = 0;
      let dragging = false;
      let lx = 0;
      const onDown = (e: PointerEvent) => {
        dragging = true;
        lx = e.clientX;
        renderer.domElement.setPointerCapture(e.pointerId);
      };
      const onMove = (e: PointerEvent) => {
        if (!dragging) return;
        yaw += (e.clientX - lx) * 0.01;
        lx = e.clientX;
      };
      const onUp = () => {
        dragging = false;
      };
      renderer.domElement.addEventListener("pointerdown", onDown);
      renderer.domElement.addEventListener("pointermove", onMove);
      renderer.domElement.addEventListener("pointerup", onUp);
      function size() {
        const w = Math.max(stage.clientWidth, 220);
        const h = Math.max(stage.clientHeight, 180);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      }
      size();
      const ro = new ResizeObserver(size);
      ro.observe(stage);
      let raf = 0;
      const tick = () => {
        raf = requestAnimationFrame(tick);
        if (!dragging) yaw += 0.006;
        root.rotation.y = yaw;
        renderer.render(scene, camera);
      };
      tick();
      dispose = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        renderer.dispose();
        renderer.domElement.remove();
      };
    });
    return () => {
      dead = true;
      dispose();
    };
  }, [nft, lang]);
  if (!nft) return null;
  const pt = lang === "pt";
  return (
    <div>
      <p className="mono text-[0.62rem] uppercase tracking-[0.12em] text-[#8a2a1a]">
        {pt ? "Inspecionar · arrastar para rodar" : "Inspect · drag to turn"}
      </p>
      <p className="mt-1 text-[0.85rem] text-[#1a1008]">
        {nft.title} · {nft.kind} · {nft.id}
      </p>
      <div ref={host} className="mt-2 h-[280px] w-full overflow-hidden border border-[#6b2e1c] bg-[#fff6e4]" />
    </div>
  );
}

export function NftRoster({
  nfts,
  selectedId,
  lang = "pt",
  onSelect,
}: {
  nfts: Nft[];
  selectedId?: string;
  lang?: "pt" | "en";
  onSelect: (id: string) => void;
}) {
  const pt = lang === "pt";
  const sel = nfts.find((n) => n.id === selectedId) ?? nfts[0] ?? null;
  return (
    <div className="mt-4 border border-line p-3">
      <NftTurntable nft={sel} lang={lang} />
      <ul className="mt-3 divide-y divide-line">
        {nfts.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              className={`flex w-full items-center justify-between py-2 text-left text-[0.82rem] ${n.id === sel?.id ? "text-[#8a2a1a]" : "text-[#1a1008]"}`}
              onClick={() => onSelect(n.id)}
            >
              <span>{n.title}</span>
              <span className="mono text-[0.68rem] text-[#6b2e1c]">{n.kind}</span>
            </button>
          </li>
        ))}
      </ul>
      {!nfts.length ? <p className="text-[0.8rem] text-muted">{pt ? "Sem NFT nesta conta." : "No NFTs on this account."}</p> : null}
    </div>
  );
}
