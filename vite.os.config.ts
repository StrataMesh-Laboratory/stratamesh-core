import path from "node:path";
import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const r = (p: string) => path.resolve(import.meta.dirname, p);

export default defineConfig({
  plugins: [tailwindcss(), viteReact()],
  base: "/os/",
  resolve: {
    alias: [
      { find: "@/lib/auth/gates", replacement: r("src/lib/os-shims/gates.tsx") },
      { find: "@/lib/auth/use-current-user", replacement: r("src/lib/os-shims/user.ts") },
      { find: "@/lib/auth/client", replacement: r("src/lib/os-shims/client.ts") },
      { find: "@/lib/status", replacement: r("src/lib/os-shims/status.ts") },
      { find: "@/lib/sca-server", replacement: r("src/lib/os-shims/sca-server.ts") },
      { find: "@tanstack/react-router", replacement: r("src/lib/os-shims/router.tsx") },
      { find: "@tanstack/react-start", replacement: r("src/lib/os-shims/start.ts") },
      { find: "@", replacement: r("src") },
    ],
  },
  build: {
    outDir: "artifacts/os-spa",
    emptyOutDir: true,
    rollupOptions: {
      input: r("os.html"),
    },
  },
});
