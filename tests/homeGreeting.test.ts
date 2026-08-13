import assert from "node:assert/strict";
import test from "node:test";
import {
  getHomeGreeting,
  resolveHomeGreetingSession,
} from "../src/utils/homeGreeting";

test("onboarding session uses the welcome greeting", () => {
  const onboardingSession = resolveHomeGreetingSession(null, null);

  assert.equal(onboardingSession, true);
  assert.equal(getHomeGreeting(onboardingSession), "Добро пожаловать,");
});

test("onboarding session keeps the welcome greeting after settings are saved", () => {
  const onboardingSession = resolveHomeGreetingSession(null, null);
  const sessionAfterSettingsSave = resolveHomeGreetingSession(
    onboardingSession,
    "2026-08-13T12:00:00.000Z",
  );

  assert.equal(sessionAfterSettingsSave, true);
  assert.equal(getHomeGreeting(sessionAfterSettingsSave), "Добро пожаловать,");
});

test("session started with saved settings uses the returning greeting", () => {
  const returningSession = resolveHomeGreetingSession(
    null,
    "2026-08-13T12:00:00.000Z",
  );

  assert.equal(returningSession, false);
  assert.equal(getHomeGreeting(returningSession), "С возвращением,");
});
