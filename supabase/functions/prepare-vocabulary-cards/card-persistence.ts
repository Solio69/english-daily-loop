/// <reference path="../deno-globals.d.ts" />

import type { ServiceClient } from "../_shared/app.ts";
import { fail } from "../_shared/server.ts";
import type { VocabularyCardBatchItem } from "./ai-pipeline.ts";

type VocabularyWordRow = {
  id: string;
  word: string;
  status: "unlearned" | "learned";
  card_status: "pending" | "needs_approval" | "ready";
};

export type CardSaveResult = {
  prepared: boolean;
  merged: boolean;
  reactivated: boolean;
};

const failedSaveResult: CardSaveResult = {
  prepared: false,
  merged: false,
  reactivated: false,
};

const toCardUpdatePayload = (
  card: VocabularyCardBatchItem,
): Record<string, unknown> => ({
  word: card.word,
  translation: card.translation,
  part_of_speech: card.partOfSpeech,
  is_verb: card.isVerb,
  is_regular_verb: card.isRegularVerb,
  verb_forms: card.verbForms,
  examples: card.examples,
  card_status: "needs_approval",
});

const findExistingCanonicalWord = async (
  supabase: ServiceClient,
  userId: string,
  pendingWordId: string,
  canonicalWord: string,
): Promise<VocabularyWordRow | null> => {
  const { data, error } = await supabase
    .from("user_vocabulary_words")
    .select("id, word, status, card_status")
    .eq("user_id", userId)
    .neq("id", pendingWordId)
    .ilike("word", canonicalWord)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[prepare-vocabulary-cards] failed to find canonical word", {
      appUserId: userId,
      pendingWordId,
      canonicalWord,
      error: error.message,
    });
    fail(500, "VOCABULARY_CANONICAL_LOOKUP_FAILED", "Failed to save card.");
  }

  return (data as VocabularyWordRow | null) ?? null;
};

const updatePendingWordWithCard = async (
  supabase: ServiceClient,
  userId: string,
  pendingWordId: string,
  card: VocabularyCardBatchItem,
): Promise<CardSaveResult> => {
  const { error } = await supabase
    .from("user_vocabulary_words")
    .update(toCardUpdatePayload(card))
    .eq("id", pendingWordId)
    .eq("user_id", userId)
    .eq("card_status", "pending");

  if (error) {
    console.error("[prepare-vocabulary-cards] failed to save card", {
      appUserId: userId,
      wordId: pendingWordId,
      error: error.message,
    });
    return failedSaveResult;
  }

  return { prepared: true, merged: false, reactivated: false };
};

const mergePendingDuplicateIntoCanonicalWord = async (
  supabase: ServiceClient,
  userId: string,
  pendingWordId: string,
  existingWord: VocabularyWordRow,
  card: VocabularyCardBatchItem,
): Promise<CardSaveResult> => {
  const reactivated = existingWord.status === "learned";

  const existingUpdatePayload: Record<string, unknown> = {
    status: "unlearned",
    learned_at: null,
  };

  if (existingWord.card_status === "pending") {
    Object.assign(existingUpdatePayload, toCardUpdatePayload(card), {
      word: existingWord.word,
    });
  }

  const { error: existingUpdateError } = await supabase
    .from("user_vocabulary_words")
    .update(existingUpdatePayload)
    .eq("id", existingWord.id)
    .eq("user_id", userId);

  if (existingUpdateError) {
    console.error("[prepare-vocabulary-cards] failed to update canonical word", {
      appUserId: userId,
      pendingWordId,
      canonicalWordId: existingWord.id,
      error: existingUpdateError.message,
    });
    return failedSaveResult;
  }

  const { error: sourcesUpdateError } = await supabase
    .from("user_vocabulary_word_sources")
    .update({ word_id: existingWord.id })
    .eq("user_id", userId)
    .eq("word_id", pendingWordId);

  if (sourcesUpdateError) {
    console.error("[prepare-vocabulary-cards] failed to move word sources", {
      appUserId: userId,
      pendingWordId,
      canonicalWordId: existingWord.id,
      error: sourcesUpdateError.message,
    });
    return failedSaveResult;
  }

  const { error: deleteError } = await supabase
    .from("user_vocabulary_words")
    .delete()
    .eq("id", pendingWordId)
    .eq("user_id", userId)
    .eq("card_status", "pending");

  if (deleteError) {
    console.error("[prepare-vocabulary-cards] failed to delete merged pending word", {
      appUserId: userId,
      pendingWordId,
      canonicalWordId: existingWord.id,
      error: deleteError.message,
    });
    return failedSaveResult;
  }

  console.info("[prepare-vocabulary-cards] merged duplicate vocabulary word", {
    appUserId: userId,
    pendingWordId,
    canonicalWordId: existingWord.id,
    canonicalWord: existingWord.word,
    reactivated,
  });

  return { prepared: true, merged: true, reactivated };
};

export const saveGeneratedCard = async (
  supabase: ServiceClient,
  userId: string,
  pendingWordId: string,
  card: VocabularyCardBatchItem,
): Promise<CardSaveResult> => {
  const existingWord = await findExistingCanonicalWord(
    supabase,
    userId,
    pendingWordId,
    card.word,
  );

  if (existingWord) {
    // MVP path: this is a sequence of DB calls. A production hardening step
    // should move the merge into a single Postgres RPC transaction.
    return mergePendingDuplicateIntoCanonicalWord(
      supabase,
      userId,
      pendingWordId,
      existingWord,
      card,
    );
  }

  return updatePendingWordWithCard(supabase, userId, pendingWordId, card);
};
