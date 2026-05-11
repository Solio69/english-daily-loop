/// <reference path="../deno-globals.d.ts" />

export { normalizePlainText } from "./ai-text.ts";
import { normalizePlainText } from "./ai-text.ts";

export type EnglishLevel = "A1" | "A2" | "B1" | "B2";

export type VocabularyCardStatus = "pending" | "needs_approval" | "ready";

export type VocabularyCard = {
  word: string;
  translation: string;
  partOfSpeech: string;
  isVerb: boolean;
  isRegularVerb: boolean | null;
  verbForms: {
    base: string;
    past: string;
    pastParticiple: string;
  } | null;
  examples: string[];
  level: EnglishLevel;
};

export type VocabularyCardBatchItem = VocabularyCard & {
  id: string;
};

export const normalizeVocabularyWord = (value: string): string =>
  normalizePlainText(value)
    .toLowerCase()
    .replace(/^[^a-z]+/i, "")
    .replace(/[^a-z]+$/i, "");

export const parseEnglishLevel = (value: unknown): EnglishLevel | null => {
  if (value === "A1" || value === "A2" || value === "B1" || value === "B2") {
    return value;
  }

  return null;
};
