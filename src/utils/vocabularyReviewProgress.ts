type VocabularyReviewProgressSource = {
  requiredTotalCount: number;
  remainingRequiredCount: number;
  displayTotalCount?: number | null;
  displayReviewedCount?: number | null;
  displayRemainingCount?: number | null;
};

export const getVocabularyReviewProgressCounts = (
  state: VocabularyReviewProgressSource,
) => {
  const hasCompleteDisplayCounts =
    state.displayTotalCount !== null &&
    state.displayTotalCount !== undefined &&
    state.displayReviewedCount !== null &&
    state.displayReviewedCount !== undefined &&
    state.displayRemainingCount !== null &&
    state.displayRemainingCount !== undefined;

  const totalCount = hasCompleteDisplayCounts
    ? state.displayTotalCount
    : state.requiredTotalCount;
  const remainingCount = hasCompleteDisplayCounts
    ? state.displayRemainingCount
    : state.remainingRequiredCount;
  const reviewedCount = hasCompleteDisplayCounts
    ? state.displayReviewedCount
    : Math.max(totalCount - remainingCount, 0);

  return {
    totalCount,
    reviewedCount,
    remainingCount,
  };
};
