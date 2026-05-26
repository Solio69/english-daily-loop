export type SaveVocabularyWordAction =
  | "created"
  | "reactivated"
  | "already_exists";

export type VocabularyWordStatus = "unlearned" | "learned";
export type VocabularyCardStatus = "pending" | "needs_approval" | "ready";

export type SaveVocabularyWordResult = {
  action: SaveVocabularyWordAction;
  wordId: string;
  word: string;
  originalWord: string;
  status: VocabularyWordStatus;
  cardStatus: VocabularyCardStatus;
  wordIndex: number;
};

export type VocabularyState = {
  pendingCount: number;
  needsApprovalCount: number;
  readyCount: number;
  totalCount: number;
};

export type PrepareVocabularyCardsResult = {
  preparedCount: number;
  failedCount: number;
  mergedCount: number;
  reactivatedCount: number;
  remainingPendingCount: number;
  needsApprovalCount: number;
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
  createdAt: string;
  updatedAt: string;
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
