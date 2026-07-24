import assert from "node:assert/strict";
import test from "node:test";
import { formatReleaseDate } from "../src/utils/releasePresentation";

test("release date is formatted for Russian locale", () => {
  assert.match(formatReleaseDate("2026-07-24"), /24 июля 2026/);
});

test("invalid release date is presented safely", () => {
  assert.equal(formatReleaseDate(""), "Дата не указана");
  assert.equal(formatReleaseDate("not-a-date"), "not-a-date");
  assert.equal(formatReleaseDate("2026-02-30"), "2026-02-30");
});
