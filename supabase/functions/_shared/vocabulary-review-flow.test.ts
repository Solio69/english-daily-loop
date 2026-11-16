import assert from 'node:assert/strict'
import type { ServiceClient } from './app.ts'
import { loadReviewState } from '../get-vocabulary-review-state/review-state-service.ts'
import { parseReviewWordInput } from '../review-vocabulary-word/review-word-contract.ts'
import { createReviewWordRepository } from '../review-vocabulary-word/review-word-repository.ts'
import { reviewVocabularyWord } from '../review-vocabulary-word/review-word-service.ts'
import { AppError } from './server.ts'
import { loadVocabularyReviewSnapshot } from './vocabulary-review-state.ts'
import {
  REVIEW_FLOW,
  createReviewStateHarness,
  createReviewWordHarness,
  emptyReviewSnapshot,
  reviewSnapshot,
  reviewSuccess,
} from './vocabulary-review-flow-test-mocks.ts'

const expectAppError = async ({
  action,
  code,
  status,
}: {
  action: () => unknown | Promise<unknown>
  code: string
  status: number
}) => {
  await assert.rejects(
    async () => await action(),
    (error: unknown) =>
      error instanceof AppError &&
      error.code === code &&
      error.status === status,
  )
}

Deno.test('review snapshot projects required card and actions', async () => {
  const { repository, calls } = createReviewStateHarness()
  const result = await loadReviewState({
    userId: REVIEW_FLOW.userId,
    repository,
    studyDate: () => REVIEW_FLOW.reviewDate,
  })
  assert.equal(calls.count, REVIEW_FLOW.oneCall)
  assert.equal(calls.reviewDate, REVIEW_FLOW.reviewDate)
  assert.equal(result.requiredTotalCount, REVIEW_FLOW.requiredTotal)
  assert.equal(result.extraAvailableCount, REVIEW_FLOW.optionalTotal)
  assert.equal(result.currentCard?.id, REVIEW_FLOW.wordId)
  assert.equal(result.currentCard?.isOptional, false)
  assert.deepEqual(
    result.currentCard?.actions.map(({ action }) => action),
    ['forgot', 'same_step', 'next_step', 'jump_step'],
  )
})

Deno.test(
  'review snapshot preserves optional card and empty completion',
  async () => {
    const optional = await loadReviewState({
      userId: REVIEW_FLOW.userId,
      repository: createReviewStateHarness({
        ...reviewSnapshot,
        currentCardIsOptional: true,
      }).repository,
      studyDate: () => REVIEW_FLOW.reviewDate,
    })
    assert.equal(optional.currentCard?.isOptional, true)

    const empty = await loadReviewState({
      userId: REVIEW_FLOW.userId,
      repository: createReviewStateHarness(emptyReviewSnapshot).repository,
      studyDate: () => REVIEW_FLOW.reviewDate,
    })
    assert.equal(empty.status, emptyReviewSnapshot.status)
    assert.equal(empty.completedAt, emptyReviewSnapshot.completedAt)
    assert.equal(empty.currentCard, null)
  },
)

Deno.test('review input rejects missing word and invalid action', async () => {
  await expectAppError({
    action: () =>
      parseReviewWordInput({
        wordId: REVIEW_FLOW.emptyWordId,
        action: 'forgot',
      }),
    code: REVIEW_FLOW.requiredWordCode,
    status: REVIEW_FLOW.expectedBadRequestStatus,
  })
  await expectAppError({
    action: () =>
      parseReviewWordInput({
        wordId: REVIEW_FLOW.wordId,
        action: REVIEW_FLOW.badAction,
      }),
    code: REVIEW_FLOW.invalidActionCode,
    status: REVIEW_FLOW.expectedBadRequestStatus,
  })
})

Deno.test(
  'review service passes action and returns SQL transition',
  async () => {
    const { repository, calls } = createReviewWordHarness()
    const result = await reviewVocabularyWord({
      userId: REVIEW_FLOW.userId,
      wordId: REVIEW_FLOW.wordId,
      action: 'next_step',
      repository,
      studyDate: () => REVIEW_FLOW.reviewDate,
    })
    assert.equal(calls.count, REVIEW_FLOW.oneCall)
    assert.equal(calls.reviewDate, REVIEW_FLOW.reviewDate)
    assert.equal(calls.action, 'next_step')
    assert.deepEqual(result, {
      reviewDate: reviewSuccess.reviewDate,
      wordId: reviewSuccess.wordId,
      word: reviewSuccess.word,
      status: reviewSuccess.status,
      reviewStep: reviewSuccess.reviewStep,
      nextReviewDate: reviewSuccess.nextReviewDate,
      learnedAt: reviewSuccess.learnedAt,
      wasRequired: reviewSuccess.wasRequired,
    })
  },
)

Deno.test(
  'review service preserves not found and conflict status',
  async () => {
    const cases = [
      {
        code: REVIEW_FLOW.missingWordCode,
        status: REVIEW_FLOW.expectedNotFoundStatus,
      },
      {
        code: REVIEW_FLOW.notReadyCode,
        status: REVIEW_FLOW.expectedConflictStatus,
      },
    ]
    for (const item of cases) {
      const { repository } = createReviewWordHarness({
        ok: false,
        code: item.code,
        message: item.code,
      })
      await expectAppError({
        action: () =>
          reviewVocabularyWord({
            userId: REVIEW_FLOW.userId,
            wordId: REVIEW_FLOW.wordId,
            action: 'forgot',
            repository,
            studyDate: () => REVIEW_FLOW.reviewDate,
          }),
        code: item.code,
        status: item.status,
      })
    }
  },
)

Deno.test('review RPC adapters reject malformed data safely', async () => {
  const invalidSnapshot = { ...reviewSnapshot, remainingRequiredCount: null }
  const stateClient = {
    rpc: () => Promise.resolve({ data: invalidSnapshot, error: null }),
  } as unknown as ServiceClient
  await expectAppError({
    action: () =>
      loadVocabularyReviewSnapshot(
        stateClient,
        REVIEW_FLOW.userId,
        REVIEW_FLOW.reviewDate,
        'review-test',
      ),
    code: REVIEW_FLOW.malformedCode,
    status: REVIEW_FLOW.expectedServerErrorStatus,
  })

  const wordClient = {
    rpc: () =>
      Promise.resolve({
        data: { ...reviewSuccess, reviewStep: 'bad' },
        error: null,
      }),
  } as unknown as ServiceClient
  await expectAppError({
    action: () =>
      createReviewWordRepository(wordClient).review({
        userId: REVIEW_FLOW.userId,
        wordId: REVIEW_FLOW.wordId,
        action: 'forgot',
        reviewDate: REVIEW_FLOW.reviewDate,
      }),
    code: REVIEW_FLOW.malformedReviewCode,
    status: REVIEW_FLOW.expectedServerErrorStatus,
  })
})
