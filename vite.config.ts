import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import path from "path";
import { defineConfig } from "vite";

type BuildEnvironmentVariables = Readonly<
  Record<string, string | undefined>
>;

type ReleaseBuildMetadata = {
  appVersion: string;
  buildId: string;
  environment: "production" | "preview" | "telegram-dev" | "development";
};

const packageJson = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
) as { version: string };

export const getBuildOutputDirectory = (mode: string): string =>
  mode === "telegram-dev" ? "dist-telegram" : "dist";

export const getReleaseBuildMetadata = (
  mode: string,
  environmentVariables: BuildEnvironmentVariables = process.env,
): ReleaseBuildMetadata => {
  const vercelEnvironment = environmentVariables.VERCEL_ENV?.trim();

  return {
    appVersion: packageJson.version,
    buildId:
      environmentVariables.VERCEL_GIT_COMMIT_SHA?.trim() || "local",
    environment:
      mode === "telegram-dev"
        ? "telegram-dev"
        : vercelEnvironment === "production" ||
            vercelEnvironment === "preview"
          ? vercelEnvironment
          : "development",
  };
};

export default defineConfig(({ mode }) => {
  const releaseMetadata = getReleaseBuildMetadata(mode);

  return {
    // Telegram dev builds receive an isolated env from scripts/dev-stack.mjs.
    envDir: mode === "telegram-dev" ? false : undefined,
    // Keep Telegram dev artifacts isolated from production build checks.
    build: {
      outDir: getBuildOutputDirectory(mode),
    },
    define: {
      __APP_VERSION__: JSON.stringify(releaseMetadata.appVersion),
      __BUILD_ID__: JSON.stringify(releaseMetadata.buildId),
      __APP_ENVIRONMENT__: JSON.stringify(releaseMetadata.environment),
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== "true",
      // Local Telegram Mini App launch via tunnel domains (cloudflared/localtunnel).
      allowedHosts: [".loca.lt", ".trycloudflare.com"],
    },
  };
});
