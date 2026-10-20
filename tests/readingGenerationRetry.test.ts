import assert from "node:assert/strict";
import test from "node:test";
import { EdgeFunctionError } from "../src/services/edgeFunctionErrors";
import { retryUnknownGenerationOutcome } from "../src/services/readingGenerationRetry";

const REQUEST_ID = "req_reading_generation_retry_test";
const RESULT = { textId: "reading-result" };
const ERROR_MESSAGE = "Ответ сервера не получен.";
const KNOWN_ERROR_CODE = "TEXT_GENERATION_FAILED";

test("unknown generation outcome retries the same request ID", async () => {
  const invokedIds: string[] = [];
  const responseSequence: (Error | typeof RESULT)[] = [
    new EdgeFunctionError({ message: ERROR_MESSAGE, requestId: REQUEST_ID }),
    RESULT,
  ];

  const result = await retryUnknownGenerationOutcome(REQUEST_ID, async (id) => {
    invokedIds.push(id);
    const response = responseSequence.shift();
    if (response instanceof Error) throw response;
    if (!response) throw new Error(ERROR_MESSAGE);
    return response;
  });

  assert.equal(result, RESULT);
  assert.deepEqual(invokedIds, [REQUEST_ID, REQUEST_ID]);
});

test("known generation failure does not trigger another request", async () => {
  const invokedIds: string[] = [];
  const failure = new EdgeFunctionError({
    message: ERROR_MESSAGE,
    code: KNOWN_ERROR_CODE,
    requestId: REQUEST_ID,
  });

  await assert.rejects(
    retryUnknownGenerationOutcome(REQUEST_ID, async (id) => {
      invokedIds.push(id);
      throw failure;
    }),
    failure,
  );

  assert.deepEqual(invokedIds, [REQUEST_ID]);
});
