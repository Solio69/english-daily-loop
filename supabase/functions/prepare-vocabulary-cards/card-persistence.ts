/// <reference path="../deno-globals.d.ts" />

import type { ServiceClient } from "../_shared/app.ts";
import type { VocabularyCardBatchItem } from "./ai-pipeline.ts";

export type CardSaveResult = {
  prepared: boolean;
  cancelled: boolean;
  merged: boolean;
  reactivated: boolean;
};

const failedSaveResult: CardSaveResult = {
  prepared: false,
  cancelled: false,
  merged: false,
  reactivated: false,
};

type PersistGeneratedCardRpcResult =
  | ({ ok: true } & CardSaveResult)
  | {
      ok: false;
      code: string;
      message: string;
    };

export const saveGeneratedCard = async (
  supabase: ServiceClient,
  userId: string,
  pendingWordId: string,
  card: VocabularyCardBatchItem,
): Promise<CardSaveResult> => {
  const { data, error } = await supabase.rpc(
    "persist_generated_vocabulary_card",
    {
      p_user_id: userId,
      p_pending_word_id: pendingWordId,
      p_word: card.word,
      p_translation: card.translation,
      p_part_of_speech: card.partOfSpeech,
      p_is_verb: card.isVerb,
      p_is_regular_verb: card.isRegularVerb,
      p_verb_forms: card.verbForms,
      p_examples: card.examples,
    },
  );

  if (error) {
    console.error("[prepare-vocabulary-cards] card persistence RPC failed", {
      appUserId: userId,
      wordId: pendingWordId,
      error: error.message,
    });
    return failedSaveResult;
  }

  const result = data as PersistGeneratedCardRpcResult | null;
  if (!result || !result.ok) {
    console.error("[prepare-vocabulary-cards] card persistence was rejected", {
      appUserId: userId,
      wordId: pendingWordId,
      code: result?.code ?? "EMPTY_PERSISTENCE_RESULT",
    });
    return failedSaveResult;
  }

  if (result.cancelled) {
    console.info("[prepare-vocabulary-cards] generated card target was cancelled", {
      appUserId: userId,
      wordId: pendingWordId,
    });
  }

  return {
    prepared: result.prepared,
    cancelled: result.cancelled,
    merged: result.merged,
    reactivated: result.reactivated,
  };
};
