import assert from 'node:assert/strict'
import test from 'node:test'

import { buildSafeAiDiagnostics } from '../supabase/functions/_shared/ai-diagnostics.ts'
import {
  DEFAULT_FALLBACK_MODEL,
  DEFAULT_PRIMARY_MODEL,
  OpenRouterError,
  requestOpenRouter,
} from '../supabase/functions/_shared/openrouter.ts'
import { generateReadingTextWithOpenRouter } from '../supabase/functions/generate-reading-text/ai-pipeline.ts'
import { generateVocabularyCardsBatch } from '../supabase/functions/prepare-vocabulary-cards/ai-pipeline.ts'
import { HTTP_STATUS } from './fixtures/http.ts'
import {
  OPENROUTER_SAFETY_MOCKS,
  OPENROUTER_SAFETY_REQUEST,
  OPENROUTER_SAFETY_RESPONSES,
} from './mocks/openrouterSafety.ts'

test('provider 429 is safe and causes no application retry for reading', async () => {
  const originalFetch = globalThis.fetch
  let calls = OPENROUTER_SAFETY_MOCKS.counter.initial
  globalThis.fetch = (async () => {
    calls += OPENROUTER_SAFETY_MOCKS.counter.increment
    return OPENROUTER_SAFETY_RESPONSES.rateLimited()
  }) as typeof fetch

  try {
    await assert.rejects(
      () =>
        generateReadingTextWithOpenRouter({
          apiKey: OPENROUTER_SAFETY_REQUEST.apiKey,
          models: OPENROUTER_SAFETY_REQUEST.models,
          targetLevel: OPENROUTER_SAFETY_MOCKS.targetLevel,
          readingMinutes: OPENROUTER_SAFETY_MOCKS.readingMinutes,
          config: OPENROUTER_SAFETY_MOCKS.readingConfig,
        }),
      (error: unknown) => {
        assert.ok(error instanceof Error)
        assert.doesNotMatch(
          error.message,
          OPENROUTER_SAFETY_MOCKS.secretPattern,
        )
        return true
      },
    )
    assert.equal(calls, OPENROUTER_SAFETY_MOCKS.counter.expected)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('provider 500 causes no application retry for vocabulary cards', async () => {
  const originalFetch = globalThis.fetch
  let calls = OPENROUTER_SAFETY_MOCKS.counter.initial
  globalThis.fetch = (async () => {
    calls += OPENROUTER_SAFETY_MOCKS.counter.increment
    return OPENROUTER_SAFETY_RESPONSES.serverError()
  }) as typeof fetch
  try {
    await assert.rejects(() =>
      generateVocabularyCardsBatch({
        apiKey: OPENROUTER_SAFETY_REQUEST.apiKey,
        models: OPENROUTER_SAFETY_REQUEST.models,
        words: [OPENROUTER_SAFETY_MOCKS.vocabularyWord],
        level: OPENROUTER_SAFETY_MOCKS.targetLevel,
      }),
    )
    assert.equal(calls, OPENROUTER_SAFETY_MOCKS.counter.expected)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('network failure and invalid provider JSON are safe and non-retryable', async () => {
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = (async () => {
      throw new Error(OPENROUTER_SAFETY_MOCKS.apiKey)
    }) as typeof fetch
    await assert.rejects(
      () => requestOpenRouter(OPENROUTER_SAFETY_REQUEST),
      (error: unknown) => {
        assert.ok(error instanceof OpenRouterError)
        assert.equal(error.retryableContent, false)
        assert.doesNotMatch(
          error.message,
          OPENROUTER_SAFETY_MOCKS.apiKeyPattern,
        )
        return true
      },
    )

    globalThis.fetch = (async () =>
      OPENROUTER_SAFETY_RESPONSES.invalidJson()) as typeof fetch
    await assert.rejects(
      () => requestOpenRouter(OPENROUTER_SAFETY_REQUEST),
      (error: unknown) => {
        assert.ok(error instanceof OpenRouterError)
        assert.equal(error.retryableContent, false)
        assert.equal(error.stage, OPENROUTER_SAFETY_MOCKS.providerResponseStage)
        return true
      },
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('transport timeout becomes a safe non-retryable error', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = ((_input, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener(
        OPENROUTER_SAFETY_MOCKS.abortEvent,
        () => {
          reject(
            new DOMException(
              OPENROUTER_SAFETY_MOCKS.apiKey,
              OPENROUTER_SAFETY_MOCKS.timeoutErrorName,
            ),
          )
        },
        { once: true },
      )
    })) as typeof fetch
  try {
    await assert.rejects(
      () =>
        requestOpenRouter({
          ...OPENROUTER_SAFETY_REQUEST,
          timeoutMs: OPENROUTER_SAFETY_MOCKS.timeoutMs,
        }),
      (error: unknown) => {
        assert.ok(error instanceof OpenRouterError)
        assert.equal(error.retryableContent, false)
        assert.doesNotMatch(
          error.message,
          OPENROUTER_SAFETY_MOCKS.apiKeyPattern,
        )
        return true
      },
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('invalid provider JSON does not retry across remaining models', async () => {
  const originalFetch = globalThis.fetch
  let calls = OPENROUTER_SAFETY_MOCKS.counter.initial
  globalThis.fetch = (async () => {
    calls += OPENROUTER_SAFETY_MOCKS.counter.increment
    return OPENROUTER_SAFETY_RESPONSES.invalidJson()
  }) as typeof fetch
  try {
    await assert.rejects(() =>
      generateReadingTextWithOpenRouter({
        apiKey: OPENROUTER_SAFETY_REQUEST.apiKey,
        models: [DEFAULT_PRIMARY_MODEL, DEFAULT_FALLBACK_MODEL],
        targetLevel: OPENROUTER_SAFETY_MOCKS.targetLevel,
        readingMinutes: OPENROUTER_SAFETY_MOCKS.readingMinutes,
        config: OPENROUTER_SAFETY_MOCKS.readingConfig,
      }),
    )
    assert.equal(calls, OPENROUTER_SAFETY_MOCKS.counter.expected)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('HTTP 200 with a provider error object does not retry', async () => {
  const originalFetch = globalThis.fetch
  let calls = OPENROUTER_SAFETY_MOCKS.counter.initial
  globalThis.fetch = (async () => {
    calls += OPENROUTER_SAFETY_MOCKS.counter.increment
    return OPENROUTER_SAFETY_RESPONSES.providerError()
  }) as typeof fetch
  try {
    await assert.rejects(
      () =>
        generateVocabularyCardsBatch({
          apiKey: OPENROUTER_SAFETY_REQUEST.apiKey,
          models: [DEFAULT_PRIMARY_MODEL, DEFAULT_FALLBACK_MODEL],
          words: [OPENROUTER_SAFETY_MOCKS.vocabularyWord],
          level: OPENROUTER_SAFETY_MOCKS.targetLevel,
        }),
      (error: unknown) => {
        assert.ok(error instanceof Error)
        assert.doesNotMatch(
          error.message,
          OPENROUTER_SAFETY_MOCKS.privatePromptPattern,
        )
        return true
      },
    )
    assert.equal(calls, OPENROUTER_SAFETY_MOCKS.counter.expected)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('client AI diagnostics expose only bounded metadata', () => {
  const diagnostics = buildSafeAiDiagnostics({
    functionName: OPENROUTER_SAFETY_MOCKS.functionName,
    requestId: OPENROUTER_SAFETY_MOCKS.requestId,
    promptVersion: OPENROUTER_SAFETY_MOCKS.promptVersion,
    modelChain: [DEFAULT_PRIMARY_MODEL],
    stage: OPENROUTER_SAFETY_MOCKS.providerResponseStage,
    durationMs: OPENROUTER_SAFETY_MOCKS.elapsedMs,
    metadata: {
      model: OPENROUTER_SAFETY_MOCKS.privatePrompt,
      finishReason: OPENROUTER_SAFETY_MOCKS.privatePrompt,
      providerErrorCode: OPENROUTER_SAFETY_MOCKS.apiKey,
      providerStatus: HTTP_STATUS.rateLimited,
    },
    details: OPENROUTER_SAFETY_MOCKS.diagnosticsDetails,
  })
  const serialized = JSON.stringify(diagnostics)
  assert.equal(diagnostics.providerStatus, HTTP_STATUS.rateLimited)
  assert.equal(diagnostics.model, null)
  assert.doesNotMatch(serialized, OPENROUTER_SAFETY_MOCKS.diagnosticLeakPattern)
})

test('vocabulary content retry stops when the shared 30-second budget is spent', async () => {
  const originalFetch = globalThis.fetch
  const originalNow = Date.now
  let elapsed: number = OPENROUTER_SAFETY_MOCKS.counter.initial
  let calls = OPENROUTER_SAFETY_MOCKS.counter.initial
  Date.now = () => elapsed
  globalThis.fetch = (async () => {
    calls += OPENROUTER_SAFETY_MOCKS.counter.increment
    elapsed = OPENROUTER_SAFETY_MOCKS.budgetExceededAtMs
    return OPENROUTER_SAFETY_RESPONSES.emptyContent()
  }) as typeof fetch

  try {
    await assert.rejects(
      () =>
        generateVocabularyCardsBatch({
          apiKey: OPENROUTER_SAFETY_REQUEST.apiKey,
          models: [DEFAULT_PRIMARY_MODEL, DEFAULT_FALLBACK_MODEL],
          words: [OPENROUTER_SAFETY_MOCKS.vocabularyWord],
          level: OPENROUTER_SAFETY_MOCKS.targetLevel,
        }),
      OPENROUTER_SAFETY_MOCKS.budgetErrorPattern,
    )
    assert.equal(calls, OPENROUTER_SAFETY_MOCKS.counter.expected)
  } finally {
    globalThis.fetch = originalFetch
    Date.now = originalNow
  }
})
