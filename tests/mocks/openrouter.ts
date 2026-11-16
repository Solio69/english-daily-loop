import {
  DEFAULT_FALLBACK_MODEL,
  DEFAULT_PRIMARY_MODEL,
} from '../../supabase/functions/_shared/openrouter.ts'
import {
  HTTP_CONTENT_TYPE,
  HTTP_HEADER,
  HTTP_STATUS,
} from '../fixtures/http.ts'

const EXPECTED_FREE_MODELS = [
  'nvidia/nemotron-3-super-120b-a12b:free',
  'dots-studio/dots-3-note-preview:free',
  'nvidia/nemotron-3.5-super-vl:free',
] as const

export const OPENROUTER_MOCKS = {
  baseModels: EXPECTED_FREE_MODELS,
  readingModels: EXPECTED_FREE_MODELS,
  obsoleteModelOverride: 'openai/gpt-oss-20b:free',
  alternateFreeModel: 'google/gemma-4-26b-a4b-it:free',
  freeModelSuffix: ':free',
  modelLimit: 3,
  modelLimitPattern: /exceeds 3 models/,
  unsupportedModel: 'qwen/qwen3.6-plus:free',
  unsupportedModelPattern: /Unsupported OpenRouter model/,
  responseHeaders: { [HTTP_HEADER.contentType]: HTTP_CONTENT_TYPE.json },
  firstResponse: {
    model: DEFAULT_PRIMARY_MODEL,
    choices: [{ finish_reason: 'length', message: { content: '' } }],
    usage: {
      completion_tokens: 450,
      completion_tokens_details: { reasoning_tokens: 450 },
    },
  },
  secondResponse: {
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
  },
  rateLimitResponse: {
    error: { code: 'rate_limit_exceeded', message: 'Provider returned error' },
  },
  apiKey: 'test-key',
  targetLevel: 'A1',
  readingMinutes: 3,
  readingConfig: {
    wordMin: 3,
    wordMax: 5,
    validationWordMin: 2,
    validationWordMax: 6,
    maxTokens: 450,
  },
  providerRequest: {
    role: 'user',
    content: 'Return JSON.',
    maxTokens: 100,
    temperature: 0.1,
    timeoutMs: 1000,
  },
  expectedReasoning: { enabled: false },
  responseFormatType: 'json_object',
  providerStage: 'provider_response',
  safeProviderMessage: 'AI-сервис временно недоступен. Попробуй еще раз позже.',
  requestBodies: { firstIndex: 0, secondIndex: 1, firstLength: 1, total: 2 },
} as const

export const OPENROUTER_RESPONSES = {
  emptyContent: () =>
    Response.json(OPENROUTER_MOCKS.firstResponse, {
      status: HTTP_STATUS.ok,
      headers: OPENROUTER_MOCKS.responseHeaders,
    }),
  fallbackContent: () =>
    Response.json(OPENROUTER_MOCKS.secondResponse, {
      status: HTTP_STATUS.ok,
      headers: OPENROUTER_MOCKS.responseHeaders,
    }),
  rateLimited: () =>
    Response.json(OPENROUTER_MOCKS.rateLimitResponse, {
      status: HTTP_STATUS.rateLimited,
      headers: OPENROUTER_MOCKS.responseHeaders,
    }),
}
