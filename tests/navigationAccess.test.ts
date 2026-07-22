import assert from "node:assert/strict";
import test from "node:test";
import { getDisabledNavItems } from "../src/utils/navigationAccess";

test("onboarding locks learning sections until settings are completed", () => {
  assert.deepEqual(getDisabledNavItems(false), [
    "reading",
    "vocabulary",
    "materials",
  ]);
});

test("vocabulary is available immediately after settings are completed", () => {
  assert.deepEqual(getDisabledNavItems(true), []);
});
