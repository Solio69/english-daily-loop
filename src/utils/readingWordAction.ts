export type ReadingWordAction = {
  word: string;
  index: number;
  mode: "add" | "remove";
};

export const resolveReadingWordAction = ({
  word,
  index,
  savedWordIndexes,
  pendingSavedWordIndexes,
}: {
  word: string;
  index: number;
  savedWordIndexes: ReadonlySet<number>;
  pendingSavedWordIndexes: ReadonlySet<number>;
}): ReadingWordAction | null => {
  if (!word) return null;

  if (savedWordIndexes.has(index)) {
    return pendingSavedWordIndexes.has(index)
      ? { word, index, mode: "remove" }
      : null;
  }

  return { word, index, mode: "add" };
};

export const removeWordIndexes = (
  currentIndexes: ReadonlySet<number>,
  removedIndexes: readonly number[],
): Set<number> => {
  const nextIndexes = new Set(currentIndexes);
  for (const index of removedIndexes) {
    nextIndexes.delete(index);
  }
  return nextIndexes;
};

export const shouldCloseStaleRemoveAction = ({
  errorCode,
  selectedIndex,
  refreshedSavedWordIndexes,
}: {
  errorCode: string | undefined;
  selectedIndex: number;
  refreshedSavedWordIndexes: ReadonlySet<number> | null;
}): boolean =>
  errorCode === "VOCABULARY_SOURCE_NOT_FOUND" &&
  refreshedSavedWordIndexes !== null &&
  !refreshedSavedWordIndexes.has(selectedIndex);
