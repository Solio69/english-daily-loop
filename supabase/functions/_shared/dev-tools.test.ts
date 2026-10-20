/// <reference path="../deno-globals.d.ts" />

import type { ServiceClient } from "./app.ts";
import { DEV_TOOL_ACTIONS, parseDevToolInput } from "./dev-tools-contract.ts";
import { executeDevToolAction } from "./dev-tools-actions.ts";
import {
  assertDevToolsEnabled,
  runAuthorizedDevToolAction,
} from "./dev-tools-flow.ts";
import { assertEquals, assertRejectsAppError } from "./test-support.ts";

const USER_ID = "mock-user-id";
const STUDY_DATE = "2026-10-20";
const SECRET_DB_MESSAGE = "private database detail";

const createClient = ({
  role = "admin",
  errorTable,
}: {
  role?: "admin" | "tester" | "user";
  errorTable?: string;
} = {}) => {
  const calls: string[] = [];
  const query = (table: string) => {
    const result = {
      count: 2,
      error: table === errorTable ? { message: SECRET_DB_MESSAGE } : null,
    };
    const chain = {
      eq: () => chain,
      maybeSingle: () =>
        Promise.resolve({ data: { app_role: role }, error: null }),
      then: (resolve: (value: typeof result) => unknown) =>
        Promise.resolve(result).then(resolve),
    };
    return {
      select: () => chain,
      delete: () => chain,
      update: () => chain,
    };
  };
  const client = {
    from: (table: string) => {
      calls.push(table);
      return query(table);
    },
    rpc: (name: string) => {
      calls.push(`rpc:${name}`);
      return Promise.resolve({
        data: {
          ok: true,
          reviewDate: STUDY_DATE,
          reviewStep: "1_day",
          nextReviewDate: "2026-10-21",
          processedCount: 2,
          reviewedTodayCount: 2,
        },
        error: null,
      });
    },
  };
  return { client: client as unknown as ServiceClient, calls };
};

Deno.test("disabled dev tools reject before a service client is needed", async () => {
  await assertRejectsAppError({
    action: () => assertDevToolsEnabled(undefined),
    expectedStatus: 403,
    expectedCode: "DEV_TOOLS_DISABLED",
  });
  await assertRejectsAppError({
    action: () => assertDevToolsEnabled("false"),
    expectedStatus: 403,
    expectedCode: "DEV_TOOLS_DISABLED",
  });
  assertDevToolsEnabled("true");
});

Deno.test("request contract rejects unknown actions and review steps", async () => {
  await assertRejectsAppError({
    action: () => parseDevToolInput({ action: "unknown" }),
    expectedStatus: 400,
    expectedCode: "INVALID_DEV_TOOL_ACTION",
  });
  await assertRejectsAppError({
    action: () =>
      parseDevToolInput({
        action: "complete_today_vocabulary_reviews_at_step",
        reviewStep: "unknown",
      }),
    expectedStatus: 400,
    expectedCode: "INVALID_REVIEW_STEP",
  });
  assertEquals({
    actual: parseDevToolInput({
      action: "reset_subscriptions",
      reviewStep: "ignored",
    }),
    expected: { action: "reset_subscriptions", reviewStep: null },
  });
});

Deno.test("tester and user are denied before any mutation", async () => {
  for (const role of ["tester", "user"] as const) {
    const { client, calls } = createClient({ role });
    await assertRejectsAppError({
      action: () =>
        runAuthorizedDevToolAction({
          supabase: client,
          userId: USER_ID,
          studyDate: STUDY_DATE,
          input: parseDevToolInput({ action: "reset_subscriptions" }),
        }),
      expectedStatus: 403,
      expectedCode: "DEV_TOOLS_ADMIN_REQUIRED",
    });
    assertEquals({ actual: calls, expected: ["users"] });
  }
});

Deno.test("admin role allows action after role lookup", async () => {
  const { client, calls } = createClient();
  await runAuthorizedDevToolAction({
    supabase: client,
    userId: USER_ID,
    studyDate: STUDY_DATE,
    input: parseDevToolInput({ action: "reset_subscriptions" }),
  });
  assertEquals({ actual: calls, expected: ["users", "user_subscriptions"] });
});

Deno.test("all eight action names route to their existing table or RPC", async () => {
  assertEquals({ actual: DEV_TOOL_ACTIONS.length, expected: 8 });
  const expectedRoutes = [
    ["reading_generation_attempts"],
    ["vocabulary_card_generation_attempts"],
    ["user_vocabulary_words"],
    ["user_vocabulary_words"],
    ["rpc:dev_complete_vocabulary_reviews_at_step"],
    ["user_daily_vocabulary_review_completions"],
    ["user_completed_reading_texts", "user_daily_reading_completions"],
    ["user_subscriptions"],
  ];
  for (const [index, action] of DEV_TOOL_ACTIONS.entries()) {
    const { client, calls } = createClient();
    await executeDevToolAction(
      client,
      USER_ID,
      STUDY_DATE,
      parseDevToolInput({ action, reviewStep: "1_day" }),
    );
    assertEquals({ actual: calls, expected: expectedRoutes[index] });
  }
});

Deno.test("database failures do not expose raw details in logs or error", async () => {
  const { client } = createClient({
    errorTable: "reading_generation_attempts",
  });
  const messages: string[] = [];
  const previous = console.error;
  console.error = (...args: unknown[]) => messages.push(JSON.stringify(args));
  try {
    await assertRejectsAppError({
      action: () =>
        executeDevToolAction(
          client,
          USER_ID,
          STUDY_DATE,
          parseDevToolInput({ action: "reset_generation_attempts" }),
        ),
      expectedStatus: 500,
      expectedCode: "DEV_TOOL_ACTION_FAILED",
    });
  } finally {
    console.error = previous;
  }
  assertEquals({
    actual: messages.some((line) => line.includes(SECRET_DB_MESSAGE)),
    expected: false,
  });
  assertEquals({
    actual: messages.some((line) => line.includes(USER_ID)),
    expected: false,
  });
});
