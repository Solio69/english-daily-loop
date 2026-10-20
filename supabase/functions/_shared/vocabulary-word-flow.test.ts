import assert from 'node:assert/strict'
import type { ServiceClient } from './app.ts'
import { parseDeleteWordInput } from '../delete-pending-vocabulary-word/delete-word-contract.ts'
import { createDeleteWordRepository } from '../delete-pending-vocabulary-word/delete-word-repository.ts'
import { deletePendingVocabularyWord } from '../delete-pending-vocabulary-word/delete-word-service.ts'
import { parseSaveWordInput } from '../save-vocabulary-word/save-word-contract.ts'
import { createSaveWordRepository } from '../save-vocabulary-word/save-word-repository.ts'
import { saveVocabularyWord } from '../save-vocabulary-word/save-word-service.ts'
import { AppError } from './server.ts'
import {
  WORD_FLOW,
  createDeleteWordHarness,
  createSaveWordHarness,
  deleteInput,
  saveInput,
  saveRpcInput,
} from './vocabulary-word-flow-test-mocks.ts'

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

Deno.test(
  'save input preserves numeric coercion while delete requires a number',
  async () => {
    const saved = parseSaveWordInput({
      readingTextId: WORD_FLOW.readingTextId,
      word: WORD_FLOW.word,
      wordIndex: WORD_FLOW.numericWordIndex,
    })
    assert.equal(saved.wordIndex, WORD_FLOW.wordIndex)
    await expectAppError({
      action: () =>
        parseDeleteWordInput({
          readingTextId: WORD_FLOW.readingTextId,
          wordIndex: WORD_FLOW.numericWordIndex,
        }),
      code: 'INVALID_WORD_INDEX',
      status: WORD_FLOW.expectedBadRequestStatus,
    })
  },
)

Deno.test(
  'save validates active text and selected token before quota or RPC',
  async () => {
    const { repository, calls } = createSaveWordHarness({
      loadActiveText: () =>
        Promise.resolve({
          reading_text_id: WORD_FLOW.otherTextId,
          body: WORD_FLOW.body,
        }),
    })
    await expectAppError({
      action: () => saveVocabularyWord({ ...saveInput, repository }),
      code: 'ACTIVE_TEXT_CHANGED',
      status: WORD_FLOW.expectedConflictStatus,
    })
    assert.equal(calls.limit, WORD_FLOW.noCalls)
    assert.equal(calls.save, WORD_FLOW.noCalls)
  },
)

Deno.test(
  'save rejects a word that does not match the active text',
  async () => {
    const { repository, calls } = createSaveWordHarness()
    await expectAppError({
      action: () =>
        saveVocabularyWord({
          ...saveInput,
          word: WORD_FLOW.badWord,
          repository,
        }),
      code: 'WORD_MISMATCH',
      status: WORD_FLOW.expectedBadRequestStatus,
    })
    assert.equal(calls.save, WORD_FLOW.noCalls)
  },
)

Deno.test('save rejects an index outside the active text', async () => {
  const { repository, calls } = createSaveWordHarness()
  await expectAppError({
    action: () =>
      saveVocabularyWord({
        ...saveInput,
        wordIndex: WORD_FLOW.badIndex,
        repository,
      }),
    code: 'INVALID_WORD_INDEX',
    status: WORD_FLOW.expectedBadRequestStatus,
  })
  assert.equal(calls.save, WORD_FLOW.noCalls)
})

Deno.test('save returns RPC action and keeps lookup order', async () => {
  const { repository, calls } = createSaveWordHarness()
  const result = await saveVocabularyWord({ ...saveInput, repository })
  assert.equal(result.action, WORD_FLOW.expectedSaveAction)
  assert.equal(result.wordId, WORD_FLOW.wordId)
  assert.equal(result.wordIndex, WORD_FLOW.wordIndex)
  assert.equal(calls.level, WORD_FLOW.oneCall)
  assert.equal(calls.limit, WORD_FLOW.oneCall)
  assert.equal(calls.save, WORD_FLOW.oneCall)
})

Deno.test(
  'save maps the RPC vocabulary limit to its existing public error',
  async () => {
    const { repository } = createSaveWordHarness({
      save: () =>
        Promise.resolve({
          ok: false,
          code: 'VOCABULARY_LIMIT_EXCEEDED',
          message: 'limit',
        } as const),
    })
    await expectAppError({
      action: () => saveVocabularyWord({ ...saveInput, repository }),
      code: 'VOCABULARY_LIMIT_EXCEEDED',
      status: WORD_FLOW.expectedLimitStatus,
    })
  },
)

Deno.test(
  'delete returns all indexes after pending word RPC succeeds',
  async () => {
    const { repository, calls } = createDeleteWordHarness()
    const result = await deletePendingVocabularyWord({
      ...deleteInput,
      repository,
    })
    assert.deepEqual(result.removedWordIndexes, WORD_FLOW.removedIndexes)
    assert.equal(result.removedSourceCount, WORD_FLOW.removedSourceCount)
    assert.equal(calls.deleted, WORD_FLOW.oneCall)
  },
)

Deno.test('delete never calls RPC after active text changes', async () => {
  const { repository, calls } = createDeleteWordHarness({
    loadActiveTextId: () => Promise.resolve(WORD_FLOW.otherTextId),
  })
  await expectAppError({
    action: () => deletePendingVocabularyWord({ ...deleteInput, repository }),
    code: 'ACTIVE_TEXT_CHANGED',
    status: WORD_FLOW.expectedConflictStatus,
  })
  assert.equal(calls.deleted, WORD_FLOW.noCalls)
})

Deno.test(
  'delete refuses a prepared card with the existing conflict code',
  async () => {
    const { repository } = createDeleteWordHarness({
      delete: () =>
        Promise.resolve({
          ok: false,
          code: WORD_FLOW.expectedDeleteCode,
          message: 'prepared',
        } as const),
    })
    await expectAppError({
      action: () => deletePendingVocabularyWord({ ...deleteInput, repository }),
      code: WORD_FLOW.expectedDeleteCode,
      status: WORD_FLOW.expectedConflictStatus,
    })
  },
)

Deno.test('save repository rejects a malformed RPC success', async () => {
  const client = {
    rpc: () => Promise.resolve({ data: { ok: true }, error: null }),
  } as unknown as ServiceClient
  await expectAppError({
    action: () => createSaveWordRepository(client).save(saveRpcInput),
    code: 'VOCABULARY_SAVE_FAILED',
    status: WORD_FLOW.expectedServerErrorStatus,
  })
})

Deno.test('delete repository rejects a malformed RPC success', async () => {
  const client = {
    rpc: () => Promise.resolve({ data: { ok: true }, error: null }),
  } as unknown as ServiceClient
  await expectAppError({
    action: () => createDeleteWordRepository(client).delete(deleteInput),
    code: 'VOCABULARY_DELETE_FAILED',
    status: WORD_FLOW.expectedServerErrorStatus,
  })
})
