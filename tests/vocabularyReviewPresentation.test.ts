import assert from "node:assert/strict";
import test from "node:test";
import {
  formatReviewDate,
  getReviewStepLabel,
} from "../src/utils/vocabularyReviewPresentation.ts";

test("review steps use user-facing interval labels", () => {
  assert.equal(getReviewStepLabel("1_day"), "1 день");
  assert.equal(getReviewStepLabel("3_days"), "3 дня");
  assert.equal(getReviewStepLabel("6_months"), "6 месяцев");
});

test("review timestamps are formatted using the Moscow calendar date", () => {
  assert.equal(formatReviewDate("2026-06-22T21:30:00Z"), "23 июн.");
});

test("date-only review values keep their calendar date", () => {
  assert.equal(formatReviewDate("2026-06-30"), "30 июн.");
  assert.equal(formatReviewDate("invalid"), null);
});
