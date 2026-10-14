import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_FALLBACK_MODEL,
  DEFAULT_PRIMARY_MODEL,
  DEFAULT_READING_MODEL_CHAIN,
  DEFAULT_TERTIARY_MODEL,
  OpenRouterError,
  getOpenRouterModelChain,
  requestOpenRouter,
} from '../supabase/functions/_shared/openrouter.ts'
import { generateReadingTextWithOpenRouter } from '../supabase/functions/generate-reading-text/ai-pipeline.ts'

test('default OpenRouter base model chain contains three current unique models', () => {
  assert.deepEqual(
    getOpenRouterModelChain(
      DEFAULT_PRIMARY_MODEL,
      DEFAULT_FALLBACK_MODEL,
      DEFAULT_TERTIARY_MODEL,
    ),
    [
      'openai/gpt-oss-20b:free',
      'qwen/qwen3-next-80b-a3b-instruct:free',
      'google/gemma-4-26b-a4b-it:free',
    ],
  )

  assert.throws(
    () => getOpenRouterModelChain('qwen/qwen3.6-plus:free'),
    /Unsupported OpenRouter model/,
  )
})

test('default reading generation model chain contains current unique models', () => {
  assert.deepEqual(getOpenRouterModelChain(...DEFAULT_READING_MODEL_CHAIN), [
    'qwen/qwen3-next-80b-a3b-instruct:free',
    'nvidia/nemotron-nano-9b-v2:free',
    'google/gemma-4-31b-it:free',
    'google/gemma-4-26b-a4b-it:free',
    'openai/gpt-oss-20b:free',
  ])
})

test('reading generation retries with fallback after empty provider content', async () => {
  const originalFetch = globalThis.fetch
  const originalConsoleError = console.error
  const requestBodies: Array<{
    models: string[]
    reasoning?: { effort?: string; exclude?: boolean }
    response_format?: { type?: string }
  }> = []

  console.error = () => undefined
  globalThis.fetch = (async (_input, init) => {
    requestBodies.push(JSON.parse(String(init?.body)))

    if (requestBodies.length === 1) {
      return new Response(
        JSON.stringify({
          model: DEFAULT_PRIMARY_MODEL,
          choices: [
            {
              finish_reason: 'length',
              message: { content: '' },
            },
          ],
          usage: {
            completion_tokens: 450,
            completion_tokens_details: { reasoning_tokens: 450 },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }

    return new Response(
      JSON.stringify({
        model: DEFAULT_FALLBACK_MODEL,
        choices: [
          {
            finish_reason: 'stop',
            message: {
              content: JSON.stringify({
                title: 'A Small Story',
                body: 'One calm day begins.',
                estimatedMinutes: 3,
                level: 'A1',
              }),
            },
          },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }) as typeof fetch

  try {
    const result = await generateReadingTextWithOpenRouter({
      apiKey: 'test-key',
      models: [
        DEFAULT_PRIMARY_MODEL,
        DEFAULT_FALLBACK_MODEL,
        DEFAULT_TERTIARY_MODEL,
      ],
      targetLevel: 'A1',
      readingMinutes: 3,
      config: {
        wordMin: 3,
        wordMax: 5,
        validationWordMin: 2,
        validationWordMax: 6,
        maxTokens: 450,
      },
    })

    assert.equal(result.usedModel, DEFAULT_FALLBACK_MODEL)
    assert.equal(requestBodies.length, 2)
    assert.deepEqual(requestBodies[0].models, [
      DEFAULT_PRIMARY_MODEL,
      DEFAULT_FALLBACK_MODEL,
      DEFAULT_TERTIARY_MODEL,
    ])
    assert.deepEqual(requestBodies[1].models, [
      DEFAULT_FALLBACK_MODEL,
      DEFAULT_TERTIARY_MODEL,
    ])
    assert.deepEqual(requestBodies[0].reasoning, {
      effort: 'low',
      exclude: true,
    })
    assert.deepEqual(requestBodies[1].reasoning, {
      effort: 'low',
      exclude: true,
    })
    assert.equal(requestBodies[0].response_format?.type, 'json_object')
    assert.equal(requestBodies[1].response_format?.type, 'json_object')
  } finally {
    globalThis.fetch = originalFetch
    console.error = originalConsoleError
  }
})

test('OpenRouter provider errors keep safe diagnostics', async () => {
  const originalFetch = globalThis.fetch
  const requestBodies: Array<{
    reasoning?: { effort?: string; exclude?: boolean }
    response_format?: { type?: string }
  }> = []

  globalThis.fetch = (async (_input, init) => {
    requestBodies.push(JSON.parse(String(init?.body)))

    return new Response(
      JSON.stringify({
        error: {
          code: 'rate_limit_exceeded',
          message: 'Provider returned error',
        },
      }),
      { status: 429, headers: { 'Content-Type': 'application/json' } },
    )
  }) as typeof fetch

  try {
    await assert.rejects(
      () =>
        requestOpenRouter({
          apiKey: 'test-key',
          models: [DEFAULT_PRIMARY_MODEL],
          messages: [{ role: 'user', content: 'Return JSON.' }],
          maxTokens: 100,
          temperature: 0.1,
          timeoutMs: 1000,
        }),
      (error) => {
        assert.ok(error instanceof OpenRouterError)
        assert.equal(error.stage, 'provider_response')
        assert.equal(
          error.message,
          'AI-сервис временно недоступен. Попробуй еще раз позже.',
        )
        assert.equal(error.providerStatus, 429)
        assert.equal(error.providerErrorCode, 'rate_limit_exceeded')
        return true
      },
    )

    assert.deepEqual(requestBodies[0].reasoning, {
      effort: 'low',
      exclude: true,
    })
    assert.equal(requestBodies[0].response_format?.type, 'json_object')
  } finally {
    globalThis.fetch = originalFetch
  }
})
