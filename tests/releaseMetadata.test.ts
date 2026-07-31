import assert from "node:assert/strict";
import test from "node:test";
import { createReleaseMetadata } from "../src/config/releaseMetadata";
import { currentRelease } from "../src/constants/currentRelease";
import { getReleaseBuildMetadata } from "../vite.config";

test("Vite release metadata identifies each supported environment", () => {
  assert.deepEqual(getReleaseBuildMetadata("telegram-dev", {}), {
    appVersion: currentRelease.version,
    buildId: "local",
    environment: "telegram-dev",
  });
  assert.equal(
    getReleaseBuildMetadata("production", {
      VERCEL_ENV: "production",
      VERCEL_GIT_COMMIT_SHA: "commit-sha",
    }).environment,
    "production",
  );
  assert.equal(
    getReleaseBuildMetadata("production", {
      VERCEL_ENV: "preview",
    }).environment,
    "preview",
  );
  assert.equal(
    getReleaseBuildMetadata("development", {}).environment,
    "development",
  );
});

test("release metadata uses safe local fallbacks", () => {
  assert.deepEqual(createReleaseMetadata({}), {
    appVersion: "unknown",
    buildId: "local",
    environment: "development",
  });
  assert.deepEqual(
    createReleaseMetadata({
      appVersion: " 1.2.3 ",
      buildId: " ",
      environment: "invalid" as "development",
    }),
    {
      appVersion: "1.2.3",
      buildId: "local",
      environment: "development",
    },
  );
});
