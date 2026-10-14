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

const testRequest = {
  apiKey: 'secret-synthetic-key',
  models: [DEFAULT_PRIMARY_MODEL],
  messages: [{ role: 'user' as const, content: 'private synthetic prompt' }],
  maxTokens: 100,
  temperature: 0.1,
  timeoutMs: 1000,
}

test('provider 429 is safe and causes no application retry for reading', async () => {
  const originalFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = (async () => {
    calls += 1
    return new Response(
      JSON.stringify({
        error: {
          code: 'rate_limit_exceeded',
          message: 'private synthetic prompt secret-synthetic-key',
        },
      }),
      { status: 429 },
    )
  }) as typeof fetch

  try {
    await assert.rejects(
      () =>
        generateReadingTextWithOpenRouter({
          apiKey: testRequest.apiKey,
          models: testRequest.models,
          targetLevel: 'A1',
          readingMinutes: 3,
          config: {
            wordMin: 3,
            wordMax: 5,
            validationWordMin: 2,
            validationWordMax: 6,
            maxTokens: 100,
          },
        }),
      (error: unknown) => {
        assert.ok(error instanceof Error)
        assert.doesNotMatch(error.message, /private synthetic|secret-synthetic/)
        return true
      },
    )
    assert.equal(calls, 1)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('provider 500 causes no application retry for vocabulary cards', async () => {
  const originalFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = (async () => {
    calls += 1
    return new Response(
      JSON.stringify({ error: { message: 'raw private message' } }),
      { status: 500 },
    )
  }) as typeof fetch
  try {
    await assert.rejects(() =>
      generateVocabularyCardsBatch({
        apiKey: testRequest.apiKey,
        models: testRequest.models,
        words: [{ id: 'synthetic-id', word: 'apple' }],
        level: 'A1',
      }),
    )
    assert.equal(calls, 1)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('network failure and invalid provider JSON are safe and non-retryable', async () => {
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = (async () => {
      throw new Error('secret-synthetic-key')
    }) as typeof fetch
    await assert.rejects(
      () => requestOpenRouter(testRequest),
      (error: unknown) => {
        assert.ok(error instanceof OpenRouterError)
        assert.equal(error.retryableContent, false)
        assert.doesNotMatch(error.message, /secret-synthetic/)
        return true
      },
    )

    globalThis.fetch = (async () =>
      new Response('{', { status: 200 })) as typeof fetch
    await assert.rejects(
      () => requestOpenRouter(testRequest),
      (error: unknown) => {
        assert.ok(error instanceof OpenRouterError)
        assert.equal(error.retryableContent, false)
        assert.equal(error.stage, 'provider_response')
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
        'abort',
        () => {
          reject(new DOMException('secret-synthetic-key', 'AbortError'))
        },
        { once: true },
      )
    })) as typeof fetch
  try {
    await assert.rejects(
      () => requestOpenRouter({ ...testRequest, timeoutMs: 5 }),
      (error: unknown) => {
        assert.ok(error instanceof OpenRouterError)
        assert.equal(error.retryableContent, false)
        assert.doesNotMatch(error.message, /secret-synthetic/)
        return true
      },
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('invalid provider JSON does not retry across remaining models', async () => {
  const originalFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = (async () => {
    calls += 1
    return new Response('{', { status: 200 })
  }) as typeof fetch
  try {
    await assert.rejects(() =>
      generateReadingTextWithOpenRouter({
        apiKey: testRequest.apiKey,
        models: [DEFAULT_PRIMARY_MODEL, DEFAULT_FALLBACK_MODEL],
        targetLevel: 'A1',
        readingMinutes: 3,
        config: {
          wordMin: 3,
          wordMax: 5,
          validationWordMin: 2,
          validationWordMax: 6,
          maxTokens: 100,
        },
      }),
    )
    assert.equal(calls, 1)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('HTTP 200 with a provider error object does not retry', async () => {
  const originalFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = (async () => {
    calls += 1
    return new Response(
      JSON.stringify({
        error: { code: 'internal_error', message: 'private synthetic prompt' },
      }),
      { status: 200 },
    )
  }) as typeof fetch
  try {
    await assert.rejects(
      () =>
        generateVocabularyCardsBatch({
          apiKey: testRequest.apiKey,
          models: [DEFAULT_PRIMARY_MODEL, DEFAULT_FALLBACK_MODEL],
          words: [{ id: 'synthetic-id', word: 'apple' }],
          level: 'A1',
        }),
      (error: unknown) => {
        assert.ok(error instanceof Error)
        assert.doesNotMatch(error.message, /private synthetic/)
        return true
      },
    )
    assert.equal(calls, 1)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('client AI diagnostics expose only bounded metadata', () => {
  const diagnostics = buildSafeAiDiagnostics({
    functionName: 'prepare-vocabulary-cards',
    requestId: 'req_synthetic',
    promptVersion: 'vocabulary-card-v1',
    modelChain: [DEFAULT_PRIMARY_MODEL],
    stage: 'provider_response',
    durationMs: 31_000,
    metadata: {
      model: 'private synthetic prompt',
      finishReason: 'private synthetic prompt',
      providerErrorCode: 'secret-synthetic-key',
      providerStatus: 429,
    },
    details: { englishLevel: 'A1', requestedCount: 1, failedCount: 1 },
  })
  const serialized = JSON.stringify(diagnostics)
  assert.equal(diagnostics.providerStatus, 429)
  assert.equal(diagnostics.model, null)
  assert.doesNotMatch(
    serialized,
    /private synthetic|secret-synthetic|errorMessage|problemWords|providerErrorCode/,
  )
})

test('vocabulary content retry stops when the shared 30-second budget is spent', async () => {
  const originalFetch = globalThis.fetch
  const originalNow = Date.now
  let elapsed = 0
  let calls = 0
  Date.now = () => elapsed
  globalThis.fetch = (async () => {
    calls += 1
    elapsed = 30_001
    return new Response(
      JSON.stringify({
        model: DEFAULT_PRIMARY_MODEL,
        choices: [{ message: { content: '{}' } }],
      }),
      { status: 200 },
    )
  }) as typeof fetch

  try {
    await assert.rejects(
      () =>
        generateVocabularyCardsBatch({
          apiKey: testRequest.apiKey,
          models: [DEFAULT_PRIMARY_MODEL, DEFAULT_FALLBACK_MODEL],
          words: [{ id: 'synthetic-id', word: 'apple' }],
          level: 'A1',
        }),
      /общий лимит времени/,
    )
    assert.equal(calls, 1)
  } finally {
    globalThis.fetch = originalFetch
    Date.now = originalNow
  }
})
