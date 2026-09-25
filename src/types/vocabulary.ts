export type SaveVocabularyWordAction =
  | "created"
  | "reactivated"
  | "already_exists";

export type VocabularyWordStatus = "not_started" | "active" | "learned";
export type VocabularyCardStatus = "pending" | "needs_approval" | "ready";
export type VocabularyReviewStep =
  | "1_day"
  | "3_days"
  | "7_days"
  | "14_days"
  | "1_month"
  | "2_months"
  | "3_months"
  | "4_months"
  | "5_months"
  | "6_months";
export type VocabularyReviewAction =
  | "forgot"
  | "same_step"
  | "next_step"
  | "jump_step";

export type VocabularyReviewActionOption = {
  action: VocabularyReviewAction;
  label: string;
};

export type SaveVocabularyWordResult = {
  action: SaveVocabularyWordAction;
  wordId: string;
  word: string;
  originalWord: string;
  status: VocabularyWordStatus;
  cardStatus: VocabularyCardStatus;
  wordIndex: number;
};

export type DeletePendingVocabularyWordResult = {
  removedWordIndexes: number[];
  removedSourceCount: number;
};

export type VocabularyCardGenerationState = {
  dailyLimit: number;
  usedAttempts: number;
  remainingAttempts: number;
};

export type VocabularyState = {
  pendingCount: number;
  needsApprovalCount: number;
  readyCount: number;
  totalCount: number;
  cardGeneration: VocabularyCardGenerationState;
};

export type PrepareVocabularyCardsResult = {
  preparedCount: number;
  failedCount: number;
  mergedCount: number;
  reactivatedCount: number;
  remainingPendingCount: number;
  needsApprovalCount: number;
  dailyLimit: number;
  usedAttempts: number;
  remainingAttempts: number;
};

export type VocabularyVerbForms = {
  base: string;
  past: string;
  pastParticiple: string;
};

export type VocabularyWordCard = {
  id: string;
  word: string;
  translation: string;
  partOfSpeech: string;
  isVerb: boolean;
  isRegularVerb: boolean | null;
  verbForms: VocabularyVerbForms | null;
  examples: string[];
  status: VocabularyWordStatus;
  cardStatus: Extract<VocabularyCardStatus, "needs_approval" | "ready">;
  reviewStep: VocabularyReviewStep | null;
  nextReviewDate: string | null;
  lastReviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type VocabularyReviewCard = VocabularyWordCard & {
  cardStatus: Extract<VocabularyCardStatus, "ready">;
  reviewCount: number;
  isOptional: boolean;
  actions: VocabularyReviewActionOption[];
};

export type VocabularyReviewStatus =
  | "not_started"
  | "in_progress"
  | "completed";

export type VocabularyReviewState = {
  reviewDate: string;
  status: VocabularyReviewStatus;
  totalReadyCount: number;
  requiredTotalCount: number;
  reviewedTodayCount: number;
  remainingRequiredCount: number;
  newAvailableCount: number;
  extraAvailableCount: number;
  displayTotalCount: number;
  displayReviewedCount: number;
  displayRemainingCount: number;
  completedAt: string | null;
  dictionaryActions: {
    pendingCount: number;
    needsApprovalCount: number;
  };
  currentCard: VocabularyReviewCard | null;
};

export type ReviewVocabularyWordResult = {
  reviewDate: string;
  wordId: string;
  word: string;
  status: VocabularyWordStatus;
  reviewStep: VocabularyReviewStep | null;
  nextReviewDate: string | null;
  learnedAt: string | null;
  wasRequired: boolean;
};

export type VocabularyWordsPage = {
  needsApproval: VocabularyWordCard[];
  ready: VocabularyWordCard[];
};

export type ApproveVocabularyCardResult = {
  wordId: string;
  word: string;
  status: VocabularyWordStatus;
  cardStatus: Extract<VocabularyCardStatus, "ready">;
};

export type ApproveVocabularyCardsResult = {
  approvedCount: number;
};
