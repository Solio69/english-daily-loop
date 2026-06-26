import assert from "node:assert/strict";
import test from "node:test";
import { getMoscowDate } from "../src/utils/moscowDate";

test("formats date using the Moscow calendar day", () => {
  assert.equal(
    getMoscowDate(new Date("2026-06-25T21:30:00.000Z")),
    "2026-06-26",
  );
});
