import assert from "node:assert/strict";
import test from "node:test";
import { getPostReadingCompletionMetrics } from "../supabase/functions/_shared/reading-completion-metrics.ts";

test("post-completion metrics do not reject an already completed mutation", async () => {
  const originalConsoleError = console.error;
  console.error = () => undefined;

  try {
    const supabase = {
      from(table: string) {
        if (table === "user_daily_reading_completions") {
          return {
            select() {
              return this;
            },
            eq() {
              return this;
            },
            lte() {
              return this;
            },
            async order() {
              return {
                data: null,
                error: { message: "temporary streak error" },
              };
            },
          };
        }

        return {
          select() {
            return this;
          },
          async eq() {
            return {
              count: null,
              error: { message: "temporary history error" },
            };
          },
        };
      },
    };

    const metrics = await getPostReadingCompletionMetrics(
      supabase as never,
      "user-123",
      "2026-07-22",
      "[test]",
    );

    assert.deepEqual(metrics, {
      streakDays: null,
      completedReadingTextCount: null,
    });
  } finally {
    console.error = originalConsoleError;
  }
});
