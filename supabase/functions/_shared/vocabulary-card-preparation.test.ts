import assert from 'node:assert/strict'
import type { ServiceClient } from './app.ts'
import { AppError } from './server.ts'
import { parseCardBatchJson } from '../prepare-vocabulary-cards/card-contract.ts'
import {
  buildCardBatchMessages,
  VOCABULARY_CARD_PROMPT_VERSION,
} from '../prepare-vocabulary-cards/card-prompt.ts'
import { saveGeneratedCard } from '../prepare-vocabulary-cards/card-persistence.ts'
import { prepareVocabularyCards } from '../prepare-vocabulary-cards/preparation-service.ts'
import {
  CARD_PREPARATION,
  CARD_PREPARATION_CARD,
  CARD_PREPARATION_WORDS,
  createCardPreparationHarness,
} from './vocabulary-card-preparation-test-mocks.ts'

const runPreparation = ({
  repository,
  generateBatch,
}: {
  repository: ReturnType<typeof createCardPreparationHarness>['repository']
  generateBatch: NonNullable<
    Parameters<typeof prepareVocabularyCards>[0]['generateBatch']
  >
}) =>
  prepareVocabularyCards({
    repository,
    userId: CARD_PREPARATION.userId,
    apiKey: CARD_PREPARATION.apiKey,
    models: [CARD_PREPARATION.model],
    requestId: CARD_PREPARATION.requestId,
    requestStartedAt: CARD_PREPARATION.startedAt,
    studyDate: () => CARD_PREPARATION.studyDate,
    generateBatch,
  })

Deno.test(
  'empty pending queue reads state without claiming or calling AI',
  async () => {
    const { repository, calls } = createCardPreparationHarness({
      loadPending: () => {
        calls.order.push('pending')
        return Promise.resolve([])
      },
    })
    const result = await runPreparation({
      repository,
      generateBatch: () => Promise.reject(new Error('Unexpected AI call')),
    })
    assert.equal(result.preparedCount, CARD_PREPARATION.zero)
    assert.equal(result.remainingPendingCount, CARD_PREPARATION.zero)
    assert.deepEqual(calls.order, ['level', 'pending', 'limit', 'state'])
  },
)

Deno.test(
  'mixed batch keeps valid cards and counts cancelled targets separately',
  async () => {
    const secondCard = {
      ...CARD_PREPARATION_CARD,
      id: CARD_PREPARATION.secondWordId,
      word: CARD_PREPARATION.secondWord,
    }
    const { repository, calls } = createCardPreparationHarness({
      saveCard: ({ pendingWordId }) => {
        calls.order.push('save')
        return Promise.resolve(
          pendingWordId === CARD_PREPARATION.secondWordId
            ? {
                prepared: false,
                cancelled: true,
                merged: false,
                reactivated: false,
              }
            : {
                prepared: true,
                cancelled: false,
                merged: true,
                reactivated: true,
              },
        )
      },
    })
    const result = await runPreparation({
      repository,
      generateBatch: () =>
        Promise.resolve({
          cards: [CARD_PREPARATION_CARD, secondCard],
          usedModel: CARD_PREPARATION.model,
        }),
    })
    assert.equal(result.preparedCount, CARD_PREPARATION.one)
    assert.equal(result.failedCount, CARD_PREPARATION.one)
    assert.equal(result.mergedCount, CARD_PREPARATION.one)
    assert.equal(result.reactivatedCount, CARD_PREPARATION.one)
    assert.deepEqual(calls.succeededCounts, {
      requestedCount: CARD_PREPARATION.three,
      preparedCount: CARD_PREPARATION.one,
      failedCount: CARD_PREPARATION.one,
      mergedCount: CARD_PREPARATION.one,
      reactivatedCount: CARD_PREPARATION.one,
    })
    assert.deepEqual(calls.order.slice(0, 5), [
      'level',
      'pending',
      'limit',
      'claim',
      'metadata',
    ])
    assert.equal(calls.order.at(-1), 'succeeded')
  },
)

Deno.test(
  'whole AI failure records failed attempt and returns safe counters',
  async () => {
    const { repository, calls } = createCardPreparationHarness()
    const previousError = console.error
    console.error = () => undefined
    try {
      const result = await runPreparation({
        repository,
        generateBatch: () =>
          Promise.reject(new Error(CARD_PREPARATION.providerFailure)),
      })
      assert.equal(result.preparedCount, CARD_PREPARATION.zero)
      assert.equal(result.failedCount, CARD_PREPARATION.three)
      assert.equal(calls.failedCounts?.failedCount, CARD_PREPARATION.three)
      assert.equal(calls.order.includes('succeeded'), false)
      assert.equal('diagnostics' in result, true)
    } finally {
      console.error = previousError
    }
  },
)

Deno.test(
  'daily claim failure stops before AI and keeps its public code',
  async () => {
    const { repository, calls } = createCardPreparationHarness({
      claim: () =>
        Promise.reject(
          new AppError(
            CARD_PREPARATION.exhaustedStatus,
            CARD_PREPARATION.exhaustedCode,
            'Daily limit reached.',
          ),
        ),
    })
    await assert.rejects(
      () =>
        runPreparation({
          repository,
          generateBatch: () => Promise.reject(new Error('Unexpected AI call')),
        }),
      (error: unknown) =>
        error instanceof AppError &&
        error.status === CARD_PREPARATION.exhaustedStatus &&
        error.code === CARD_PREPARATION.exhaustedCode,
    )
    assert.equal(calls.order.includes('metadata'), false)
    assert.equal(calls.order.includes('failed'), false)
  },
)

Deno.test('prompt keeps word UUIDs and current version', () => {
  const messages = buildCardBatchMessages(
    CARD_PREPARATION_WORDS,
    CARD_PREPARATION.level,
  )
  assert.equal(VOCABULARY_CARD_PROMPT_VERSION, 'vocabulary-card-v1')
  assert.match(messages[1].content, /word-id-1/)
  assert.match(messages[1].content, /word-id-2/)
})

Deno.test(
  'AI validation skips unknown and duplicated IDs, keeping valid cards',
  () => {
    const raw = JSON.stringify({
      cards: [
        CARD_PREPARATION_CARD,
        { ...CARD_PREPARATION_CARD, id: CARD_PREPARATION.unknownWordId },
        CARD_PREPARATION_CARD,
      ],
    })
    const previousWarn = console.warn
    console.warn = () => undefined
    try {
      const cards = parseCardBatchJson(
        raw,
        new Set(CARD_PREPARATION_WORDS.map((word) => word.id)),
        CARD_PREPARATION.level,
      )
      assert.equal(cards.length, CARD_PREPARATION.one)
      assert.equal(cards[0].id, CARD_PREPARATION.firstWordId)
    } finally {
      console.warn = previousWarn
    }
  },
)

Deno.test('persistence adapter rejects malformed RPC success', async () => {
  const client = {
    rpc: () => Promise.resolve({ data: { ok: true }, error: null }),
  } as unknown as ServiceClient
  const previousError = console.error
  console.error = () => undefined
  try {
    const result = await saveGeneratedCard({
      supabase: client,
      userId: CARD_PREPARATION.userId,
      pendingWordId: CARD_PREPARATION.firstWordId,
      card: CARD_PREPARATION_CARD,
    })
    assert.equal(result.prepared, false)
    assert.equal(result.cancelled, false)
  } finally {
    console.error = previousError
  }
})
