import assert from "node:assert/strict";
import test from "node:test";
import { getTelegramProfileUrl } from "../src/utils/telegramLinks";

test("builds Telegram profile URLs from valid usernames", () => {
  assert.equal(
    getTelegramProfileUrl("english_daily_loop"),
    "https://t.me/english_daily_loop",
  );
  assert.equal(
    getTelegramProfileUrl(" @EnglishDailyLoop_bot "),
    "https://t.me/EnglishDailyLoop_bot",
  );
});

test("ignores invalid Telegram usernames", () => {
  assert.equal(getTelegramProfileUrl(undefined), null);
  assert.equal(getTelegramProfileUrl(""), null);
  assert.equal(getTelegramProfileUrl("abcd"), null);
  assert.equal(getTelegramProfileUrl("has-dash"), null);
  assert.equal(getTelegramProfileUrl("https://t.me/user"), null);
});
