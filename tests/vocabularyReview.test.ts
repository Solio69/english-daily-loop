import assert from "node:assert/strict";
import test from "node:test";
import { getReviewActionOptions } from "../supabase/functions/_shared/vocabulary-review.ts";

test("new words start with the first three review intervals", () => {
  assert.deepEqual(getReviewActionOptions("not_started", null), [
    { action: "forgot", label: "Не помню" },
    { action: "same_step", label: "1 день" },
    { action: "next_step", label: "3 дня" },
    { action: "jump_step", label: "7 дней" },
  ]);
});

test("the last review step exposes learned outcomes", () => {
  assert.deepEqual(getReviewActionOptions("active", "6_months"), [
    { action: "forgot", label: "Не помню" },
    { action: "same_step", label: "6 месяцев" },
    { action: "next_step", label: "изучено" },
    { action: "jump_step", label: "изучено" },
  ]);
});
