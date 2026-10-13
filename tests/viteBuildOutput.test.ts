import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  getBuildOutputDirectory,
  getReleaseBuildMetadata,
} from "../vite.config";

test("production and Telegram dev builds use isolated output directories", () => {
  assert.equal(getBuildOutputDirectory("production"), "dist");
  assert.equal(getBuildOutputDirectory("telegram-dev"), "dist-telegram");
  assert.notEqual(
    getBuildOutputDirectory("production"),
    getBuildOutputDirectory("telegram-dev"),
  );
});

test("Telegram preview explicitly serves the isolated build directory", () => {
  const packageJson = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  ) as { scripts?: Record<string, string> };
  const previewScript = packageJson.scripts?.["preview:telegram"] ?? "";

  assert.match(previewScript, /--mode telegram-dev/);
  assert.match(previewScript, /--outDir dist-telegram/);
});

test("Telegram frontend watcher rebuilds the isolated bundle with dev-stack env", () => {
  const packageJson = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  ) as { scripts?: Record<string, string> };
  const watcherScript = packageJson.scripts?.["watch:telegram"] ?? "";
  const devStackSource = readFileSync(
    new URL("../scripts/dev-stack.mjs", import.meta.url),
    "utf8",
  );

  assert.match(watcherScript, /^vite build /);
  assert.match(watcherScript, /--mode telegram-dev/);
  assert.match(watcherScript, /--watch/);
  assert.match(
    devStackSource,
    /\["watch:telegram"\],[\s\S]*?\{\s*env:\s*getTelegramDevChildEnv\(\),\s*replaceEnv:\s*true\s*\}/,
  );
  assert.match(
    devStackSource,
    /startFrontend\(\);\s*startFrontendWatcher\(\);/,
  );
});

test("production and Telegram builds receive the same package version", () => {
  const packageJson = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  ) as { version: string };
  const productionMetadata = getReleaseBuildMetadata("production", {
    VERCEL_ENV: "production",
    VERCEL_GIT_COMMIT_SHA: "production-commit",
  });
  const telegramMetadata = getReleaseBuildMetadata("telegram-dev", {});

  assert.equal(productionMetadata.appVersion, packageJson.version);
  assert.equal(telegramMetadata.appVersion, productionMetadata.appVersion);
  assert.equal(productionMetadata.buildId, "production-commit");
  assert.equal(telegramMetadata.buildId, "local");
});
