/**
 * Legal homebrew carts hosted on this node.
 * Source: Libretro Content Downloader (buildbot.libretro.com/assets/cores),
 * the same packs RetroArch ships as freeware/homebrew. Not MAMEDEV sets.
 */
export type HomebrewCart = {
  id: string;
  file: string;
  title: string;
  lesson: string;
};

export const HOMEBREW_CARTS: HomebrewCart[] = [
  { id: "cart-deadeus", file: "deadeus.gb", title: "Deadeus", lesson: "árvore de fala · inventário" },
  { id: "cart-tobu", file: "tobu.gb", title: "Tobu Tobu Girl", lesson: "câmara a seguir · plataformas" },
  { id: "cart-castle", file: "castle-escape.gbc", title: "Castle Escape", lesson: "salas · chave na porta" },
  { id: "cart-exodus", file: "exodus.gb", title: "Exodus 2092", lesson: "ecrãs · actores ZGB" },
  { id: "cart-mona", file: "mona.gb", title: "Mona & the Hat", lesson: "objecto equipável" },
  { id: "cart-polka", file: "polkasheep.gb", title: "PolkaSheep", lesson: "agarrar · física" },
  { id: "cart-rademo", file: "rademo.gb", title: "RA Demo", lesson: "cartucho de teste" },
];

export const CART_URL = (file: string) => `/os/roms/${file}`;
