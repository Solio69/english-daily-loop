/// <reference path="../deno-globals.d.ts" />

import type { ServiceClient } from "./app.ts";
import { getDailyVocabularyCardGenerationLimit as getAccessDailyVocabularyCardGenerationLimit } from "./access.ts";
import { OPENROUTER_PROVIDER } from "./openrouter.ts";
import { fail } from "./server.ts";

export type VocabularyCardGenerationState = {
  dailyLimit: number;
  usedAttempts: number;
  remainingAttempts: number;
};

export type VocabularyCardAttemptCounts = {
  requestedCount: number;
  preparedCount: number;
  failedCount: number;
  mergedCount: number;
  reactivatedCount: number;
};

export type ClaimedVocabularyCardGenerationAttempt = {
  attemptId: string;
  usedAttempts: number;
  remainingAttempts: number;
};

type ClaimVocabularyCardGenerationAttemptResult =
  | {
      ok: true;
      attemptId: string;
      usedAttempts: number;
      remainingAttempts: number;
    }
  | {
      ok: false;
      code: string;
      message: string;
      usedAttempts: number;
      remainingAttempts: number;
    };

const sanitizeAttemptErrorMessage = (message: string): string =>
  message
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);

export const getDailyVocabularyCardGenerationLimit = async (
  supabase: ServiceClient,
  userId: string,
  logPrefix: string,
): Promise<number> => {
  return await getAccessDailyVocabularyCardGenerationLimit(
    supabase,
    userId,
    logPrefix,
  );
};

export const getUsedVocabularyCardGenerationAttempts = async (
  supabase: ServiceClient,
  userId: string,
  attemptDate: string,
  logPrefix: string,
): Promise<number> => {
  const { count, error } = await supabase
    .from("vocabulary_card_generation_attempts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("attempt_date", attemptDate);

  if (error) {
    console.error(`${logPrefix} failed to count attempts`, {
      appUserId: userId,
      attemptDate,
      error: error.message,
    });
    fail(500, "ATTEMPT_COUNT_FAILED", "Failed to count generation attempts.");
  }

  return count ?? 0;
};

export const getVocabularyCardGenerationState = async (
  supabase: ServiceClient,
  userId: string,
  attemptDate: string,
  logPrefix: string,
): Promise<VocabularyCardGenerationState> => {
  const [dailyLimit, usedAttempts] = await Promise.all([
    getDailyVocabularyCardGenerationLimit(supabase, userId, logPrefix),
    getUsedVocabularyCardGenerationAttempts(
      supabase,
      userId,
      attemptDate,
      logPrefix,
    ),
  ]);

  return {
    dailyLimit,
    usedAttempts,
    remainingAttempts: Math.max(dailyLimit - usedAttempts, 0),
  };
};

export const claimVocabularyCardGenerationAttempt = async (
  supabase: ServiceClient,
  userId: string,
  attemptDate: string,
  dailyLimit: number,
  requestedCount: number,
  logPrefix: string,
): Promise<ClaimedVocabularyCardGenerationAttempt> => {
  const { data, error } = await supabase.rpc(
    "claim_vocabulary_card_generation_attempt",
    {
      p_user_id: userId,
      p_attempt_date: attemptDate,
      p_daily_limit: dailyLimit,
      p_requested_count: requestedCount,
      p_provider: OPENROUTER_PROVIDER,
    },
  );

  if (error) {
    console.error(`${logPrefix} failed to claim attempt`, {
      appUserId: userId,
      attemptDate,
      error: error.message,
    });
    fail(500, "ATTEMPT_CLAIM_FAILED", "Failed to save generation attempt.");
  }

  const result = data as ClaimVocabularyCardGenerationAttemptResult | null;
  if (!result) {
    return fail(500, "ATTEMPT_CLAIM_FAILED", "Empty attempt claim result.");
  }

  if (!result.ok) {
    return fail(
      result.code === "VOCABULARY_CARD_ATTEMPTS_EXHAUSTED" ? 429 : 500,
      result.code,
      result.message,
    );
  }

  return {
    attemptId: result.attemptId,
    usedAttempts: result.usedAttempts,
    remainingAttempts: result.remainingAttempts,
  };
};

export const updateVocabularyCardAttemptMetadata = async ({
  supabase,
  attemptId,
  userId,
  promptVersion,
  modelChain,
  logPrefix,
}: {
  supabase: ServiceClient;
  attemptId: string;
  userId: string;
  promptVersion: string;
  modelChain: string[];
  logPrefix: string;
}): Promise<void> => {
  const { error } = await supabase
    .from("vocabulary_card_generation_attempts")
    .update({
      prompt_version: promptVersion,
      model_chain: modelChain,
    })
    .eq("id", attemptId);

  if (error) {
    console.error(`${logPrefix} failed to update attempt metadata`, {
      appUserId: userId,
      attemptId,
      error: error.message,
    });
  }
};

export const markVocabularyCardAttemptSucceeded = async ({
  supabase,
  attemptId,
  userId,
  model,
  promptVersion,
  modelChain,
  counts,
  durationMs,
  logPrefix,
}: {
  supabase: ServiceClient;
  attemptId: string;
  userId: string;
  model: string | null;
  promptVersion: string;
  modelChain: string[];
  counts: VocabularyCardAttemptCounts;
  durationMs: number;
  logPrefix: string;
}): Promise<void> => {
  const { error } = await supabase
    .from("vocabulary_card_generation_attempts")
    .update({
      status: "succeeded",
      provider: OPENROUTER_PROVIDER,
      model,
      prompt_version: promptVersion,
      model_chain: modelChain,
      requested_count: counts.requestedCount,
      prepared_count: counts.preparedCount,
      failed_count: counts.failedCount,
      merged_count: counts.mergedCount,
      reactivated_count: counts.reactivatedCount,
      duration_ms: durationMs,
      error_code: null,
      error_message: null,
    })
    .eq("id", attemptId);

  if (error) {
    console.error(`${logPrefix} failed to update attempt`, {
      appUserId: userId,
      attemptId,
      error: error.message,
    });
  }
};

export const markVocabularyCardAttemptFailed = async ({
  supabase,
  attemptId,
  userId,
  promptVersion,
  modelChain,
  counts,
  durationMs,
  errorCode,
  errorMessage,
  logPrefix,
}: {
  supabase: ServiceClient;
  attemptId: string;
  userId?: string;
  promptVersion?: string;
  modelChain?: string[];
  counts?: VocabularyCardAttemptCounts;
  durationMs: number;
  errorCode: string;
  errorMessage: string;
  logPrefix: string;
}): Promise<void> => {
  const { error } = await supabase
    .from("vocabulary_card_generation_attempts")
    .update({
      status: "failed",
      ...(promptVersion ? { prompt_version: promptVersion } : {}),
      ...(modelChain ? { model_chain: modelChain } : {}),
      ...(counts
        ? {
            requested_count: counts.requestedCount,
            prepared_count: counts.preparedCount,
            failed_count: counts.failedCount,
            merged_count: counts.mergedCount,
            reactivated_count: counts.reactivatedCount,
          }
        : {}),
      duration_ms: durationMs,
      error_code: errorCode,
      error_message: sanitizeAttemptErrorMessage(errorMessage),
    })
    .eq("id", attemptId);

  if (error) {
    console.error(`${logPrefix} failed to mark attempt failed`, {
      ...(userId ? { appUserId: userId } : {}),
      attemptId,
      error: error.message,
    });
  }
};
