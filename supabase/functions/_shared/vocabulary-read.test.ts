import assert from 'node:assert/strict'
import { AppError } from './server.ts'
import { loadVocabularyState } from '../get-vocabulary-state/vocabulary-state-repository.ts'
import { loadVocabularyWords } from '../get-vocabulary-words/vocabulary-words-repository.ts'
import {
  VOCABULARY_READ,
  createVocabularyReadClient,
} from './vocabulary-read-test-mocks.ts'

Deno.test(
  'vocabulary state returns own counts and generation state',
  async () => {
    const { client, calls } = createVocabularyReadClient()
    const result = await loadVocabularyState({
      supabase: client,
      userId: VOCABULARY_READ.userId,
      studyDate: () => VOCABULARY_READ.studyDate,
      loadGenerationState: () =>
        Promise.resolve({
          dailyLimit: VOCABULARY_READ.dailyLimit,
          usedAttempts: VOCABULARY_READ.usedAttempts,
          remainingAttempts: VOCABULARY_READ.remainingAttempts,
        }),
    })
    assert.equal(result.pendingCount, VOCABULARY_READ.pendingCount)
    assert.equal(result.needsApprovalCount, VOCABULARY_READ.approvalCount)
    assert.equal(result.readyCount, VOCABULARY_READ.readyCount)
    assert.equal(result.totalCount, VOCABULARY_READ.totalCount)
    assert.equal(calls.length, VOCABULARY_READ.countQueryCount)
    assert.equal(
      calls.every((call) => call.userId === VOCABULARY_READ.userId),
      true,
    )
  },
)

Deno.test(
  'vocabulary words keep sections, order and 50-item limit',
  async () => {
    const { client, calls } = createVocabularyReadClient()
    const result = await loadVocabularyWords({
      supabase: client,
      userId: VOCABULARY_READ.userId,
    })
    assert.equal(calls.length, VOCABULARY_READ.sectionCount)
    assert.equal(result.ready[0].id, VOCABULARY_READ.wordId)
    assert.equal(result.ready[0].translation, VOCABULARY_READ.translation)
    assert.equal(result.needsApproval.length, 0)
    for (const call of calls) {
      assert.equal(call.userId, VOCABULARY_READ.userId)
      assert.equal(call.limit, VOCABULARY_READ.maxItems)
      assert.deepEqual(call.order, [
        { column: 'updated_at', ascending: false },
        { column: 'id', ascending: false },
      ])
    }
  },
)

Deno.test('vocabulary words reject damaged database rows safely', async () => {
  const { client } = createVocabularyReadClient({ readyRows: [{}] })
  await assert.rejects(
    () =>
      loadVocabularyWords({
        supabase: client,
        userId: VOCABULARY_READ.userId,
      }),
    (error: unknown) =>
      error instanceof AppError &&
      error.code === 'VOCABULARY_WORDS_LOAD_FAILED',
  )
})
