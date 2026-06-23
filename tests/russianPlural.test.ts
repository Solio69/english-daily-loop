import assert from "node:assert/strict";
import test from "node:test";
import { getRussianPlural } from "../src/utils/russianPlural";

const WORD_FORMS = ["слово", "слова", "слов"] as const;

test("selects Russian plural forms including teen exceptions", () => {
  assert.equal(getRussianPlural(1, WORD_FORMS), "слово");
  assert.equal(getRussianPlural(2, WORD_FORMS), "слова");
  assert.equal(getRussianPlural(5, WORD_FORMS), "слов");
  assert.equal(getRussianPlural(11, WORD_FORMS), "слов");
  assert.equal(getRussianPlural(21, WORD_FORMS), "слово");
  assert.equal(getRussianPlural(24, WORD_FORMS), "слова");
});
