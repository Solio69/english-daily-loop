import assert from "node:assert/strict";
import test from "node:test";
import { getVocabularyReviewProgressCounts } from "../src/utils/vocabularyReviewProgress";

test("review progress falls back to required counts", () => {
  assert.deepEqual(
    getVocabularyReviewProgressCounts({
      requiredTotalCount: 12,
      remainingRequiredCount: 3,
    }),
    {
      totalCount: 12,
      reviewedCount: 9,
      remainingCount: 3,
    },
  );
});

test("review progress prefers display counts for optional words after completion", () => {
  assert.deepEqual(
    getVocabularyReviewProgressCounts({
      requiredTotalCount: 12,
      remainingRequiredCount: 0,
      displayTotalCount: 17,
      displayReviewedCount: 13,
      displayRemainingCount: 4,
    }),
    {
      totalCount: 17,
      reviewedCount: 13,
      remainingCount: 4,
    },
  );
});

test("review progress ignores partial display counts", () => {
  assert.deepEqual(
    getVocabularyReviewProgressCounts({
      requiredTotalCount: 12,
      remainingRequiredCount: 3,
      displayTotalCount: 17,
      displayReviewedCount: 13,
    }),
    {
      totalCount: 12,
      reviewedCount: 9,
      remainingCount: 3,
    },
  );
});
