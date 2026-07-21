import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  // TODO: Telegram dev builds receive an isolated env from scripts/dev-stack.mjs.
  envDir: mode === "telegram-dev" ? false : undefined,
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
