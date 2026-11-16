import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_FALLBACK_MODEL,
  DEFAULT_PRIMARY_MODEL,
  DEFAULT_READING_MODEL_CHAIN,
  DEFAULT_TERTIARY_MODEL,
  OPENROUTER_MODEL_ENV,
  OPENROUTER_MODEL_SEPARATOR,
  OpenRouterError,
  getConfiguredOpenRouterModelChain,
  getOpenRouterModelChain,
  requestOpenRouter,
} from '../supabase/functions/_shared/openrouter.ts'
import { generateReadingTextWithOpenRouter } from '../supabase/functions/generate-reading-text/ai-pipeline.ts'
import { HTTP_STATUS } from './fixtures/http.ts'
import { OPENROUTER_MOCKS, OPENROUTER_RESPONSES } from './mocks/openrouter.ts'

test('both AI features use the full model chain before positional overrides', () => {
  const configuredChain = OPENROUTER_MOCKS.readingModels.join(
    OPENROUTER_MODEL_SEPARATOR,
  )
  const env = new Map<string, string>([
    [OPENROUTER_MODEL_ENV.chain, configuredChain],
    [OPENROUTER_MODEL_ENV.primary, OPENROUTER_MOCKS.obsoleteModelOverride],
  ])

  assert.deepEqual(
    getConfiguredOpenRouterModelChain((name) => env.get(name) ?? null),
    OPENROUTER_MOCKS.readingModels,
  )
  assert.deepEqual(
    getConfiguredOpenRouterModelChain(() => null),
    OPENROUTER_MOCKS.readingModels,
  )
})

test('default OpenRouter base model chain contains three current unique models', () => {
  const models = getOpenRouterModelChain(
    DEFAULT_PRIMARY_MODEL,
    DEFAULT_FALLBACK_MODEL,
    DEFAULT_TERTIARY_MODEL,
  )
  assert.deepEqual(models, OPENROUTER_MOCKS.baseModels)
  assert.equal(models.length, OPENROUTER_MOCKS.modelLimit)
  assert.ok(
    models.every((model) => model.endsWith(OPENROUTER_MOCKS.freeModelSuffix)),
  )
  assert.equal(new Set(models).size, models.length)

  assert.throws(
    () => getOpenRouterModelChain(OPENROUTER_MOCKS.unsupportedModel),
    OPENROUTER_MOCKS.unsupportedModelPattern,
  )
  assert.throws(
    () =>
      getOpenRouterModelChain(...models, OPENROUTER_MOCKS.alternateFreeModel),
    OPENROUTER_MOCKS.modelLimitPattern,
  )
})

test('default reading generation model chain contains current unique models', () => {
  assert.deepEqual(
    getOpenRouterModelChain(...DEFAULT_READING_MODEL_CHAIN),
    OPENROUTER_MOCKS.readingModels,
  )
})

test('reading generation retries with fallback after empty provider content', async () => {
  const originalFetch = globalThis.fetch
  const originalConsoleError = console.error
  const requestBodies: Array<{
    models: string[]
    reasoning?: { enabled?: boolean }
    response_format?: { type?: string }
  }> = []

  console.error = () => undefined
  globalThis.fetch = (async (_input, init) => {
    requestBodies.push(JSON.parse(String(init?.body)))

    if (requestBodies.length === OPENROUTER_MOCKS.requestBodies.firstLength) {
      return OPENROUTER_RESPONSES.emptyContent()
    }

    return OPENROUTER_RESPONSES.fallbackContent()
  }) as typeof fetch

  try {
    const result = await generateReadingTextWithOpenRouter({
      apiKey: OPENROUTER_MOCKS.apiKey,
      models: [
        DEFAULT_PRIMARY_MODEL,
        DEFAULT_FALLBACK_MODEL,
        DEFAULT_TERTIARY_MODEL,
      ],
      targetLevel: OPENROUTER_MOCKS.targetLevel,
      readingMinutes: OPENROUTER_MOCKS.readingMinutes,
      config: OPENROUTER_MOCKS.readingConfig,
    })

    assert.equal(result.usedModel, DEFAULT_FALLBACK_MODEL)
    assert.equal(requestBodies.length, OPENROUTER_MOCKS.requestBodies.total)
    assert.deepEqual(
      requestBodies[OPENROUTER_MOCKS.requestBodies.firstIndex].models,
      [DEFAULT_PRIMARY_MODEL, DEFAULT_FALLBACK_MODEL, DEFAULT_TERTIARY_MODEL],
    )
    assert.deepEqual(
      requestBodies[OPENROUTER_MOCKS.requestBodies.secondIndex].models,
      [DEFAULT_FALLBACK_MODEL, DEFAULT_TERTIARY_MODEL],
    )
    assert.deepEqual(
      requestBodies[OPENROUTER_MOCKS.requestBodies.firstIndex].reasoning,
      OPENROUTER_MOCKS.expectedReasoning,
    )
    assert.deepEqual(
      requestBodies[OPENROUTER_MOCKS.requestBodies.secondIndex].reasoning,
      OPENROUTER_MOCKS.expectedReasoning,
    )
    assert.equal(
      requestBodies[OPENROUTER_MOCKS.requestBodies.firstIndex].response_format
        ?.type,
      OPENROUTER_MOCKS.responseFormatType,
    )
    assert.equal(
      requestBodies[OPENROUTER_MOCKS.requestBodies.secondIndex].response_format
        ?.type,
      OPENROUTER_MOCKS.responseFormatType,
    )
  } finally {
    globalThis.fetch = originalFetch
    console.error = originalConsoleError
  }
})

test('OpenRouter provider errors keep safe diagnostics', async () => {
  const originalFetch = globalThis.fetch
  const requestBodies: Array<{
    reasoning?: { enabled?: boolean }
    response_format?: { type?: string }
  }> = []

  globalThis.fetch = (async (_input, init) => {
    requestBodies.push(JSON.parse(String(init?.body)))

    return OPENROUTER_RESPONSES.rateLimited()
  }) as typeof fetch

  try {
    await assert.rejects(
      () =>
        requestOpenRouter({
          apiKey: OPENROUTER_MOCKS.apiKey,
          models: [DEFAULT_PRIMARY_MODEL],
          messages: [
            {
              role: OPENROUTER_MOCKS.providerRequest.role,
              content: OPENROUTER_MOCKS.providerRequest.content,
            },
          ],
          maxTokens: OPENROUTER_MOCKS.providerRequest.maxTokens,
          temperature: OPENROUTER_MOCKS.providerRequest.temperature,
          timeoutMs: OPENROUTER_MOCKS.providerRequest.timeoutMs,
        }),
      (error) => {
        assert.ok(error instanceof OpenRouterError)
        assert.equal(error.stage, OPENROUTER_MOCKS.providerStage)
        assert.equal(error.message, OPENROUTER_MOCKS.safeProviderMessage)
        assert.equal(error.providerStatus, HTTP_STATUS.rateLimited)
        assert.equal(
          error.providerErrorCode,
          OPENROUTER_MOCKS.rateLimitResponse.error.code,
        )
        return true
      },
    )

    assert.deepEqual(
      requestBodies[OPENROUTER_MOCKS.requestBodies.firstIndex].reasoning,
      OPENROUTER_MOCKS.expectedReasoning,
    )
    assert.equal(
      requestBodies[OPENROUTER_MOCKS.requestBodies.firstIndex].response_format
        ?.type,
      OPENROUTER_MOCKS.responseFormatType,
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})
