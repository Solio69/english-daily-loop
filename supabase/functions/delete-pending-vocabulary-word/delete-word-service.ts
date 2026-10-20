import { fail, HTTP_STATUS } from '../_shared/server.ts'
import {
  DELETE_WORD_CODE,
  DELETE_WORD_ERROR,
  rejectDeleteWordResult,
} from './delete-word-contract.ts'
import type { DeleteWordRepository } from './delete-word-repository.ts'

export const deletePendingVocabularyWord = async ({
  userId,
  readingTextId,
  wordIndex,
  repository,
}: {
  userId: string
  readingTextId: string
  wordIndex: number
  repository: DeleteWordRepository
}) => {
  const activeTextId = await repository.loadActiveTextId(userId)
  if (activeTextId !== readingTextId) {
    fail(
      HTTP_STATUS.CONFLICT,
      DELETE_WORD_CODE.activeTextChanged,
      DELETE_WORD_ERROR.activeTextUnavailable,
    )
  }
  const result = await repository.delete({ userId, readingTextId, wordIndex })
  if (!result.ok) {
    return rejectDeleteWordResult(result)
  }
  return {
    removedWordIndexes: result.removedWordIndexes,
    removedSourceCount: result.removedSourceCount,
  }
}
