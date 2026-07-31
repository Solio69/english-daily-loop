export type ReadingParagraphMeasurement = {
  index: number;
  top: number;
};

export const getReadingPositionRestoreKey = (
  readingTextId: string | null,
  paragraphIndex: number | null,
  isContentVisible: boolean,
): string | null => {
  if (!readingTextId || !isContentVisible) {
    return null;
  }

  return `${readingTextId}:${paragraphIndex ?? "top"}`;
};

export const getReachedReadingParagraphIndex = (
  measurements: ReadingParagraphMeasurement[],
  viewportTopOffset: number,
): number | null => {
  let reachedIndex: number | null = null;

  for (const measurement of [...measurements].sort(
    (left, right) => left.index - right.index,
  )) {
    if (measurement.top > viewportTopOffset) {
      break;
    }

    reachedIndex = measurement.index;
  }

  return reachedIndex;
};
