import assert from "node:assert/strict";
import test from "node:test";
import { getMoscowStudyDate as getFrontendStudyDate } from "../src/utils/moscowStudyDate";
import { getMoscowStudyDate as getServerStudyDate } from "../supabase/functions/_shared/moscow-study-date.ts";

const cases = [
  {
    name: "keeps the calendar date before midnight",
    timestamp: "2026-06-25T20:59:59.000Z",
    expected: "2026-06-25",
  },
  {
    name: "keeps the previous study date at Moscow midnight",
    timestamp: "2026-06-25T21:00:00.000Z",
    expected: "2026-06-25",
  },
  {
    name: "keeps the previous study date at 04:59:59",
    timestamp: "2026-06-26T01:59:59.000Z",
    expected: "2026-06-25",
  },
  {
    name: "starts the new study date at 05:00:00",
    timestamp: "2026-06-26T02:00:00.000Z",
    expected: "2026-06-26",
  },
  {
    name: "crosses a month boundary before 05:00",
    timestamp: "2026-04-30T21:30:00.000Z",
    expected: "2026-04-30",
  },
  {
    name: "crosses a year boundary before 05:00",
    timestamp: "2025-12-31T22:59:59.000Z",
    expected: "2025-12-31",
  },
  {
    name: "keeps leap day before 05:00 on March 1",
    timestamp: "2028-02-29T22:59:59.000Z",
    expected: "2028-02-29",
  },
] as const;

for (const { name, timestamp, expected } of cases) {
  test(`frontend study date ${name}`, () => {
    assert.equal(getFrontendStudyDate(new Date(timestamp)), expected);
  });

  test(`server study date ${name}`, () => {
    assert.equal(getServerStudyDate(new Date(timestamp)), expected);
  });
}
