/// <reference path="../deno-globals.d.ts" />

import type { ServiceClient } from "./app.ts";
import { fail } from "./server.ts";
import type {
  VocabularyReviewStatus,
  VocabularyReviewStep,
} from "./vocabulary-review.ts";

export type VocabularyReviewWordRow = {
  id: string;
  word: string;
  translation: string;
  part_of_speech: string;
  is_verb: boolean;
  is_regular_verb: boolean | null;
  verb_forms: {
    base?: string;
    past?: string;
    pastParticiple?: string;
  } | null;
  examples: string[];
  status: VocabularyReviewStatus;
  card_status: "ready";
  review_step: VocabularyReviewStep | null;
  next_review_date: string | null;
  last_reviewed_at: string | null;
  review_count: number;
  created_at: string;
  updated_at: string;
};

export type VocabularyReviewSnapshot = {
  reviewDate: string;
  status: "not_started" | "in_progress" | "completed";
  totalReadyCount: number;
  requiredTotalCount: number;
  reviewedTodayCount: number;
  remainingRequiredCount: number;
  newAvailableCount: number;
  extraAvailableCount: number;
  completedAt: string | null;
  dictionaryActions: {
    pendingCount: number;
    needsApprovalCount: number;
  };
  currentCard: VocabularyReviewWordRow | null;
  currentCardIsOptional: boolean;
};

export const loadVocabularyReviewSnapshot = async (
  supabase: ServiceClient,
  userId: string,
  reviewDate: string,
  logPrefix: string,
): Promise<VocabularyReviewSnapshot> => {
  const { data, error } = await supabase.rpc(
    "get_or_create_vocabulary_review_state",
    {
      p_user_id: userId,
      p_review_date: reviewDate,
    },
  );

  if (error) {
    console.error(`${logPrefix} failed to load vocabulary review snapshot`, {
      appUserId: userId,
      reviewDate,
      error: error.message,
    });
    fail(
      500,
      "VOCABULARY_REVIEW_STATE_LOAD_FAILED",
      "Failed to load vocabulary review state.",
    );
  }

  if (!data || typeof data !== "object") {
    console.error(`${logPrefix} received an invalid vocabulary review snapshot`, {
      appUserId: userId,
      reviewDate,
    });
    fail(
      500,
      "VOCABULARY_REVIEW_STATE_INVALID",
      "Vocabulary review state is invalid.",
    );
  }

  return data as VocabularyReviewSnapshot;
};
