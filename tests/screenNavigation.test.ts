import assert from "node:assert/strict";
import test from "node:test";
import { navigationReducer } from "../src/hooks/useScreenNavigation";

type TestScreen = "home" | "vocabulary" | "materials";

test("keeps nested navigation history and returns one screen at a time", () => {
  let state: { current: TestScreen; history: TestScreen[] } = {
    current: "home",
    history: [],
  };

  state = navigationReducer(state, {
    type: "navigate",
    target: "vocabulary",
    root: false,
    rootScreen: "home",
  });
  state = navigationReducer(state, {
    type: "navigate",
    target: "materials",
    root: false,
    rootScreen: "home",
  });

  assert.deepEqual(state, {
    current: "materials",
    history: ["home", "vocabulary"],
  });

  state = navigationReducer(state, { type: "back", rootScreen: "home" });
  assert.deepEqual(state, {
    current: "vocabulary",
    history: ["home"],
  });
});

test("root navigation starts a fresh history stack", () => {
  const state = navigationReducer<TestScreen>(
    { current: "vocabulary", history: ["home"] },
    {
      type: "navigate",
      target: "materials",
      root: true,
      rootScreen: "home",
    },
  );

  assert.deepEqual(state, {
    current: "materials",
    history: ["home"],
  });
});
