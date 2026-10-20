import { fail, HTTP_STATUS } from '../_shared/server.ts'
import { normalizeVocabularyWord } from '../_shared/vocabulary.ts'
import {
  rejectSaveWordResult,
  SAVE_WORD_CODE,
  SAVE_WORD_ERROR,
} from './save-word-contract.ts'
import type { SaveWordRepository } from './save-word-repository.ts'

const TOKEN_SEPARATOR = /\s+/

export const saveVocabularyWord = async ({
  userId,
  readingTextId,
  word,
  wordIndex,
  studyDate,
  repository,
}: {
  userId: string
  readingTextId: string
  word: string
  wordIndex: number
  studyDate: string
  repository: SaveWordRepository
}) => {
  const activeText = await repository.loadActiveText(userId)
  if (!activeText) {
    fail(
      HTTP_STATUS.CONFLICT,
      SAVE_WORD_CODE.noActiveText,
      SAVE_WORD_ERROR.activeTextUnavailable,
    )
  }
  if (activeText.reading_text_id !== readingTextId) {
    fail(
      HTTP_STATUS.CONFLICT,
      SAVE_WORD_CODE.activeTextChanged,
      SAVE_WORD_ERROR.activeTextUnavailable,
    )
  }

  const tokens = activeText.body.split(TOKEN_SEPARATOR).filter(Boolean)
  const tokenAtIndex = tokens[wordIndex]
  if (!tokenAtIndex) {
    fail(
      HTTP_STATUS.BAD_REQUEST,
      SAVE_WORD_CODE.invalidWordIndex,
      SAVE_WORD_ERROR.outsideText,
    )
  }
  if (normalizeVocabularyWord(tokenAtIndex) !== word) {
    fail(
      HTTP_STATUS.BAD_REQUEST,
      SAVE_WORD_CODE.wordMismatch,
      SAVE_WORD_ERROR.wordMismatch,
    )
  }

  await repository.checkEnglishLevel(userId)
  const vocabularyLimit = await repository.getVocabularyLimit(userId)
  const result = await repository.save({
    userId,
    word,
    readingTextId,
    readingDate: studyDate,
    wordIndex,
    originalWord: word,
    vocabularyLimit,
  })
  if (!result.ok) {
    return rejectSaveWordResult(result)
  }

  return {
    action: result.action,
    wordId: result.wordId,
    word: result.word,
    originalWord: word,
    status: result.status,
    cardStatus: result.cardStatus,
    wordIndex,
  }
}
