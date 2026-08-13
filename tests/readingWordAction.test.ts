import assert from "node:assert/strict";
import test from "node:test";
import {
  removeWordIndexes,
  resolveReadingWordAction,
  shouldCloseStaleRemoveAction,
} from "../src/utils/readingWordAction";

test("unsaved word keeps the existing add action", () => {
  assert.deepEqual(
    resolveReadingWordAction({
      word: "practice",
      index: 4,
      savedWordIndexes: new Set(),
      pendingSavedWordIndexes: new Set(),
    }),
    { word: "practice", index: 4, mode: "add" },
  );
});

test("saved pending word resolves to the remove action", () => {
  assert.deepEqual(
    resolveReadingWordAction({
      word: "practice",
      index: 4,
      savedWordIndexes: new Set([4]),
      pendingSavedWordIndexes: new Set([4]),
    }),
    { word: "practice", index: 4, mode: "remove" },
  );
});

test("saved prepared word does not expose the destructive action", () => {
  assert.equal(
    resolveReadingWordAction({
      word: "practice",
      index: 4,
      savedWordIndexes: new Set([4]),
      pendingSavedWordIndexes: new Set(),
    }),
    null,
  );
});

test("successful deletion removes every returned source index", () => {
  const original = new Set([2, 4, 9, 12]);
  const updated = removeWordIndexes(original, [4, 12]);

  assert.deepEqual([...updated], [2, 9]);
  assert.deepEqual([...original], [2, 4, 9, 12]);
});

test("lost success response closes a stale remove action after refresh", () => {
  assert.equal(
    shouldCloseStaleRemoveAction({
      errorCode: "VOCABULARY_SOURCE_NOT_FOUND",
      selectedIndex: 4,
      refreshedSavedWordIndexes: new Set([2, 9]),
    }),
    true,
  );
  assert.equal(
    shouldCloseStaleRemoveAction({
      errorCode: "VOCABULARY_CARD_ALREADY_PREPARED",
      selectedIndex: 4,
      refreshedSavedWordIndexes: new Set([4]),
    }),
    false,
  );
});
