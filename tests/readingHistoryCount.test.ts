import assert from "node:assert/strict";
import test from "node:test";
import { getCompletedReadingTextCount } from "../supabase/functions/_shared/reading-history.ts";

test("completed reading count is scoped to the current user", async () => {
  const calls: Array<[string, unknown]> = [];
  const query = {
    select(columns: string, options: unknown) {
      calls.push(["select", { columns, options }]);
      return this;
    },
    async eq(column: string, value: string) {
      calls.push(["eq", { column, value }]);
      return { count: 24, error: null };
    },
  };
  const supabase = {
    from(table: string) {
      calls.push(["from", table]);
      return query;
    },
  };

  const count = await getCompletedReadingTextCount(
    supabase as never,
    "user-123",
    "[test]",
  );

  assert.equal(count, 24);
  assert.deepEqual(calls, [
    ["from", "user_completed_reading_texts"],
    [
      "select",
      { columns: "id", options: { count: "exact", head: true } },
    ],
    ["eq", { column: "user_id", value: "user-123" }],
  ]);
});

test("completed reading count returns null when the aggregate is unavailable", async () => {
  const originalConsoleError = console.error;
  console.error = () => undefined;

  try {
    const query = {
      select() {
        return this;
      },
      async eq() {
        return {
          count: null,
          error: { message: "temporary database error" },
        };
      },
    };
    const supabase = {
      from() {
        return query;
      },
    };

    const count = await getCompletedReadingTextCount(
      supabase as never,
      "user-123",
      "[test]",
    );

    assert.equal(count, null);
  } finally {
    console.error = originalConsoleError;
  }
});

test("completed reading count returns null when the request rejects", async () => {
  const originalConsoleError = console.error;
  console.error = () => undefined;

  try {
    const supabase = {
      from() {
        return {
          select() {
            return this;
          },
          async eq() {
            throw new Error("temporary network error");
          },
        };
      },
    };

    const count = await getCompletedReadingTextCount(
      supabase as never,
      "user-123",
      "[test]",
    );

    assert.equal(count, null);
  } finally {
    console.error = originalConsoleError;
  }
});
