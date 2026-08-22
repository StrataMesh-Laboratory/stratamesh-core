/** Per-account Bancada CGU — one sandbox per identity, never the Fog Node lab. */
import { useEffect } from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { walletOf } from "@/lib/session-id";
import { burnDynamic, type Nft, type NftKind } from "@/lib/lab-kernel";

export type BancadaKyc = { email: string; status: "pending" | "verified" | "rejected" };

export const DEFAULT_WORLD = "cmn-lab-world";
export const NFT_MIN_COLLATERAL = 0.1;

export type BancadaSnap = {
  ownerId: string;
  strata: number;
  nfts: Nft[];
  kyc: BancadaKyc | null;
  journal: { at: string; text: string }[];
  worldId: string;
  transforms: Record<string, { x: number; z: number }>;
  equippedAvatarId: string | null;
};

function emptySnap(ownerId: string): BancadaSnap {
  return { ownerId, strata: 0, nfts: [], kyc: null, journal: [], worldId: DEFAULT_WORLD, transforms: {}, equippedAvatarId: null };
}

function stamp(text: string) {
  return { at: new Date().toISOString(), text };
}

type Actions = {
  byOwner: Record<string, BancadaSnap>;
  ensure: (ownerId: string) => void;
  mint: (ownerId: string, title: string, kind: NftKind) => void;
  setWorld: (ownerId: string, worldId: string) => void;
  setTransform: (ownerId: string, id: string, x: number, z: number) => void;
  equipAvatar: (ownerId: string, id: string) => void;
  burnHour: (ownerId: string) => void;
  enrollKyc: (ownerId: string, email: string) => void;
};

export const useBancada = create<Actions>()(
  persist(
    (set, get) => ({
      byOwner: {},
      ensure: (ownerId) => {
        if (!ownerId || get().byOwner[ownerId]) return;
        set((s) => ({ byOwner: { ...s.byOwner, [ownerId]: emptySnap(ownerId) } }));
      },
      mint: (ownerId, title, kind) => {
        if (!ownerId) return;
        const cur0 = get().byOwner[ownerId] ?? emptySnap(ownerId);
        const id = (kind === "avatar" ? "AVT-" : "NFT-") + Math.random().toString(36).slice(2, 8).toUpperCase();
        const nft: Nft = {
          id,
          title: title.trim() || (kind === "avatar" ? "Avatar" : "Criação"),
          kind,
          mode: kind === "avatar" ? "static" : "dynamic",
          collateral: NFT_MIN_COLLATERAL,
          market: NFT_MIN_COLLATERAL,
          burnRate: kind === "avatar" ? 0 : 0.01,
          fractions: [{ holder: walletOf(ownerId), units: NFT_MIN_COLLATERAL }],
          worldId: cur0.worldId || DEFAULT_WORLD,
        };
        set((s) => {
          const cur = s.byOwner[ownerId] ?? emptySnap(ownerId);
          return {
            byOwner: {
              ...s.byOwner,
              [ownerId]: {
                ...cur,
                nfts: [nft, ...cur.nfts],
                equippedAvatarId: kind === "avatar" ? nft.id : cur.equippedAvatarId,
                journal: [stamp(`mint ${id}`), ...cur.journal].slice(0, 24),
              },
            },
          };
        });
      },
      setWorld: (ownerId, worldId) => {
        if (!ownerId || !worldId.trim()) return;
        set((s) => {
          const cur = s.byOwner[ownerId] ?? emptySnap(ownerId);
          return {
            byOwner: {
              ...s.byOwner,
              [ownerId]: { ...cur, worldId: worldId.trim() },
            },
          };
        });
      },
      setTransform: (ownerId, id, x, z) => {
        if (!ownerId || !id) return;
        set((s) => {
          const cur = s.byOwner[ownerId] ?? emptySnap(ownerId);
          return {
            byOwner: {
              ...s.byOwner,
              [ownerId]: { ...cur, transforms: { ...cur.transforms, [id]: { x, z } } },
            },
          };
        });
      },
      equipAvatar: (ownerId, id) => {
        if (!ownerId || !id) return;
        set((s) => {
          const cur = s.byOwner[ownerId] ?? emptySnap(ownerId);
          return {
            byOwner: {
              ...s.byOwner,
              [ownerId]: { ...cur, equippedAvatarId: id },
            },
          };
        });
      },
      burnHour: (ownerId) => {
        if (!ownerId) return;
        set((s) => {
          const cur = s.byOwner[ownerId];
          if (!cur) return s;
          return {
            byOwner: {
              ...s.byOwner,
              [ownerId]: { ...cur, nfts: cur.nfts.map((n) => (n.kind === "avatar" ? n : burnDynamic(n, 1))) },
            },
          };
        });
      },
      enrollKyc: (ownerId, email) => {
        if (!ownerId || !email) return;
        set((s) => {
          const cur = s.byOwner[ownerId] ?? emptySnap(ownerId);
          return {
            byOwner: {
              ...s.byOwner,
              [ownerId]: { ...cur, kyc: { email, status: "pending" } },
            },
          };
        });
      },
    }),
    { name: "cmn-bancada-v1", skipHydration: true, storage: createJSONStorage(() => localStorage) },
  ),
);

/** Guest (no ownerId) → null. Signed-in → that account's sandbox only. */
export function useHydratedBancada(ownerId: string | null): BancadaSnap | null {
  const byOwner = useBancada((s) => s.byOwner);
  useEffect(() => {
    void useBancada.persist.rehydrate();
  }, []);
  useEffect(() => {
    if (ownerId) useBancada.getState().ensure(ownerId);
  }, [ownerId]);
  if (!ownerId) return null;
  const snap = byOwner[ownerId] ?? emptySnap(ownerId);
  return {
    ...emptySnap(ownerId),
    ...snap,
    worldId: snap.worldId || DEFAULT_WORLD,
    transforms: snap.transforms ?? {},
    equippedAvatarId: snap.equippedAvatarId ?? null,
  };
}
