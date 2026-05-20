import { VocabularyWordCard } from "../types/vocabulary";

export type HighlightedTextPart = {
  text: string;
  isHighlighted: boolean;
};

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const getVocabularyHighlightTokens = (
  word: VocabularyWordCard,
): string[] =>
  Array.from(
    new Set(
      [
        word.word,
        word.isVerb ? `${word.word}s` : null,
        word.verbForms?.base ?? null,
        word.verbForms?.past ?? null,
        word.verbForms?.pastParticiple ?? null,
      ]
        .filter((token): token is string => Boolean(token))
        .map((token) => token.toLowerCase()),
    ),
  ).sort((left, right) => right.length - left.length);

export const getHighlightedTextParts = (
  text: string,
  highlightTokens: string[],
): HighlightedTextPart[] => {
  if (highlightTokens.length === 0) {
    return [{ text, isHighlighted: false }];
  }

  const pattern = new RegExp(
    `(${highlightTokens.map(escapeRegExp).join("|")})`,
    "gi",
  );

  return text
    .split(pattern)
    .filter(Boolean)
    .map((part) => ({
      text: part,
      isHighlighted: highlightTokens.includes(part.toLowerCase()),
    }));
};
