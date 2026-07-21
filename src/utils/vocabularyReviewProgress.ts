import type { VocabularyReviewStatus } from "../types/vocabulary";

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
  if (
    state.displayTotalCount !== null &&
    state.displayTotalCount !== undefined &&
    state.displayReviewedCount !== null &&
    state.displayReviewedCount !== undefined &&
    state.displayRemainingCount !== null &&
    state.displayRemainingCount !== undefined
  ) {
    return {
      totalCount: state.displayTotalCount,
      reviewedCount: state.displayReviewedCount,
      remainingCount: state.displayRemainingCount,
    };
  }

  const totalCount = state.requiredTotalCount;
  const remainingCount = state.remainingRequiredCount;
  const reviewedCount = Math.max(totalCount - remainingCount, 0);

  return {
    totalCount,
    reviewedCount,
    remainingCount,
  };
};

type VocabularyReviewProgressPresentationSource =
  VocabularyReviewProgressSource & {
    status: VocabularyReviewStatus;
  };

export const getVocabularyReviewProgressPresentation = (
  state: VocabularyReviewProgressPresentationSource,
) => ({
  ...getVocabularyReviewProgressCounts(state),
  isCompleted: state.status === "completed",
});
