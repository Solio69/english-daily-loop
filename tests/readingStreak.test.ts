import assert from "node:assert/strict";
import test from "node:test";
import { calculateReadingCompletionStreak } from "../supabase/functions/_shared/reading-streak.ts";

test("reading streak is zero when today is missed", () => {
  assert.equal(
    calculateReadingCompletionStreak("2026-06-26", ["2026-06-25"]),
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

test("reading streak ignores duplicates, future dates and input order", () => {
  assert.equal(
    calculateReadingCompletionStreak("2026-06-26", [
      "2026-06-27",
      "2026-06-25",
      "2026-06-26",
      "2026-06-25",
      "2026-06-24",
    ]),
    3,
  );
});
