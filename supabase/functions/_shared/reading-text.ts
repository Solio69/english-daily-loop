export const splitReadingParagraphs = (value: string): string[] =>
  value
    .replace(/\r\n?/g, "\n")
    .split(/\n[ \t]*\n+/)
    .map((paragraph) =>
      paragraph.replace(/[ \t]*\n[ \t]*/g, " ").trim(),
    )
    .filter(Boolean);

export const getReadingParagraphCount = (value: string): number =>
  splitReadingParagraphs(value).length;
