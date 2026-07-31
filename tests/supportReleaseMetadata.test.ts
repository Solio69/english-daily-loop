import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildSupportAppContext } from "../src/services/supportAppContext";

test("support app context includes only the provided safe release metadata", () => {
  const appContext = buildSupportAppContext(
    null,
    {
      appVersion: "0.1.1",
      buildId: "commit-sha",
      environment: "production",
    },
    {
      userAgent: "test-agent",
      viewport: { width: 390, height: 844 },
      telegramColorScheme: "dark",
    },
  );

  assert.equal(appContext.appVersion, "0.1.1");
  assert.equal(appContext.buildId, "commit-sha");
  assert.equal(appContext.environment, "production");
  assert.equal(appContext.userAgent, "test-agent");
  assert.equal(Object.hasOwn(appContext, "telegramUserId"), false);
});

test("support release metadata does not read process env or known secrets", () => {
  const sources = [
    readFileSync("src/config/releaseMetadata.ts", "utf8"),
    readFileSync("src/services/supportAppContext.ts", "utf8"),
    readFileSync("src/services/supportService.ts", "utf8"),
  ].join("\n");

  assert.doesNotMatch(sources, /process\.env/);
  assert.doesNotMatch(
    sources,
    /SUPABASE_SERVICE_ROLE_KEY|OPENROUTER_API_KEY|TELEGRAM_BOT_TOKEN/,
  );
});
