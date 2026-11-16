import type { DeleteWordRepository } from '../delete-pending-vocabulary-word/delete-word-repository.ts'
import type { SaveWordRepository } from '../save-vocabulary-word/save-word-repository.ts'

export const WORD_FLOW = {
  userId: 'user-1',
  readingTextId: '123e4567-e89b-42d3-a456-426614174000',
  otherTextId: '123e4567-e89b-42d3-a456-426614174001',
  word: 'apple',
  body: 'An apple grows.',
  wordIndex: 1,
  numericWordIndex: '1',
  studyDate: '2026-10-20',
  vocabularyLimit: 100,
  wordId: 'word-1',
  removedIndexes: [1, 3],
  removedSourceCount: 2,
  badIndex: 10,
  badWord: 'pear',
  expectedSaveAction: 'created',
  expectedDeleteCode: 'VOCABULARY_CARD_ALREADY_PREPARED',
  expectedConflictStatus: 409,
  expectedBadRequestStatus: 400,
  expectedLimitStatus: 429,
  expectedServerErrorStatus: 500,
  noCalls: 0,
  oneCall: 1,
  callIncrement: 1,
} as const

export const saveInput = {
  userId: WORD_FLOW.userId,
  readingTextId: WORD_FLOW.readingTextId,
  word: WORD_FLOW.word,
  wordIndex: WORD_FLOW.wordIndex,
  studyDate: WORD_FLOW.studyDate,
}

export const deleteInput = {
  userId: WORD_FLOW.userId,
  readingTextId: WORD_FLOW.readingTextId,
  wordIndex: WORD_FLOW.wordIndex,
}

export const saveRpcInput = {
  ...saveInput,
  readingDate: WORD_FLOW.studyDate,
  originalWord: WORD_FLOW.word,
  vocabularyLimit: WORD_FLOW.vocabularyLimit,
}

export const createSaveWordHarness = (
  overrides: Partial<SaveWordRepository> = {},
) => {
  const calls = {
    level: WORD_FLOW.noCalls,
    limit: WORD_FLOW.noCalls,
    save: WORD_FLOW.noCalls,
  }
  const repository: SaveWordRepository = {
    loadActiveText: () =>
      Promise.resolve({
        reading_text_id: WORD_FLOW.readingTextId,
        body: WORD_FLOW.body,
      }),
    checkEnglishLevel: () => {
      calls.level += WORD_FLOW.callIncrement
      return Promise.resolve()
    },
    getVocabularyLimit: () => {
      calls.limit += WORD_FLOW.callIncrement
      return Promise.resolve(WORD_FLOW.vocabularyLimit)
    },
    save: () => {
      calls.save += WORD_FLOW.callIncrement
      return Promise.resolve({
        ok: true,
        action: WORD_FLOW.expectedSaveAction,
        wordId: WORD_FLOW.wordId,
        word: WORD_FLOW.word,
        status: 'not_started',
        cardStatus: 'pending',
      } as const)
    },
    ...overrides,
  }
  return { repository, calls }
}

export const createDeleteWordHarness = (
  overrides: Partial<DeleteWordRepository> = {},
) => {
  const calls = { deleted: WORD_FLOW.noCalls }
  const repository: DeleteWordRepository = {
    loadActiveTextId: () => Promise.resolve(WORD_FLOW.readingTextId),
    delete: () => {
      calls.deleted += WORD_FLOW.callIncrement
      return Promise.resolve({
        ok: true,
        removedWordIndexes: [...WORD_FLOW.removedIndexes],
        removedSourceCount: WORD_FLOW.removedSourceCount,
      } as const)
    },
    ...overrides,
  }
  return { repository, calls }
}
