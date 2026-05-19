export type ReadingTextPart = {
  value: string;
  wordIndex: number | null;
  normalizedWord: string;
};

export type ReadingTextParagraph = {
  parts: ReadingTextPart[];
};

export const normalizeSelectableWord = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/^[^a-z]+/i, "")
    .replace(/[^a-z]+$/i, "");

const splitReadingParagraphs = (value: string): string[] =>
  value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);

export const parseReadingText = (value: string): ReadingTextParagraph[] => {
  let wordIndex = -1;

  return splitReadingParagraphs(value).map((paragraph) => ({
    parts: paragraph
      .split(/(\s+)/)
      .filter(Boolean)
      .map((part) => {
        if (/^\s+$/.test(part)) {
          return {
            value: part,
            wordIndex: null,
            normalizedWord: "",
          };
        }

        wordIndex += 1;

        return {
          value: part,
          wordIndex,
          normalizedWord: normalizeSelectableWord(part),
        };
      }),
  }));
};
