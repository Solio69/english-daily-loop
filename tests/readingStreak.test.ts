import assert from "node:assert/strict";
import test from "node:test";
import { calculateReadingCompletionStreak } from "../supabase/functions/_shared/reading-streak.ts";

test("reading streak is zero without completion history", () => {
  assert.equal(calculateReadingCompletionStreak("2026-06-26", []), 0);
});

test("reading streak carries yesterday while today is pending", () => {
  assert.equal(
    calculateReadingCompletionStreak("2026-06-26", ["2026-06-25"]),
    1,
  );
});

test("reading streak carries consecutive history while today is pending", () => {
  assert.equal(
    calculateReadingCompletionStreak("2026-06-26", [
      "2026-06-25",
      "2026-06-24",
      "2026-06-23",
      "2026-06-21",
    ]),
    3,
  );
});

test("reading streak resets after the previous study day was missed", () => {
  assert.equal(
    calculateReadingCompletionStreak("2026-06-26", [
      "2026-06-24",
      "2026-06-23",
    ]),
    0,
  );
});

test("reading streak restarts from one after completing today with a gap", () => {
  assert.equal(
    calculateReadingCompletionStreak("2026-06-26", [
      "2026-06-26",
      "2026-06-24",
    ]),
    1,
  );
});

test("reading streak counts only consecutive completed dates", () => {
  assert.equal(
    calculateReadingCompletionStreak("2026-06-26", [
      "2026-06-26",
      "2026-06-25",
      "2026-06-24",
      "2026-06-22",
    ]),
    3,
  );
});

test("reading streak ignores duplicate completions, future dates and input order", () => {
  assert.equal(
    calculateReadingCompletionStreak("2026-06-26", [
      "2026-06-27",
      "2026-06-25",
      "2026-06-26",
      "2026-06-26",
      "2026-06-25",
      "2026-06-24",
    ]),
    3,
  );
});

test("reading streak carries across a year boundary", () => {
  assert.equal(
    calculateReadingCompletionStreak("2027-01-01", [
      "2026-12-31",
      "2026-12-30",
      "2026-12-28",
    ]),
    2,
  );
});
