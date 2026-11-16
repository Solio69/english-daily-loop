import { DEFAULT_PRIMARY_MODEL } from '../../supabase/functions/_shared/openrouter.ts'
import { HTTP_STATUS } from '../fixtures/http.ts'

export const OPENROUTER_SAFETY_MOCKS = {
  apiKey: 'secret-synthetic-key',
  privatePrompt: 'private synthetic prompt',
  userRole: 'user',
  privateProviderMessage: 'private synthetic prompt secret-synthetic-key',
  rawPrivateMessage: 'raw private message',
  providerErrorCode: {
    rateLimited: 'rate_limit_exceeded',
    internal: 'internal_error',
  },
  providerResponseStage: 'provider_response',
  invalidJson: '{',
  emptyJsonObject: '{}',
  targetLevel: 'A1',
  vocabularyWord: { id: 'synthetic-id', word: 'apple' },
  functionName: 'prepare-vocabulary-cards',
  requestId: 'req_synthetic',
  promptVersion: 'vocabulary-card-v1',
  secretPattern: /private synthetic|secret-synthetic/,
  apiKeyPattern: /secret-synthetic/,
  privatePromptPattern: /private synthetic/,
  diagnosticLeakPattern:
    /private synthetic|secret-synthetic|errorMessage|problemWords|providerErrorCode/,
  timeoutErrorName: 'AbortError',
  abortEvent: 'abort',
  budgetErrorPattern: /общий лимит времени/,
  counter: { initial: 0, increment: 1, expected: 1 },
  timeoutMs: 5,
  requestTimeoutMs: 1000,
  temperature: 0.1,
  elapsedMs: 31_000,
  budgetExceededAtMs: 30_001,
  readingMinutes: 3,
  readingConfig: {
    wordMin: 3,
    wordMax: 5,
    validationWordMin: 2,
    validationWordMax: 6,
    maxTokens: 100,
  },
  diagnosticsDetails: { englishLevel: 'A1', requestedCount: 1, failedCount: 1 },
} as const

export const OPENROUTER_SAFETY_REQUEST = {
  apiKey: OPENROUTER_SAFETY_MOCKS.apiKey,
  models: [DEFAULT_PRIMARY_MODEL],
  messages: [
    {
      role: OPENROUTER_SAFETY_MOCKS.userRole,
      content: OPENROUTER_SAFETY_MOCKS.privatePrompt,
    },
  ],
  maxTokens: OPENROUTER_SAFETY_MOCKS.readingConfig.maxTokens,
  temperature: OPENROUTER_SAFETY_MOCKS.temperature,
  timeoutMs: OPENROUTER_SAFETY_MOCKS.requestTimeoutMs,
}

export const OPENROUTER_SAFETY_RESPONSES = {
  rateLimited: () =>
    new Response(
      JSON.stringify({
        error: {
          code: OPENROUTER_SAFETY_MOCKS.providerErrorCode.rateLimited,
          message: OPENROUTER_SAFETY_MOCKS.privateProviderMessage,
        },
      }),
      { status: HTTP_STATUS.rateLimited },
    ),
  serverError: () =>
    new Response(
      JSON.stringify({
        error: { message: OPENROUTER_SAFETY_MOCKS.rawPrivateMessage },
      }),
      { status: HTTP_STATUS.serverError },
    ),
  invalidJson: () =>
    new Response(OPENROUTER_SAFETY_MOCKS.invalidJson, {
      status: HTTP_STATUS.ok,
    }),
  providerError: () =>
    new Response(
      JSON.stringify({
        error: {
          code: OPENROUTER_SAFETY_MOCKS.providerErrorCode.internal,
          message: OPENROUTER_SAFETY_MOCKS.privatePrompt,
        },
      }),
      { status: HTTP_STATUS.ok },
    ),
  emptyContent: () =>
    new Response(
      JSON.stringify({
        model: DEFAULT_PRIMARY_MODEL,
        choices: [
          { message: { content: OPENROUTER_SAFETY_MOCKS.emptyJsonObject } },
        ],
      }),
      { status: HTTP_STATUS.ok },
    ),
}
