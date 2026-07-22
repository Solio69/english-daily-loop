import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

export const getBuildOutputDirectory = (mode: string): string =>
  mode === "telegram-dev" ? "dist-telegram" : "dist";

export default defineConfig(({ mode }) => ({
  // TODO: Telegram dev builds receive an isolated env from scripts/dev-stack.mjs.
  envDir: mode === "telegram-dev" ? false : undefined,
  // TODO: Keep Telegram dev artifacts isolated from production build checks.
  build: {
    outDir: getBuildOutputDirectory(mode),
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  server: {
    hmr: process.env.DISABLE_HMR !== "true",
    // TODO: Local Telegram Mini App launch via tunnel domains (cloudflared/localtunnel).
    allowedHosts: [".loca.lt", ".trycloudflare.com"],
  },
}));
