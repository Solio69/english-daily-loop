import assert from "node:assert/strict";
import test from "node:test";
import {
  getCompletedReadingTextLabel,
  getReviewProgressPresentation,
} from "../src/utils/homeProgressPresentation";

test("empty completed review day has a distinct label and completed state", () => {
  assert.deepEqual(
    getReviewProgressPresentation({
      status: "completed",
      dueCount: 0,
      reviewedTodayCount: 0,
    }),
    {
      state: "done",
      label: "Слов на повторение нет",
    },
  );
});

test("completed review with reviewed words keeps the regular completed label", () => {
  assert.deepEqual(
    getReviewProgressPresentation({
      status: "completed",
      dueCount: 0,
      reviewedTodayCount: 3,
    }),
    {
      state: "done",
      label: "Готово",
    },
  );
});

test("active review does not use the empty-day label", () => {
  assert.deepEqual(
    getReviewProgressPresentation({
      status: "in_progress",
      dueCount: 0,
      reviewedTodayCount: 0,
    }),
    {
      state: "in_progress",
      label: "В процессе",
    },
  );
});

test("completed reading counter uses Russian plural forms", () => {
  assert.equal(getCompletedReadingTextLabel(0), "Прочитано: 0 текстов");
  assert.equal(getCompletedReadingTextLabel(1), "Прочитано: 1 текст");
  assert.equal(getCompletedReadingTextLabel(2), "Прочитано: 2 текста");
  assert.equal(getCompletedReadingTextLabel(5), "Прочитано: 5 текстов");
  assert.equal(getCompletedReadingTextLabel(21), "Прочитано: 21 текст");
});

test("completed reading counter has a neutral fallback when unavailable", () => {
  assert.equal(getCompletedReadingTextLabel(null), "История чтения");
});
